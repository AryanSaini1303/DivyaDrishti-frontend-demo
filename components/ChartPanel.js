"use client";

import { useEffect, useState } from "react";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const SERIES_COLORS = ["#4AF2A1", "#2FE0C7", "#9CFF6B", "#1FBF6B", "#8B6FE8"];
const MONO_FONT = "JetBrains Mono, monospace";

function toRechartsData(chartData) {
    if (!chartData?.labels) return [];
    return chartData.labels.map((label, i) => {
        const row = { name: label };
        chartData.series?.forEach((s) => {
            row[s.name] = s.data[i];
        });
        return row;
    });
}

const tickStyle = { fontSize: 9, fontFamily: MONO_FONT, fill: "#cfeedd" };
const tooltipStyle = {
    background: "#0a140e",
    border: "1px solid #1f5c3f",
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: "#cfeedd",
};
const legendStyle = { fontFamily: MONO_FONT, fontSize: 10, color: "#cfeedd" };

export default function ChartPanel({ chartData }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (chartData) {
            const t = setTimeout(() => setVisible(true), 20); // next tick, so the transition actually plays
            return () => clearTimeout(t);
        }
        setVisible(false);
    }, [chartData]);

    if (!chartData) return null;

    const data = toRechartsData(chartData);
    const seriesNames = chartData.series?.map((s) => s.name) || [];

    return (
        <div
            style={{
                position: "absolute",
                right: "4%",
                top: "50%",
                transform: visible ? "translateY(-50%) scale(1)" : "translateY(-50%) scale(0.85)",
                opacity: visible ? 1 : 0,
                transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
                width: 260,
                padding: "14px 16px 8px",
                border: "1px solid #1f5c3f",
                borderRadius: 2,
                background: "rgba(10,20,14,0.65)",
                backdropFilter: "blur(4px)",
            }}
        >
            <div style={{ color: "#4af2a1", fontFamily: MONO_FONT, fontSize: 11, marginBottom: 8 }}>
                {chartData.title}
            </div>

            <ResponsiveContainer width="100%" height={160}>
                {chartData.chart_type === "line" ? (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,242,161,0.1)" />
                        <XAxis dataKey="name" stroke="#1f5c3f" tick={tickStyle} />
                        <YAxis stroke="#1f5c3f" tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#4af2a1" }} />
                        {seriesNames.length > 1 && <Legend wrapperStyle={legendStyle} />}
                        {seriesNames.map((name, i) => (
                            <Line
                                key={name}
                                type="monotone"
                                dataKey={name}
                                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                            />
                        ))}
                    </LineChart>
                ) : chartData.chart_type === "pie" ? (
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey={seriesNames[0]}
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label={{ fontFamily: MONO_FONT, fontSize: 9, fill: "#cfeedd" }}
                        >
                            {data.map((_, i) => (
                                <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                ) : (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,242,161,0.1)" />
                        <XAxis dataKey="name" stroke="#1f5c3f" tick={tickStyle} />
                        <YAxis stroke="#1f5c3f" tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#4af2a1" }} />
                        {seriesNames.length > 1 && <Legend wrapperStyle={legendStyle} />}
                        {seriesNames.map((name, i) => (
                            <Bar key={name} dataKey={name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                        ))}
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}