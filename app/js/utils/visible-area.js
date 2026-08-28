/**
 * visible-area.js — where on screen the map is actually VISIBLE.
 *
 * An app with furniture has a viewport and a smaller, differently shaped region a person can
 * actually see into. `fitBounds` knows about the first one. Left to itself it centres a
 * feature in the middle of the canvas, which in this app is a spot half covered by the panel
 * and, when the dock is open, by the dock.
 *
 * So every camera move goes through `visiblePadding()`. It is not a cosmetic margin: the
 * numbers are read off the live furniture each time, because the panel can be any of four
 * postures and the dock can be folded or open.
 *
 * The floating case is the one people get wrong. A FLOATING panel returns zero occlusion,
 * because an unpinned panel sits wherever it was dragged: reserving a left band for something
 * that may be sitting in the middle of the map buys nothing, and reserving a band around
 * wherever it happens to be would make the camera jump every time it moved. See the
 * `chrome-aware-camera` skill.
 */

/**
 * The right screen edge of the panel WHEN it occludes the left side, which means when it is
 * docked and not stowed. Zero when there is nothing to avoid.
 * @returns {number}
 */
export function dockedPanelRight() {
    if (typeof document === 'undefined') return 0;
    const panel = document.getElementById('sgs-panel');
    if (!panel || panel.offsetParent === null) return 0;
    if (panel.classList.contains('sgs-panel--float')) return 0;
    if (panel.classList.contains('sgs-panel--stowed')) return 0;
    const r = panel.getBoundingClientRect();
    return r.width > 0 ? r.right : 0;
}

/**
 * How much of the bottom of the viewport the dock covers. A FOLDED dock still covers its own
 * head, which is a real band and worth avoiding: a feature centred under the fold bar is a
 * feature you cannot see.
 * @returns {number}
 */
export function dockCover() {
    if (typeof document === 'undefined') return 0;
    const dock = document.getElementById('sgs-dock');
    if (!dock || dock.offsetParent === null) return 0;
    const r = dock.getBoundingClientRect();
    return Math.max(0, window.innerHeight - r.top);
}

/**
 * A MapLibre padding object that keeps fitted geometry inside the visible part of the
 * viewport: right of the panel, above the dock.
 *
 * Clamped, because MapLibre requires the padding to leave a positive drawing area, and a
 * panel dragged to 60% of the window plus an open dock can otherwise ask for more padding
 * than there is screen. When the clamp bites, the camera is merely imperfect; without it,
 * `fitBounds` throws and the button appears broken.
 *
 * @param {number} [base] padding on unobstructed edges, in pixels
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function visiblePadding(base = 48) {
    /** @type {{top: number, right: number, bottom: number, left: number}} */
    const pad = { top: base, right: base, bottom: base, left: base };
    if (typeof document === 'undefined' || typeof window === 'undefined') return pad;

    const panelRight = dockedPanelRight();
    if (panelRight > 0) pad.left = Math.max(pad.left, Math.round(panelRight + 16));

    const covered = dockCover();
    if (covered > 0) pad.bottom = Math.max(pad.bottom, Math.round(covered + 16));

    const w = window.innerWidth;
    const h = window.innerHeight;
    if (pad.left + pad.right > w * 0.8) {
        const scale = (w * 0.8) / (pad.left + pad.right);
        pad.left = Math.floor(pad.left * scale);
        pad.right = Math.floor(pad.right * scale);
    }
    if (pad.top + pad.bottom > h * 0.8) {
        const scale = (h * 0.8) / (pad.top + pad.bottom);
        pad.top = Math.floor(pad.top * scale);
        pad.bottom = Math.floor(pad.bottom * scale);
    }
    return pad;
}

/**
 * The rectangle of the viewport a person can actually see the map through, in client
 * coordinates. Popup placement uses this; so does anything else that needs to land something
 * where it will be looked at.
 * @param {number} [edge] margin to keep from the viewport edge
 * @returns {{left: number, top: number, right: number, bottom: number, width: number, height: number}}
 */
export function visibleRect(edge = 10) {
    const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const h = typeof window === 'undefined' ? 800 : window.innerHeight;
    const left = Math.max(edge, dockedPanelRight() + (dockedPanelRight() > 0 ? 12 : 0));
    const bottom = h - Math.max(edge, dockCover() + (dockCover() > 0 ? 12 : 0));
    return {
        left,
        top: edge,
        right: w - edge,
        bottom,
        width: Math.max(0, w - edge - left),
        height: Math.max(0, bottom - edge),
    };
}
