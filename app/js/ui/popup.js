/**
 * popup.js — the popup itself: what it looks like, where it is told to go, and the line back
 * to the thing it describes.
 *
 * ── One at a time, Ctrl to compare ───────────────────────────────────────────────────────
 * A plain click REPLACES the open popup. Clicking around a map is browsing, and browsing
 * with an accumulating trail of popups means the third click is spent closing the first
 * two. Holding Ctrl keeps what is open — that is the deliberate gesture for building a
 * comparison — and each kept popup cascades 40px right of the last so every title bar stays
 * grabbable.
 *
 * ── Placed once, then yours ──────────────────────────────────────────────────────────────
 * A popup is positioned when it opens and never re-placed by the app. It is draggable (by
 * its body, with a 4px threshold so a click is still a click), and a thing the user can
 * move is a thing the code must stop moving. When the camera pans, only the LEADER LINE is
 * redrawn: a dashed line from the feature to the popup's centre. In CLEAN mode the popup
 * deliberately sits far from its feature, and without that line a reader cannot tell which
 * of three open popups belongs to which of thirty features. If you take the placement
 * strategy, take the leader line with it.
 *
 * Placement itself is decided in popup-placement.js. Keeping the decision separate from the
 * DOM is what lets the decision be unit-tested.
 */

import { map } from '../map.js';
import { icon } from '../icons.js';
import { buildSymbolSwatch } from './symbology.js';
import { getSourcePill, makeTypePill } from './type-pill.js';
import { buildFieldBadge, inferTypeFromValue } from './field-badge.js';
import {
    PLACEMENT, getPlacementMode, adjacentPlacement, anchorPoint, cleanBaseLeft, cascadeSlot,
} from './popup-placement.js';
import { pushDismissible, raiseDismissible } from './dismiss-stack.js';

/** Where the CLEAN column sits vertically: just under the top edge, out of the map's way. */
const CLEAN_TOP = 10;

/**
 * @typedef {object} OpenPopup
 * @property {HTMLElement} el
 * @property {SVGLineElement} leader
 * @property {[number, number]} lngLat
 * @property {() => void} dismiss
 * @property {() => void} unregister
 * @property {AbortController} drag
 */

/** @type {OpenPopup[]} */
const _open = [];

/** Running cascade offset for CLEAN mode; resets when the stack empties. */
let _cascadeOffset = 0;

/** @type {HTMLElement|null} */
let _host = null;
/** @type {SVGSVGElement|null} */
let _leaders = null;

function ensureHost() {
    if (_host) return;
    _leaders = /** @type {SVGSVGElement} */ (
        document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    );
    _leaders.setAttribute('class', 'sgs-leaders');
    _leaders.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_leaders);

    _host = document.createElement('div');
    _host.className = 'sgs-popups';
    document.body.appendChild(_host);

    // The camera moves under the popups; the popups stay put and their lines track.
    map.on('move', updateAllLeaders);
    map.on('resize', updateAllLeaders);
    window.addEventListener('resize', updateAllLeaders);

    // Ctrl + arrows nudge the topmost popup (Shift for big steps): fine positioning for a
    // comparison someone is arranging, without reaching for the mouse.
    document.addEventListener('keydown', (e) => {
        if (!e.ctrlKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        const top = _open[_open.length - 1];
        if (!top) return;
        e.preventDefault();
        const step = e.shiftKey ? 100 : 20;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        top.el.style.left = `${(parseInt(top.el.style.left) || 0) + dx}px`;
        top.el.style.top = `${(parseInt(top.el.style.top) || 0) + dy}px`;
        updateAllLeaders();
    });
}

/** @returns {number} how many popups are open */
export function openPopupCount() { return _open.length; }

/** @returns {void} */
export function closeAllPopups() {
    while (_open.length) closePopup(_open[_open.length - 1]);
    _cascadeOffset = 0;
}

/** @param {OpenPopup} p @returns {void} */
export function closePopup(p) {
    const i = _open.indexOf(p);
    if (i === -1) return;
    _open.splice(i, 1);
    p.drag.abort();
    p.unregister();
    p.el.remove();
    p.leader.remove();
    if (_open.length === 0) _cascadeOffset = 0;
}

