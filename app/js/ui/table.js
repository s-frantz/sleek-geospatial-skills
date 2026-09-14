/**
 * table.js — the table: a band across the foot of the viewport showing one layer's rows.
 *
 * ── Three states, three shapes ───────────────────────────────────────────────────────────
 *   OPEN     a full-width card (small inset each side), resizable by dragging its top edge.
 *            The layer panel gives up its bottom: a body class plus the `--sgs-table-h`
 *            variable raise the panel so the two never overlap, and the CSS owns that rule —
 *            the table only publishes its height.
 *   FOLDED   the head alone, still full width, still reporting "Stations, 24 rows". A fold
 *            and not a stow, because the head has something to say while shut — apply the
 *            test from the `ui-stow` skill to anything you add here.
 *   CLOSED   the table leaves entirely. What remains is its MARK: a small tab parked at the
 *            bottom-centre edge that brings the table back, the same put-away grammar as
 *            everything else, just against the viewport instead of a panel.
 *
 * ── Docked, or undocked ─────────────────────────────────────────────────────────────────────
 * The table docks, exactly like the panel, and it carries the same pair of gestures: a dock
 * button in its head, and a drag that undocks it and a drag back that docks it again.
 * Before, the table was the one piece of chrome nailed to the viewport, which made it the one
 * piece a reader could not move off the thing they were trying to look at.
 *
 * Undocked, it stops being bottom-edge furniture: `edgeOf` in furniture.js reads geometry rather
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
import { iconButton, setButton } from './buttons.js';
import { buildFieldBadge, inferColumnType } from './field-badge.js';
import { buildSymbolSwatch } from './symbology.js';
import { getSourcePill, makeTypePill } from './type-pill.js';
import { foldPanel, isPanelFolded } from './panel.js';
import { flashMark, nextFoldMode, stowInto } from './stow.js';
import { makeDraggable, releaseDrag } from '../utils/draggable.js';
import { nearBottomEdge, makeBorrow } from '../utils/furniture.js';
import { getPrefs, setPrefs } from '../utils/prefs.js';

/** Default open height, px. */
const DEFAULT_H = 250;
const MIN_H = 120;
const MIN_W = 280;

/** Matches --sgs-panel-inset in furniture.css: the gap the table keeps from the viewport. */
const INSET = 10;

/**
 * The height past which the layer panel is no longer worth keeping open: its own minimum
 * useful height plus the gap the CSS holds between the two. Above this the panel is a strip
 * of clipped rows, so the table folds it on the way up and unfolds it on the way back down.
 */
const PANEL_SQUEEZE = 156;

/**
 * The panel fold the table is holding while it is tall enough to need the room.
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
 * The tallest the table may be.
 *
 * The old limit was 70% of the viewport, which is a number with no argument behind it: it
 * stopped the drag somewhere arbitrary and left no way to give the table the screen. The
 * limit now has a reason. The table stops when its TOP edge is the same distance from the top
 * of the map as its BOTTOM edge is from the bottom, which is to say when its margins are
 * symmetric. That reads as deliberate rather than as having hit something, it is the full
 * screen for every practical purpose, and the strip of map left showing above is what says
 * the map is still under there and the table is a thing sitting on it.
 *
 * @returns {number}
 */
function maxHeight() {
    return Math.max(MIN_H, window.innerHeight - 2 * INSET);
}

/** @type {HTMLElement|null} */
let _table = null;
/** @type {string|null} the layer whose table the mark would bring back */
let _lastLayerId = null;
/** @type {string|null} the key of the one lit row, if any */
let _hitKey = null;
/**
 * The popup feature whose table button lit the row, or last cleared it: that button's next
 * press moves on (clear, then close), where any other popup's press lights its own row. Null
 * when the table was opened or re-lit some other way (the layer row, the mark, a zoom-to).
 * @type {string|null}
 */
