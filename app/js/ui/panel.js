/**
 * panel.js — the left panel's geometry: three independent facts, one applier.
 *
 * ── Not four postures ────────────────────────────────────────────────────────────────────
 * This started as an enum: auto | manual-w | manual-h | float. It reads well and it is
 * wrong, because those four names describe a SINGLE state variable and the panel does not
 * have one. It has three, and they vary independently:
 *
 *   float     docked into the top-left inset, or loose and dragged by its head.
 *   w         a pinned width, or automatic (the panel fits its content).
 *   h         a pinned height, or automatic (the panel reaches the bottom inset).
 *
 * The enum forced the two size axes to be mutually exclusive, so pinning a height silently
 * threw away a pinned width: widen the panel, then shorten it, and the width snaps back to
 * automatic because the mode has become `manual-h` and the applier clears the other
 * variable. That is not a bug in the applier, it is the applier faithfully expressing a
 * model that cannot hold both facts.
 *
 * A state variable that can only hold one of several things people expect to combine is the
 * thing to look for. The tell is an applier with an `else` branch that ERASES rather than
 * leaves alone.
 *
 * The four names survive as a description of where you can end up, and `getPosture()` still
 * reports one for anything that wants a single word. Nothing stores one.
 *
 * ── One applier ──────────────────────────────────────────────────────────────────────────
 * Every control mutates the frame object and calls `apply`. Grips, the pin, the fold, the
 * window-resize clamp, the restore from storage: all one path. The alternative, where each
 * control writes the styles it cares about, is how a panel ends up floating and 320px wide
 * and anchored to the bottom at the same time.
 *
 * ── Geometry reaches CSS through variables ───────────────────────────────────────────────
 * `--sgs-panel-w` and `--sgs-panel-h`, not `style.width`. That way the stylesheet stays in
 * charge of what those numbers MEAN: minimums, maximums, and what else in the layout responds
 * to the panel's size. JavaScript supplies a number; CSS decides the consequences. Because
 * the three facts are independent, so are their classes: `--manual-w`, `--manual-h` and
 * `--float` combine freely and no rule assumes the absence of another.
 *
 * ── Folding must not resize ──────────────────────────────────────────────────────────────
 * In the automatic width the panel is `width: max-content`, so collapsing the body shrinks it
 * to the width of its own header and the fold reads as a jump. Folding therefore PINS the
 * width it already had, and unfolding gives the automatic width back if the fold is what
 * pinned it. A gesture named "collapse the contents" may not change the other axis.
 *
 * ── Postures are a viewer preference ─────────────────────────────────────────────────────
 * They live in localStorage, never in anything shared. Where you like your panel is a fact
 * about you, not about the map.
 *
 * ── Every axis carries its own undo ──────────────────────────────────────────────────────
 * There is no "restore automatic" button, because there does not need to be one: each grip
 * double-clicks ITS OWN axis back to automatic and the pin toggles back to docked. A grip
 * that reset both axes would be the enum leaking back in through the undo.
 */

import { getPrefs, setPrefs } from '../utils/prefs.js';
import { icon } from '../icons.js';
import { makeDraggable, releaseDrag } from '../utils/draggable.js';
import { nearBerth, makeBorrow } from '../utils/furniture.js';
import { makeClosable, makeFoldable } from './stow.js';

/** @typedef {'auto'|'manual-w'|'manual-h'|'float'} Posture */

const MIN_W = 200;
const MIN_H = 140;

/**
 * The three independent facts, plus FULL.
 *
 * FULL is not a fourth fact and not a size: it is a temporary takeover that overrides both
 * size axes in CSS and remembers nothing, because there is nothing to remember. `w` and `h`
 * keep whatever the reader pinned; the class simply outranks them while it is on, and letting
 * go restores the reader's numbers exactly because they were never overwritten. A maximize
 * that SAVES and RESTORES is the version that eventually loses somebody's width.
 *
 * @type {{float: boolean, full?: boolean, w?: number, h?: number, x?: number, y?: number}}
 */
let _frame = { float: false };

/**
 * The width the FOLD pinned, held under the borrow contract: released on unfold only while
 * the fold is still the one holding it, and never taken from a reader who had pinned a width
 * of their own. Was a bare boolean; see makeBorrow in furniture.js for the two bugs the bare
 * boolean cannot express.
 * @type {ReturnType<typeof makeBorrow>}
 */
let _foldW;

/** @type {HTMLElement} */
let _panel;
/** @type {HTMLButtonElement} */
let _pin;
/** @type {HTMLButtonElement} */
let _fullBtn;
/** @type {ReturnType<typeof makeFoldable>|null} */
let _foldable = null;
/** @type {(() => void)[]} */
const _listeners = [];

/** @param {() => void} fn Called after any geometry change. @returns {void} */
export function onPanelGeometryChange(fn) { _listeners.push(fn); }

/** @param {number} px @returns {number} */
const clampW = (px) => Math.max(MIN_W, Math.min(Math.round(px), Math.floor(window.innerWidth * 0.6)));
/** @param {number} px @returns {number} */
const clampH = (px) => Math.max(MIN_H, Math.min(Math.round(px), window.innerHeight - 16));

