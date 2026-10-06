"use client";

import { useEffect } from "react";
import ChartBody from "./ChartBody";

export default function ChartModal({ chart, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!chart) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(5,8,6,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(700px, 90vw)",
                    padding: "24px 28px 16px",
                    border: "1px solid #4af2a1",
                    borderRadius: 4,
                    background: "#0a140e",
                    boxShadow: "0 0 40px rgba(74,242,161,0.15)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ color: "#4af2a1", fontFamily: "JetBrains Mono, monospace", fontSize: 14 }}>
                        {chart.title}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "1px solid #1f5c3f",
                            color: "#cfeedd",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: 11,
                            padding: "4px 10px",
                            borderRadius: 2,
                            cursor: "pointer",
                        }}
                    >
                        close
                    </button>
                </div>
                <ChartBody chart={chart} />
            </div>
        </div>
    );
}