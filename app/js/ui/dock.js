/**
 * dock.js — the bottom dock: a band across the foot of the viewport that the table lives in.
 *
 * ── Three states, three shapes ───────────────────────────────────────────────────────────
 *   OPEN     a full-width card (small inset each side), resizable by dragging its top edge.
 *            The layer panel gives up its bottom: a body class plus the `--sgs-dock-h`
 *            variable raise the panel so the two never overlap, and the CSS owns that rule —
 *            the dock only publishes its height.
 *   FOLDED   the head alone, still full width, still reporting "Stations, 24 rows". A fold
 *            and not a stow, because the head has something to say while shut — apply the
 *            test from the `ui-stow` skill to anything you add here.
 *   CLOSED   the dock leaves entirely. What remains is a SLIVER: a small tab parked at the
 *            bottom-centre edge that brings the table back. It is the dock's MARK, and the
 *            bottom edge is its berth — the same put-away grammar as everything else, just
 *            against the viewport instead of a panel.
 *
 * ── Pinned, or loose ─────────────────────────────────────────────────────────────────────
 * The dock is furniture with a BERTH, exactly like the panel, and it carries the same pair of
 * gestures: a pin in its head, and a drag that undocks it and a drag back that re-berths it.
 * Before, the table was the one piece of chrome nailed to the viewport, which made it the one
 * piece a reader could not move off the thing they were trying to look at.
 *
 * Loose, it stops being bottom-edge furniture: `edgeOf` in furniture.js reads geometry rather
 * than a label, so the camera stops padding for it and popups stop avoiding it the moment it
 * leaves the edge, with nothing here to say so.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────────────────
 * Sorting, paging, editing, column resizing, virtualisation. A real table needs some of
 * them, and every one has a right answer that depends on your data. What transfers is the
 * band: where it sits, how it resizes, how it reports while folded, how it leaves, and that
 * the camera and the panel both know it is there.
 */

import { featuresOf, layerById, zoomToFeature, flashFeature, LAYERS } from '../layers.js';
import { icon } from '../icons.js';
import { buildFieldBadge, inferColumnType } from './field-badge.js';
import { buildSymbolSwatch } from './symbology.js';
import { getSourcePill, makeTypePill } from './type-pill.js';
import { foldPanel, isPanelFolded } from './panel.js';
import { flashMark, nextFoldMode } from './stow.js';
import { makeDraggable, releaseDrag } from '../utils/draggable.js';
import { nearBottomBerth, makeBorrow } from '../utils/furniture.js';
import { getPrefs, setPrefs } from '../utils/prefs.js';

/** Default open height, px. */
const DEFAULT_H = 250;
const MIN_H = 120;
const MIN_W = 280;

/** Matches --sgs-panel-inset in furniture.css: the gap the dock keeps from the viewport. */
const INSET = 10;

/**
 * The height past which the layer panel is no longer worth keeping open: its own minimum
 * useful height plus the gap the CSS holds between the two. Above this the panel is a strip
 * of clipped rows, so the dock folds it on the way up and unfolds it on the way back down.
 */
const PANEL_SQUEEZE = 156;

/**
 * The panel fold the dock is holding while it is tall enough to need the room.
 *
 * Was a bare boolean plus an `if` at each end. The boolean could express "I folded it" but
 * not "it was already folded, so there is nothing here to give back", which is the half that
 * overrules the reader. See makeBorrow in furniture.js.
 */
const _panelRoom = makeBorrow({
    available: () => !isPanelFolded(),
    take: () => foldPanel(true),
    give: () => foldPanel(false),
});

/**
 * The tallest the dock may be.
 *
 * The old limit was 70% of the viewport, which is a number with no argument behind it: it
 * stopped the drag somewhere arbitrary and left no way to give the table the screen. The
 * limit now has a reason. The dock stops when its TOP edge is the same distance from the top
 * of the map as its BOTTOM edge is from the bottom, which is to say when its margins are
 * symmetric. That reads as deliberate rather than as having hit something, it is the full
 * screen for every practical purpose, and the strip of map left showing above is what says
 * the map is still under there and the dock is a thing sitting on it.
 *
 * @returns {number}
 */
function maxHeight() {
    return Math.max(MIN_H, window.innerHeight - 2 * INSET);
}