let _owner = null;
let _height = DEFAULT_H;
let _folded = false;
/** TIGHT, the chevron's second view: fits the rows and overwrites no height. */
let _tight = false;
/** SNUG, the chevron's fourth view: TIGHT, and as narrow as the columns. Overwrites no width. */
let _snug = false;
/** The current table's own width (max-content), measured when it is built: SNUG's target. */
let _contentW = 0;
/** Undocked on the map rather than docked along the bottom. */
let _undocked = false;
/** FULL: a takeover, not a size. `_height` keeps the reader's number underneath it. */
let _full = false;
/** The width an undocked table carries; ignored while docked, where it is full-bleed. */
let _width = 0;
let _x = 0, _y = 0;

/**
 * The table's single applier, the same shape as the panel's: every control mutates the state
 * above and calls this, and nothing else writes a style. Publishing the height is part of it
 * rather than a separate call, because a height that changed without being published is the
 * bug this function exists to prevent.
 * @returns {void}
 */
function apply() {
    const table = _table;
    if (!table) return;

    // FULL is a takeover wherever the table is. Undocked and FULL, it fills the map exactly as a
    // docked one does, while its undocked position and width wait underneath untouched,
    // so releasing FULL puts it back where it was.
    const undocked = _undocked && !_full;
    table.classList.toggle('sgs-table--undocked', _undocked);
    table.classList.toggle('sgs-table--full', _full);
    table.classList.toggle('sgs-table--tight', _tight && !_folded);
    table.classList.toggle('sgs-table--snug', _snug && !_folded);
    document.body.classList.toggle('sgs-table-undocked', undocked);

    // The chevron's views outrank the sizes and write over none of them. Strongest first:
    // HEAD (a folded table is as tall as its head, whatever anyone else thinks), TIGHT (fit
    // the rows inside whatever room there is), FULL (which leaves the reader's height
    // untouched underneath), and the reader's own height.
    if (_folded) table.style.height = 'auto';
    else if (fitsRows()) table.style.height = `${tightHeight()}px`;
    else table.style.height = `${_full ? maxHeight() : _height}px`;
    // SNUG takes the width in to the columns as well; every other view leaves the width alone.
    // An inline width, so it wins over the undocked width and the docked full bleed alike.
    if (_snug && !_folded) table.style.width = `${snugWidth()}px`;
    else table.style.removeProperty('width');

    if (undocked) {
        const { x, y } = clampXY(_x, _y);
        _x = x; _y = y;
        table.style.left = `${x}px`;
        table.style.top = `${y}px`;
        table.style.setProperty('--sgs-table-w', `${_width || Math.round(window.innerWidth * 0.6)}px`);
    } else {
        // Docked: left/right/bottom come from the stylesheet again. The table is natively
        // `position: fixed` so the drag never promoted it, but it still wrote right/bottom to
        // auto on the way past, and those are exactly what a full-bleed band needs back.
        releaseDrag(table);
        table.style.removeProperty('--sgs-table-w');
    }

    const dockBtn = table.querySelector('.sgs-table-dock');
    // "Dock" and "Undock", the words the panel's dock button uses: one verb for one gesture everywhere.
    if (dockBtn) setButton(dockBtn, {
        glyph: _undocked ? 'pin-off' : 'pin', size: 13,
        label: _undocked ? 'Dock the table' : 'Undock the table', pressed: !_undocked,
    });
    const full = table.querySelector('.sgs-table-full');
    if (full) setButton(full, {
        glyph: _full ? 'tight' : 'full',
        label: _full ? 'Give the room back' : 'Fill the map', pressed: _full,
    });
    // The chevron's label names what the NEXT press does, and aria-expanded says whether
    // the rows are showing at all.
    const chev = table.querySelector('.sgs-table-fold');
    if (chev) {
        setButton(chev, { label: FOLD_LABELS[nextFoldMode(foldMode(), offer())] });
        chev.setAttribute('aria-expanded', String(!_folded));
    }

    // Only a DOCKED table covers the bottom of the map (or a FULL one, from anywhere). Undocked,
    // it is furniture the camera still avoids by geometry, but it is not an edge any more, so
    // the panel must not be pushed up by a band that is no longer down there.
    const h = undocked ? 0 : table.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--sgs-table-h', `${Math.round(h)}px`);

    squeezePanel();
    setPrefs({ tableUndocked: _undocked, tableFull: _full, tableH: _height, tableW: _width, tableX: _x, tableY: _y });
}

