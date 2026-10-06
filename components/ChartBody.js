"use client";

import { useRef, useState } from "react";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { exportChartAsPNG, exportChartAsCSV, slugify } from "./ChartExport";

const SERIES_COLORS = ["#4AF2A1", "#2FE0C7", "#9CFF6B", "#1FBF6B", "#8B6FE8"];
const OTHER_COLOR = "#4a5a52";
const MONO_FONT = "JetBrains Mono, monospace";

// Mini orbit panels stay capped and shrink-to-fit - there's no scrolling
// inside a small sidebar preview, so a hard ceiling is the right call there.
const MAX_RENDERED_POINTS_MINI = 8;

// Full mode never drops data. Instead, once there are more categories than
// comfortably fit at a readable size, the chart grows past its container's
// width and scrolls horizontally - each bar gets a guaranteed minimum width
// no matter how many there are, so labels never fight each other for space.
const FULL_SCROLL_TRIGGER_COUNT = 8;
const FULL_MIN_PX_PER_BAR = 46;

// Pie/donut charts stop being readable well before 15 slices - past this many,
// group the smallest ones into a single "Other" wedge instead of drawing every
// last sliver. Applies regardless of size, since even an unlabeled mini pie
// gets impossible to hover accurately once slices are this thin.
const PIE_MAX_SLICES = 7;

function toRechartsData(chart) {
    if (!chart?.labels) return [];
    return chart.labels.map((label, i) => {
        const row = { name: label };
        chart.series?.forEach((s) => { row[s.name] = s.data[i]; });
        return row;
    });
}

function consolidatePieData(rows, valueKey) {
    if (!valueKey || rows.length <= PIE_MAX_SLICES) return rows;
    const sorted = [...rows].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
    const top = sorted.slice(0, PIE_MAX_SLICES - 1);
    const rest = sorted.slice(PIE_MAX_SLICES - 1);
    const otherTotal = rest.reduce((sum, r) => sum + (r[valueKey] || 0), 0);
    return [...top, { name: `Other (${rest.length})`, [valueKey]: otherTotal, __isOther: true }];
}

