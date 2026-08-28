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
 * postures and the dock can be open, minimised, or gone.
 *
 * ── Occlusion is a question about WHERE THE PANEL IS, not what state it is in ────────────
 * The first version of this file asked whether the panel carried the float class and gave up
 * the moment it did. Consequence: unpinning the panel WITHOUT MOVING IT ONE PIXEL sent every
 * popup back to the far left, underneath it, and stopped the camera reserving the band it
 * plainly still covers. A float parked at home occludes exactly as much as a docked panel.
 * So the rule is geometric: the panel occludes the left edge while its own left edge sits
 * within HOME of it. That also handles "dragged away and roughly back" for free, which no
 * amount of pin-state bookkeeping would.
 */

/** How close to the left viewport edge still counts as "hugging" it, in px. */
const HOME = 24;

/**
 * The right screen edge of the panel WHILE it occludes the left side, else 0. Measured, not
 * inferred from posture flags — see the header.
 * @returns {number}
 */
export function dockedPanelRight() {
    if (typeof document === 'undefined') return 0;
    const panel = document.getElementById('sgs-panel');
    if (!panel) return 0;
    if (panel.classList.contains('sgs-closed')) return 0;
    // Rect, not offsetParent — see dockCover for why offsetParent lies about fixed elements.
    const r = panel.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return 0;
    return r.left <= HOME ? r.right : 0;
}

/**
 * How much of the bottom of the viewport the dock covers. A MINIMISED dock still covers its
 * own head, which is a real band and worth avoiding; the closed-state sliver tab is a few
 * pixels of deliberate chrome and is not.
 * @returns {number}
 */
export function dockCover() {
    if (typeof document === 'undefined') return 0;
    const dock = document.getElementById('sgs-dock');
    if (!dock) return 0;
    // NOT `offsetParent === null` as a visibility test: the dock is position fixed, and a
    // fixed element's offsetParent is null BY DEFINITION, on screen or not. That guard
    // silently reported the dock invisible and zeroed the camera's bottom padding, which
    // shipped as "zoom-to centres features underneath the table". A display-none element
    // has a zero rect, so the rect is the honest test.
    const r = dock.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return 0;
    return Math.max(0, window.innerHeight - r.top);
}

/**
 * A MapLibre padding object that keeps fitted geometry inside the visible part of the
 * viewport: right of the panel, above the dock.
 *
 * Clamped, because MapLibre requires the padding to leave a positive drawing area, and a
 * wide panel plus an open dock can otherwise ask for more padding than there is screen. When
 * the clamp bites, the camera is merely imperfect; without it, `fitBounds` throws and the
 * button appears broken.
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
