"use client";

import { useCallback, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Splits on sentence-ending punctuation followed by whitespace or end-of-string.
// Requiring trailing whitespace after the punctuation is what stops this from
// false-splitting on things like "27.4%" (no space between the "." and the "4") —
// not bulletproof for every edge case (e.g. abbreviations), but good enough for
// TTS chunking, where an occasional over-eager split just means a smaller clip,
// not a broken one.
const SENTENCE_REGEX = /[^.!?]+[.!?]+(\s|$)/g;

export function useAskDivyaDrishti({ setCoreState }) {
    const [narrative, setNarrative] = useState("");
    const [currentSentence, setCurrentSentence] = useState("");
    const [chartHistory, setChartHistory] = useState([]); // accumulates across questions, capped
    const [sources, setSources] = useState([]);
    const [category, setCategory] = useState(null);
    const [error, setError] = useState(null);

    const sentenceBufferRef = useRef("");
    const playbackQueueRef = useRef([]); // [{ text, audioPromise }]
    const isPlayingRef = useRef(false);
    const streamDoneRef = useRef(false);
    const chartDataRef = useRef(null);
    const currentAudioRef = useRef(null);
    const chartIdRef = useRef(0);
    const conversationRef = useRef([]); // actual conversation history, built automatically per turn below

    const fetchTTS = useCallback(async (text) => {
        const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS request failed");
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }, []);

    const maybeFinish = useCallback(() => {
        if (playbackQueueRef.current.length === 0 && streamDoneRef.current) {
            setCurrentSentence("");
            setCoreState(chartDataRef.current ? "data" : "idle");
        }
    }, [setCoreState]);

    const playNext = useCallback(async () => {
        if (isPlayingRef.current) return;
        const item = playbackQueueRef.current[0];
        if (!item) return;

        isPlayingRef.current = true;
        setCoreState("speaking");
        setCurrentSentence(item.text);

        try {
            const audioUrl = await item.audioPromise;
            if (audioUrl) {
                await new Promise((resolve) => {
                    const audioEl = new Audio(audioUrl);
                    currentAudioRef.current = audioEl;
                    audioEl.onended = resolve;
                    audioEl.onerror = resolve; // don't get stuck if one clip fails — move on
                    audioEl.play().catch(resolve);
                });
                currentAudioRef.current = null;
                URL.revokeObjectURL(audioUrl);
            }
        } catch {
            // swallow — one bad clip shouldn't kill the rest of the answer
        }

        playbackQueueRef.current.shift();
        isPlayingRef.current = false;

        if (playbackQueueRef.current.length > 0) {
            playNext();
        } else {
            maybeFinish();
        }
    }, [setCoreState, maybeFinish]);

    const queueSentence = useCallback((sentence) => {
        const trimmed = sentence.trim();
        if (!trimmed) return;
        const audioPromise = fetchTTS(trimmed).catch(() => null); // fetch starts immediately, doesn't wait for playback
        playbackQueueRef.current.push({ text: trimmed, audioPromise });
        playNext();
    }, [fetchTTS, playNext]);

    const handleToken = useCallback((text) => {
        sentenceBufferRef.current += text;
        let match;
        let lastIndex = 0;
        SENTENCE_REGEX.lastIndex = 0;
        while ((match = SENTENCE_REGEX.exec(sentenceBufferRef.current)) !== null) {
            queueSentence(match[0]);
            lastIndex = SENTENCE_REGEX.lastIndex;
        }
        sentenceBufferRef.current = sentenceBufferRef.current.slice(lastIndex);
    }, [queueSentence]);

    const flushRemainingBuffer = useCallback(() => {
        if (sentenceBufferRef.current.trim()) {
            queueSentence(sentenceBufferRef.current);
            sentenceBufferRef.current = "";
        }
    }, [queueSentence]);

    const stopSpeaking = useCallback(() => {
        playbackQueueRef.current = [];
        streamDoneRef.current = true;
        setCurrentSentence("");
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }
        isPlayingRef.current = false;
        setCoreState("idle");
    }, [setCoreState]);

    const askQuestion = useCallback(async (question, industry) => {
        setError(null);
        setNarrative("");
        setCurrentSentence("");
        setChartHistory([]); // clear immediately — don't leave the previous answer's charts on screen
        setSources([]);
        setCategory(null);
        sentenceBufferRef.current = "";
        playbackQueueRef.current = [];
        streamDoneRef.current = false;
        chartDataRef.current = null;
        let fullAnswerText = ""; // accumulated locally so it can be recorded into history on "done", independent of React state timing

        if (!API_BASE_URL) {
            setError("NEXT_PUBLIC_API_BASE_URL is not set");
            setCoreState("idle");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/ask`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, conversation: conversationRef.current, origin: industry }),
            });

            if (!res.ok || !res.body) {
                throw new Error(`Backend returned ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const blocks = buffer.split("\n\n");
                buffer = blocks.pop(); // last chunk may be incomplete — keep it for the next read

                for (const block of blocks) {
                    if (!block.trim()) continue;
                    let event = null, data = null;
                    for (const line of block.split("\n")) {
                        if (line.startsWith("event: ")) event = line.slice(7).trim();
                        if (line.startsWith("data: ")) data = line.slice(6);
                    }
                    if (!event || data === null) continue;

                    const parsed = JSON.parse(data);

                    if (event === "meta") {
                        setCategory(parsed.category);
                        setSources(parsed.pages || []);
                    } else if (event === "token") {
                        fullAnswerText += parsed.text;
                        setNarrative((prev) => prev + parsed.text);
                        handleToken(parsed.text);
                    } else if (event === "chart_data") {
                        chartDataRef.current = parsed.chart_data; // per-question flag, used only for the idle/data decision below
                        if (parsed.chart_data) {
                            chartIdRef.current += 1;
                            const groupId = chartIdRef.current;
                            // Same underlying data, rendered as all three chart types at once —
                            // genuinely more to look at per answer, not just a toggle to click.
                            const variants = ["bar", "line", "pie"].map((t) => ({
                                ...parsed.chart_data,
                                chart_type: t,
                                id: `${groupId}-${t}`,
                            }));
                            setChartHistory(variants);
                        }
                    } else if (event === "done") {
                        flushRemainingBuffer();
                        streamDoneRef.current = true;
                        maybeFinish();
                        // Record this turn now that the answer is complete, so the *next*
                        // question actually has real history to resolve follow-ups against.
                        // Capped at the last 8 entries (4 exchanges) — this only ever feeds
                        // the cheap classifier call, not the narrative/chart generation, so
                        // the cost risk of letting it grow is low, but there's no reason to
                        // let it grow unbounded across a long session regardless.
                        conversationRef.current = [
                            ...conversationRef.current,
                            { role: "user", content: question },
                            { role: "assistant", content: fullAnswerText },
                        ].slice(-8);
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to get an answer");
            setCoreState("idle");
        }
    }, [handleToken, flushRemainingBuffer, maybeFinish, setCoreState]);

    return { askQuestion, stopSpeaking, narrative, currentSentence, chartHistory, sources, category, error };
}