function truncate(label, max = 14) {
    return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

// recharts doesn't rotate tick labels on its own — this is what actually stops
// long category names (SKU names, product titles) from overlapping each other.
function AngledTick({ x, y, payload, fontSize, truncMax }) {
    return (
        <text
            x={x} y={y} dy={fontSize <= 8 ? 6 : 12}
            textAnchor="end"
            transform={`rotate(-50, ${x}, ${y})`}
            fill="#cfeedd"
            fontFamily={MONO_FONT}
            fontSize={fontSize}
        >
            {truncate(payload.value, truncMax)}
        </text>
    );
}

// fill="currentColor" (not a hardcoded hex) so the icon always matches
// whatever text color the button currently has - idle gray or hover green -
// instead of going invisible against this app's near-black background.
function PngFileIcon(props) {
    return (
        <svg viewBox="0 0 400 400" width="24" height="24" fill="currentColor" {...props}>
            <path d="M325,105H250a5,5,0,0,1-5-5V25a5,5,0,0,1,10,0V95h70a5,5,0,0,1,0,10Z" />
            <path d="M325,154.83a5,5,0,0,1-5-5V102.07L247.93,30H100A20,20,0,0,0,80,50v98.17a5,5,0,0,1-10,0V50a30,30,0,0,1,30-30H250a5,5,0,0,1,3.54,1.46l75,75A5,5,0,0,1,330,100v49.83A5,5,0,0,1,325,154.83Z" />
            <path d="M300,380H100a30,30,0,0,1-30-30V275a5,5,0,0,1,10,0v75a20,20,0,0,0,20,20H300a20,20,0,0,0,20-20V275a5,5,0,0,1,10,0v75A30,30,0,0,1,300,380Z" />
            <path d="M275,280H125a5,5,0,0,1,0-10H275a5,5,0,0,1,0,10Z" />
            <path d="M200,330H125a5,5,0,0,1,0-10h75a5,5,0,0,1,0,10Z" />
            <path d="M325,280H75a30,30,0,0,1-30-30V173.17a30,30,0,0,1,30-30h.2l250,1.66a30.09,30.09,0,0,1,29.81,30V250A30,30,0,0,1,325,280ZM75,153.17a20,20,0,0,0-20,20V250a20,20,0,0,0,20,20H325a20,20,0,0,0,20-20V174.83a20.06,20.06,0,0,0-19.88-20l-250-1.66Z" />
            <path d="M139.82,236h-9.61V182.68h21.84q9.34,0,13.85,4.71a16.37,16.37,0,0,1-.37,22.95,17.49,17.49,0,0,1-12.38,4.53H139.82Zm0-29.37h11.37q4.45,0,6.8-2.19a7.58,7.58,0,0,0,2.34-5.82,8,8,0,0,0-2.17-5.62q-2.17-2.34-7.83-2.34H139.82Z" />
            <path d="M218.42,236h-9.34l-20.23-34.06-1.52-2.54q-.47-.78-1.45-2.46V236h-7.73V182.68h10.63l18.67,31.41,3.4,5.74V182.68h7.58Z" />
            <path d="M270.61,208.73V236h-4.26l-2.93-7.19q-4.65,8-14.41,8-10.9,0-16.27-8.28a34.45,34.45,0,0,1-5.37-19.18q0-11.52,6-19.51t16.78-8q8,0,13.24,4.67a20.55,20.55,0,0,1,6.56,11.62l-8.36,1.48q-2.34-9.76-11.21-9.77a11.17,11.17,0,0,0-9.24,4.61q-3.57,4.61-3.57,14.18,0,20.2,12.66,20.2a10.74,10.74,0,0,0,8.14-3.4,12.52,12.52,0,0,0,3.22-9h-11v-7.73Z" />
        </svg>
    );
}

function CsvFileIcon(props) {
    return (
        <svg viewBox="0 0 400 400" width="24" height="24" fill="currentColor" {...props}>
            <path d="M325,105H250a5,5,0,0,1-5-5V25a5,5,0,1,1,10,0V95h70a5,5,0,0,1,0,10Z" />
            <path d="M325,154.83a5,5,0,0,1-5-5V102.07L247.93,30H100A20,20,0,0,0,80,50v98.17a5,5,0,0,1-10,0V50a30,30,0,0,1,30-30H250a5,5,0,0,1,3.54,1.46l75,75A5,5,0,0,1,330,100v49.83A5,5,0,0,1,325,154.83Z" />
            <path d="M300,380H100a30,30,0,0,1-30-30V275a5,5,0,0,1,10,0v75a20,20,0,0,0,20,20H300a20,20,0,0,0,20-20V275a5,5,0,0,1,10,0v75A30,30,0,0,1,300,380Z" />
            <path d="M275,280H125a5,5,0,1,1,0-10H275a5,5,0,0,1,0,10Z" />
            <path d="M200,330H125a5,5,0,1,1,0-10h75a5,5,0,0,1,0,10Z" />
            <path d="M325,280H75a30,30,0,0,1-30-30V173.17a30,30,0,0,1,30-30h.2l250,1.66a30.09,30.09,0,0,1,29.81,30V250A30,30,0,0,1,325,280ZM75,153.17a20,20,0,0,0-20,20V250a20,20,0,0,0,20,20H325a20,20,0,0,0,20-20V174.83a20.06,20.06,0,0,0-19.88-20l-250-1.66Z" />
            <path d="M168.48,217.48l8.91,1a20.84,20.84,0,0,1-6.19,13.18q-5.33,5.18-14,5.18-7.31,0-11.86-3.67a23.43,23.43,0,0,1-7-10,37.74,37.74,0,0,1-2.46-13.87q0-12.19,5.78-19.82t15.9-7.64a18.69,18.69,0,0,1,13.2,4.88q5.27,4.88,6.64,14l-8.91.94q-2.46-12.07-10.86-12.07-5.39,0-8.38,5t-3,14.55q0,9.69,3.2,14.63t8.48,4.94a9.3,9.3,0,0,0,7.19-3.32A13.25,13.25,0,0,0,168.48,217.48Z" />
            <path d="M179.41,223.15l9.34-2q1.68,7.93,12.89,7.93,5.12,0,7.87-2a6.07,6.07,0,0,0,2.75-5,7.09,7.09,0,0,0-1.25-4q-1.25-1.85-5.35-2.91l-10.2-2.66a25.1,25.1,0,0,1-7.73-3.11,12.15,12.15,0,0,1-4-4.9,15.54,15.54,0,0,1-1.5-6.76,14,14,0,0,1,5.31-11.46q5.31-4.32,13.59-4.32a24.86,24.86,0,0,1,12.29,3,13.56,13.56,0,0,1,6.89,8.52l-9.14,2.27q-2.11-6.05-9.84-6.05-4.49,0-6.86,1.88a5.83,5.83,0,0,0-2.36,4.77q0,4.57,7.42,6.41l9.06,2.27q8.24,2.07,11.05,6.11a15.29,15.29,0,0,1,2.81,8.93,14.7,14.7,0,0,1-5.92,12.36q-5.92,4.51-15.33,4.51a28,28,0,0,1-13.89-3.32A16.29,16.29,0,0,1,179.41,223.15Z" />
            <path d="M250.31,236h-9.77L224.1,182.68h10.16l12.23,40.86L259,182.68h8Z" />
        </svg>
    );
}

// Small bordered icon+label button matching the app's green monospace HUD
// look, with its own hover state since this file has no stylesheet to put
// :hover in. `type` picks the icon and is kept separate from the display
// text on purpose - matching against the rendered label string is brittle
// the moment the label gets an arrow glyph or a space in front of it.
function ExportBtn({ type, label, onClick }) {
    const [hover, setHover] = useState(false);
    const Icon = type === "png" ? PngFileIcon : CsvFileIcon;
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: `1px solid ${hover ? "#4af2a1" : "#1f5c3f"}`,
                color: hover ? "#cfeedd" : "#7fae94",
                fontFamily: MONO_FONT,
                fontSize: 11,
                padding: "4px 9px",
                borderRadius: 2,
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
            }}
        >
            <Icon />
            {label.toUpperCase()}
        </button>
    );
}

