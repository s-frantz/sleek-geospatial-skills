/**
 * panel.js — the left panel's geometry: three independent facts, one applier.
 *
 * ── Not four postures ────────────────────────────────────────────────────────────────────
 * This started as an enum: auto | manual-w | manual-h | undocked. It reads well and it is
 * wrong, because those four names describe a SINGLE state variable and the panel does not
 * have one. It has three, and they vary independently:
 *
 *   undocked  docked in the top-left inset, or undocked and dragged by its head.
 *   w         a manual width, or automatic (the panel fits its content).
 *   h         a manual height, or automatic (the panel reaches the bottom inset).
 *
 * The enum forced the two size axes to be mutually exclusive, so pinning a height silently
 * threw away a manual width: widen the panel, then shorten it, and the width snaps back to
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
 * Every control mutates the frame object and calls `apply`. Grips, the dock button, the fold, the
 * window-resize clamp, the restore from storage: all one path. The alternative, where each
 * control writes the styles it cares about, is how a panel ends up undocked and 320px wide
 * and anchored to the bottom at the same time.
 *
 * ── Geometry reaches CSS through variables ───────────────────────────────────────────────
 * `--sgs-panel-w` and `--sgs-panel-h`, not `style.width`. That way the stylesheet stays in
 * charge of what those numbers MEAN: minimums, maximums, and what else in the layout responds
 * to the panel's size. JavaScript supplies a number; CSS decides the consequences. Because
 * the three facts are independent, so are their classes: `--manual-w`, `--manual-h` and
 * `--undocked` combine freely and no rule assumes the absence of another.
 *
 * ── Folding must not resize ──────────────────────────────────────────────────────────────
 * In the automatic width the panel is `width: max-content`, so collapsing the body shrinks it
 * to the width of its own header and the fold reads as a jump. Folding therefore SETS the
 * width it already had, and unfolding gives the automatic width back if the fold is what
 * set it. A gesture named "collapse the contents" may not change the other axis.
 *
 * ── Postures are a viewer preference ─────────────────────────────────────────────────────
 * They live in localStorage, never in anything shared. Where you like your panel is a fact
 * about you, not about the map.
 *
 * ── Every axis carries its own undo ──────────────────────────────────────────────────────
 * There is no "restore automatic" button, because there does not need to be one: each grip
 * double-clicks ITS OWN axis back to automatic and the dock button toggles back to docked. A grip
 * that reset both axes would be the enum leaking back in through the undo.
 */

import { getPrefs, setPrefs } from '../utils/prefs.js';
import { setButton } from './buttons.js';
import { makeDraggable, releaseDrag } from '../utils/draggable.js';
import { nearLeftEdge, makeBorrow } from '../utils/furniture.js';
import { makeClosable, makeFoldable } from './stow.js';

/** @typedef {'auto'|'manual-w'|'manual-h'|'undocked'} Posture */

const MIN_W = 200;
const MIN_H = 140;

/**
 * The three independent facts.
 *
 * There is no FULL here, deliberately. The panel had one, and all it could add was width: a
 * docked panel's automatic height already reaches the bottom inset, and a list of layers gains
 * nothing from 60% of the screen. FULL belongs to the table, whose content is the kind that
 * wants the room; see table.js and the `ui-furniture` skill.
 *
 * @type {{undocked: boolean, w?: number, h?: number, x?: number, y?: number}}
 */
let _frame = { undocked: false };

/**
 * The width the FOLD set, held under the borrow contract: released on unfold only while
 * the fold is still the one holding it, and never taken from a reader who had set a width
 * of their own. Was a bare boolean; see makeBorrow in furniture.js for the two bugs the bare
 * boolean cannot express.
 * @type {ReturnType<typeof makeBorrow>}
 */
let _foldW;

