/**
 * furniture.js — the declarative contract between an app's chrome and the framework tier.
 *
 * Any element that should be treated as furniture — something the camera pads around, and
 * something an ADJACENT popup must not cover — gets one attribute:
 *
 *     <div id="my-panel" data-sgs-furniture></div>
 *
 * No registration call, no id hardcoded into a shared file, no lifecycle to unwind. The
 * framework re-scans the DOM and re-reads geometry on every call, so a copied piece of
 * furniture participates the moment its markup exists — visible-area.js and
 * popup-placement.js need no change to support a third panel, an inspector on the right, or a
 * form instead of a layer list. See CONTRIBUTING.md for the tiers this sits inside.
 *
 * ── Why the marker carries no value ──────────────────────────────────────────────────────
 * An earlier draft of this contract used `data-sgs-furniture="left"` — the edge as a static
 * attribute written once in markup. Rejected: this app already paid, once, to learn that
 * TRUSTING A LABEL FOR WHERE SOMETHING IS is the wrong move — the git history has a
 * `position: fixed` element whose `offsetParent === null` (true by definition, on screen or
 * not) silently zeroed the camera's bottom padding. A static edge string is the same mistake
 * relocated to markup: it goes stale the instant something floats, redocks, or is dragged.
 * The boolean marker plus a live geometric read (edgeOf, below) cannot go stale, because
 * there is nothing cached to go stale.
 */

/** How close to a viewport edge still counts as "hugging" it, in px. */
export const HOME = 24;

/**
 * Every element currently marked as furniture, with its live rect. An element with a zero
 * rect (display: none, or not yet mounted) is excluded — a hidden element occludes nothing.
 * @param {ParentNode} [root] defaults to the whole document
 * @returns {Array<{el: Element, rect: DOMRect}>}
 */