/**
 * Drag wiring for one popup: the whole body is the handle, with a 4px threshold so a click
 * inside the popup is still a click, and interactive children are exempt so a button press
 * or a text selection never starts a drag. An AbortController carries every listener, so
 * closing the popup cleans the document-level ones up in one call.
 *
 * @param {HTMLElement} el
 * @param {() => void} onDrag
 * @returns {AbortController}
 */
function wireDrag(el, onDrag) {
    const ac = new AbortController();
    const { signal } = ac;
    let startX = 0, startY = 0, baseX = 0, baseY = 0, armed = false, dragging = false;

    el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (/** @type {HTMLElement} */ (e.target).closest('button, a, input, textarea, select, label')) return;
        const r = el.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        baseX = r.left; baseY = r.top;
        armed = true;
    }, { signal });

    document.addEventListener('pointermove', (e) => {
        if (!armed) return;
        if (!dragging) {
            if (Math.abs(e.clientX - startX) < 4 && Math.abs(e.clientY - startY) < 4) return;
            dragging = true;
            el.style.cursor = 'grabbing';
            el.style.userSelect = 'none';
        }
        el.style.left = `${Math.round(baseX + (e.clientX - startX))}px`;
        el.style.top = `${Math.round(baseY + (e.clientY - startY))}px`;
        onDrag();
    }, { signal });

    document.addEventListener('pointerup', () => {
        armed = false;
        if (dragging) {
            dragging = false;
            el.style.cursor = '';
            el.style.userSelect = '';
        }
    }, { signal });

    return ac;
}

/**
 * @param {object} opts
 * @param {[number, number]} opts.lngLat where the popup points
 * @param {string} opts.title
 * @param {Array<[string, unknown]>} opts.rows field name and value, in order
 * @param {string} [opts.accent] a colour for the title rule, usually the layer's
 * @param {boolean} [opts.ctrlKey] true keeps the popups already open
 * @param {{id: string, kind: 'fill'|'circle', color: string, type: string}} [opts.layer]
 *        the layer this feature came from: supplies the swatch and the type pill, and lets
 *        the title bar carry the same table action the layer row does
 * @param {(layerId: string) => void} [opts.onOpenTable]
 * @returns {OpenPopup}
 */