/** Kept as the old name for callers that only mean "the height moved". @returns {void} */
function syncVar() { apply(); }

/**
 * @param {number} x @param {number} y
 * @returns {{x: number, y: number}}
 */
function clampXY(x, y) {
    const r = /** @type {HTMLElement} */ (_table).getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(x, window.innerWidth - Math.max(120, r.width))),
        y: Math.max(0, Math.min(y, window.innerHeight - 48)),
    };
}

/**
 * Where the table sits when it is docked: hard against the bottom inset, full-bleed. Its y
 * depends on how tall the table currently is, which is why the dock point is a function and
 * not a constant.
 * @returns {{x: number, y: number}}
 */
function dockPoint() {
    const h = _table ? _table.getBoundingClientRect().height : _height;
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
    if (!_table) return DEFAULT_H;
    const head = /** @type {HTMLElement} */ (_table.querySelector('.sgs-table-head'));
    const grid = _table.querySelector('.sgs-table-body table');
    const content = (grid?.getBoundingClientRect().height ?? 0) + head.getBoundingClientRect().height;
    // No floor: fitted to the rows means fitted, a two-row table included. MIN_H is the grip's
    // floor, a limit on dragging, not on what the content is allowed to need.
    return Math.round(Math.min(content + 2, maxHeight()));
}

/**
 * Fold the layer panel out of the way once the table has taken its room, and give it back
 * when the table comes down.
 *
 * The mirror half is the part worth getting right, and it is `_panelRoom` that gets it right
 * rather than this function: unfolding is conditional on the TABLE having been the one to fold
 * it, and folding is conditional on there being a fold available to take. Same shape as the
 * fold-sets-the-width rule in panel.js, which now runs through the same contract.
 *
 * @returns {void}
 */
function squeezePanel() {
    // What matters is how tall the table ACTUALLY is on screen, whichever control made it so,
    // and whether it is standing on the panel's room at all. An undocked table is not, since the
    // squeeze is about the bottom band; a FULL one is, from wherever it was undocked.
    const onPanelRoom = !_undocked || _full;
    const h = _folded ? 0 : fitsRows() ? tightHeight() : _full ? maxHeight() : _height;
    _panelRoom.want(onPanelRoom && h > window.innerHeight - INSET - PANEL_SQUEEZE);
}

/** Give the panel back, if the table is what took it. @returns {void} */
function releasePanel() { _panelRoom.release(); }

/**
 * Dock the table. One function for both gestures, the dock button and the drag,
 * because a drag that re-docked into a subtly different state than the dock button would be two
 * outcomes wearing one name.
 * @returns {void}
 */
function dockTable() {
    _undocked = false;
    apply();
}

/** @returns {boolean} */
export function isTableOpen() { return !!_table; }

/** @param {string} layerId @returns {boolean} is the table showing THIS layer right now? */
export function isShowing(layerId) { return !!_table && _lastLayerId === layerId; }

/**
 * What a table button does: open this layer, switch to it, or close it.
 *
 * One control, three outcomes, and the third is the one usually missing. A button that
 * only ever opens leaves the reader hunting for the table's own close, and pressing the
 * same button again (the obvious thing to try) appears to do nothing.
 *
 * @param {string} layerId
 * @returns {void}
 */
export function toggleLayerTable(layerId) {
    if (isShowing(layerId)) closeTable();
    else showLayerTable(layerId);
}

/** @param {string} layerId @param {string} key @returns {string} */
const ownerOf = (layerId, key) => `${layerId}\u0000${key}`;

