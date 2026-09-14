/**
 * buttons.js: the one way an icon button is made, and the one way it changes its look.
 *
 * An icon button has no words on it, so its tooltip IS its name: `title` for the eye and
 * `aria-label` for a screen reader, the same text in both. Every icon button in the app used to
 * write that pair out by hand, and every toggle (the table buttons, FULL, the chevron, the popup's
 * table button) wrote it again each time its state moved. Any one of those places could set one
 * half and forget the other. `setButton` sets both from one argument, so they cannot disagree.
 *
 * Only icon buttons come through here. A button with words on it (a window's footer, a tab in
 * a window's rail, a segment in quick settings) already has a name, and has its own role and
 * requirements besides; wrapping those would be a helper with a branch per caller.
 */

import { icon } from '../icons.js';

/**
 * What a button shows. Everything is optional, and only what is given changes, so a toggle can
 * update its label without redrawing its glyph.
 * @typedef {object} ButtonLook
 * @property {string} [glyph] a name from icons.js
 * @property {number} [size] the glyph's size in px, 12 unless said otherwise
 * @property {string} [label] the tooltip and the accessible name: one text, both places
 * @property {boolean} [pressed] a toggle's state, as `aria-pressed`
 */

/**
 * @param {ButtonLook & {className?: string, onClick?: (e: MouseEvent) => void}} spec
 *        `className` defaults to the shared icon-button shell (buttons.css)
 * @returns {HTMLButtonElement}
 */
export function iconButton({ className = 'sgs-icon-btn', onClick, ...look }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    setButton(b, look);
    if (onClick) b.addEventListener('click', onClick);
    return b;
}

/**
 * Change a button's look. Takes an Element, so a button found with querySelector needs no cast.
 * @param {Element} b
 * @param {ButtonLook} look
 * @returns {void}
 */
export function setButton(b, { glyph, size = 12, label, pressed }) {
    if (glyph) b.innerHTML = icon(glyph, size);
    if (label !== undefined) {
        b.setAttribute('title', label);
        b.setAttribute('aria-label', label);
    }
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
}
