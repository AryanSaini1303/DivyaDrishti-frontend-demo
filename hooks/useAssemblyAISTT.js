"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// AssemblyAI's v3 streaming API expects raw PCM16 audio, not a container format
// like MediaRecorder produces — so capture goes through the Web Audio API instead
// this time. Using ScriptProcessorNode for broad compatibility (it's deprecated but
// still works everywhere, including Safari); AudioWorkletNode is the more modern
// approach and worth migrating to later if this needs to scale.

const TOKEN_FRESH_MS = 50000; // treat a cached token as usable for 50s (server TTL is 60s)

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0, offset = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function useAssemblyAISTT({ onUtteranceComplete } = {}) {
  const [state, setState] = useState("idle"); // "idle" | "listening" | "thinking"
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const tokenCacheRef = useRef({ token: null, fetchedAt: 0 });

  const fetchToken = useCallback(async () => {
    const res = await fetch("/api/assemblyai-token", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to fetch AssemblyAI token");
    }
    const { token } = await res.json();
    tokenCacheRef.current = { token, fetchedAt: Date.now() };
    return token;
  }, []);

  const getToken = useCallback(async () => {
    const { token, fetchedAt } = tokenCacheRef.current;
    if (token && Date.now() - fetchedAt < TOKEN_FRESH_MS) return token;
    return fetchToken();
  }, [fetchToken]);

  // warm the cache as soon as the component mounts, so the *first* click is fast too
  useEffect(() => {
    fetchToken().catch(() => { }); // silent — startListening will retry if this failed
  }, [fetchToken]);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
    socketRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    cleanup();
    setState("idle");
    setInterimTranscript("");
  }, [cleanup]);

  const startListening = useCallback(async () => {
    setError(null);

    // Kicked off immediately, before anything else — this is what actually cuts
    // initiation time. getUserMedia (mic permission) and the token fetch + WebSocket
    // handshake are independent of each other; running them concurrently means total
    // startup time is roughly max(micPermission, tokenAndHandshake) instead of the
    // sum of both, which is what the old sequential await chain cost us.
    const streamPromise = navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        // Deliberately off: AGC continuously boosts quiet audio toward a target
        // loudness, which means it can amplify background noise *up toward* our
        // gate's threshold during quiet moments — actively working against the
        // noise gate below rather than helping it.
        autoGainControl: false,
      },
    });
    streamPromise.catch(() => { }); // silences a stray unhandled-rejection warning if this
    // rejects before onopen gets a chance to await it below — the real handling still
    // happens there; a promise can have more than one handler attached to it

    try {
      const token = await getToken();

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      const sampleRate = audioContext.sampleRate; // declare the device's actual rate to AssemblyAI below

      const params = new URLSearchParams({
        sample_rate: String(sampleRate),
        encoding: "pcm_s16le",
        format_turns: "true",
        // AssemblyAI's officially documented "Fast" preset — tuned for quick
        // back-and-forth voice interaction. We were previously sending none of
        // these, which meant running on their defaults (400ms / 1280ms), closer
        // to a "Balanced" customer-support-call preset than a snappy assistant.
        end_of_turn_confidence_threshold: "0.7",
        min_end_of_turn_silence_when_confident: "160",
        max_turn_silence: "400",
        token,
      });

      const socket = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params.toString()}`);
      socketRef.current = socket;

      socket.onopen = async () => {
        let stream;
        try {
          stream = await streamPromise; // very likely already resolved by now, having run in parallel above
        } catch (err) {
          setError(err instanceof Error ? err.message : "Microphone permission denied");
          cleanup();
          setState("idle");
          return;
        }
        streamRef.current = stream;

        setState("listening");
        fetchToken().catch(() => { }); // warm the cache for next time, don't block on it

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Noise gate that calibrates itself instead of relying on one fixed
        // number: the first CALIBRATION_CHUNKS of audio measure your actual
        // ambient noise level, then the gate threshold is set to a multiple of
        // that — adapts to whatever room/mic you're actually in, rather than a
        // magic constant that only happens to work in one environment. Small
        // cost: audio during that brief calibration window isn't sent, so
        // speaking in the very first ~500ms after clicking "start listening"
        // could clip — in practice mic/connection setup usually eats that time
        // anyway.
        const CALIBRATION_CHUNKS = 6; // ~500-560ms at typical sample rates, given the 4096-sample buffer
        const THRESHOLD_MULTIPLIER = 3; // gate threshold = measured ambient RMS × this
        const MIN_THRESHOLD = 0.01; // floor so a near-silent room doesn't set an impossibly touchy threshold
        const HANGOVER_CHUNKS = 4; // ~340-370ms — keeps sending briefly after volume drops so trailing syllables aren't cut

        let calibrationSamples = [];
        let calibrating = true;
        let noiseGateThreshold = 0.02; // used only during the brief calibration window itself
        let hangoverCounter = 0;
        const silentChunk = floatTo16BitPCM(new Float32Array(4096)); // reused whenever the gate is "closed"

        processor.onaudioprocess = (event) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const input = event.inputBuffer.getChannelData(0);

          let sumSquares = 0;
          for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
          const rms = Math.sqrt(sumSquares / input.length);

          if (calibrating) {
            calibrationSamples.push(rms);
            if (calibrationSamples.length >= CALIBRATION_CHUNKS) {
              const avgAmbient = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
              noiseGateThreshold = Math.max(avgAmbient * THRESHOLD_MULTIPLIER, MIN_THRESHOLD);
              calibrating = false;
            }
            socket.send(floatTo16BitPCM(input)); // send real audio during calibration too — no threshold decided yet
            return;
          }

          if (rms > noiseGateThreshold) {
            hangoverCounter = HANGOVER_CHUNKS;
          }

          if (hangoverCounter > 0) {
            hangoverCounter--;
            socket.send(floatTo16BitPCM(input));
          } else {
            // Below threshold: send actual silence rather than skipping the send
            // entirely. AssemblyAI's end-of-turn timers measure silence *within*
            // a continuous stream — stop sending packets altogether and it has no
            // way to observe that silence at all, which is exactly what was
            // making the session never end.
            socket.send(silentChunk);
          }
        };

        source.connect(processor);
        // connecting to destination keeps the processing graph alive in some
        // browsers; output stays silent since we never write to the output buffer
        processor.connect(audioContext.destination);
      };

      socket.onmessage = (message) => {
        const data = JSON.parse(message.data);

        if (data.type === "Turn") {
          setInterimTranscript(data.transcript || "");

          if (data.end_of_turn) {
            const finalTranscript = (data.transcript || "").trim();
            if (finalTranscript) {
              setState("thinking");
              onUtteranceComplete?.(finalTranscript);
            }
            cleanup();
          }
        }
      };

      socket.onerror = () => {
        setError("AssemblyAI connection error");
        cleanup();
        setState("idle");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start listening");
      // streamRef only gets set inside onopen — if we failed before that point,
      // the stream could still resolve later and leak an active mic. Stop it
      // defensively whenever it does land.
      streamPromise.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => { });
      cleanup();
      setState("idle");
    }
  }, [cleanup, getToken, fetchToken, onUtteranceComplete]);

  return {
    state,
    setState, // exposed so the caller can flip to "thinking" -> back to "idle" once the backend responds
    interimTranscript,
    error,
    startListening,
    stopListening,
  };
}