/** @type {HTMLElement} */
let _panel;
/** @type {HTMLButtonElement} */
let _dockBtn;
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
function dockPoint() {
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
    // Each class tracks exactly one fact, and they combine. An undocked panel can carry a
    // manual width; a docked one can carry a manual width AND a manual height.
    p.classList.toggle('sgs-panel--manual-w', _frame.w != null);
    p.classList.toggle('sgs-panel--manual-h', _frame.h != null);
    p.classList.toggle('sgs-panel--undocked', _frame.undocked);

    if (_frame.w != null) p.style.setProperty('--sgs-panel-w', `${_frame.w}px`);
    else p.style.removeProperty('--sgs-panel-w');

    if (_frame.h != null) p.style.setProperty('--sgs-panel-h', `${_frame.h}px`);
    else p.style.removeProperty('--sgs-panel-h');

    // Position is the only thing `undocked` owns outright. Size comes from the same two variables
    // whether the panel is docked or undocked, which is what stops a grip from re-docking it.
    if (_frame.undocked) {
        const { x, y } = clampXY(_frame.x ?? 60, _frame.y ?? 80);
        _frame.x = x; _frame.y = y;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
    } else {
        // Docked: the stylesheet positions it, so every trace of a drag has to go — not just
        // left and top. See releaseDrag.
        releaseDrag(p);
    }

    setButton(_dockBtn, {
        glyph: _frame.undocked ? 'pin-off' : 'pin', size: 13,
        label: _frame.undocked ? 'Dock the layer panel' : 'Undock the layer panel', pressed: !_frame.undocked,
    });

    setPrefs({
        panelUndocked: _frame.undocked,
        panelW: _frame.w,
        panelH: _frame.h,
        panelX: _frame.x,
        panelY: _frame.y,
    });
    // Whether the chevron's TIGHT step is on offer depends on the geometry just applied.
    _foldable?.relabel();
    for (const fn of _listeners) fn();
}

