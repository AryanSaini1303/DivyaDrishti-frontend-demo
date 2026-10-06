"use client";

import { useEffect } from "react";

export default function AnswerModal({ text, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!text) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(5,8,6,0.7)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: 40,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(680px, 90vw)",
                    maxHeight: "70vh",
                    padding: "24px 28px 20px",
                    border: "1px solid #4af2a1",
                    borderRadius: 4,
                    background: "#0a140e",
                    boxShadow: "0 0 40px rgba(74,242,161,0.15)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginBottom: 14, flexShrink: 0,
                    }}
                >
                    <div style={{ color: "#4af2a1", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>
                        full answer
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
                <div
                    style={{
                        overflowY: "auto",
                        color: "#cfeedd",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 13,
                        lineHeight: 1.7,
                    }}
                >
                    {text}
                </div>
            </div>
        </div>
    );
}