export function openPopup({ lngLat, title, rows, accent, ctrlKey = false, layer, onOpenTable }) {
    ensureHost();
    if (!ctrlKey) closeAllPopups();

    const el = document.createElement('div');
    el.className = 'sgs-popup';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    if (accent) el.style.setProperty('--sgs-popup-accent', accent);

    const head = document.createElement('div');
    head.className = 'sgs-popup-head';

    // Swatch first, then the source pill, then the name: the same three things in the same
    // order as the layer row, so a popup reads as coming FROM a row the reader knows.
    if (layer) {
        head.appendChild(buildSymbolSwatch(layer));
        head.appendChild(makeTypePill(getSourcePill(layer.type)));
    }

    const h = document.createElement('span');
    h.className = 'sgs-popup-title';
    h.textContent = title;
    head.appendChild(h);

    // The head's buttons go in the one group every furniture head uses, so their spacing is a
    // single rule (furniture.css, .sgs-head-actions) rather than whatever this head's gap is.
    const actions = document.createElement('span');
    actions.className = 'sgs-head-actions';
    head.appendChild(actions);

    // The table action, for THIS feature: the caller finds its row in the table, lit and
    // scrolled into view, and a second press toggles the table away, the same idiom as the
    // layer row's button. What "find" means is the caller's; this file only offers the button.
    if (layer && onOpenTable) {
        const tableBtn = document.createElement('button');
        tableBtn.type = 'button';
        tableBtn.className = 'sgs-icon-btn';
        tableBtn.title = 'Find this feature in the table';
        tableBtn.setAttribute('aria-label', tableBtn.title);
        tableBtn.innerHTML = icon('table', 12);
        tableBtn.addEventListener('click', (ev) => { ev.stopPropagation(); onOpenTable(layer.id); });
        actions.appendChild(tableBtn);
    }

    const close = document.createElement('button');
    close.className = 'sgs-icon-btn';
    close.type = 'button';
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = icon('close', 12);
    actions.appendChild(close);

    const body = document.createElement('div');
    body.className = 'sgs-popup-body';

    // Three columns: TYPE, FIELD, VALUE. The type column is first because it is fixed-width
    // and monospace, so it forms a clean left rail the eye can skip; putting it last would
    // ragged-edge against variable-length values.
    const table = document.createElement('table');
    table.className = 'sgs-fields';
    for (const [k, v] of rows) {
        const tr = document.createElement('tr');

        const tdType = document.createElement('td');
        tdType.className = 'sgs-field-type-col';
        tdType.appendChild(buildFieldBadge(inferTypeFromValue(v)));

        const th = document.createElement('th');
        th.textContent = k;

        const td = document.createElement('td');
        // textContent, never innerHTML: feature attributes are arbitrary data, and an
        // attribute containing markup must render as the text it is.
        td.textContent = v === null || v === undefined
            ? ''
            : typeof v === 'object' ? JSON.stringify(v) : String(v);

        tr.append(tdType, th, td);
        table.appendChild(tr);
    }
    body.appendChild(table);
    el.append(head, body);
    /** @type {HTMLElement} */ (_host).appendChild(el);

    const leader = /** @type {SVGLineElement} */ (
        document.createElementNS('http://www.w3.org/2000/svg', 'line')
    );
    leader.setAttribute('class', 'sgs-leader');
    if (accent) leader.setAttribute('stroke', accent);
    /** @type {SVGSVGElement} */ (_leaders).appendChild(leader);

    /** @type {OpenPopup} */
    const p = /** @type {any} */ ({ el, leader, lngLat });
    p.dismiss = () => closePopup(p);
    p.unregister = pushDismissible(p.dismiss);
    p.drag = wireDrag(el, () => drawLeader(p));
    _open.push(p);
    close.addEventListener('click', () => closePopup(p));

    // Bring a clicked popup to the front, so an overlapping cascade can be untangled by
    // clicking, and so Escape takes the one the user last touched.
    el.addEventListener('pointerdown', () => {
        const i = _open.indexOf(p);
        if (i > -1 && i !== _open.length - 1) {
            _open.splice(i, 1);
            _open.push(p);
            raiseDismissible(p.dismiss);
            /** @type {HTMLElement} */ (_host).appendChild(el);
        }
    });

    place(p);
    return p;
}

/**
 * Position one popup, ONCE, at open time.
 * @param {OpenPopup} p
 * @returns {void}
 */
function place(p) {
    const r = p.el.getBoundingClientRect();
    const size = { w: r.width || 260, h: r.height || 120 };
    const anchor = anchorPoint(map, p.lngLat);

    if (getPlacementMode() === PLACEMENT.ADJACENT && anchor) {
        const pos = adjacentPlacement(anchor, size);
        p.el.style.left = `${pos.left}px`;
        p.el.style.top = `${pos.top}px`;
        p.el.dataset.strategy = pos.side;
    } else {
        // CLEAN: the fixed home beside the panel, cascading right for each kept popup. The
        // base is re-measured per open, so a panel that moved since the last popup does not
        // leave the column where the panel used to be.
        const slot = cascadeSlot(cleanBaseLeft(), _cascadeOffset, size.w, window.innerWidth);
        _cascadeOffset = slot.nextOffset;
        p.el.style.left = `${slot.left}px`;
        p.el.style.top = `${CLEAN_TOP}px`;
        p.el.dataset.strategy = 'clean';
    }
    drawLeader(p);
}

/**
 * The leader runs from the feature to the popup's CENTRE. The line layer sits under the
 * popups, so the segment that would cross the popup itself is hidden by it, and the visible
 * part reads as "this popup, that feature".
 * @param {OpenPopup} p
 * @returns {void}
 */
function drawLeader(p) {
    const a = anchorPoint(map, p.lngLat);
    if (!a) return;
    const b = p.el.getBoundingClientRect();
    p.leader.setAttribute('x1', String(a.x));
    p.leader.setAttribute('y1', String(a.y));
    p.leader.setAttribute('x2', String(b.left + b.width / 2));
    p.leader.setAttribute('y2', String(b.top + b.height / 2));
}

/** Redraw every leader line: the camera or a popup moved. @returns {void} */
export function updateAllLeaders() {
    for (const p of _open) drawLeader(p);
}
