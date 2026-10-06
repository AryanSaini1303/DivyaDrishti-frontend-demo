"use client";

import { useEffect, useState } from "react";
import ChartBody from "./ChartBody";

export default function OrbitPanel({ chart, onClick }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 20); // next tick, so the transition actually plays
        return () => clearTimeout(t);
    }, []);

    return (
        <button
            onClick={onClick}
            style={{
                position: "relative",
                width: "100%",
                textAlign: "left",
                padding: "14px 16px 8px",
                border: "1px solid #1f5c3f",
                borderRadius: 2,
                background: "rgba(10,20,14,0.7)",
                backdropFilter: "blur(4px)",
                cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "scale(1)" : "scale(0.9)",
                transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    position: "absolute", top: -1, left: -1, width: 10, height: 10,
                    borderTop: "2px solid #4af2a1", borderLeft: "2px solid #4af2a1",
                }}
            />
            <span
                aria-hidden="true"
                style={{
                    position: "absolute", bottom: -1, right: -1, width: 10, height: 10,
                    borderBottom: "2px solid #4af2a1", borderRight: "2px solid #4af2a1",
                }}
            />
            <div style={{ color: "#4af2a1", fontFamily: "JetBrains Mono, monospace", fontSize: 11, marginBottom: 8 }}>
                {chart.title}
            </div>
            <ChartBody chart={chart} mini height={170} />
        </button>
    );
}