/** @type {HTMLElement|null} */
let _dock = null;
/** @type {string|null} the layer whose table the sliver would bring back */
let _lastLayerId = null;
/** @type {string|null} the key of the CURRENT feature's row: lit in the table, if any */
let _hitKey = null;
let _height = DEFAULT_H;
let _folded = false;
/** TIGHT, the chevron's middle step: a view that fits the rows and overwrites no height. */
let _tight = false;
/** Loose on the map rather than berthed along the bottom. */
let _float = false;
/** FULL: a takeover, not a size. `_height` keeps the reader's number underneath it. */
let _full = false;
/** The pinned width a floating dock carries; ignored while berthed, where it is full-bleed. */
let _width = 0;
let _x = 0, _y = 0;

/**
 * The dock's single applier, the same shape as the panel's: every control mutates the state
 * above and calls this, and nothing else writes a style. Publishing the height is part of it
 * rather than a separate call, because a height that changed without being published is the
 * bug this function exists to prevent.
 * @returns {void}
 */
function apply() {
    const dock = _dock;
    if (!dock) return;

    // FULL is a takeover wherever the table is. Loose and FULL, it fills the map exactly as a
    // berthed one does, while its float, position and width wait underneath untouched, so
    // releasing FULL puts it back where it was floating.
    const loose = _float && !_full;
    dock.classList.toggle('sgs-dock--float', _float);
    dock.classList.toggle('sgs-dock--full', _full);
    document.body.classList.toggle('sgs-dock-float', loose);

    // The chevron's views outrank the sizes and write over none of them. Strongest first:
    // HEADER (a folded dock is as tall as its head, whatever anyone else thinks), TIGHT (fit
    // the rows inside whatever room there is), FULL (which leaves the reader's height
    // untouched underneath), and the reader's own height.
    if (_folded) dock.style.height = 'auto';
    else if (_tight) dock.style.height = `${tightHeight()}px`;
    else dock.style.height = `${_full ? maxHeight() : _height}px`;

    if (loose) {
        const { x, y } = clampXY(_x, _y);
        _x = x; _y = y;
        dock.style.left = `${x}px`;
        dock.style.top = `${y}px`;
        dock.style.setProperty('--sgs-dock-w', `${_width || Math.round(window.innerWidth * 0.6)}px`);
    } else {
        // Berthed: left/right/bottom come from the stylesheet again. The dock is natively
        // `position: fixed` so the drag never promoted it, but it still wrote right/bottom to
        // auto on the way past, and those are exactly what a full-bleed band needs back.
        releaseDrag(dock);
        dock.style.removeProperty('--sgs-dock-w');
    }

    const pin = dock.querySelector('.sgs-dock-pin');
    if (pin) {
        pin.innerHTML = icon(_float ? 'pin-off' : 'pin', 13);
        pin.setAttribute('title', _float ? 'Berth the table' : 'Undock the table');
        pin.setAttribute('aria-label', /** @type {string} */ (pin.getAttribute('title')));
        pin.setAttribute('aria-pressed', String(!_float));
    }
    const full = dock.querySelector('.sgs-dock-full');
    if (full) {
        full.innerHTML = icon(_full ? 'tight' : 'full', 12);
        full.setAttribute('title', _full ? 'Give the room back' : 'Fill the map');
        full.setAttribute('aria-label', /** @type {string} */ (full.getAttribute('title')));
        full.setAttribute('aria-pressed', String(_full));
    }
    // The chevron's label names what the NEXT press does, and aria-expanded says whether
    // the rows are showing at all.
    const chev = dock.querySelector('.sgs-dock-fold');
    if (chev) {
        const label = FOLD_LABELS[nextFoldMode(foldMode(), tightDiffers())];
        chev.setAttribute('title', label);
        chev.setAttribute('aria-label', label);
        chev.setAttribute('aria-expanded', String(!_folded));
    }

    // Only a BERTHED dock covers the bottom of the map (or a FULL one, from anywhere). Loose,
    // it is furniture the camera still avoids by geometry, but it is not an edge any more, so
    // the panel must not be pushed up by a band that is no longer down there.
    const h = loose ? 0 : dock.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--sgs-dock-h', `${Math.round(h)}px`);

    squeezePanel();
    setPrefs({ dockFloat: _float, dockFull: _full, dockH: _height, dockW: _width, dockX: _x, dockY: _y });
}

