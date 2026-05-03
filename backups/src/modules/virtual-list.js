/**
 * Lightweight fixed-height virtual scroller for long lists (Phase 3 — rendering).
 * Use when row content fits a predictable height; for variable rows, pick a safe min-height + overflow:hidden.
 */

/**
 * @param {object} opts
 * @param {HTMLElement} opts.container - Scrollport (gets overflow:auto).
 * @param {unknown[]} opts.items
 * @param {number} opts.rowHeight - Pixel height per row.
 * @param {(item: unknown, index: number) => string} opts.renderRow - Returns HTML for one row.
 * @param {number} [opts.overscan=4]
 * @param {number} [opts.minHeight=280] - Default scrollport min-height if container has no height.
 * @returns {() => void} Teardown
 */
export function mountVirtualList({
    container,
    items,
    rowHeight,
    renderRow,
    overscan = 4,
    minHeight = 280
}) {
    if (!container || !Array.isArray(items)) {
        return () => {};
    }

    const total = items.length;
    if (total === 0) {
        container.innerHTML = "";
        return () => {};
    }

    container.innerHTML = "";
    container.style.overflow = "auto";
    container.style.position = "relative";
    if (!container.style.minHeight && !container.style.height) {
        container.style.minHeight = `${minHeight}px`;
    }

    const inner = document.createElement("div");
    inner.style.position = "relative";
    inner.style.height = `${total * rowHeight}px`;
    inner.setAttribute("data-virtual-inner", "true");
    container.appendChild(inner);

    const paint = () => {
        const st = container.scrollTop;
        const ch = container.clientHeight || minHeight;
        const start = Math.max(0, Math.floor(st / rowHeight) - overscan);
        const end = Math.min(total, Math.ceil((st + ch) / rowHeight) + overscan);

        inner.replaceChildren();
        const frag = document.createDocumentFragment();
        for (let i = start; i < end; i++) {
            const row = document.createElement("div");
            row.className = "virtual-list-row";
            row.style.position = "absolute";
            row.style.top = `${i * rowHeight}px`;
            row.style.left = "0";
            row.style.right = "0";
            row.style.height = `${rowHeight}px`;
            row.style.overflow = "hidden";
            row.style.boxSizing = "border-box";
            row.innerHTML = renderRow(items[i], i);
            frag.appendChild(row);
        }
        inner.appendChild(frag);
    };

    const onScroll = () => window.requestAnimationFrame(paint);
    container.addEventListener("scroll", onScroll, { passive: true });
    paint();

    return () => {
        container.removeEventListener("scroll", onScroll);
        container.innerHTML = "";
    };
}