/**
 * Where a popup's table button stands for its feature, which decides what its next press does.
 *   closed   no table: the press opens it on this feature's row, lit
 *   lit      this feature's row is the lit one: the press clears it
 *   cleared  this button cleared its row a moment ago: the press closes the table
 *   other    the table is open for some other reason: the press lights this feature's row
 *
 * `other` is why the cycle needs an owner and not just the table's state: a table opened from
 * the layer list, from another popup, or reopened from its tab has nothing lit by THIS button,
 * so the press still means "show me my row", never "close whatever is there".
 *
 * @param {string} layerId
 * @param {unknown} keyValue the feature's value for its layer's `key`
 * @returns {'closed'|'lit'|'cleared'|'other'}
 */
export function featureTableState(layerId, keyValue) {
    if (!_table) return 'closed';
    if (keyValue === undefined || keyValue === null) return 'other';
    const key = String(keyValue);
    if (_lastLayerId === layerId && _hitKey === key) return 'lit';
    return _owner === ownerOf(layerId, key) ? 'cleared' : 'other';
}

/** What the button says its next press does, by the state it is in. */
export const FEATURE_TABLE_LABELS = /** @type {const} */ ({
    closed: 'Find this feature in the table',
    other: 'Find this feature in the table',
    lit: 'Clear this feature\'s row',
    cleared: 'Close the table',
});

/**
 * What a popup's table button does: three presses, find, clear, close. See
 * featureTableState() for which press is which.
 *
 * The first press is the reason to open from a popup rather than from the layer row: a popup
 * is about one feature, and a table that opened without saying where it is would leave the
 * reader hunting. The second clears the row and leaves the table, so the button can be pressed
 * again without losing the table; the third puts the table away, as the layer row's does.
 *
 * @param {string} layerId
 * @param {unknown} keyValue the feature's value for its layer's `key`
 * @returns {void}
 */
export function toggleFeatureInTable(layerId, keyValue) {
    // A layer with no `key` cannot name a row, so its button is the plain toggle the layer
    // row has, rather than lighting whichever row happens to match "undefined".
    if (keyValue === undefined || keyValue === null) { toggleLayerTable(layerId); return; }
    const key = String(keyValue);
    const state = featureTableState(layerId, key);
    if (state === 'cleared') { closeTable(); return; }
    if (state === 'lit') {
        lightRow(null, false);
        _owner = ownerOf(layerId, key);
        tableChanged();
        return;
    }
    if (!isShowing(layerId)) showLayerTable(layerId);
    else if (_folded) setFolded(false);
    lightRow(key, true);
    _owner = ownerOf(layerId, key);
    tableChanged();
}

/**
 * Tell anything showing the table's state (a popup's pressed button) that it moved. An event
 * rather than a callback list, so a popup that closes takes its listener with it.
 * @returns {void}
 */
function tableChanged() {
    document.dispatchEvent(new CustomEvent('sgs-table-change'));
}

/**
 * A popup is closing: if its table button is the one that lit the row, the row goes dark with
 * it. A row lit some other way (a zoom-to, another popup) is not this popup's to clear.
 * @param {string} layerId
 * @param {unknown} keyValue
 * @returns {void}
 */
export function releaseFeatureRow(layerId, keyValue) {
    if (!_table || keyValue === undefined || keyValue === null) return;
    const key = String(keyValue);
    if (_owner !== ownerOf(layerId, key)) return;
    if (_lastLayerId === layerId && _hitKey === key) lightRow(null, false);
    _owner = null;
    tableChanged();
}

/**
 * Light one row as the current feature, and only that row, or none.
 * @param {string|null} key null clears the lit row
 * @param {boolean} scroll bring it into view; a row the reader just clicked is already there
 * @returns {void}
 */
