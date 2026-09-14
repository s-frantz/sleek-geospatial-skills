/**
 * stow.js — the one way a section is put away.
 *
 * An app grows several gestures for "make this go away" and no word for any of them, so each
 * new panel invents another one. Two verbs and two nouns, and one test.
 *
 *   FOLD    one chevron, four views: natural, tight (fit to the rows), the head alone, and
 *           snug (fit to the rows and the width).
 *   CLOSE   the whole section leaves the layout and gives its pixels back.
 *   MARK    what a close leaves behind: a small tab that brings the section back.
 *   EDGE    where a mark parks: the viewport edge its section came from, never a lane of
 *           its own.
 *
 * ── The test ─────────────────────────────────────────────────────────────────────────────
 * DOES THE THING STILL HAVE SOMETHING TO SAY WHEN IT IS SHUT?
 *
 * Yes, so FOLD. The table's bar goes on reporting "Stations, 24 rows" while folded, and that
 * sentence is worth a row of pixels. No, so CLOSE: a folded minimap yields a bar reading
 * "Minimap", which is no information at all, so it should leave and give the space back.
 *
 * A chevron is a LIST affordance. Alone on screen it is a switch wearing a disclosure
 * costume, which is why folding a single lone panel reads cheap.
 *
 * ── Both verbs on one section ────────────────────────────────────────────────────────────
 * The panel and the table each offer BOTH, and that is deliberate rather than indecisive.
 * They are the two largest things on screen, and the two questions a reader actually has are
 * different: "let me see the map behind this for a second" (fold, and the head stays where
 * my eye expects it) and "I am not using this at all right now" (close, and give me the
 * pixels). Offering only the first makes a permanently unwanted panel permanently present;
 * offering only the second throws away the head's report every time someone peeks.
 *
 * The grammar is identical in both places, which is the part worth taking: same chevron in
 * the same corner, same close beside it, same kind of tab left behind on the nearest
 * viewport edge. Learn the panel and you already know the table.
 *
 * ── Why marks sit on an edge, not in a lane ──────────────────────────────────────────────
 * The obvious design is a RAIL: a thin dedicated row that holds the marks. It does not
 * survive contact. A lane that exists to hold one or two small glyphs spends a whole row of
 * chrome, and it reads as new furniture rather than as the section having moved. So a mark
 * parks against the viewport edge the section came from: the panel's on the left, the
 * table's on the bottom. Nothing on screen when nothing is closed.
 */

import { iconButton, setButton } from './buttons.js';

/**
 * @typedef {object} Closable
 * @property {() => void} close
 * @property {() => void} open
 * @property {() => void} toggle
 * @property {() => boolean} isClosed
 * @property {HTMLButtonElement} mark
 */

/**
 * Make a section closable, leaving a MARK docked on a viewport edge.
 *
 * The mark is created once and lives in the document permanently; CSS shows it only while
 * the section is closed. Creating and destroying it per state would mean the reopen control
 * does not exist at the exact moment somebody needs it — a race that shows up as a tab that
 * flickers on resize.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.section     the thing that leaves the layout
 * @param {string} opts.markId           id for the mark, so tests and CSS can find it
 * @param {string} opts.markClass        which edge the mark parks on
 * @param {string} opts.glyph            the chevron direction that points back at the section
 * @param {string} opts.label
 * @param {(closed: boolean) => void} [opts.onChange] fires on every change, including the
 *        initial one, so the camera and any open popups get told exactly once
 * @returns {Closable}
 */
