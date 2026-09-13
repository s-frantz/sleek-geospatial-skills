/**
 * stow.js — the one way a section is put away.
 *
 * An app grows several gestures for "make this go away" and no word for any of them, so each
 * new panel invents another one. Two verbs and two nouns, and one test.
 *
 *   FOLD    one chevron, three views: natural, tight (fit to the rows), the head alone.
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

    return {
        close: () => apply(true),
        open: () => apply(false),
        toggle: () => apply(!_closed),
        isClosed: () => _closed,
        mark,
    };
}

/**
 * The three views one chevron gives of a section's vertical axis.
 *   natural  its own height: the reader's pinned one, or FULL's
 *   tight    fitted to its rows, with no blank band under the last one
 *   header   its head alone, still reporting
 * @typedef {'natural'|'tight'|'header'} FoldMode
 */

/**
 * The step a chevron press takes. ONE owner for the cycle, so the panel and the table cannot
 * grow two orders: natural, then tight, then header, then natural again. TIGHT is skipped when
 * the rows would fill the section anyway, because a press that changes nothing reads as a
 * broken button.
 *
 * @param {FoldMode} mode
 * @param {boolean} tightDiffers would fitting to the rows actually make it shorter?
 * @returns {FoldMode}
 */
export function nextFoldMode(mode, tightDiffers) {
    if (mode === 'natural') return tightDiffers ? 'tight' : 'header';
    if (mode === 'tight') return 'header';
    return 'natural';
}

/**
 * Make a section foldable: one chevron stepping through NATURAL, TIGHT and HEADER.
 *
 * TIGHT and HEADER are VIEWS, not sizes: each is a class on the section, so neither writes over
 * a height the reader pinned, and stepping back to NATURAL restores it exactly. The same rule
 * FULL follows, for the same reason.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.section
 * @param {HTMLButtonElement} opts.control the head button carrying the chevron
 * @param {HTMLElement} opts.body
 * @param {string} [opts.foldedClass] the class marking HEADER
 * @param {string} [opts.tightClass] the class marking TIGHT; without one the section only folds
 * @param {() => boolean} [opts.tightDiffers] would TIGHT make the section shorter right now?
 * @param {Record<FoldMode, string>} [opts.labels] what a press does, by the view it goes to
 * @param {boolean} [opts.folded]
 * @param {(folded: boolean, mode: FoldMode) => void} [opts.onChange]
 */
export function makeFoldable({
    section, control, body, foldedClass = 'sgs-folded', tightClass, tightDiffers = () => false,
    labels, folded = true, onChange,
}) {
    /** @type {FoldMode} */
    let _mode = folded ? 'header' : 'natural';
    const next = () => nextFoldMode(_mode, !!tightClass && tightDiffers());

    // The label names what the NEXT press does, which is what a reader hovering it wants.
    const relabel = () => {
        if (!labels) return;
        const text = labels[next()];
        control.title = text;
        control.setAttribute('aria-label', text);
    };

    const apply = (/** @type {FoldMode} */ mode) => {
        _mode = mode;
        section.classList.toggle(foldedClass, mode === 'header');
        if (tightClass) section.classList.toggle(tightClass, mode === 'tight');
        control.setAttribute('aria-expanded', String(mode !== 'header'));
        // `hidden` and not display:none in a rule: the body must leave the accessibility
        // tree too, or a screen reader still walks a table the sighted reader cannot see.
        body.hidden = mode === 'header';
        onChange?.(mode === 'header', mode);
        relabel();
    };

    control.addEventListener('click', () => apply(next()));
    apply(_mode);

    return {
        fold: () => apply('header'),
        unfold: () => apply('natural'),
        toggle: () => apply(_mode === 'header' ? 'natural' : 'header'),
        step: () => apply(next()),
        next,
        mode: () => _mode,
        isFolded: () => _mode === 'header',
        relabel,
    };
}