function lightRow(key, scroll) {
    if (!_table) return;
    _hitKey = key;
    for (const lit of _table.querySelectorAll('tr.sgs-row-hit')) {
        lit.classList.remove('sgs-row-hit');
        lit.removeAttribute('aria-current');
    }
    if (key === null) return;
    const tr = _table.querySelector(`tr[data-key="${CSS.escape(key)}"]`);
    if (!tr) return;
    tr.classList.add('sgs-row-hit');
    tr.setAttribute('aria-current', 'true');
    // Centre, not nearest: `nearest` parks a row going upward under the sticky header.
    if (scroll) tr.scrollIntoView({ block: 'center' });
}

/** @returns {void} */
export function closeTable() {
    const leaving = _table;
    _table = null;
    _hitKey = null;
    _owner = null;
    // A view belongs to the table that was showing; the next one opens at its natural size.
    _tight = false;
    _snug = false;
    document.body.classList.remove('sgs-table-open');
    // The mark is where the table went: the table shrinks into it, then it pulses once. The
    // table does not go through makeClosable (it removes itself outright), so it asks for the
    // same two steps directly. The state above is already "closed"; what shrinks is only the
    // table's last picture of itself, stripped of its id, its furniture marker and its clicks
    // so nothing can mistake it for the table while it goes.
    const mark = document.getElementById('sgs-table-mark');
    if (leaving) {
        leaving.removeAttribute('id');
        leaving.removeAttribute('data-sgs-furniture');
        leaving.inert = true;
        if (mark) stowInto(leaving, mark, () => { leaving.remove(); flashMark(mark); });
        else leaving.remove();
    }
    tableChanged();
    // A table that has left cannot be squeezing anything. Releasing here and not only on the
    // way down matters because closing is the other way the table stops being tall.
    releasePanel();
}

/**
 * The always-there reopen tab. Created once at boot; CSS hides it while the table is open.
 * @returns {void}
 */
export function initTable() {
    if (document.getElementById('sgs-table-mark')) return;
    const mark = iconButton({
        className: 'sgs-mark sgs-mark--bottom',
        // Points UP, back at the table it restores, the way the panel's mark points right.
        glyph: 'chevron',
        size: 10,
        label: 'Open the table',
        // Reopen whatever last held the table; before anything has, the first layer is the
        // only honest guess.
        onClick: () => showLayerTable(_lastLayerId ?? LAYERS[0]?.id),
    });
    mark.id = 'sgs-table-mark';
    document.body.appendChild(mark);
}

/** What the chevron says a press will do, by the view the press goes to. */
const FOLD_LABELS = /** @type {Record<import('./stow.js').FoldMode, string>} */ ({
    natural: 'Unfold the table',
    tight: 'Fit the table to its rows',
    head: 'Fold the table to its head',
    snug: 'Fit the table to its rows and columns',
});

/** @returns {import('./stow.js').FoldMode} */
function foldMode() { return _folded ? 'head' : _snug ? 'snug' : _tight ? 'tight' : 'natural'; }

/**
 * Could every row show on screen at once? TIGHT is offered exactly when they could, growing the
 * table or shrinking it to get there; when they could not, "fitted to its rows" would be a lie.
 * @returns {boolean}
 */
function tightFits() {
    if (!_table) return false;
    const head = /** @type {HTMLElement} */ (_table.querySelector('.sgs-table-head'));
    const grid = _table.querySelector('.sgs-table-body table');
    return head.getBoundingClientRect().height + (grid?.getBoundingClientRect().height ?? 0) + 2
        <= maxHeight();
}

/** Is the height the rows' own right now? TIGHT, or SNUG whose rows fit. @returns {boolean} */
function fitsRows() { return _tight || (_snug && tightFits()); }

/** The width SNUG gives the table: its columns', within the map. @returns {number} */
function snugWidth() { return Math.round(Math.min(_contentW + 2, window.innerWidth - 2 * INSET)); }

/** The width a docked table has, full bleed, and so the one it keeps when it comes undocked. */
function dockedWidth() { return Math.round(window.innerWidth - 2 * INSET); }

