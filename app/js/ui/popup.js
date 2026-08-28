/**
 * popup.js — the popup itself: what it looks like, where it is told to go, and the line back
 * to the thing it describes.
 *
 * The leader line is not decoration. In CLEAN mode a popup deliberately sits far from its
 * feature, and without a line drawn back to the anchor the reader has no way to tell which of
 * three open popups belongs to which of thirty features. If you take the placement strategy,
 * take the leader line with it.
 *
 * Placement is decided in popup-placement.js and applied here. Keeping the decision separate
 * from the DOM is what lets the decision be unit-tested.
 */

import { map } from '../map.js';
import { icon } from '../icons.js';
import { placementFor, rect } from './popup-placement.js';
import { pushDismissible, raiseDismissible } from './dismiss-stack.js';

/**
 * @typedef {object} OpenPopup
 * @property {HTMLElement} el
 * @property {SVGLineElement} leader
 * @property {[number, number]} lngLat
 * @property {() => void} dismiss the handler this popup put on the dismiss stack
 * @property {() => void} unregister
 */

/** @type {OpenPopup[]} */
const _open = [];

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

    map.on('move', repositionAll);
    map.on('resize', repositionAll);
    window.addEventListener('resize', repositionAll);
}

/** @returns {number} how many popups are open */
export function openPopupCount() { return _open.length; }

/** @returns {void} */
export function closeAllPopups() {
    while (_open.length) closePopup(_open[_open.length - 1]);
}

/** @param {OpenPopup} p @returns {void} */
export function closePopup(p) {
    const i = _open.indexOf(p);
    if (i === -1) return;
    _open.splice(i, 1);
    p.unregister();
    p.el.remove();
    p.leader.remove();
    repositionAll();
}

/**
 * @param {object} opts
 * @param {[number, number]} opts.lngLat where the popup points
 * @param {string} opts.title
 * @param {Array<[string, unknown]>} opts.rows field name and value, in order
 * @param {string} [opts.accent] a colour for the title rule, usually the layer's
 * @returns {OpenPopup}
 */
export function openPopup({ lngLat, title, rows, accent }) {
    ensureHost();

    const el = document.createElement('div');
    el.className = 'sgs-popup';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    if (accent) el.style.setProperty('--sgs-popup-accent', accent);

    const head = document.createElement('div');
    head.className = 'sgs-popup-head';
    const h = document.createElement('span');
    h.className = 'sgs-popup-title';
    h.textContent = title;
    const close = document.createElement('button');
    close.className = 'sgs-icon-btn';
    close.type = 'button';
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = icon('close', 12);
    head.append(h, close);

    const body = document.createElement('div');
    body.className = 'sgs-popup-body';
    const table = document.createElement('table');
    table.className = 'sgs-fields';
    for (const [k, v] of rows) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = k;
        const td = document.createElement('td');
        td.textContent = v === null || v === undefined ? '' : String(v);
        tr.append(th, td);
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

    // Escape closes the TOPMOST thing, and the dismiss stack is what decides which that is.
    // Closing every popup on one key is how a reader loses a comparison they spent four
    // clicks assembling.
    /** @type {OpenPopup} */
    const p = /** @type {any} */ ({ el, leader, lngLat });
    p.dismiss = () => closePopup(p);
    p.unregister = pushDismissible(p.dismiss);
    _open.push(p);
    close.addEventListener('click', () => closePopup(p));

    // Bring a clicked popup to the front, so an overlapping pair can be untangled by clicking.
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
 * Position one popup and draw its leader. Existing popups are passed to the placement
 * decision so a new one does not land on an old one.
 * @param {OpenPopup} p
 * @returns {void}
 */
function place(p) {
    const anchorPt = map.project(p.lngLat);
    const r = p.el.getBoundingClientRect();
    const existing = _open
        .filter((o) => o !== p)
        .map((o) => {
            const b = o.el.getBoundingClientRect();
            return rect(b.left, b.top, b.width, b.height);
        });

    const pos = placementFor(
        { x: anchorPt.x, y: anchorPt.y },
        { w: r.width || 240, h: r.height || 120 },
        existing,
    );
    p.el.style.left = `${pos.left}px`;
    p.el.style.top = `${pos.top}px`;
    p.el.dataset.strategy = pos.strategy;
    drawLeader(p, anchorPt);
}

/**
 * @param {OpenPopup} p
 * @param {{x: number, y: number}} anchorPt
 * @returns {void}
 */
function drawLeader(p, anchorPt) {
    const b = p.el.getBoundingClientRect();
    // Start the line at the point on the popup's border nearest the anchor, so the line
    // never appears to sprout from the middle of the text.
    const cx = Math.max(b.left, Math.min(anchorPt.x, b.right));
    const cy = Math.max(b.top, Math.min(anchorPt.y, b.bottom));
    const onEdge = cx > b.left && cx < b.right && cy > b.top && cy < b.bottom;
    p.leader.setAttribute('x1', String(onEdge ? anchorPt.x : cx));
    p.leader.setAttribute('y1', String(onEdge ? anchorPt.y : cy));
    p.leader.setAttribute('x2', String(anchorPt.x));
    p.leader.setAttribute('y2', String(anchorPt.y));
}

/** Re-place every popup: the camera moved, or the furniture did. @returns {void} */
export function repositionAll() {
    for (const p of _open) place(p);
}
