# Divya Drishti — STT phase (Next.js, JavaScript, App Router)

A complete, runnable Next.js project. Unzip it, install, add your key, run.

STT runs on AssemblyAI's Universal-Streaming API (switched from Deepgram —
their console was unreliable at signup time).

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:
- `ASSEMBLYAI_API_KEY` — from assemblyai.com/dashboard.
- `OPENAI_API_KEY` — not used yet in this phase, but wire it in now so it's
  ready for the TTS/backend phase.

Then:

```bash
npm run dev
```

Open `http://localhost:3000`. Click "start listening", talk, stop talking —
the orb should shift from listening to thinking on its own once AssemblyAI's
end-of-turn detection fires. No manual stop button needed for that part.

## Project layout

```
app/
  layout.js              root layout, loads JetBrains Mono + Space Grotesk
  globals.css            reset
  page.js                wires the STT hook to the core component
  page.module.css         all page-level styling, CSS modules
  api/assemblyai-token/
    route.js              mints a 60s AssemblyAI streaming token per request
hooks/
  useAssemblyAISTT.js      mic capture (raw PCM16 via Web Audio API), WebSocket
                           streaming, end-of-turn detection
components/
  DivyaDrishtiCore.js      the visual core (3D wireframe + particles + 2D rings/veins)
  DivyaDrishtiCore.module.css
```

## Why this looks different from a Deepgram integration

AssemblyAI's streaming API expects raw PCM16 audio, not a container format
like the webm/opus that `MediaRecorder` produces. So capture goes through the
Web Audio API (`ScriptProcessorNode`) instead — reads raw audio samples,
converts them to 16-bit PCM by hand, sends them as binary WebSocket frames.
More code than the old `MediaRecorder` approach, but as a side effect it's
also more broadly compatible — this should work in Safari without the
compatibility gap the Deepgram version had.

Messages come back as `Turn` events instead of Deepgram's `Results` +
`UtteranceEnd` split: `{ type: "Turn", transcript: "...", end_of_turn: false }`
for the rolling live transcript, and `end_of_turn: true` on the same event
type once AssemblyAI's turn detection decides you're done talking — that's
the silence-detection signal driving the listening → thinking transition.

## What's here, what isn't

**Working:** mic capture, live interim transcript, AssemblyAI's end-of-turn
detection driving the listening → thinking transition automatically,
industry selector recoloring the core live.

**Not yet, on purpose:**
- No backend call. `onUtteranceComplete` in `app/page.js` just logs the
  transcript to console — that's the hook-up point for `/ask` next.
- Nothing resolves "thinking" back to "idle" yet, since there's no response
  coming back. You'll see it sit there — expected, not a bug.
- No TTS. The orb has a "speaking" and "data" state already built into
  `DivyaDrishtiCore.js`, just nothing driving them yet.

## If something's not working

- Test in Chrome first.
- If the WebSocket won't open, check `ASSEMBLYAI_API_KEY` is set and valid —
  the token route will return a 500 or 502 with the actual error message from
  AssemblyAI, worth checking the Network tab response body directly.
- If you get audio but no transcripts, double check the `sample_rate` being
  sent matches — it's read live from `audioContext.sampleRate`, so this
  should self-correct across devices, but worth confirming in the WebSocket
  URL if you're debugging.