/** Kept as the old name for callers that only mean "the height moved". @returns {void} */
function syncVar() { apply(); }

/**
 * @param {number} x @param {number} y
 * @returns {{x: number, y: number}}
 */
function clampXY(x, y) {
    const r = /** @type {HTMLElement} */ (_dock).getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(x, window.innerWidth - Math.max(120, r.width))),
        y: Math.max(0, Math.min(y, window.innerHeight - 48)),
    };
}

/**
 * Where the dock sits when it is berthed: hard against the bottom inset, full-bleed. Its y
 * depends on how tall the dock currently is, which is why the berth point is a function and
 * not a constant.
 * @returns {{x: number, y: number}}
 */
function berthPoint() {
    const h = _dock ? _dock.getBoundingClientRect().height : _height;
    return { x: INSET, y: Math.round(window.innerHeight - INSET - h) };
}

/**
 * TIGHT: the height at which the table shows every row it has and no blank band under them.
 *
 * The old double-click target was DEFAULT_H, a constant with nothing behind it — on a
 * three-row table it opened a 250px box mostly full of nothing, and on a 400-row table it was
 * indistinguishable from any other number. Measuring the content answers the question the
 * reader is actually asking, which is "show me this table, and no more screen than it needs".
 * @returns {number}
 */
function tightHeight() {
    if (!_dock) return DEFAULT_H;
    const head = /** @type {HTMLElement} */ (_dock.querySelector('.sgs-dock-head'));
    const table = _dock.querySelector('.sgs-dock-body table');
    const content = (table?.getBoundingClientRect().height ?? 0) + head.getBoundingClientRect().height;
    return Math.round(Math.max(MIN_H, Math.min(content + 2, maxHeight())));
}

/**
 * Fold the layer panel out of the way once the dock has taken its room, and give it back
 * when the dock comes down.
 *
 * The mirror half is the part worth getting right, and it is `_panelRoom` that gets it right
 * rather than this function: unfolding is conditional on the DOCK having been the one to fold
 * it, and folding is conditional on there being a fold available to take. Same shape as the
 * fold-pins-the-width rule in panel.js, which now runs through the same contract.
 *
 * @returns {void}
 */
function squeezePanel() {
    // What matters is how tall the table ACTUALLY is on screen, whichever control made it so,
    // and whether it is standing on the panel's room at all. A loose table is not, since the
    // squeeze is about the bottom band; a FULL one is, from wherever it was floating.
    const onPanelRoom = !_float || _full;
    const h = _folded ? 0 : _tight ? tightHeight() : _full ? maxHeight() : _height;
    _panelRoom.want(onPanelRoom && h > window.innerHeight - INSET - PANEL_SQUEEZE);
}

/** Give the panel back, if the dock is what took it. @returns {void} */
function releasePanel() { _panelRoom.release(); }

/**
 * Put the dock back in its berth. One function for both gestures — the pin and the drag —
 * because a drag that re-berthed into a subtly different state than the pin would be two
 * outcomes wearing one name.
 * @returns {void}
 */
function berthDock() {
    _float = false;
    apply();
}

/** @returns {boolean} */
export function isDockOpen() { return !!_dock; }

/** @param {string} layerId @returns {boolean} is the table showing THIS layer right now? */
export function isShowing(layerId) { return !!_dock && _lastLayerId === layerId; }

/**
 * What a table button does: open this layer, switch to it, or close it.
 *
 * One control, three outcomes, and the third is the one usually missing. A button that
 * only ever opens leaves the reader hunting for the dock's own close, and pressing the
 * same button again (the obvious thing to try) appears to do nothing.
 *
 * @param {string} layerId
 * @returns {void}
 */
export function toggleLayerTable(layerId) {
    if (isShowing(layerId)) closeTable();
    else showLayerTable(layerId);
}

/**
 * What a popup's table button does: show THIS feature's row, lit and scrolled into view.
 *
 * The layer row's button asks "show me this layer". A popup is about one feature, so its
 * button asks "where is this one in the table?", and opening the whole table to leave the
 * reader hunting through it answers the wrong question. Pressed again while that same row is
 * lit, it puts the table away, so it keeps the toggle the layer row's button has.
 *
 * @param {string} layerId
 * @param {unknown} keyValue the feature's value for its layer's `key`
 * @returns {void}
 */
