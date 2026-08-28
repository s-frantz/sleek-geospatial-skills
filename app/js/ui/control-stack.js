/**
 * control-stack.js — custom buttons that sit with MapLibre's own, and look like they belong.
 *
 * MapLibre's control API is an object with `onAdd` returning an element. That is the whole
 * contract, which means a custom control is easy to add and easy to make look foreign. The
 * three things that make one look native:
 *
 *   1. WEAR THE LIBRARY'S CLASSES. `maplibregl-ctrl maplibregl-ctrl-group` on the container.
 *      Skip them and you inherit none of the group's radius, shadow, or edge handling, and
 *      you will spend an afternoon re-deriving them slightly wrong.
 *   2. LET THE GLYPH INHERIT `color`. Every icon here is stroked with `currentColor`, so one
 *      rule recolours the whole stack, hover and dark mode included. A glyph carrying its own
 *      fill needs a rule per state per glyph, and one of them will get missed.
 *   3. ONE SHELL, MANY BUTTONS. Every custom button goes through `makeControl`, so there is
 *      one place where padding, sizing and the focus ring are decided.
 *
 * The styling trap is in the `map-control-icons` skill: MapLibre's own selectors are specific
 * enough that a plain class rule loses to them, which is one of the rare places `!important`
 * is the correct answer rather than a smell.
 */

import { icon, GLYPH } from '../icons.js';

/**
 * @typedef {object} ControlSpec
 * @property {string} glyph a name from icons.js
 * @property {string} title tooltip and accessible name
 * @property {(btn: HTMLButtonElement) => void} onClick
 * @property {number} [size] ink size override, in pixels
 */

/**
 * Build a MapLibre control containing one or more buttons in a single group.
 * @param {ControlSpec[]} specs
 * @returns {{onAdd: () => HTMLElement, onRemove: () => void, buttons: HTMLButtonElement[]}}
 */
export function makeControl(specs) {
    /** @type {HTMLButtonElement[]} */
    const buttons = [];
    /** @type {HTMLElement|null} */
    let container = null;

    return {
        buttons,
        onAdd() {
            container = document.createElement('div');
            container.className = 'maplibregl-ctrl maplibregl-ctrl-group sgs-ctrl';
            for (const spec of specs) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'sgs-ctrl-btn';
                btn.title = spec.title;
                btn.setAttribute('aria-label', spec.title);
                btn.innerHTML = icon(spec.glyph, spec.size ?? GLYPH);
                btn.dataset.glyph = spec.glyph;
                btn.addEventListener('click', () => spec.onClick(btn));
                container.appendChild(btn);
                buttons.push(btn);
            }
            return container;
        },
        onRemove() {
            container?.remove();
            container = null;
        },
    };
}
