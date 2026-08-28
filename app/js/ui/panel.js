/**
 * panel.js — the left panel's geometry: four postures, one applier.
 *
 * ── The postures ─────────────────────────────────────────────────────────────────────────
 *   auto      docked top-left, width fits its content, height bounded by the viewport. The
 *             default, and the CSS as written: no inline styles at all.
 *   manual-w  the right-edge grip pins --sgs-panel-w.
 *   manual-h  the bottom-edge grip pins --sgs-panel-h and the panel releases its bottom
 *             anchor, so it hugs the height you gave it.
 *   float     unpinned. Drags anywhere by its head, hugs its content, and stops being
 *             something the camera and the popups have to avoid.
 *
 * ── One applier ──────────────────────────────────────────────────────────────────────────
 * Every control mutates the frame object and calls `apply`. Grips, the pin, the window-resize
 * clamp, the restore from storage: all one path. The alternative, where each control writes
 * the styles it cares about, is how a panel ends up floating and 320px wide and anchored to
 * the bottom at the same time.
 *
 * ── Geometry reaches CSS through variables ───────────────────────────────────────────────
 * `--sgs-panel-w` and `--sgs-panel-h`, not `style.width`. That way the stylesheet stays in
 * charge of what those numbers MEAN: minimums, maximums, and what else in the layout responds
 * to the panel's size. JavaScript supplies a number; CSS decides the consequences.
 *
 * ── Postures are a viewer preference ─────────────────────────────────────────────────────
 * They live in localStorage, never in anything shared. Where you like your panel is a fact
 * about you, not about the map.
 *
 * ── Every posture carries its own undo ───────────────────────────────────────────────────
 * There is no "restore automatic" button, because there does not need to be one: a grip
 * double-clicks back to automatic and the pin toggles back to docked. A separate reset button
 * is a confession that the controls do not reverse.
 */

import { getPrefs, setPrefs } from '../utils/prefs.js';
import { icon } from '../icons.js';
import { makeDraggable } from '../utils/draggable.js';
import { makeClosable, makeFoldable } from './stow.js';

/** @typedef {'auto'|'manual-w'|'manual-h'|'float'} Posture */

const MIN_W = 200;
const MIN_H = 140;

/** @type {{mode: Posture, w?: number, h?: number, x?: number, y?: number}} */
let _frame = { mode: 'auto' };

/** @type {HTMLElement} */
let _panel;
/** @type {HTMLButtonElement} */
let _pin;
/** @type {(() => void)[]} */
const _listeners = [];

/** @param {() => void} fn Called after any geometry change. @returns {void} */
export function onPanelGeometryChange(fn) { _listeners.push(fn); }

/** @param {number} px @returns {number} */
const clampW = (px) => Math.max(MIN_W, Math.min(Math.round(px), Math.floor(window.innerWidth * 0.6)));
/** @param {number} px @returns {number} */
const clampH = (px) => Math.max(MIN_H, Math.min(Math.round(px), window.innerHeight - 16));

/**
 * @param {number} x @param {number} y
 * @returns {{x: number, y: number}}
 */
function clampXY(x, y) {
    const r = _panel.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(x, window.innerWidth - Math.max(80, r.width))),
        y: Math.max(0, Math.min(y, window.innerHeight - 60)),
    };
}

/** The single place any posture becomes pixels. @returns {void} */
function apply() {
    const p = _panel;
    p.classList.toggle('sgs-panel--manual-w', _frame.mode === 'manual-w');
    p.classList.toggle('sgs-panel--manual-h', _frame.mode === 'manual-h');
    p.classList.toggle('sgs-panel--float', _frame.mode === 'float');

    if (_frame.mode === 'manual-w' && _frame.w) {
        p.style.setProperty('--sgs-panel-w', `${_frame.w}px`);
    } else {
        p.style.removeProperty('--sgs-panel-w');
    }
    if (_frame.mode === 'manual-h' && _frame.h) {
        p.style.setProperty('--sgs-panel-h', `${_frame.h}px`);
    } else {
        p.style.removeProperty('--sgs-panel-h');
    }
    if (_frame.mode === 'float') {
        const { x, y } = clampXY(_frame.x ?? 60, _frame.y ?? 80);
        _frame.x = x; _frame.y = y;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        // A floating panel can still be resized by its grips. The stored width and height
        // apply as inline sizes IN PLACE: the panel must not re-dock just because a grip was
        // touched, which is exactly the jump the one-applier design exists to prevent.
        p.style.width = _frame.w ? `${_frame.w}px` : '';
        p.style.height = _frame.h ? `${_frame.h}px` : '';
    } else {
        p.style.left = '';
        p.style.top = '';
        p.style.width = '';
        p.style.height = '';
    }

    _pin.innerHTML = icon(_frame.mode === 'float' ? 'pin-off' : 'pin', 13);
    _pin.title = _frame.mode === 'float' ? 'Dock the panel' : 'Undock the panel';
    _pin.setAttribute('aria-label', _pin.title);
    _pin.setAttribute('aria-pressed', String(_frame.mode !== 'float'));

    setPrefs({ panelPosture: _frame.mode, panelW: _frame.w, panelH: _frame.h, panelX: _frame.x, panelY: _frame.y });
    for (const fn of _listeners) fn();
}

