export function slugify(title) {
    return (title || "chart")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "chart";
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function exportChartAsPNG(containerEl, filename = "chart", bgColor = "#0a140e") {
    const svg = containerEl?.querySelector("svg");
    if (!svg) return;

    const { width, height } = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
            if (blob) downloadBlob(blob, `${filename}.png`);
        });
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
}

function csvEscape(value) {
    const str = String(value ?? "");
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function exportChartAsCSV(chart, filename = "chart") {
    if (!chart?.labels) return;
    const seriesNames = chart.series?.map((s) => s.name) || [];
    const header = ["Label", ...seriesNames];
    const rows = chart.labels.map((label, i) => [
        label,
        ...seriesNames.map((_, si) => chart.series[si]?.data?.[i] ?? ""),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}