export function toggleFeatureInTable(layerId, keyValue) {
    // A layer with no `key` cannot name a row, so the button falls back to the layer's table
    // rather than lighting whichever row happens to match "undefined".
    if (keyValue === undefined || keyValue === null) { toggleLayerTable(layerId); return; }
    const key = String(keyValue);
    if (isShowing(layerId) && _hitKey === key) { closeTable(); return; }
    if (!isShowing(layerId)) showLayerTable(layerId);
    else if (_folded) setFolded(false);
    lightRow(key, true);
}

/**
 * Light one row as the current feature, and only that row.
 * @param {string} key
 * @param {boolean} scroll bring it into view; a row the reader just clicked is already there
 * @returns {void}
 */
function lightRow(key, scroll) {
    if (!_dock) return;
    _hitKey = key;
    for (const lit of _dock.querySelectorAll('tr.sgs-row-hit')) {
        lit.classList.remove('sgs-row-hit');
        lit.removeAttribute('aria-current');
    }
    const tr = _dock.querySelector(`tr[data-key="${CSS.escape(key)}"]`);
    if (!tr) return;
    tr.classList.add('sgs-row-hit');
    tr.setAttribute('aria-current', 'true');
    // Centre, not nearest: `nearest` parks a row going upward under the sticky header.
    if (scroll) tr.scrollIntoView({ block: 'center' });
}

/** @returns {void} */
export function closeTable() {
    _dock?.remove();
    _dock = null;
    _hitKey = null;
    // A view belongs to the table that was showing; the next one opens at its natural height.
    _tight = false;
    document.body.classList.remove('sgs-dock-open');
    // The sliver is where the table went: say so, once. The dock does not go through
    // makeClosable (it removes itself outright), so it asks for the same pulse directly.
    const sliver = document.getElementById('sgs-dock-sliver');
    if (sliver) flashMark(sliver);
    // A dock that has left cannot be squeezing anything. Releasing here and not only on the
    // way down matters because closing is the other way the dock stops being tall.
    releasePanel();
}

/**
 * The always-there reopen tab. Created once at boot; CSS hides it while the dock is open.
 * @returns {void}
 */
export function initDock() {
    if (document.getElementById('sgs-dock-sliver')) return;
    const sliver = document.createElement('button');
    sliver.id = 'sgs-dock-sliver';
    sliver.className = 'sgs-mark sgs-mark--bottom';
    sliver.type = 'button';
    sliver.title = 'Open the table';
    sliver.setAttribute('aria-label', 'Open the table');
    // Points UP, back at the dock it restores, the way the panel's mark points right.
    sliver.innerHTML = icon('chevron', 10);
    sliver.addEventListener('click', () => {
        // Reopen whatever last held the dock; before anything has, the first layer is the
        // only honest guess.
        showLayerTable(_lastLayerId ?? LAYERS[0]?.id);
    });
    document.body.appendChild(sliver);
}

/** What the chevron says a press will do, by the view the press goes to. */
const FOLD_LABELS = /** @type {Record<import('./stow.js').FoldMode, string>} */ ({
    natural: 'Unfold the table',
    tight: 'Fit the table to its rows',
    header: 'Fold the table to its head',
});

/** @returns {import('./stow.js').FoldMode} */
function foldMode() { return _folded ? 'header' : _tight ? 'tight' : 'natural'; }

/**
 * Would TIGHT make the table shorter than its natural height? When the rows would fill it
 * anyway the chevron skips the step: a press that changes nothing reads as a broken button.
 * @returns {boolean}
 */
function tightDiffers() { return tightHeight() < (_full ? maxHeight() : _height) - 2; }

/**
 * Put the chevron in one of its three views. The cycle itself is nextFoldMode()'s, shared
 * with the panel, so the two cannot grow different orders.
 * @param {import('./stow.js').FoldMode} mode
 * @returns {void}
 */
function setFoldMode(mode) {
    _tight = mode === 'tight';
    setFolded(mode === 'header');
}

