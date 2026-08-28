/**
 * stow.js — the one way a section is put away.
 *
 * An app grows several gestures for "make this go away" and no word for any of them, so each
 * new panel invents another one. The vocabulary is two verbs and two nouns, and the test for
 * which verb applies is: DOES THE THING STILL HAVE SOMETHING TO SAY WHEN IT IS SHUT?
 *
 *   FOLD    the content collapses, the header stays in its slot, a chevron rotates. Right when
 *           the header is itself information AND the section has siblings to compare against.
 *           The dock folds: its bar goes on reporting "Districts, 12 rows" while shut.
 *   STOW    the whole section leaves the layout and gives its pixels back. Right when the
 *           section is self-contained and has nothing to report while shut. Folding a minimap
 *           yields a bar reading "Minimap", which is no information at all.
 *   MARK    what a stow leaves behind: the section's own glyph, parked at a corner of the
 *           container, which brings it back.
 *   BERTH   where a container's marks park. A corner, not a lane.
 *
 * A chevron is a LIST affordance. Alone on screen it is a switch wearing a disclosure costume,
 * which is why folding a single panel reads cheap.
 *
 * WHY MARKS SIT AT CORNERS. The obvious design is a RAIL: a thin dedicated row that holds the
 * marks. It does not survive contact. A lane that exists to hold one or two small glyphs
 * spends a whole row of a narrow panel on chrome, and it reads as new furniture rather than as
 * the section having moved. So marks park at corners of chrome that already exists. No lane,
 * no extra line, and nothing on screen when nothing is stowed.
 *
 * The consequence worth knowing: a mark and a stow control can be the SAME element. When a
 * section's control already lives in the berth, stowing does not spawn a twin beside it; the
 * control simply becomes the thing that brings the section back. One glyph per section, in one
 * place, whatever its state.
 *
 * A stow is not the same switch as a settings toggle. Settings decides whether a thing exists
 * for this map at all; a stow is this reader, right now, wanting the pixels.
 */

import { icon } from '../icons.js';

/**
 * @typedef {object} Stowable
 * @property {() => void} stow
 * @property {() => void} unstow
 * @property {() => void} toggle
 * @property {() => boolean} isStowed
 * @property {HTMLButtonElement} mark
 */

/**
 * Make a section stowable, with its mark parked in a berth.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.section the thing that leaves the layout
 * @param {HTMLElement} opts.berth where its mark parks
 * @param {string} opts.glyph a name from icons.js: the section's OWN mark, not a generic one
 * @param {string} opts.label used for the title and the accessible name
 * @param {boolean} [opts.stowed] initial state
 * @param {(stowed: boolean) => void} [opts.onChange] fires after every change, including the
 *        initial one, so callers that must react (the camera, popups) get told once
 * @returns {Stowable}
 */
export function makeStowable({ section, berth, glyph, label, stowed = false, onChange }) {
    let _stowed = false;

    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'sgs-icon-btn sgs-mark';

    const apply = (/** @type {boolean} */ next) => {
        _stowed = next;
        section.classList.toggle('sgs-stowed', next);
        // The mark is the same element in both states. Only what it says changes.
        mark.title = next ? `Show ${label}` : `Hide ${label}`;
        mark.setAttribute('aria-label', mark.title);
        mark.setAttribute('aria-pressed', String(next));
        mark.innerHTML = icon(next ? glyph : 'tight', 13);
        onChange?.(next);
    };

    mark.addEventListener('click', () => apply(!_stowed));
    berth.appendChild(mark);
    apply(stowed);

    return {
        stow: () => apply(true),
        unstow: () => apply(false),
        toggle: () => apply(!_stowed),
        isStowed: () => _stowed,
        mark,
    };
}

/**
 * Make a section foldable: content collapses, the head stays and keeps reporting.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.section
 * @param {HTMLButtonElement} opts.control the head button carrying the chevron
 * @param {HTMLElement} opts.body
 * @param {boolean} [opts.folded]
 * @param {(folded: boolean) => void} [opts.onChange]
 * @returns {{fold: () => void, unfold: () => void, toggle: () => void, isFolded: () => boolean}}
 */
export function makeFoldable({ section, control, body, folded = true, onChange }) {
    let _folded = folded;

    const apply = (/** @type {boolean} */ next) => {
        _folded = next;
        section.classList.toggle('sgs-dock--folded', next);
        control.setAttribute('aria-expanded', String(!next));
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
