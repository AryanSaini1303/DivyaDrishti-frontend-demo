import { NextResponse } from "next/server";

// Mints a short-lived AssemblyAI streaming token on every request. The browser
// calls this route, gets back a temporary token, and opens its WebSocket to
// AssemblyAI directly — your real ASSEMBLYAI_API_KEY never leaves the server.

const EXPIRES_IN_SECONDS = 60;

export async function POST() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY is not set on the server" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${EXPIRES_IN_SECONDS}`,
      { headers: { Authorization: apiKey } } // raw key, no Bearer prefix
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `AssemblyAI token request failed: ${body}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mint AssemblyAI token" },
      { status: 500 }
    );
  }
}