/**
 * Is there width to take in? SNUG is skipped when there is not, because it would then be
 * TIGHT again, and the step that is TIGHT's job has already come round.
 * @returns {boolean}
 */
function snugDiffers() {
    const natural = _undocked && !_full ? (_width || Math.round(window.innerWidth * 0.6)) : dockedWidth();
    return _contentW > 0 && snugWidth() < natural - 2;
}

/** Which fitted views can do their job right now. */
function offer() { return { tight: tightFits(), snug: snugDiffers() }; }

/**
 * Put the chevron in one of its four views. The cycle itself is nextFoldMode()'s, shared
 * with the panel, so the two cannot grow different orders.
 * @param {import('./stow.js').FoldMode} mode
 * @returns {void}
 */
function setFoldMode(mode) {
    _tight = mode === 'tight';
    _snug = mode === 'snug';
    setFolded(mode === 'head');
}

/** @param {boolean} next @returns {void} */
function setFolded(next) {
    if (!_table) return;
    _folded = next;
    _table.classList.toggle('sgs-table--folded', next);
    // The open height is an inline style, so folding must release it: a folded table is as
    // tall as its head and nothing else. apply() owns that, the chevron's label, and the
    // squeeze with them.
    apply();
}

/**
 * Build the table chrome: head (title, count, fold, close), top resize grip, empty body.
 * @returns {{head: HTMLElement, body: HTMLElement, title: HTMLElement, count: HTMLElement}}
 */