/**
 * Fold or unfold the panel from outside.
 *
 * The table uses this as it grows: once the table's top edge has taken the space the panel
 * needs to be worth reading, a panel still trying to occupy it is a strip of clipped rows.
 * Exported rather than reached through initPanel's return value because the caller is the
 * table, not the code that wired the panel up, and threading the handle through main.js would
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
    if (_frame.undocked) return 'undocked';
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
    if (mode === 'undocked') {
        _frame.undocked = true;
    } else if (mode === 'auto') {
        _frame.undocked = false;
        _frame.w = undefined;
        _frame.h = undefined;
        _foldW.release();
    } else {
        _frame.undocked = false;
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
        // an undocked panel keeps it, then let it fall out of storage: apply() writes the three
        // facts and never writes the enum back.
        undocked: prefs.panelUndocked ?? prefs.panelPosture === 'float',
        w: prefs.panelW,
        h: prefs.panelH,
        x: prefs.panelX,
        y: prefs.panelY,
    };
    const head = /** @type {HTMLElement} */ (panel.querySelector('.sgs-panel-head'));

    // The dock button comes first in the head's buttons: it answers "where is this", not "is the content
    // showing", which is the fold's and the close's question. Its look is apply()'s.
    _dockBtn = /** @type {HTMLButtonElement} */ (panel.querySelector('.sgs-panel-dock'));
    _dockBtn.addEventListener('click', () => {
        if (_frame.undocked) {
            // Re-docking returns to automatic on both axes: a size set while undocked was a
            // fact about where it sat, not about the docked panel.
            _frame.undocked = false;
            _frame.w = undefined;
            _frame.h = undefined;
            _foldW.release();
        } else {
            _frame.undocked = true;
        }
        apply();
    });

    // The fold's borrowed width. `take` reads _pendingW rather than a parameter because the
    // measurement has to happen before makeFoldable hides the body (see the capture-phase
    // listener below), and the borrow is what decides whether the measurement gets used.
    let _pendingW = 0;
    _foldW = makeBorrow({
        available: () => _frame.w == null,
        take: () => { _frame.w = _pendingW; },
        give: () => { _frame.w = undefined; },
    });

    // FOLD and CLOSE, the same pair the table offers, in the same order. See stow.js for why
    // one section reasonably carries both.
    const foldBtn = /** @type {HTMLButtonElement} */ (panel.querySelector('.sgs-panel-fold'));
    setButton(foldBtn, { glyph: 'chevron' });
    const body = /** @type {HTMLElement} */ (panel.querySelector('.sgs-panel-body'));
    /**
     * The panel's width at max-content, rows included, read by one inline override. Folded, the
     * body is hidden and the head alone would measure, so it is shown for the read.
     * @returns {number}
     */
    const contentWidth = () => {
        const prevW = panel.style.width;
        const hidden = body.hidden;
        body.hidden = false;
        panel.style.width = 'max-content';
        const w = panel.getBoundingClientRect().width;
        panel.style.width = prevW;
        body.hidden = hidden;
        return w;
    };
    const foldable = _foldable = makeFoldable({
        section: panel,
        control: foldBtn,
        body,
        foldedClass: 'sgs-panel--folded',
        // TIGHT hugs the rows, offered whenever they all fit on screen. SNUG hugs the rows and
        // takes the width in to them, offered when there is width to take in: the panel's
        // automatic width is already its content's, so SNUG appears once a grip has set a
        // wider one, and is skipped otherwise rather than repeating TIGHT.
        tightClass: 'sgs-panel--tight',
        snugClass: 'sgs-panel--snug',
        tightFits: () => body.scrollHeight + head.getBoundingClientRect().height + 2
            <= window.innerHeight - 2 * dockPoint().x,
        snugDiffers: () => contentWidth() < panel.getBoundingClientRect().width - 2,
        labels: {
            natural: 'Unfold the layer panel',
            tight: 'Fit the layer panel to its rows',
            head: 'Fold the layer panel to its head',
            snug: 'Fit the layer panel to its rows and width',
        },
        folded: false,
        onChange: (folded) => {
            // Leaving the head gives the automatic width back, but only if the FOLD is what
            // set it. A width the reader chose with the grip is theirs and survives both.
            if (!folded) _foldW.release();
            apply();
            for (const fn of _listeners) fn();
        },
    });

    // The width has to be measured BEFORE the body is hidden, and makeFoldable hides it and
    // toggles the folded class before it calls back. So this runs in the CAPTURE phase, which
    // reaches the button ahead of the bubble-phase handler makeFoldable registered, whatever
    // order the two were attached in. Measuring in onChange reads the collapsed panel and
    // sets the head's width, which is the bug wearing a fix.
    foldBtn.addEventListener('click', () => {
        // Only the step INTO the head hides the body. Natural to tight changes the height
        // alone, and a press out of the head is an unfold.
        if (foldable.next() !== 'head') return;
        _pendingW = clampW(panel.getBoundingClientRect().width);
        _foldW.want(true);
    }, true);
    // Whether TIGHT is on offer depends on how many rows there are NOW, and rows arrive after
    // the panel is built, so the label is refreshed as the pointer or the focus reaches it.
    foldBtn.addEventListener('pointerenter', () => foldable.relabel());
    foldBtn.addEventListener('focus', () => foldable.relabel());

    // The mark points RIGHT, back at the panel it restores: a chevron is a direction, and
    // the direction it should give is "your panel is over here".
    const closable = makeClosable({
        section: panel,
        markId: 'sgs-panel-mark',
        markClass: 'sgs-mark--left',
        glyph: 'chevron',
        label: 'the layer panel',
        onChange: () => { for (const fn of _listeners) fn(); },
    });
    const closeBtn = /** @type {HTMLButtonElement} */ (panel.querySelector('.sgs-panel-close'));
    setButton(closeBtn, { glyph: 'close' });
    closeBtn.addEventListener('click', () => closable.close());

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
            // One grip sets ONE axis, undocked or docked, and never touches the other.
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

    // Dragging the head undocks the panel; letting go near its edge docks it again.
    //
    // Undocking by drag and re-docking by drag are the same gesture, and before this the
    // second half of it did not exist: a reader who dragged the panel back to the corner it
    // came from got a panel sitting AT the corner but still undocked, still writing
    // panelX/panelY, still needing the dock button pressed to actually be docked. The app and the
    // reader disagreed about a thing the reader could see, which is the whole argument in
    // furniture.js's SNAP.
    //
    // It docks along the whole LEFT EDGE, not at the top-left corner: a panel held against the left
    // edge anywhere along it docks, the table's rule along the bottom rotated (nearLeftEdge).
    // Ctrl held leaves the snap off, so a reader can park it just off the edge on purpose.
    makeDraggable(panel, head, ({ x, y, ctrl }) => {
        _frame.undocked = true;
        _frame.x = x; _frame.y = y;
        panel.classList.toggle('sgs-snapping', !ctrl && nearLeftEdge({ left: x }, dockPoint().x));
        apply();
    }, ({ x, ctrl }) => {
        panel.classList.remove('sgs-snapping');
        if (ctrl || !nearLeftEdge({ left: x }, dockPoint().x)) return;
        // Docking by drag lands in the same state the dock button lands in, on purpose: two
        // gestures for one outcome, not two outcomes that look alike.
        _frame.undocked = false;
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