/** @returns {Posture} */
export function getPosture() { return _frame.mode; }

/** @param {Posture} mode @returns {void} */
export function setPosture(mode) {
    _frame.mode = mode;
    apply();
}

/**
 * @param {HTMLElement} panel
 * @returns {{closable: import('./stow.js').Closable, foldable: ReturnType<typeof makeFoldable>}}
 */
export function initPanel(panel) {
    _panel = panel;
    const head = /** @type {HTMLElement} */ (panel.querySelector('.sgs-panel-head'));
    const berth = /** @type {HTMLElement} */ (panel.querySelector('.sgs-berth'));

    _pin = document.createElement('button');
    _pin.type = 'button';
    _pin.className = 'sgs-icon-btn';
    _pin.addEventListener('click', () => {
        if (_frame.mode === 'float') {
            // Re-docking returns to automatic: the float's pinned size was a fact about
            // where it floated, not about the dock.
            _frame.w = undefined;
            _frame.h = undefined;
            setPosture('auto');
        } else {
            setPosture('float');
        }
    });
    berth.appendChild(_pin);

    // FOLD and CLOSE, the same pair the dock offers, in the same order. See stow.js for why
    // one section reasonably carries both.
    const foldBtn = /** @type {HTMLButtonElement} */ (panel.querySelector('.sgs-panel-fold'));
    foldBtn.innerHTML = icon('chevron', 12);
    const foldable = makeFoldable({
        section: panel,
        control: foldBtn,
        body: /** @type {HTMLElement} */ (panel.querySelector('.sgs-panel-body')),
        foldedClass: 'sgs-panel--folded',
        folded: false,
        onChange: () => { for (const fn of _listeners) fn(); },
    });

    // The mark points RIGHT, back at the panel it restores: a chevron is a direction, and
    // the direction it should give is "your panel is over here".
    const closable = makeClosable({
        section: panel,
        markId: 'sgs-panel-sliver',
        markClass: 'sgs-mark--left',
        glyph: 'chevron',
        label: 'the layer panel',
        onChange: () => { for (const fn of _listeners) fn(); },
    });
    /** @type {HTMLButtonElement} */
    (panel.querySelector('.sgs-panel-close')).innerHTML = icon('close', 12);
    /** @type {HTMLButtonElement} */
    (panel.querySelector('.sgs-panel-close')).addEventListener('click', () => closable.close());

    // Grips. Each drags one dimension; each double-clicks back to automatic, which is why
    // there is no separate reset.
    for (const grip of panel.querySelectorAll('.sgs-grip')) {
        const axis = /** @type {HTMLElement} */ (grip).dataset.grip;
        let dragging = false;

        grip.addEventListener('pointerdown', (e) => {
            dragging = true;
            /** @type {HTMLElement} */ (grip).setPointerCapture(/** @type {PointerEvent} */ (e).pointerId);
            e.preventDefault();
        });
        grip.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const pe = /** @type {PointerEvent} */ (e);
            const r = panel.getBoundingClientRect();
            // Floating: the grip resizes the panel where it sits. Docked: the grip pins the
            // corresponding manual posture. Same gesture, and the mode only changes in the
            // docked case.
            if (axis === 'w') {
                if (_frame.mode !== 'float') _frame.mode = 'manual-w';
                _frame.w = clampW(pe.clientX - r.left);
            } else {
                if (_frame.mode !== 'float') _frame.mode = 'manual-h';
                _frame.h = clampH(pe.clientY - r.top);
            }
            apply();
        });
        const stop = (/** @type {Event} */ e) => {
            if (!dragging) return;
            dragging = false;
            try {
                /** @type {HTMLElement} */ (grip).releasePointerCapture(/** @type {PointerEvent} */ (e).pointerId);
            } catch { /* already released */ }
        };
        grip.addEventListener('pointerup', stop);
        grip.addEventListener('pointercancel', stop);
        grip.addEventListener('dblclick', () => {
            if (_frame.mode === 'float') {
                _frame.w = undefined;
                _frame.h = undefined;
                apply();
            } else {
                setPosture('auto');
            }
        });
    }

    makeDraggable(panel, head, ({ x, y }) => {
        if (_frame.mode !== 'float') _frame.mode = 'float';
        _frame.x = x; _frame.y = y;
        apply();
    });

    window.addEventListener('resize', () => {
        if (_frame.mode === 'manual-w' && _frame.w) _frame.w = clampW(_frame.w);
        if (_frame.mode === 'manual-h' && _frame.h) _frame.h = clampH(_frame.h);
        apply();
    });

    const prefs = getPrefs();
    _frame = {
        mode: prefs.panelPosture ?? 'auto',
        w: prefs.panelW,
        h: prefs.panelH,
        x: prefs.panelX,
        y: prefs.panelY,
    };
    apply();

    return { closable, foldable };
}