function buildTable() {
    const prefs = getPrefs();
    _undocked = !!prefs.tableUndocked;
    _full = !!prefs.tableFull;
    _height = prefs.tableH ?? DEFAULT_H;
    _width = prefs.tableW ?? 0;
    _x = prefs.tableX ?? INSET;
    _y = prefs.tableY ?? INSET;

    const table = document.createElement('div');
    table.id = 'sgs-table';
    table.className = 'sgs-table';
    // The framework contract (app/js/utils/furniture.js): marks this as something the camera
    // pads around and popups must not cover, with no id registered anywhere else.
    table.setAttribute('data-sgs-furniture', '');

    // Top-edge resize grip: a thin strip with a centred pill, overlaid so it costs no
    // height. Drag to resize; double-click returns the default — the grip carries its own
    // undo, same as the panel's.
    const grip = document.createElement('div');
    grip.className = 'sgs-table-grip sgs-table-grip--h';
    grip.title = 'Drag to set the height, double-click to fit the rows';
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
        _snug = false;
        // Undocked, the table's top edge is where the pointer is. Docked, its BOTTOM is held
        // to the inset, so the same drag means a height rather than a position.
        _height = Math.round(Math.max(MIN_H, Math.min(
            _undocked ? table.getBoundingClientRect().bottom - e.clientY : window.innerHeight - e.clientY - INSET,
            maxHeight(),
        )));
        if (_undocked) _y = Math.round(e.clientY);
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
        _snug = false;
        _height = Math.max(MIN_H, tightHeight());
        apply();
    });

    // The width grip only matters undocked: docked, the table spans the viewport and there is no
    // width to have an opinion about. It is built unconditionally and hidden by CSS, because a
    // control that appears and disappears with a state change is a control that has to be
    // rebuilt correctly every time that state changes.
    const wgrip = document.createElement('div');
    wgrip.className = 'sgs-table-grip sgs-table-grip--w';
    wgrip.title = 'Drag to set the width, double-click to fit the columns';
    let wresizing = false;
    wgrip.addEventListener('pointerdown', (e) => {
        if (_folded || !_undocked) return;
        wresizing = true;
        wgrip.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    wgrip.addEventListener('pointermove', (e) => {
        if (!wresizing) return;
        _full = false;
        // The reader is setting the width by hand, so SNUG's fitted width gives way to it.
        _snug = false;
        _width = Math.round(Math.max(MIN_W, Math.min(e.clientX - table.getBoundingClientRect().left, window.innerWidth)));
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
        const grid = table.querySelector('.sgs-table-body table');
        _width = Math.round(Math.max(MIN_W, Math.min(
            (grid?.getBoundingClientRect().width ?? MIN_W) + 4, window.innerWidth - 2 * INSET,
        )));
        apply();
    });

    const head = document.createElement('div');
    head.className = 'sgs-table-head';

    // Swatch, pill, name, count: the same opening phrase as a layer row and a popup title.
    const swatch = document.createElement('span');
    swatch.className = 'sgs-table-swatch';
    const pill = document.createElement('span');
    pill.className = 'sgs-table-pill';
    const title = document.createElement('span');
    title.className = 'sgs-table-title';
    const count = document.createElement('span');
    count.className = 'sgs-table-count';

    const spacer = document.createElement('span');
    spacer.className = 'sgs-table-spacer';

    // FULL and DOCK answer "how much room, and where"; FOLD and CLOSE answer "is the content
    // showing". Grouping them in that order, in both the panel's head and here, is what lets
    // a reader learn the row once.
    const full = iconButton({ className: 'sgs-icon-btn sgs-table-full', onClick: (e) => {
        e.stopPropagation();
        _full = !_full;
        // Asking for the room is asking to see the rows: the chevron goes back to NATURAL.
        _tight = false;
        _snug = false;
        if (_folded) setFolded(false); else apply();
    } });

    const dockBtn = iconButton({ className: 'sgs-icon-btn sgs-table-dock', onClick: (e) => {
        e.stopPropagation();
        if (_undocked) {
            dockTable();
        } else {
            // Undocking changes WHERE the table is, never its size: it keeps its height and its
            // full width, so the press reads as picking the thing up. Narrowing it is SNUG's
            // job (the chevron), which fits it to its columns; an undock that also resized it
            // was two gestures in one button.
            _width = dockedWidth();
            const r = table.getBoundingClientRect();
            _x = Math.round(r.left); _y = Math.round(r.top);
            _undocked = true;
            apply();
        }
    } });

    // One chevron, four views, the same cycle the panel's takes. Its label is apply()'s.
    const fold = iconButton({ className: 'sgs-icon-btn sgs-table-fold', glyph: 'chevron', onClick: (e) => {
        e.stopPropagation();
        setFoldMode(nextFoldMode(foldMode(), offer()));
    } });

    const close = iconButton({
        glyph: 'close',
        label: 'Close the table',
        onClick: (e) => { e.stopPropagation(); closeTable(); },
    });

    // The buttons sit in the group every furniture head shares, so the table's four and the
    // panel's four are spaced by one rule, not by each head's own gap (furniture.css).
    const actions = document.createElement('span');
    actions.className = 'sgs-head-actions';
    actions.append(full, dockBtn, fold, close);
    head.append(swatch, pill, title, count, spacer, actions);
    // A folded table unfolds from its chevron, as the panel does; its bar is a handle to drag,
    // not a button. The whole bar used to unfold it, which made this the one head that behaved
    // differently from the others, and made every drag of a folded table end in an unfold.

    const body = document.createElement('div');
    body.className = 'sgs-table-body';

    // Same gesture as the panel, docked or undocked, folded or not: dragging the head undocks the
    // table, and letting go near the bottom edge docks it again. It docks along the whole edge,
    // so "near" means held against the bottom anywhere along it, not near one corner of it: see
    // nearBottomEdge() in furniture.js. A nudge that never leaves the edge's catch therefore
    // changes nothing, which is what makes grabbing the head safe.
    makeDraggable(table, head, ({ x, y, ctrl }) => {
        // Picked up from its edge, it keeps the width it had there, as the dock button does.
        if (!_undocked) _width = dockedWidth();
        _undocked = true;
        _full = false;
        _x = x; _y = y;
        // Ctrl held leaves the snap off, as it does for the panel.
        table.classList.toggle('sgs-snapping', !ctrl && nearBottomEdge({ top: y }, dockPoint().y));
        apply();
    }, ({ y, ctrl }) => {
        table.classList.remove('sgs-snapping');
        if (_undocked && !ctrl && nearBottomEdge({ top: y }, dockPoint().y)) dockTable();
    });

    table.append(grip, wgrip, head, body);
    document.body.appendChild(table);
    _table = table;
    document.body.classList.add('sgs-table-open');
    apply();
    return { head, body, title, count };
}

/**
 * Fill the table with one layer's rows, opening (and unfolding) it if needed.
 * @param {string} layerId
 * @returns {void}
 */
export function showLayerTable(layerId) {
    const def = layerById(layerId);
    if (!def) return;
    _lastLayerId = layerId;
    // A rebuilt table has no lit row and no owner until something points at one.
    _hitKey = null;
    _owner = null;

    if (!_table) buildTable();
    const table = /** @type {HTMLElement} */ (_table);
    const title = /** @type {HTMLElement} */ (table.querySelector('.sgs-table-title'));
    const count = /** @type {HTMLElement} */ (table.querySelector('.sgs-table-count'));
    const body = /** @type {HTMLElement} */ (table.querySelector('.sgs-table-body'));

    const features = featuresOf(layerId);
    title.textContent = def.label;
    count.textContent = `${features.length} rows`;

    const swatch = /** @type {HTMLElement} */ (table.querySelector('.sgs-table-swatch'));
    const pill = /** @type {HTMLElement} */ (table.querySelector('.sgs-table-pill'));
    swatch.textContent = '';
    swatch.appendChild(buildSymbolSwatch(def));
    pill.textContent = '';
    pill.appendChild(makeTypePill(getSourcePill(def.type)));

    body.textContent = '';
    const grid = document.createElement('table');
    grid.className = 'sgs-grid';

    // Header cells read like the popup's field rows: a type badge, then the field name.
    // The popup shows one feature's fields down the page and the table shows them across
    // it, so making the two look alike is what lets a reader carry one mental model
    // between them. A column's type comes from its first non-null value; see
    // field-badge.js for why that is the honest answer without a schema.
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    // The zoom-to rail's own head: empty, and narrow. It is a column of controls, not of
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
        // The same glyph the layer row's zoom-to uses. One action, one symbol, wherever it
        // appears: a reader who learned it on the row does not have to learn it again here.
        const goBtn = iconButton({
            glyph: 'target',
            label: `Zoom to ${feat.properties?.[def.fields[1]] ?? 'this feature'}`,
        });
        goTd.appendChild(goBtn);
        tr.appendChild(goTd);

        for (const f of def.fields) {
            const td = document.createElement('td');
            const v = feat.properties?.[f];
            td.textContent = v === null || v === undefined ? '' : String(v);
            tr.appendChild(td);
        }
        // Row to map. The camera pads for the table itself, so the feature does not land
        // underneath the row you clicked to find it; then the feature flashes, because a
        // camera that lands on a screen of neighbours has not said which one it meant. The
        // row becomes the current one, the same state a popup's table button lights.
        const go = () => {
            zoomToFeature(feat);
            flashFeature(layerId, feat);
            if (key === null) return;
            lightRow(key, false);
            // Lit by a zoom, not by a popup: no popup's button owns it.
            _owner = null;
            tableChanged();
        };
        goBtn.addEventListener('click', (e) => { e.stopPropagation(); go(); });
        tr.addEventListener('dblclick', go);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        tbody.appendChild(tr);
    }

    grid.append(thead, tbody);
    body.appendChild(grid);
    if (_folded) setFolded(false); else syncVar();
    // SNUG's target: the table at its own width, measured once it is showing, and applied in
    // case SNUG is the view already in force for the layer the table just switched to.
    grid.style.width = 'max-content';
    _contentW = Math.ceil(grid.getBoundingClientRect().width);
    grid.style.removeProperty('width');
    apply();
}
