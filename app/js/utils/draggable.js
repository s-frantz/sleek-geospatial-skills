/**
 * draggable.js — drag an element by a handle.
 *
 * Pointer events, not mouse events, so a stylus and a touch drag work for free. Capture is
 * taken on the HANDLE, which is what keeps a fast drag from escaping the element and leaving
 * it stuck to the cursor.
 *
 * ── Left and top are not coordinates until the element is out of flow ────────────────────
 * This used to say "drag an ABSOLUTELY POSITIONED element", and the overlay window was not
 * one: it is `position: relative`, centred by `place-items: center` on its backdrop. On a
 * relative element `left` and `top` are an OFFSET FROM where flow already put it, not a
 * position in the viewport, so writing the element's own bounding rect into them moved it by
 * its own distance from the corner. Grabbing a centred window threw it off the screen, and
 * the further from the corner it started, the further it jumped.
 *
 * A comment saying "absolutely positioned" is not a precondition anybody checks. So the drag
 * establishes it instead: on the first press, an element that is not already out of flow is
 * promoted to `position: fixed` at the rect it currently occupies, which is a no-op visually
 * and makes left/top mean what the rest of this file assumes. Centring by grid and
 * positioning by coordinates are two systems, and the element has to leave one to enter the
 * other.
 */

/**
 * Undo the promotion, so the element goes back to being positioned by the stylesheet.
 *
 * The drag writes SIX inline properties and clearing three of them is not enough, which is
 * how furniture that re-berths after a drag ends up in the right corner at the wrong size:
 * `bottom: auto` survives, the docked panel's bottom anchor never comes back, and it sits at
 * the top-left hugging its content while every class says it is docked. The promotion is this
 * file's residue, so removing it belongs here rather than in each caller's applier, where it
 * would be got wrong once per caller.
 *
 * @param {HTMLElement} el
 * @returns {void}
 */
export function releaseDrag(el) {
    for (const prop of ['position', 'margin', 'left', 'top', 'right', 'bottom']) {
        el.style.removeProperty(prop);
    }
}

/**
 * @param {HTMLElement} el the element that moves
 * @param {HTMLElement} handle the element you grab
 * @param {(pos: {x: number, y: number}) => void} [onMove] called with each new position
 * @param {(pos: {x: number, y: number}) => void} [onEnd] called once, on release
 * @returns {() => void} teardown
 */
export function makeDraggable(el, handle, onMove, onEnd) {
    let startX = 0, startY = 0, baseX = 0, baseY = 0, dragging = false;

    /** @param {PointerEvent} e */
    const down = (e) => {
        if (e.button !== 0) return;
        // Do not start a drag from something inside the handle that is itself clickable.
        if (/** @type {HTMLElement} */ (e.target).closest('button, a, input, select')) return;
        const r = el.getBoundingClientRect();

        // Promote out of flow, in place, before the first move. Fixed rather than absolute:
        // the rect we just read is viewport-relative, and fixed is the one scheme where those
        // numbers mean the same thing without knowing what the offset parent turned out to be.
        const pos = getComputedStyle(el).position;
        if (pos !== 'absolute' && pos !== 'fixed') {
            el.style.position = 'fixed';
            el.style.margin = '0';
            el.style.left = `${r.left}px`;
            el.style.top = `${r.top}px`;
        }

        startX = e.clientX; startY = e.clientY;
        baseX = r.left; baseY = r.top;
        dragging = true;
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
    };

    /** @param {PointerEvent} e */
    const move = (e) => {
        if (!dragging) return;
        const x = Math.round(baseX + (e.clientX - startX));
        const y = Math.round(baseY + (e.clientY - startY));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        onMove?.({ x, y });
    };

    /** @param {PointerEvent} e */
    const up = (e) => {
        if (!dragging) return;
        dragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        // Release is its own event, not the last move. Furniture that snaps back to a berth
        // has to decide on LETTING GO: deciding on the last move would re-berth the thing
        // mid-drag and leave the reader dragging something that is no longer under the
        // cursor.
        const r = el.getBoundingClientRect();
        onEnd?.({ x: Math.round(r.left), y: Math.round(r.top) });
    };

    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);

    return () => {
        handle.removeEventListener('pointerdown', down);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
    };
}
