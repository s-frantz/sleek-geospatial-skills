/**
 * stow.js — the one way a section is put away.
 *
 * An app grows several gestures for "make this go away" and no word for any of them, so each
 * new panel invents another one. Two verbs and two nouns, and one test.
 *
 *   FOLD    the content collapses, the header stays in its slot, a chevron rotates.
 *   CLOSE   the whole section leaves the layout and gives its pixels back.
 *   MARK    what a close leaves behind: a small tab that brings the section back.
 *   BERTH   where a mark parks. An edge or a corner of chrome that already exists, never a
 *           lane of its own.
 *
 * ── The test ─────────────────────────────────────────────────────────────────────────────
 * DOES THE THING STILL HAVE SOMETHING TO SAY WHEN IT IS SHUT?
 *
 * Yes, so FOLD. The dock's bar goes on reporting "Stations, 24 rows" while folded, and that
 * sentence is worth a row of pixels. No, so CLOSE: a folded minimap yields a bar reading
 * "Minimap", which is no information at all, so it should leave and give the space back.
 *
 * A chevron is a LIST affordance. Alone on screen it is a switch wearing a disclosure
 * costume, which is why folding a single lone panel reads cheap.
 *
 * ── Both verbs on one section ────────────────────────────────────────────────────────────
 * The panel and the dock each offer BOTH, and that is deliberate rather than indecisive.
 * They are the two largest things on screen, and the two questions a reader actually has are
 * different: "let me see the map behind this for a second" (fold, and the head stays where
 * my eye expects it) and "I am not using this at all right now" (close, and give me the
 * pixels). Offering only the first makes a permanently unwanted panel permanently present;
 * offering only the second throws away the head's report every time someone peeks.
 *
 * The grammar is identical in both places, which is the part worth taking: same chevron in
 * the same corner, same close beside it, same kind of tab left behind on the nearest
 * viewport edge. Learn the panel and you already know the dock.
 *
 * ── Why marks sit on an edge, not in a lane ──────────────────────────────────────────────
 * The obvious design is a RAIL: a thin dedicated row that holds the marks. It does not
 * survive contact. A lane that exists to hold one or two small glyphs spends a whole row of
 * chrome, and it reads as new furniture rather than as the section having moved. So a mark
 * parks against the viewport edge the section came from: the panel's on the left, the
 * dock's on the bottom. Nothing on screen when nothing is closed.
 */

import { icon } from '../icons.js';

/**
 * @typedef {object} Closable
 * @property {() => void} close
 * @property {() => void} open
 * @property {() => void} toggle
 * @property {() => boolean} isClosed
 * @property {HTMLButtonElement} mark
 */

/**
 * Make a section closable, leaving a MARK berthed on a viewport edge.
 *
 * The mark is created once and lives in the document permanently; CSS shows it only while
 * the section is closed. Creating and destroying it per state would mean the reopen control
 * does not exist at the exact moment somebody needs it — a race that shows up as a tab that
 * flickers on resize.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.section     the thing that leaves the layout
 * @param {string} opts.markId           id for the mark, so tests and CSS can find it
 * @param {string} opts.markClass        which edge berth the mark parks in
 * @param {string} opts.glyph            the chevron direction that points back at the section
 * @param {string} opts.label
 * @param {(closed: boolean) => void} [opts.onChange] fires on every change, including the
 *        initial one, so the camera and any open popups get told exactly once
 * @returns {Closable}
 */
export function makeClosable({ section, markId, markClass, glyph, label, onChange }) {
    let _closed = false;

    const mark = document.createElement('button');
    mark.id = markId;
    mark.type = 'button';
    mark.className = `sgs-mark ${markClass}`;
    mark.title = `Open ${label}`;
    mark.setAttribute('aria-label', mark.title);
    mark.innerHTML = icon(glyph, 10);
    document.body.appendChild(mark);

    const apply = (/** @type {boolean} */ next) => {
        _closed = next;
        section.classList.toggle('sgs-closed', next);
        document.body.classList.toggle(`${markClass}-shown`, next);
        onChange?.(next);
    };

    mark.addEventListener('click', () => apply(false));
    apply(false);

    // Only a CLOSE flashes the mark, never the initial state and never an open: the pulse
    // says "it went here", which is only true at the moment it goes.
    return {
        close: () => { apply(true); flashMark(mark); },
        open: () => apply(false),
        toggle: () => { apply(!_closed); if (_closed) flashMark(mark); },
        isClosed: () => _closed,
        mark,
    };
}

/** How long the arrival pulse lasts. Matches the animation in edge-mark.css. */
const FLASH_MS = 700;
/** @type {WeakMap<HTMLElement, number>} */
const _flashTimers = new WeakMap();

/**
 * Pulse a mark once, briefly, as it appears: "this is where it went, and where it comes back
 * from". A closed section leaves a 13px tab on a viewport edge, which is easy to miss exactly
 * because it is designed to be quiet. One short pulse at the moment of closing teaches where
 * it lives, and after that it can stay quiet.
 *
 * Exported because a section can close by a path other than makeClosable: the dock removes
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
 * Make a section foldable: content collapses, the head stays and keeps reporting.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.section
 * @param {HTMLButtonElement} opts.control the head button carrying the chevron
 * @param {HTMLElement} opts.body
 * @param {string} [opts.foldedClass] the class marking the folded state
 * @param {boolean} [opts.folded]
 * @param {(folded: boolean) => void} [opts.onChange]
 * @returns {{fold: () => void, unfold: () => void, toggle: () => void, isFolded: () => boolean}}
 */
export function makeFoldable({ section, control, body, foldedClass = 'sgs-folded', folded = true, onChange }) {
    let _folded = folded;

    const apply = (/** @type {boolean} */ next) => {
        _folded = next;
        section.classList.toggle(foldedClass, next);
        control.setAttribute('aria-expanded', String(!next));
        // `hidden` and not display:none in a rule: the body must leave the accessibility
        // tree too, or a screen reader still walks a table the sighted reader cannot see.
        body.hidden = next;
        onChange?.(next);
    };

    control.addEventListener('click', () => apply(!_folded));
    apply(_folded);

    return {
        fold: () => apply(true),
        unfold: () => apply(false),
        toggle: () => apply(!_folded),
        isFolded: () => _folded,
    };
}