/**
 * Where the panel sits when it is docked: the inset corner, read from the same custom
 * property the stylesheet positions it with rather than a number copied into JavaScript.
 * @returns {{x: number, y: number}}
 */
function berthPoint() {
    const inset = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--sgs-panel-inset'),
    );
    const px = Number.isFinite(inset) ? inset : 10;
    return { x: px, y: px };
}

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

/** The single place any of the three facts becomes pixels. @returns {void} */
function apply() {
    const p = _panel;
    // Each class tracks exactly one fact, and they combine. A floating panel can carry a
    // pinned width; a docked one can carry a pinned width AND a pinned height.
    p.classList.toggle('sgs-panel--manual-w', _frame.w != null);
    p.classList.toggle('sgs-panel--manual-h', _frame.h != null);
    p.classList.toggle('sgs-panel--float', _frame.float);
    p.classList.toggle('sgs-panel--full', !!_frame.full);

    if (_frame.w != null) p.style.setProperty('--sgs-panel-w', `${_frame.w}px`);
    else p.style.removeProperty('--sgs-panel-w');

    if (_frame.h != null) p.style.setProperty('--sgs-panel-h', `${_frame.h}px`);
    else p.style.removeProperty('--sgs-panel-h');

    // Position is the only thing float owns outright. Size comes from the same two variables
    // whether the panel is docked or loose, which is what stops a grip from re-docking it.
    if (_frame.float) {
        const { x, y } = clampXY(_frame.x ?? 60, _frame.y ?? 80);
        _frame.x = x; _frame.y = y;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
    } else {
        // Docked: the stylesheet positions it, so every trace of a drag has to go — not just
        // left and top. See releaseDrag.
        releaseDrag(p);
    }

    _fullBtn.innerHTML = icon(_frame.full ? 'tight' : 'full', 12);
    _fullBtn.title = _frame.full ? 'Give the room back' : 'Fill the map';
    _fullBtn.setAttribute('aria-label', _fullBtn.title);
    _fullBtn.setAttribute('aria-pressed', String(!!_frame.full));

    _pin.innerHTML = icon(_frame.float ? 'pin-off' : 'pin', 13);
    _pin.title = _frame.float ? 'Dock the panel' : 'Undock the panel';
    _pin.setAttribute('aria-label', _pin.title);
    _pin.setAttribute('aria-pressed', String(!_frame.float));

    setPrefs({
        panelFloat: _frame.float,
        panelFull: _frame.full,
        panelW: _frame.w,
        panelH: _frame.h,
        panelX: _frame.x,
        panelY: _frame.y,
    });
    for (const fn of _listeners) fn();
}

/**
 * Fold or unfold the panel from outside.
 *
 * The dock uses this as it grows: once the dock's top edge has taken the space the panel
 * needs to be worth reading, a panel still trying to occupy it is a strip of clipped rows.
 * Exported rather than reached through initPanel's return value because the caller is the
 * dock, not the code that wired the panel up, and threading the handle through main.js would
 * make every future caller main.js's problem.
 *
 * @param {boolean} folded
 * @returns {void}
 */
export function foldPanel(folded) {
    if (!_foldable) return;
    if (folded) _foldable.fold(); else _foldable.unfold();
}

/** @returns {boolean} */
export function isPanelFolded() { return !!_foldable?.isFolded(); }

/**
 * A single word for the current frame, for anything that wants one. Derived, never stored:
 * the panel's actual state is the three facts above.
 * @returns {Posture}
 */
export function getPosture() {
    if (_frame.float) return 'float';
    if (_frame.w != null) return 'manual-w';
    if (_frame.h != null) return 'manual-h';
    return 'auto';
}

/**
 * Kept for callers that think in postures. Setting one is lossy by nature, so it says
 * exactly what each name means rather than pretending the model is an enum.
 * @param {Posture} mode
 * @returns {void}
 */
export function setPosture(mode) {
    if (mode === 'float') {
        _frame.float = true;
    } else if (mode === 'auto') {
        _frame.float = false;
        _frame.full = false;
        _frame.w = undefined;
        _frame.h = undefined;
        _foldW.release();
    } else {
        _frame.float = false;
    }
    apply();
}

/**
 * @param {HTMLElement} panel
 * @returns {{closable: import('./stow.js').Closable, foldable: ReturnType<typeof makeFoldable>}}
 */
