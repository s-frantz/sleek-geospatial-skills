/**
 * draggable.js — drag an absolutely positioned element by a handle.
 *
 * Pointer events, not mouse events, so a stylus and a touch drag work for free. Capture is
 * taken on the HANDLE, which is what keeps a fast drag from escaping the element and leaving
 * it stuck to the cursor.
 */

/**
 * @param {HTMLElement} el the element that moves
 * @param {HTMLElement} handle the element you grab
 * @param {(pos: {x: number, y: number}) => void} [onMove] called with each new position
 * @returns {() => void} teardown
 */
export function makeDraggable(el, handle, onMove) {
    let startX = 0, startY = 0, baseX = 0, baseY = 0, dragging = false;

    /** @param {PointerEvent} e */
    const down = (e) => {
        if (e.button !== 0) return;
        // Do not start a drag from something inside the handle that is itself clickable.
        if (/** @type {HTMLElement} */ (e.target).closest('button, a, input, select')) return;
        const r = el.getBoundingClientRect();
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
