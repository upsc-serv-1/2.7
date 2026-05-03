/**
 * SVG donut charts with external callout labels (leader lines), matching infographic-style PYQ visuals.
 * Labels use left/right columns with vertical stacking to avoid overlaps.
 */

function escapeAttr(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Shorten long topic names so pills stay readable */
function truncateTopic(s, maxLen) {
    const t = String(s || "").trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

const DEFAULT_PALETTE = [
    "#fbbf24", "#38bdf8", "#14b8a6", "#2563eb", "#64748b", "#7c3aed",
    "#a855f7", "#db2777", "#f472b6", "#fb7185", "#fb923c", "#f97316",
    "#84cc16", "#22c55e", "#0d9488"
];

/**
 * @param {object} opts
 * @param {{ label: string, count: number, color?: string }[]} opts.entries
 * @param {string} [opts.headerLabel]
 * @param {string} [opts.centerTitle]
 * @param {string} [opts.centerSubtitle]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 */
export function renderDonutCalloutChart(opts) {
    const entries = (opts.entries || [])
        .filter((e) => e && (Number(e.count) > 0 || e.label))
        .map((e) => ({
            label: String(e.label || "Other"),
            count: Math.max(0, Number(e.count) || 0),
            color: e.color || null
        }))
        .filter((e) => e.count > 0);

    if (!entries.length) {
        return `<p class="muted" style="padding:24px;text-align:center;">No questions in this filter for the selected years.</p>`;
    }

    const total = entries.reduce((s, e) => s + e.count, 0);
    const uid = `d${Math.random().toString(36).slice(2, 9)}`;
    const n = entries.length;

    const labW = 210;
    const gap = 8;
    /** Per-label block height (pill + up to 2 lines of topic text) */
    const labelBlockH = 58;
    const marginX = 18;
    const padTop = 28;

    let start = -Math.PI / 2;
    const segments = entries.map((e, i) => {
        const sweep = total > 0 ? (e.count / total) * Math.PI * 2 : 0;
        const mid = start + sweep / 2;
        const color = e.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        const seg = { ...e, color, start, sweep, mid };
        start += sweep;
        return seg;
    });

    const leftN = segments.filter((s) => Math.cos(s.mid) < 0).length;
    const rightN = segments.filter((s) => Math.cos(s.mid) >= 0).length;
    const maxCol = Math.max(leftN, rightN, 1);
    const colStackH = maxCol * (labelBlockH + gap) - gap;
    const H = Math.max(520, padTop + colStackH + 56);
    const W = opts.width || Math.max(900, labW * 2 + 340);

    const cx = W / 2;
    const cy = padTop + (H - padTop) / 2;
    const R = Math.min((W / 2 - marginX - labW - 28), (H - padTop) * 0.28, 120);
    const r = R * 0.56;

    const clickHandler = opts.onSliceClick || "";
    const paths = segments.map((seg) => {
        const largeArc = seg.sweep > Math.PI ? 1 : 0;
        const x1 = cx + R * Math.cos(seg.start);
        const y1 = cy + R * Math.sin(seg.start);
        const x2 = cx + R * Math.cos(seg.start + seg.sweep);
        const y2 = cy + R * Math.sin(seg.start + seg.sweep);
        const x3 = cx + r * Math.cos(seg.start + seg.sweep);
        const y3 = cy + r * Math.sin(seg.start + seg.sweep);
        const x4 = cx + r * Math.cos(seg.start);
        const y4 = cy + r * Math.sin(seg.start);
        const d = [
            `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
            `A ${R.toFixed(2)} ${R.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
            `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
            `A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
            "Z"
        ].join(" ");
        const safeLabel = escapeAttr(seg.label).replace(/'/g, "&#39;");
        const attrs = clickHandler
            ? `style="cursor:pointer;" onclick="${escapeAttr(clickHandler)}('${safeLabel}')" role="button" tabindex="0" aria-label="${escapeAttr(seg.label)}"`
            : "";
        return `<path d="${d}" fill="${seg.color}" stroke="#ffffff" stroke-width="2" opacity="0.96" ${attrs} />`;
    });

    const leftSegs = segments.filter((s) => Math.cos(s.mid) < 0);
    const rightSegs = segments.filter((s) => Math.cos(s.mid) >= 0);
    const sortByScreenOrder = (a, b) => Math.sin(a.mid) - Math.sin(b.mid);
    leftSegs.sort(sortByScreenOrder);
    rightSegs.sort(sortByScreenOrder);

    const leftX = marginX;
    const rightX = W - marginX - labW;

    const placeColumn = (list, anchorX, alignEnd) => {
        const stackH = list.length * (labelBlockH + gap) - (list.length ? gap : 0);
        const y0 = cy - stackH / 2;
        return list.map((seg, idx) => {
            const ty = y0 + idx * (labelBlockH + gap);
            const xe = cx + R * Math.cos(seg.mid);
            const ye = cy + R * Math.sin(seg.mid);
            const labelCy = ty + labelBlockH / 2;
            const endX = alignEnd ? anchorX + labW + 8 : anchorX - 8;
            const endY = labelCy;
            const pathD = `M ${xe.toFixed(1)} ${ye.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;

            const countStr = `${seg.count} Question${seg.count === 1 ? "" : "s"}`;
            const topic = truncateTopic(seg.label, n > 10 ? 36 : 44);
            return `
            <g class="pyq-callout-${alignEnd ? "L" : "R"}-${idx}">
                <path d="${pathD}" fill="none" stroke="${seg.color}" stroke-width="1.75" stroke-opacity="0.9" stroke-linecap="round"/>
                <foreignObject x="${anchorX}" y="${ty}" width="${labW}" height="${labelBlockH}">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,system-ui,sans-serif;font-size:11px;line-height:1.2;max-width:${labW}px;overflow:hidden;">
                        <span style="display:inline-block;background:${seg.color};color:#fff;font-weight:800;padding:3px 8px;border-radius:999px;margin-bottom:3px;white-space:nowrap;">${escapeAttr(countStr)}</span><br/>
                        <span style="color:#1e293b;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;" title="${escapeAttr(seg.label)}">${escapeAttr(topic)}</span>
                    </div>
                </foreignObject>
            </g>`;
        }).join("");
    };

    const labelsLeft = placeColumn(leftSegs, leftX, true);
    const labelsRight = placeColumn(rightSegs, rightX, false);

    const headerLabel = opts.headerLabel || "TOPIC WISE QUESTIONS";
    const centerTitle = opts.centerTitle || "";
    const centerSubtitle = opts.centerSubtitle || "";

    const ringR = R + Math.min(56, 36 + n * 2);

    return `
        <div class="pyq-donut-infographic" style="background: radial-gradient(circle at center, rgba(248,250,252,0.98) 0%, #ffffff 55%); border-radius: 16px; border: 1px solid var(--line); padding: 16px 12px 24px; overflow-x: auto;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom: 8px; flex-wrap:wrap;">
                <span style="background: linear-gradient(135deg,#7c3aed,#6366f1); color:#fff; font-weight:800; font-size:0.72rem; letter-spacing:0.06em; padding: 8px 14px; border-radius: 10px;">${escapeAttr(headerLabel)}</span>
                <span style="font-size:0.85rem; color: var(--muted);">${total} questions · share of PYQ pool in filters</span>
            </div>
            <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="min-height:${H}px;max-height:720px;display:block;" role="img" aria-label="Topic wise question distribution">
                <defs>
                    <filter id="${uid}-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.08"/>
                    </filter>
                </defs>
                <ellipse cx="${cx}" cy="${cy}" rx="${ringR}" ry="${ringR}" fill="none" stroke="#e2e8f0" stroke-width="1" opacity="0.45" />
                <g filter="url(#${uid}-shadow)">${paths.join("")}</g>
                <circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="#ffffff" stroke="#f1f5f9" stroke-width="2" />
                <foreignObject x="${cx - 108}" y="${cy - 40}" width="216" height="84">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-family:'Playfair Display',Georgia,serif;color:#334155;">
                        ${centerTitle ? `<div style="font-size:0.98rem;font-weight:700;line-height:1.15;">${escapeAttr(centerTitle)}</div>` : `<div style="font-size:0.9rem;font-weight:700;">Distribution</div>`}
                        ${centerSubtitle ? `<div style="font-size:0.7rem;margin-top:5px;color:#64748b;font-family:Inter,sans-serif;line-height:1.25;word-break:break-word;">${escapeAttr(truncateTopic(centerSubtitle, 80))}</div>` : ""}
                    </div>
                </foreignObject>
                ${labelsLeft}
                ${labelsRight}
            </svg>
        </div>
    `;
}

/**
 * @param {{ label: string, count: number, color?: string }[]} entries
 * @param {object} meta
 */
export function renderMiniDonutStack(title, entries, meta = {}) {
    const clean = (entries || []).filter((e) => e.count > 0);
    if (!clean.length) return "";
    const W = 340;
    const H = 300;
    const cx = W / 2;
    const cy = H / 2 + 10;
    const R = 78;
    const r = 48;
    const total = clean.reduce((s, e) => s + e.count, 0);
    let start = -Math.PI / 2;
    const paths = [];
    clean.forEach((e, i) => {
        const sweep = (e.count / total) * Math.PI * 2;
        const color = e.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        const largeArc = sweep > Math.PI ? 1 : 0;
        const x1 = cx + R * Math.cos(start);
        const y1 = cy + R * Math.sin(start);
        const x2 = cx + R * Math.cos(start + sweep);
        const y2 = cy + R * Math.sin(start + sweep);
        const x3 = cx + r * Math.cos(start + sweep);
        const y3 = cy + r * Math.sin(start + sweep);
        const x4 = cx + r * Math.cos(start);
        const y4 = cy + r * Math.sin(start);
        paths.push(`<path fill="${color}" stroke="#fff" stroke-width="1.5" d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z"/>`);
        start += sweep;
    });

    const labels = clean.map((e, i) => {
        const color = e.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        const lab = truncateTopic(e.label, 42);
        return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:0.78rem;margin:4px 0;line-height:1.35;"><span style="color:${color};font-weight:700;flex-shrink:0;">${e.count}</span><span style="color:#334155;word-break:break-word;text-align:right;" title="${escapeAttr(e.label)}">${escapeAttr(lab)}</span></div>`;
    }).join("");

    return `
        <article class="panel" style="padding:14px;min-width:260px;max-width:380px;">
            <h4 style="margin:0 0 10px;font-size:0.95rem;color:var(--text);">${escapeAttr(title)}</h4>
            <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:260px;display:block;">
                ${paths.join("")}
                <circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="#ffffff" stroke="#f1f5f9" stroke-width="1.5"/>
                <text x="${cx}" y="${cy + ((meta.centerShort || "").length > 22 ? -4 : 4)}" text-anchor="middle" dominant-baseline="middle" fill="#475569" font-size="11" font-weight="700">${escapeAttr((meta.centerShort || "").slice(0, 48))}</text>
            </svg>
            <div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px;">${labels}</div>
        </article>
    `;
}