export function initPanel(panel) {
    _panel = panel;

    // Restore BEFORE wiring anything up. Every control below calls apply() as it is built,
    // and apply() writes preferences; restoring last meant the wiring saved a default frame
    // over the reader's real one before it was ever read.
    const prefs = getPrefs();
    _frame = {
        // `panelPosture` is the old single-enum key. Read it once so a reader who already had
        // a floating panel keeps it, then let it fall out of storage: apply() writes the three
        // facts and never writes the enum back.
        float: prefs.panelFloat ?? prefs.panelPosture === 'float',
        full: prefs.panelFull,
        w: prefs.panelW,
        h: prefs.panelH,
        x: prefs.panelX,
        y: prefs.panelY,
    };
    const head = /** @type {HTMLElement} */ (panel.querySelector('.sgs-panel-head'));
    const berth = /** @type {HTMLElement} */ (panel.querySelector('.sgs-berth'));

    // FULL sits with the pin, in the berth: both answer "how much room does this get", and
    // neither is about the panel's CONTENTS the way fold and close are.
    _fullBtn = document.createElement('button');
    _fullBtn.type = 'button';
    _fullBtn.className = 'sgs-icon-btn sgs-panel-full';
    _fullBtn.addEventListener('click', () => {
        _frame.full = !_frame.full;
        apply();
    });
    berth.appendChild(_fullBtn);

    _pin = document.createElement('button');
    _pin.type = 'button';
    _pin.className = 'sgs-icon-btn sgs-panel-pin';
    _pin.addEventListener('click', () => {
        if (_frame.float) {
            // Re-docking returns to automatic on both axes: the float's pinned size was a
            // fact about where it floated, not about the dock.
            _frame.float = false;
            _frame.w = undefined;
            _frame.h = undefined;
            _foldW.release();
        } else {
            _frame.float = true;
        }
        apply();
    });
    berth.appendChild(_pin);

    // The fold's borrowed width. `take` reads _pendingW rather than a parameter because the
    // measurement has to happen before makeFoldable hides the body (see the capture-phase
    // listener below), and the borrow is what decides whether the measurement gets used.
    let _pendingW = 0;
    _foldW = makeBorrow({
        available: () => _frame.w == null,
        take: () => { _frame.w = _pendingW; },
        give: () => { _frame.w = undefined; },
    });

    // FOLD and CLOSE, the same pair the dock offers, in the same order. See stow.js for why
    // one section reasonably carries both.
    const foldBtn = /** @type {HTMLButtonElement} */ (panel.querySelector('.sgs-panel-fold'));
    foldBtn.innerHTML = icon('chevron', 12);
    const foldable = _foldable = makeFoldable({
        section: panel,
        control: foldBtn,
        body: /** @type {HTMLElement} */ (panel.querySelector('.sgs-panel-body')),
        foldedClass: 'sgs-panel--folded',
        folded: false,
        onChange: (folded) => {
            // Unfolding gives the automatic width back, but only if the FOLD is what pinned
            // it. A width the reader chose with the grip is theirs and survives both.
            if (!folded) _foldW.release();
            apply();
            for (const fn of _listeners) fn();
        },
    });

    // The width has to be measured BEFORE the body is hidden, and makeFoldable hides it and
    // toggles the folded class before it calls back. So this runs in the CAPTURE phase, which
    // reaches the button ahead of the bubble-phase handler makeFoldable registered, whatever
    // order the two were attached in. Measuring in onChange reads the collapsed panel and
    // pins the header's width, which is the bug wearing a fix.
    foldBtn.addEventListener('click', () => {
        if (panel.classList.contains('sgs-panel--folded')) return;  // this click is an unfold
        _pendingW = clampW(panel.getBoundingClientRect().width);
        _foldW.want(true);
    }, true);

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
            // One grip pins ONE axis, floating or docked, and never touches the other.
            // This is the whole point of the three-facts model: the gesture that used to
            // read "become manual-h" now reads "the height is this", which cannot discard
            // a width the reader already chose.
            if (axis === 'w') {
                _frame.w = clampW(pe.clientX - r.left);
                _foldW.release();  // the reader owns this width now, not the fold
            } else {
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
        // Double-click releases THIS axis back to automatic. Releasing both would be the
        // enum leaking back in: the reader asked about one edge.
        grip.addEventListener('dblclick', () => {
            if (axis === 'w') {
                _frame.w = undefined;
                _foldW.release();
            } else {
                _frame.h = undefined;
            }
            apply();
        });
    }

    // Dragging the head floats the panel; letting go near the berth puts it back.
    //
    // Undocking by drag and re-docking by drag are the same gesture, and before this the
    // second half of it did not exist: a reader who dragged the panel back to the corner it
    // came from got a panel sitting AT the corner but still floating, still writing
    // panelX/panelY, still needing the pin pressed to actually be docked. The app and the
    // reader disagreed about a thing the reader could see, which is the whole argument in
    // furniture.js's SNAP.
    makeDraggable(panel, head, ({ x, y }) => {
        _frame.float = true;
        _frame.x = x; _frame.y = y;
        panel.classList.toggle('sgs-snapping', nearBerth({ left: x, top: y }, berthPoint()));
        apply();
    }, ({ x, y }) => {
        panel.classList.remove('sgs-snapping');
        if (!nearBerth({ left: x, top: y }, berthPoint())) return;
        // Re-berthing by drag lands in the same state the pin lands in, on purpose: two
        // gestures for one outcome, not two outcomes that look alike.
        _frame.float = false;
        _frame.w = undefined;
        _frame.h = undefined;
        _foldW.release();
        apply();
    });

    window.addEventListener('resize', () => {
        if (_frame.w != null) _frame.w = clampW(_frame.w);
        if (_frame.h != null) _frame.h = clampH(_frame.h);
        apply();
    });

    apply();

    return { closable, foldable };
}