export function makeClosable({ section, markId, markClass, glyph, label, onChange }) {
    let _closed = false;

    const mark = iconButton({ className: `sgs-mark ${markClass}`, glyph, size: 10, label: `Open ${label}` });
    mark.id = markId;
    document.body.appendChild(mark);

    const apply = (/** @type {boolean} */ next) => {
        _closed = next;
        section.classList.toggle('sgs-closed', next);
        document.body.classList.toggle(`${markClass}-shown`, next);
        onChange?.(next);
    };

    mark.addEventListener('click', () => apply(false));
    apply(false);

    // A close shrinks the section into its mark, then the mark pulses once. Only a CLOSE
    // pulses, never the initial state and never an open: the pulse says "it went here", which
    // is only true at the moment it goes. A second press while it is on its way is ignored.
    let _leaving = false;
    const close = () => {
        if (_closed || _leaving) return;
        _leaving = true;
        stowInto(section, mark, () => { _leaving = false; apply(true); flashMark(mark); });
    };
    return {
        close,
        open: () => apply(false),
        toggle: () => { if (_closed) apply(false); else close(); },
        isClosed: () => _closed,
        mark,
    };
}

/** How long a section takes to shrink into its mark, ms. Fast enough to read as a gesture. */
export const STOW_MS = 160;

/**
 * Shrink a section toward its mark, quickly, then hand over to `done`, which takes it out of
 * the layout.
 *
 * The pulse on the mark says where the section went; this shows it going there, which is the
 * part a pulse alone cannot: the reader's eye is on the section when they close it, and a tab
 * lighting up at the far edge of the screen is easy to miss. One transform and an opacity on
 * the section's own box, no clone and no layout, so it costs nothing to maintain. Reduced
 * motion, or a section with no size, goes straight to `done`.
 *
 * @param {HTMLElement} section
 * @param {HTMLElement} mark
 * @param {() => void} done
 * @returns {void}
 */
export function stowInto(section, mark, done) {
    const from = section.getBoundingClientRect();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still || typeof section.animate !== 'function' || from.width === 0) { done(); return; }

    // The mark is display:none until its section is closed, so it is shown for one read to
    // learn where it will be. Nothing paints in between.
    const shown = getComputedStyle(mark).display !== 'none';
    if (!shown) mark.style.display = 'flex';
    const to = mark.getBoundingClientRect();
    if (!shown) mark.style.removeProperty('display');

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const s = Math.max(to.width / from.width, to.height / from.height, 0.04);
    const anim = section.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 },
    ], { duration: STOW_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
    // Held at its end frame until `done` has taken it out of the layout, then released, so a
    // section that opens again later carries no leftover transform.
    const finish = () => { done(); anim.cancel(); };
    anim.finished.then(finish, finish);
}

/**
 * How long the arrival pulse lasts. Matches the animation in edge-mark.css, which holds the
 * dark outline for its first 30%: 300ms, long enough to be seen after the shrink lands.
 */
const FLASH_MS = 1000;
/** @type {WeakMap<HTMLElement, number>} */
const _flashTimers = new WeakMap();

/**
 * Pulse a mark once, briefly, as it appears: "this is where it went, and where it comes back
 * from". A closed section leaves a 13px tab on a viewport edge, which is easy to miss exactly
 * because it is designed to be quiet. One short pulse at the moment of closing teaches where
 * it lives, and after that it can stay quiet.
 *
 * Exported because a section can close by a path other than makeClosable: the table removes
 * itself outright and its mark is shown by CSS, so it calls this directly.
 *
 * Cleared by a timer rather than `animationend`: with reduced motion the animation never runs,
 * so it never ends, and the class would stay on for good.
 *
 * @param {HTMLElement} mark
 * @returns {void}
 */
export function flashMark(mark) {
    clearTimeout(_flashTimers.get(mark));
    mark.classList.remove('sgs-mark--flash');
    // Flush styles so re-adding the class restarts the animation on a quick second close.
    void mark.offsetWidth;
    mark.classList.add('sgs-mark--flash');
    _flashTimers.set(mark, window.setTimeout(() => mark.classList.remove('sgs-mark--flash'), FLASH_MS));
}

