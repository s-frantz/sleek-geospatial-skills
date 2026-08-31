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
 *            test from the `stow` skill to anything you add here.
 *   CLOSED   the dock leaves entirely. What remains is a SLIVER: a small tab parked at the
 *            bottom-centre edge that brings the table back. It is the dock's MARK, and the
 *            bottom edge is its berth — the same put-away grammar as everything else, just
 *            against the viewport instead of a panel.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────────────────
 * Sorting, paging, editing, column resizing, virtualisation. A real table needs some of
 * them, and every one has a right answer that depends on your data. What transfers is the
 * band: where it sits, how it resizes, how it reports while folded, how it leaves, and that
 * the camera and the panel both know it is there.
 */

import { featuresOf, layerById, zoomToFeature, LAYERS } from '../layers.js';
import { icon } from '../icons.js';
import { buildFieldBadge, inferColumnType } from './field-badge.js';
import { buildSymbolSwatch } from './symbology.js';
import { getSourcePill, makeTypePill } from './type-pill.js';

/** Default open height, px. */
const DEFAULT_H = 250;
const MIN_H = 120;

/** @type {HTMLElement|null} */
let _dock = null;
/** @type {string|null} the layer whose table the sliver would bring back */
let _lastLayerId = null;
let _height = DEFAULT_H;
let _folded = false;

/** Publish the dock's real footprint so the panel's CSS can stay out of its way. */
function syncVar() {
    if (!_dock) return;
    const h = _dock.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--sgs-dock-h', `${Math.round(h)}px`);
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

/** @returns {void} */
export function closeTable() {
    _dock?.remove();
    _dock = null;
    document.body.classList.remove('sgs-dock-open');
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

/** @param {boolean} next @returns {void} */
function setFolded(next) {
    if (!_dock) return;
    _folded = next;
    _dock.classList.toggle('sgs-dock--folded', next);
    // The open height is an inline style, so folding must release it: a folded dock is as
    // tall as its head and nothing else.
    _dock.style.height = next ? 'auto' : `${_height}px`;
    const chev = _dock.querySelector('.sgs-dock-fold');
    chev?.setAttribute('aria-expanded', String(!next));
    syncVar();
}

/**
 * Build the dock chrome: head (title, count, fold, close), top resize grip, empty body.
 * @returns {{head: HTMLElement, body: HTMLElement, title: HTMLElement, count: HTMLElement}}
 */
function buildDock() {
    const dock = document.createElement('div');
    dock.id = 'sgs-dock';
    dock.className = 'sgs-dock';
    // The framework contract (app/js/utils/furniture.js): marks this as something the camera
    // pads around and popups must not cover, with no id registered anywhere else.
    dock.setAttribute('data-sgs-furniture', '');
    dock.style.height = `${_height}px`;

    // Top-edge resize grip: a thin strip with a centred pill, overlaid so it costs no
    // height. Drag to resize; double-click returns the default — the grip carries its own
    // undo, same as the panel's.
    const grip = document.createElement('div');
    grip.className = 'sgs-dock-grip';
    grip.title = 'Drag to resize, double-click for the default height';
    let resizing = false;
    grip.addEventListener('pointerdown', (e) => {
        if (_folded) return;
        resizing = true;
        grip.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        _height = Math.round(Math.max(MIN_H, Math.min(
            window.innerHeight - e.clientY - 8,
            window.innerHeight * 0.7,
        )));
        dock.style.height = `${_height}px`;
        syncVar();
    });
    const stop = (/** @type {PointerEvent} */ e) => {
        if (!resizing) return;
        resizing = false;
        try { grip.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
    grip.addEventListener('dblclick', () => {
        _height = DEFAULT_H;
        dock.style.height = `${_height}px`;
        syncVar();
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

    const fold = document.createElement('button');
    fold.type = 'button';
    fold.className = 'sgs-icon-btn sgs-dock-fold';
    fold.title = 'Fold the table';
    fold.setAttribute('aria-label', 'Fold the table');
    fold.innerHTML = icon('chevron', 12);
    fold.addEventListener('click', (e) => { e.stopPropagation(); setFolded(!_folded); });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'sgs-icon-btn';
    close.title = 'Close the table';
    close.setAttribute('aria-label', 'Close the table');
    close.innerHTML = icon('close', 12);
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTable(); });

    head.append(swatch, pill, title, count, spacer, fold, close);
    // A folded dock is one bar; the whole bar is the unfold control, not just the chevron.
    head.addEventListener('click', () => { if (_folded) setFolded(false); });

    const body = document.createElement('div');
    body.className = 'sgs-dock-body';

    dock.append(grip, head, body);
    document.body.appendChild(dock);
    _dock = dock;
    document.body.classList.add('sgs-dock-open');
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
        for (const f of def.fields) {
            const td = document.createElement('td');
            const v = feat.properties?.[f];
            td.textContent = v === null || v === undefined ? '' : String(v);
            tr.appendChild(td);
        }
        // Row to map. The camera pads for the dock itself, so the feature does not land
        // underneath the row you clicked to find it.
        const go = () => zoomToFeature(feat);
        tr.addEventListener('dblclick', go);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        tbody.appendChild(tr);
    }

    table.append(thead, tbody);
    body.appendChild(table);
    if (_folded) setFolded(false); else syncVar();
}
