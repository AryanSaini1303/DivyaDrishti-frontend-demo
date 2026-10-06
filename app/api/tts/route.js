// Streams synthesized speech back to the client. Proxies straight through to OpenAI
// rather than buffering the whole clip server-side, so playback can start as soon
// as the first bytes arrive.

export async function POST(req) {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
        return Response.json({ error: "Missing text" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return Response.json({ error: "OPENAI_API_KEY is not set on the server" }, { status: 500 });
    }

    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            voice: "ash", // deep, even-toned — starting point for a Jarvis-adjacent delivery, easy to swap
            input: text,
            instructions:
                "Speak in a calm, precise, faintly formal tone at a brisk, efficient pace — like a composed AI " +
                "assistant delivering a confident briefing without lingering. No excessive enthusiasm, no filler, " +
                "no unnecessary pauses between phrases.",
            speed: 1.25, // supported range is 0.25–4.0; nudge toward 1.25–1.3 if this still feels slow, but
            // higher values start sounding unnatural rather than just faster
            response_format: "mp3",
        }),
    });

    if (!upstream.ok) {
        const errBody = await upstream.text();
        return Response.json({ error: `TTS request failed: ${errBody}` }, { status: 502 });
    }

    return new Response(upstream.body, {
        headers: { "Content-Type": "audio/mpeg" },
    });
}