/**
 * The four views one chevron gives of a section, in the order it steps through them, with the
 * way the chevron points in each:
 *   natural  ↓  its own size: the reader's, or FULL's
 *   tight    →  fitted to its rows, taller or shorter, with no blank band under the last one
 *   head     ↑  its head alone, still reporting
 *   snug     ←  fitted to its rows AND its columns: tight, and as narrow as its content
 * @typedef {'natural'|'tight'|'head'|'snug'} FoldMode
 */

/**
 * The step a chevron press takes. ONE owner for the cycle, so the panel and the table cannot
 * grow two orders: natural, tight, head, snug, and natural again.
 *
 * A fitted view is skipped only when it could not do its job. TIGHT goes when the rows could
 * not all fit on screen, since "fitted to its rows" would then be a lie; SNUG goes when there is
 * no width to take in, since it would then be TIGHT again, and the step that is TIGHT's job
 * already came.
 *
 * @param {FoldMode} mode
 * @param {{tight: boolean, snug: boolean}} offer which fitted views can do their job right now
 * @returns {FoldMode}
 */
export function nextFoldMode(mode, offer) {
    if (mode === 'natural') return offer.tight ? 'tight' : 'head';
    if (mode === 'tight') return 'head';
    if (mode === 'head') return offer.snug ? 'snug' : 'natural';
    return 'natural';
}

/**
 * Make a section foldable: one chevron stepping through NATURAL, TIGHT, HEAD and SNUG.
 *
 * Every view but NATURAL is a VIEW, not a size: each is a class on the section, so none writes
 * over a size the reader set, and stepping back to NATURAL restores it exactly. The same rule
 * FULL follows, for the same reason.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.section
 * @param {HTMLButtonElement} opts.control the head button carrying the chevron
 * @param {HTMLElement} opts.body
 * @param {string} [opts.foldedClass] the class marking HEAD
 * @param {string} [opts.tightClass] the class marking TIGHT; without one the step is not offered
 * @param {string} [opts.snugClass] the class marking SNUG; without one the step is not offered
 * @param {() => boolean} [opts.tightFits] could every row fit on screen right now?
 * @param {() => boolean} [opts.snugDiffers] is there width to take in right now?
 * @param {Record<FoldMode, string>} [opts.labels] what a press does, by the view it goes to
 * @param {boolean} [opts.folded]
 * @param {(folded: boolean, mode: FoldMode) => void} [opts.onChange]
 */
export function makeFoldable({
    section, control, body, foldedClass = 'sgs-folded', tightClass, snugClass,
    tightFits = () => false, snugDiffers = () => false, labels, folded = true, onChange,
}) {
    /** @type {FoldMode} */
    let _mode = folded ? 'head' : 'natural';
    const next = () => nextFoldMode(_mode, {
        tight: !!tightClass && tightFits(),
        snug: !!snugClass && snugDiffers(),
    });

    // The label names what the NEXT press does, which is what a reader hovering it wants.
    const relabel = () => {
        if (labels) setButton(control, { label: labels[next()] });
    };

    const apply = (/** @type {FoldMode} */ mode) => {
        _mode = mode;
        section.classList.toggle(foldedClass, mode === 'head');
        if (tightClass) section.classList.toggle(tightClass, mode === 'tight');
        if (snugClass) section.classList.toggle(snugClass, mode === 'snug');
        control.setAttribute('aria-expanded', String(mode !== 'head'));
        // `hidden` and not display:none in a rule: the body must leave the accessibility
        // tree too, or a screen reader still walks a table the sighted reader cannot see.
        body.hidden = mode === 'head';
        onChange?.(mode === 'head', mode);
        relabel();
    };

    control.addEventListener('click', () => apply(next()));
    apply(_mode);

    return {
        fold: () => apply('head'),
        unfold: () => apply('natural'),
        toggle: () => apply(_mode === 'head' ? 'natural' : 'head'),
        step: () => apply(next()),
        next,
        mode: () => _mode,
        isFolded: () => _mode === 'head',
        relabel,
    };
}