const RADIAN = Math.PI / 180;
// Full-mode pie labels include the share of the whole, and use a larger font
// to match the bigger radius full mode renders at.
function renderPieLabel({ cx, cy, midAngle, outerRadius, name, percent }) {
    const radius = outerRadius + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text
            x={x} y={y}
            fill="#cfeedd"
            fontFamily={MONO_FONT}
            fontSize={12}
            textAnchor={x > cx ? "start" : "end"}
            dominantBaseline="central"
        >
            {`${truncate(name, 30)} (${Math.round(percent * 100)}%)`}
        </text>
    );
}

// Three real sizes, each proportioned for its own job:
//   compact - bare shape only, no axis/legend/tooltip at all (tiny thumbnails)
//   mini    - small but still labeled: axis + tooltip, no legend/grid, capped
//             and shrink-to-fit (a ~170px orbit panel can't scroll usefully)
//   full    - the fully-labeled view. Never drops data - grows and scrolls
//             horizontally instead once there's more than fits comfortably.
export default function ChartBody({ chart, compact = false, mini = false, height }) {
    const chartRef = useRef(null);
    // Export only makes sense on the opened/full view — a mini orbit-panel
    // preview or a compact thumbnail has nowhere sensible to put the button
    // and isn't really "the chart" the user is looking at yet.
    const canExport = !compact && !mini;
    const exportName = slugify(chart?.title);

    const fullData = toRechartsData(chart);
    // Preserve whatever order the data already came in (e.g. "least attendance
    // first") - mini caps how many it draws; full mode always keeps everything.
    const isCapped = mini && chart.chart_type !== "pie" && fullData.length > MAX_RENDERED_POINTS_MINI;
    const data = isCapped ? fullData.slice(0, MAX_RENDERED_POINTS_MINI) : fullData;
    const seriesNames = chart.series?.map((s) => s.name) || [];

    const showAxes = !compact;
    const showGrid = !compact && !mini;
    const showLegend = !compact && !mini;
    const showTooltip = !compact;
    const showPieLabels = !compact && !mini;

    const isBarOrLine = chart.chart_type !== "pie";
    const needsScroll = !compact && !mini && isBarOrLine && data.length > FULL_SCROLL_TRIGGER_COUNT;
    const scrollWidth = needsScroll ? data.length * FULL_MIN_PX_PER_BAR : null;

    // Mini still shrinks font/truncation as its (capped) count grows, since it
    // has no scroll option. Full mode gets a steady, comfortably-sized label
    // either way - small counts fit natively, larger counts get guaranteed
    // room via scrollWidth instead of fighting for space.
    const tickFontSize = mini
        ? Math.max(7, 8 - Math.max(0, data.length - 6) * 0.4)
        : 11;
    const tickTruncMax = mini
        ? Math.max(5, 7 - Math.max(0, data.length - 6))
        : 16;

    const tickStyle = {
        fontSize: mini ? 8 : 12,
        fontFamily: MONO_FONT,
        fill: "#cfeedd",
    };
    const tooltipStyle = {
        background: "#0a140e", border: "1px solid #1f5c3f",
        fontFamily: MONO_FONT, fontSize: mini ? 10 : 13, color: "#cfeedd",
    };
    const legendStyle = { fontFamily: MONO_FONT, fontSize: 12, color: "#cfeedd" };

    const h = height || (compact ? 56 : mini ? 130 : 320);

    const margin = compact
        ? { top: 4, right: 4, left: 4, bottom: 4 }
        : mini
            ? { top: 4, right: 4, left: 0, bottom: 26 }
            : { top: 28, right: 16, left: 4, bottom: 56 };

    const axisHeight = mini ? 30 : 64;
    const yAxisWidth = mini ? 26 : 52;

    const barTooltipCursor = { fill: "rgba(74,242,161,0.08)" }; // default is a jarring light-gray flash — override it
    const lineTooltipCursor = { stroke: "#4af2a1", strokeWidth: 1, strokeDasharray: "3 3" };

    // Pie radius scales with the chart's own height so smaller panels leave more
    // room for label text instead of it running into the container edge.
    const pieRadius = compact
        ? 24
        : mini
            ? Math.min(h * 0.36, 55)
            : Math.min(h * 0.4, 130);

    const pieData = chart.chart_type === "pie" ? consolidatePieData(fullData, seriesNames[0]) : null;

    const barChartEl = (
        <BarChart width={needsScroll ? scrollWidth : undefined} height={h} data={data} margin={margin}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,242,161,0.1)" />}
            {showAxes && <XAxis dataKey="name" stroke="#1f5c3f" tick={<AngledTick fontSize={tickFontSize} truncMax={tickTruncMax} />} interval={0} height={axisHeight} />}
            {showAxes && <YAxis stroke="#1f5c3f" tick={tickStyle} width={yAxisWidth} />}
            {showTooltip && <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#4af2a1" }} cursor={barTooltipCursor} />}
            {showLegend && seriesNames.length > 1 && <Legend verticalAlign="top" align="center" wrapperStyle={{ ...legendStyle, paddingBottom: 8 }} />}
            {seriesNames.map((name, i) => (
                <Bar key={name} dataKey={name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={mini ? 0 : [2, 2, 0, 0]} />
            ))}
        </BarChart>
    );

    const lineChartEl = (
        <LineChart width={needsScroll ? scrollWidth : undefined} height={h} data={data} margin={margin}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,242,161,0.1)" />}
            {showAxes && <XAxis dataKey="name" stroke="#1f5c3f" tick={<AngledTick fontSize={tickFontSize} truncMax={tickTruncMax} />} interval={0} height={axisHeight} />}
            {showAxes && <YAxis stroke="#1f5c3f" tick={tickStyle} width={yAxisWidth} domain={["auto", "auto"]} />}
            {showTooltip && <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#4af2a1" }} cursor={lineTooltipCursor} />}
            {showLegend && seriesNames.length > 1 && <Legend verticalAlign="top" align="center" wrapperStyle={{ ...legendStyle, paddingBottom: 8 }} />}
            {seriesNames.map((name, i) => (
                <Line
                    key={name} type="monotone" dataKey={name}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={compact ? 1.5 : mini ? 1.5 : 2.5}
                    dot={compact || mini ? false : { r: 3 }}
                />
            ))}
        </LineChart>
    );

    return (
        <div>
            {isCapped && (
                <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: "#7fae94", marginBottom: 6 }}>
                    showing {MAX_RENDERED_POINTS_MINI} of {fullData.length}
                </div>
            )}
            {needsScroll && (
                <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: "#7fae94", marginBottom: 6 }}>
                    {/* all {data.length} shown — scroll to see more → */}
                    scroll to see more →
                </div>
            )}
            {/* chartRef wraps only the rendered chart itself (not the export
                row or the notice banners above) so PNG export captures just
                the plot - exactly what's on screen, nothing extra. */}
            <div ref={chartRef}>
                {needsScroll ? (
                    <>
                        {/* scoped, not global — only this component's scroll
                            wrapper loses its scrollbar chrome. Scroll behavior
                            itself is untouched; only the visual track/thumb go. */}
                        <style>{`
                            .chartbody-scroll::-webkit-scrollbar { display: none; }
                            .chartbody-scroll {
                                scrollbar-width: none;
                                -ms-overflow-style: none;
                            }
                        `}</style>
                        <div className="chartbody-scroll" style={{ overflowX: "auto", width: "100%" }}>
                            {chart.chart_type === "line" ? lineChartEl : barChartEl}
                        </div>
                    </>
                ) : chart.chart_type === "pie" ? (
                    <ResponsiveContainer width="100%" height={h}>
                        <PieChart>
                            <Pie
                                data={pieData} dataKey={seriesNames[0]} nameKey="name"
                                cx="50%" cy="50%"
                                innerRadius={showPieLabels ? pieRadius * 0.45 : 0}
                                outerRadius={pieRadius}
                                paddingAngle={showPieLabels ? 3 : 0}
                                stroke="#0a140e"
                                strokeWidth={showPieLabels ? 2 : 0}
                                label={showPieLabels ? renderPieLabel : false}
                                labelLine={showPieLabels ? { stroke: "#1f5c3f" } : false}
                            >
                                {pieData.map((entry, i) => (
                                    <Cell key={i} fill={entry.__isOther ? OTHER_COLOR : SERIES_COLORS[i % SERIES_COLORS.length]} />
                                ))}
                            </Pie>
                            {showTooltip && (
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    itemStyle={{ color: "#cfeedd", fontFamily: MONO_FONT, fontSize: 13 }}
                                    labelStyle={{ color: "#4af2a1", fontFamily: MONO_FONT }}
                                />
                            )}
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height={h}>
                        {chart.chart_type === "line" ? lineChartEl : barChartEl}
                    </ResponsiveContainer>
                )}
            </div>
            {canExport && (
                <div style={{ display: "flex", justifyContent: "flex-start", gap: 8, marginBottom: 10 }}>
                    <ExportBtn type="png" label="png" onClick={() => exportChartAsPNG(chartRef.current, exportName)} />
                    <ExportBtn type="csv" label="csv" onClick={() => exportChartAsCSV(chart, exportName)} />
                </div>
            )}
        </div>
    );
}