/** @param {boolean} next @returns {void} */
function setFolded(next) {
    if (!_dock) return;
    _folded = next;
    _dock.classList.toggle('sgs-dock--folded', next);
    // The open height is an inline style, so folding must release it: a folded dock is as
    // tall as its head and nothing else. apply() owns that, the chevron's label, and the
    // squeeze with them.
    apply();
}

/**
 * Build the dock chrome: head (title, count, fold, close), top resize grip, empty body.
 * @returns {{head: HTMLElement, body: HTMLElement, title: HTMLElement, count: HTMLElement}}
 */
function buildDock() {
    const prefs = getPrefs();
    _float = !!prefs.dockFloat;
    _full = !!prefs.dockFull;
    _height = prefs.dockH ?? DEFAULT_H;
    _width = prefs.dockW ?? 0;
    _x = prefs.dockX ?? INSET;
    _y = prefs.dockY ?? INSET;

    const dock = document.createElement('div');
    dock.id = 'sgs-dock';
    dock.className = 'sgs-dock';
    // The framework contract (app/js/utils/furniture.js): marks this as something the camera
    // pads around and popups must not cover, with no id registered anywhere else.
    dock.setAttribute('data-sgs-furniture', '');

    // Top-edge resize grip: a thin strip with a centred pill, overlaid so it costs no
    // height. Drag to resize; double-click returns the default — the grip carries its own
    // undo, same as the panel's.
    const grip = document.createElement('div');
    grip.className = 'sgs-dock-grip sgs-dock-grip--h';
    grip.title = 'Drag to resize, double-click to fit the rows';
    let resizing = false;
    grip.addEventListener('pointerdown', (e) => {
        if (_folded) return;
        resizing = true;
        grip.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        // Dragging the edge IS the reader taking the height back, so it cancels FULL rather
        // than fighting it. A grip that moved nothing because a takeover outranked it would
        // be the second-worst outcome; a grip that silently un-fulls without saying so would
        // be the worst, which is why the button's own state changes with it.
        _full = false;
        _tight = false;
        // Loose, the dock's top edge is where the pointer is. Berthed, its BOTTOM is pinned
        // to the inset, so the same drag means a height rather than a position.
        _height = Math.round(Math.max(MIN_H, Math.min(
            _float ? dock.getBoundingClientRect().bottom - e.clientY : window.innerHeight - e.clientY - INSET,
            maxHeight(),
        )));
        if (_float) _y = Math.round(e.clientY);
        apply();
    });
    const stop = (/** @type {PointerEvent} */ e) => {
        if (!resizing) return;
        resizing = false;
        try { grip.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
    // TIGHT: this axis back to what its contents actually need. The panel's grips carry the
    // same gesture with the same meaning, which is the point of giving it a word.
    grip.addEventListener('dblclick', () => {
        _full = false;
        _tight = false;
        _height = tightHeight();
        apply();
    });

    // The width grip only matters loose: berthed, the dock spans the viewport and there is no
    // width to have an opinion about. It is built unconditionally and hidden by CSS, because a
    // control that appears and disappears with a state change is a control that has to be
    // rebuilt correctly every time that state changes.
    const wgrip = document.createElement('div');
    wgrip.className = 'sgs-dock-grip sgs-dock-grip--w';
    wgrip.title = 'Drag to resize, double-click to fit the columns';
    let wresizing = false;
    wgrip.addEventListener('pointerdown', (e) => {
        if (_folded || !_float) return;
        wresizing = true;
        wgrip.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    wgrip.addEventListener('pointermove', (e) => {
        if (!wresizing) return;
        _full = false;
        _width = Math.round(Math.max(MIN_W, Math.min(e.clientX - dock.getBoundingClientRect().left, window.innerWidth)));
        apply();
    });
    const wstop = (/** @type {PointerEvent} */ e) => {
        if (!wresizing) return;
        wresizing = false;
        try { wgrip.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    wgrip.addEventListener('pointerup', wstop);
    wgrip.addEventListener('pointercancel', wstop);
    wgrip.addEventListener('dblclick', () => {
        const table = dock.querySelector('.sgs-dock-body table');
        _width = Math.round(Math.max(MIN_W, Math.min(
            (table?.getBoundingClientRect().width ?? MIN_W) + 4, window.innerWidth - 2 * INSET,
        )));
        apply();
    });

    const head = document.createElement('div');
    head.className = 'sgs-dock-head';

    // Swatch, pill, name, count: the same opening phrase as a layer row and a popup title.
    const swatch = document.createElement('span');
    swatch.className = 'sgs-dock-swatch';
    const pill = document.createElement('span');
    pill.className = 'sgs-dock-pill';
    const title = document.createElement('span');
    title.className = 'sgs-dock-title';
    const count = document.createElement('span');
    count.className = 'sgs-dock-count';

    const spacer = document.createElement('span');
    spacer.className = 'sgs-dock-spacer';

    // FULL and PIN answer "how much room, and where"; FOLD and CLOSE answer "is the content
    // showing". Grouping them in that order, in both the panel's berth and here, is what lets
    // a reader learn the row once.
    const full = document.createElement('button');
    full.type = 'button';
    full.className = 'sgs-icon-btn sgs-dock-full';
    full.addEventListener('click', (e) => {
        e.stopPropagation();
        _full = !_full;
        // Asking for the room is asking to see the rows: the chevron goes back to NATURAL.
        _tight = false;
        if (_folded) setFolded(false); else apply();
    });

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'sgs-icon-btn sgs-dock-pin';
    pin.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_float) {
            berthDock();
        } else {
            // Undocking keeps the height and takes a width, because a full-bleed band dropped
            // into the middle of the map is not a window, it is the same band with a gap under
            // it. The width it takes is the one it had, which makes the transition read as
            // picking the thing up rather than as resizing it.
            _width = _width || Math.round(Math.min(dock.getBoundingClientRect().width, window.innerWidth * 0.6));
            const r = dock.getBoundingClientRect();
            _x = Math.round(r.left); _y = Math.round(r.top);
            _float = true;
            apply();
        }
    });

    const fold = document.createElement('button');
    fold.type = 'button';
    fold.className = 'sgs-icon-btn sgs-dock-fold';
    fold.innerHTML = icon('chevron', 12);
    // One chevron, three steps, the same cycle the panel's takes. Its label is apply()'s.
    fold.addEventListener('click', (e) => {
        e.stopPropagation();
        setFoldMode(nextFoldMode(foldMode(), tightDiffers()));
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'sgs-icon-btn';
    close.title = 'Close the table';
    close.setAttribute('aria-label', 'Close the table');
    close.innerHTML = icon('close', 12);
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTable(); });

    // The buttons sit in the group every furniture head shares, so the table's four and the
    // panel's four are spaced by one rule, not by each head's own gap (furniture.css).
    const actions = document.createElement('span');
    actions.className = 'sgs-head-actions';
    actions.append(full, pin, fold, close);
    head.append(swatch, pill, title, count, spacer, actions);
    // A folded dock is one bar; the whole bar is the unfold control, not just the chevron.
    head.addEventListener('click', () => { if (_folded) setFolded(false); });

    const body = document.createElement('div');
    body.className = 'sgs-dock-body';

    // Same gesture as the panel: the head drags it loose, and letting go near the berth puts
    // it back. The berth is the whole bottom edge, so "near" means held against the bottom
    // anywhere along it, not near one corner of it: see nearBottomBerth() in furniture.js.
    makeDraggable(dock, head, ({ x, y }) => {
        if (_folded) return;
        _float = true;
        _full = false;
        _width = _width || Math.round(dock.getBoundingClientRect().width);
        _x = x; _y = y;
        dock.classList.toggle('sgs-snapping', nearBottomBerth({ top: y }, berthPoint().y));
        apply();
    }, ({ y }) => {
        dock.classList.remove('sgs-snapping');
        if (_float && nearBottomBerth({ top: y }, berthPoint().y)) berthDock();
    });

    dock.append(grip, wgrip, head, body);
    document.body.appendChild(dock);
    _dock = dock;
    document.body.classList.add('sgs-dock-open');
    apply();
    return { head, body, title, count };
}

/**
 * Fill the dock with one layer's rows, opening (and unfolding) it if needed.
 * @param {string} layerId
 * @returns {void}
 */
export function showLayerTable(layerId) {
    const def = layerById(layerId);
    if (!def) return;
    _lastLayerId = layerId;
    // A rebuilt table has no current row until something points at one.
    _hitKey = null;

    if (!_dock) buildDock();
    const dock = /** @type {HTMLElement} */ (_dock);
    const title = /** @type {HTMLElement} */ (dock.querySelector('.sgs-dock-title'));
    const count = /** @type {HTMLElement} */ (dock.querySelector('.sgs-dock-count'));
    const body = /** @type {HTMLElement} */ (dock.querySelector('.sgs-dock-body'));

    const features = featuresOf(layerId);
    title.textContent = def.label;
    count.textContent = `${features.length} rows`;

    const swatch = /** @type {HTMLElement} */ (dock.querySelector('.sgs-dock-swatch'));
    const pill = /** @type {HTMLElement} */ (dock.querySelector('.sgs-dock-pill'));
    swatch.textContent = '';
    swatch.appendChild(buildSymbolSwatch(def));
    pill.textContent = '';
    pill.appendChild(makeTypePill(getSourcePill(def.type)));

    body.textContent = '';
    const table = document.createElement('table');
    table.className = 'sgs-table';

    // Header cells read like the popup's field rows: a type badge, then the field name.
    // The popup shows one feature's fields down the page and the table shows them across
    // it, so making the two look alike is what lets a reader carry one mental model
    // between them. A column's type comes from its first non-null value; see
    // field-badge.js for why that is the honest answer without a schema.
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    // The zoom-to rail's own header: empty, and narrow. It is a column of controls, not of
    // data, so labelling it would put a word in the header row that describes furniture.
    const goTh = document.createElement('th');
    goTh.className = 'sgs-go-col';
    goTh.setAttribute('aria-label', 'Zoom to feature');
    hr.appendChild(goTh);
    for (const f of def.fields) {
        const th = document.createElement('th');
        const wrap = document.createElement('span');
        wrap.className = 'sgs-th-field';
        wrap.appendChild(buildFieldBadge(inferColumnType(features, f)));
        const name = document.createElement('span');
        name.className = 'sgs-field-name';
        name.textContent = f;
        wrap.appendChild(name);
        th.appendChild(wrap);
        hr.appendChild(th);
    }
    thead.appendChild(hr);

    const tbody = document.createElement('tbody');
    for (const feat of features) {
        const tr = document.createElement('tr');
        tr.tabIndex = 0;
        // No key, no identity: such a row can still zoom, it just cannot be the current one.
        const raw = feat.properties?.[def.key];
        const key = raw === undefined || raw === null ? null : String(raw);
        if (key !== null) tr.dataset.key = key;

        // Double-clicking a row has always zoomed to its feature, and nothing said so. A
        // gesture with no visible affordance is a gesture only its author knows about, so
        // the rail carries the same action as a button the reader can see and tab to.
        const goTd = document.createElement('td');
        goTd.className = 'sgs-go-col';
        const goBtn = document.createElement('button');
        goBtn.type = 'button';
        goBtn.className = 'sgs-icon-btn';
        // The same glyph the layer row's zoom-to uses. One action, one symbol, wherever it
        // appears: a reader who learned it on the row does not have to learn it again here.
        goBtn.innerHTML = icon('target', 12);
        goBtn.title = `Zoom to ${feat.properties?.[def.fields[1]] ?? 'this feature'}`;
        goBtn.setAttribute('aria-label', goBtn.title);
        goTd.appendChild(goBtn);
        tr.appendChild(goTd);

        for (const f of def.fields) {
            const td = document.createElement('td');
            const v = feat.properties?.[f];
            td.textContent = v === null || v === undefined ? '' : String(v);
            tr.appendChild(td);
        }
        // Row to map. The camera pads for the dock itself, so the feature does not land
        // underneath the row you clicked to find it; then the feature flashes, because a
        // camera that lands on a screen of neighbours has not said which one it meant. The
        // row becomes the current one, the same state a popup's table button lights.
        const go = () => {
            zoomToFeature(feat);
            flashFeature(layerId, feat);
            if (key !== null) lightRow(key, false);
        };
        goBtn.addEventListener('click', (e) => { e.stopPropagation(); go(); });
        tr.addEventListener('dblclick', go);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        tbody.appendChild(tr);
    }

    table.append(thead, tbody);
    body.appendChild(table);
    if (_folded) setFolded(false); else syncVar();
}