export function furnitureRects(root) {
    if (typeof document === 'undefined') return [];
    const scope = root ?? document;
    /** @type {Array<{el: Element, rect: DOMRect}>} */
    const out = [];
    for (const el of scope.querySelectorAll('[data-sgs-furniture]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ el, rect: r });
    }
    return out;
}

/**
 * Which viewport edge a rect is hugging, if any. Pure and DOM-free — takes a rect and a
 * viewport size rather than reading either — so it is unit-testable with synthetic geometry
 * and is the one place "how close counts as docked" is decided. The same test
 * dockedPanelRight()/dockCover() used before this file existed, generalised to any edge.
 *
 * A rect close to more than one edge is resolved by SHAPE first, distance second. A band that
 * spans nearly the full viewport width — this app's own dock, insets of 10px on left, right,
 * AND bottom — sits within `home` of three edges simultaneously; per-edge distance alone
 * cannot tell it apart from a left- or right-docked panel, because all three distances are
 * equal. But a full-width band can only sensibly BE a top or bottom edge, so that shape rules
 * out left/right before distance ever has to break the tie. Same argument, rotated, for a
 * column spanning nearly the full height.
 * @param {{left: number, top: number, right: number, bottom: number}} r
 * @param {{width: number, height: number}} viewport
 * @param {number} [home]
 * @returns {'left'|'right'|'top'|'bottom'|null}
 */
export function edgeOf(r, viewport, home = HOME) {
    const spansWidth = (r.right - r.left) >= viewport.width - home * 2;
    const spansHeight = (r.bottom - r.top) >= viewport.height - home * 2;

    /** @type {Array<['left'|'right'|'top'|'bottom', number]>} */
    let candidates = [
        ['left', r.left],
        ['right', viewport.width - r.right],
        ['top', r.top],
        ['bottom', viewport.height - r.bottom],
    ];
    if (spansWidth) candidates = candidates.filter(([edge]) => edge === 'top' || edge === 'bottom');
    else if (spansHeight) candidates = candidates.filter(([edge]) => edge === 'left' || edge === 'right');

    const inRange = candidates.filter(([, d]) => d <= home);
    if (inRange.length === 0) return null;
    inRange.sort((a, b) => a[1] - b[1]);
    return inRange[0][0];
}

/**
 * Furniture rects, each tagged with the edge it occludes. Furniture parked away from every
 * edge (an unpinned panel dragged to the middle of the map) is left out entirely — this is
 * the "not furniture any more" exception popup-placement.js has always made for a floated
 * panel, now general: it applies to anything marked furniture, not to one hardcoded id.
 * @param {ParentNode} [root]
 * @returns {Array<{el: Element, rect: DOMRect, edge: 'left'|'right'|'top'|'bottom'}>}
 */
export function edgeFurniture(root) {
    if (typeof window === 'undefined') return [];
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    /** @type {Array<{el: Element, rect: DOMRect, edge: 'left'|'right'|'top'|'bottom'}>} */
    const out = [];
    for (const f of furnitureRects(root)) {
        const edge = edgeOf(f.rect, viewport, HOME);
        if (edge) out.push({ el: f.el, rect: f.rect, edge });
    }
    return out;
}

/**
 * How far edge-docked furniture intrudes from each side of the viewport — the MAXIMUM across
 * everything hugging that edge, so two things both hugging the left edge contribute once, by
 * whichever intrudes further. Pure aggregation over `furniture`, so it is testable with a
 * synthetic list without touching the DOM (see tests/unit/furniture.spec.js).
 * @param {Array<{rect: {left: number, top: number, right: number, bottom: number}, edge: string}>} furniture
 * @param {{width: number, height: number}} viewport
 * @returns {{left: number, right: number, top: number, bottom: number}}
 */
export function coverFromEdgeFurniture(furniture, viewport) {
    const cover = { left: 0, right: 0, top: 0, bottom: 0 };
    for (const f of furniture) {
        if (f.edge === 'left') cover.left = Math.max(cover.left, f.rect.right);
        if (f.edge === 'right') cover.right = Math.max(cover.right, viewport.width - f.rect.left);
        if (f.edge === 'top') cover.top = Math.max(cover.top, f.rect.bottom);
        if (f.edge === 'bottom') cover.bottom = Math.max(cover.bottom, viewport.height - f.rect.top);
    }
    return cover;
}

/**
 * The live version of coverFromEdgeFurniture: scans the DOM, reads the real viewport.
 * @param {ParentNode} [root]
 * @returns {{left: number, right: number, top: number, bottom: number}}
 */
export function edgeCover(root) {
    if (typeof window === 'undefined') return { left: 0, right: 0, top: 0, bottom: 0 };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return coverFromEdgeFurniture(edgeFurniture(root), viewport);
}

/**
 * The catch radius when a reader drags furniture back toward its berth, in px.
 *
 * Deliberately larger than HOME, and the difference is the whole argument: HOME judges a rect
 * AT REST ("is this thing occluding the left edge?"), while SNAP is a target a hand in motion
 * has to hit. The same number for both reads as principled and misses constantly.
 *
 * It is a multiple of HOME rather than an unrelated number so the two cannot drift apart:
 * anything inside SNAP of its berth point is, by construction, already inside HOME of its
 * berth EDGE — which is to say the framework is ALREADY padding the camera as though the
 * furniture were docked while the furniture still believes it is floating. Snapping does not
 * introduce a behaviour; it ends a disagreement the reader can see.
 */
export const SNAP = HOME * 2;

/**
 * Is this rect close enough to its berth point that letting go should re-berth it?
 *
 * Per-axis rather than Euclidean: a diagonal miss of 40px in both directions is not "nearly
 * home" in any sense a reader would recognise, and the radial version catches it.
 *
 * For a berth that is a single CORNER. Neither piece of furniture in this app has one any
 * more: the panel's berth is the whole left edge (nearLeftBerth) and the table's the whole
 * bottom (nearBottomBerth). Kept because a corner berth is a real shape, and the edge tests
 * are easiest to read against it.
 *
 * Pure, and takes the berth point rather than deriving one, because only the furniture knows
 * where its own berth is. Deriving it here would mean this file knowing about specific pieces
 * of furniture, which is exactly what the marker attribute exists to avoid.
 *
 * @param {{left: number, top: number}} rect where the furniture is now
 * @param {{x: number, y: number}} berth where it would sit if it were pinned
 * @param {number} [snap]
 * @returns {boolean}
 */
export function nearBerth(rect, berth, snap = SNAP) {
    return Math.abs(rect.left - berth.x) <= snap && Math.abs(rect.top - berth.y) <= snap;
}

/**
 * Is this rect held against a BOTTOM-EDGE berth closely enough that letting go should
 * re-berth it?
 *
 * The dock's berth is the whole bottom edge, not a corner, so this ignores x entirely. It used
 * to go through nearBerth() with the bottom-LEFT corner as its point, which meant a loose table
 * dropped at the foot of the map stayed loose unless it happened to land within SNAP of the
 * left inset: the reader held it against the edge it lives on, in the middle where it is most
 * natural to aim, and nothing happened.
 *
 * One-sided on y, where nearBerth() is symmetric. The panel cannot overshoot its corner (the
 * drag clamps it to the viewport), but the dock can be pushed down past its berth until only
 * its head shows, and pushing a thing INTO the edge it belongs on is the clearest possible way
 * of saying "put it back". So anything at, below, or within SNAP above the berth counts.
 *
 * @param {{top: number}} rect where the furniture is now
 * @param {number} berthTop the top it would have if it were pinned
 * @param {number} [snap]
 * @returns {boolean}
 */
export function nearBottomBerth(rect, berthTop, snap = SNAP) {
    return rect.top >= berthTop - snap;
}

/**
 * Is this rect held against a LEFT-EDGE berth closely enough that letting go should re-berth
 * it? nearBottomBerth() rotated, for the panel.
 *
 * The panel's berth used to be tested as its top-left CORNER, so a panel dropped against the
 * left edge halfway down the map stayed loose: the same miss the table had along the bottom.
 * Its docked form spans the whole left edge, so the edge is the target, and y is ignored.
 * One-sided for the same reason too, though the drag clamps x at 0: anything at or left of the
 * berth, or within SNAP to its right, counts.
 *
 * @param {{left: number}} rect where the furniture is now
 * @param {number} berthLeft the left it would have if it were pinned
 * @param {number} [snap]
 * @returns {boolean}
 */
export function nearLeftBerth(rect, berthLeft, snap = SNAP) {
    return rect.left <= berthLeft + snap;
}

/**
 * A change one piece of furniture makes to ANOTHER, which it may only undo while it is still
 * the one holding it.
 *
 * This shape had been written by hand three times before it was named — the fold that pins the
 * panel's width, the dock that folds the panel as it rises, the undock that pins the dock's
 * width — and each copy got the same half right and the same half wrong. Taking is easy.
 * GIVING BACK is where the bugs live, and there are two of them:
 *
 *   1. Giving back something you never took. The dock rises, the reader folds the panel
 *      themselves, the dock comes down and unfolds it. The app has overruled a choice it was
 *      not asked about.
 *   2. Taking something that was already gone. The reader folds the panel, the dock rises and
 *      "folds" it again, the dock comes down and gives back a fold that was never the dock's
 *      to give. Same bug, entered from the other side, which is why `available` is part of
 *      the contract and not the caller's problem.
 *
 * @param {object} spec
 * @param {() => boolean} spec.available is the thing free to take right now?
 * @param {() => void} spec.take
 * @param {() => void} spec.give
 * @returns {{want: (next: boolean) => void, release: () => void, held: () => boolean}}
 */
export function makeBorrow({ available, take, give }) {
    let held = false;
    return {
        want(next) {
            if (next === held) return;
            if (next) {
                if (!available()) return;
                held = true;
                take();
            } else {
                held = false;
                give();
            }
        },
        release() { this.want(false); },
        held: () => held,
    };
}
