"use client";

import { useState } from "react";
import ChartBody from "./ChartBody";

const TYPES = ["bar", "line", "pie"];

export default function ChartCard({ chart }) {
    const [viewType, setViewType] = useState(chart.chart_type || "bar");

    return (
        <div
            style={{
                border: "1px solid #1f5c3f",
                borderRadius: 4,
                background: "rgba(10,20,14,0.55)",
                padding: "12px 14px 8px",
            }}
        >
            <div
                style={{
                    color: "#4af2a1",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    marginBottom: 8,
                    lineHeight: 1.4,
                }}
            >
                {chart.title}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                {TYPES.map((t) => (
                    <button
                        key={t}
                        onClick={() => setViewType(t)}
                        style={{
                            background: viewType === t ? "rgba(74,242,161,0.15)" : "transparent",
                            border: `1px solid ${viewType === t ? "#4af2a1" : "#1f5c3f"}`,
                            color: viewType === t ? "#4af2a1" : "rgba(207,238,221,0.5)",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: 9,
                            padding: "3px 9px",
                            borderRadius: 2,
                            cursor: "pointer",
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <ChartBody chart={{ ...chart, chart_type: viewType }} height={210} />
        </div>
    );
}