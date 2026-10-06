"use client";

import { useEffect, useState } from "react";
import ChartBody from "./ChartBody";

export default function OrbitChartThumb({ chart, index, total, onClick }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 20); // next tick, so the transition actually plays
        return () => clearTimeout(t);
    }, []);

    // The field this renders inside is enforced square (vmin-based), so percentage
    // math here produces a true circle on screen — no ellipse distortion regardless
    // of viewport aspect ratio.
    const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2; // start at 12 o'clock
    const radiusPercent = 46;
    const x = 50 + radiusPercent * Math.cos(angle);
    const y = 50 + radiusPercent * Math.sin(angle);

    return (
        <button
            onClick={onClick}
            style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: visible ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.5)",
                opacity: visible ? 1 : 0,
                transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
                width: 104,
                padding: "8px 10px 4px",
                border: "1px solid #1f5c3f",
                borderRadius: 4,
                background: "rgba(10,20,14,0.8)",
                backdropFilter: "blur(4px)",
                cursor: "pointer",
                textAlign: "left",
            }}
        >
            <div
                style={{
                    color: "#4af2a1",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 9,
                    marginBottom: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {chart.title}
            </div>
            <ChartBody chart={chart} compact height={52} />
        </button>
    );
}