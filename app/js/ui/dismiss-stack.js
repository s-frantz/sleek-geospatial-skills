/**
 * dismiss-stack.js — one owner for Escape.
 *
 * Three modules wanted to handle Escape: the popup, the overlay window, and the settings
 * popover. Left to themselves each adds its own `document` keydown, and then one Escape closes
 * all three at once, because listeners on the same node all run whatever any of them does to
 * the event. `stopPropagation` does not help: it stops other NODES, not siblings.
 *
 * So Escape has an owner. Anything dismissible pushes a handler and gets a remover back; one
 * listener, at the top of the app, calls the LAST thing pushed. That gives the behaviour the
 * app actually wants for free: the most recently opened thing is the thing Escape closes, and
 * everything underneath is left alone.
 *
 * The rule this encodes is worth stating on its own: when two features want the same key, the
 * answer is not a cleverer guard in each of them. It is a stack, owned once.
 */

/** @type {Array<() => void>} */
const _stack = [];

let _bound = false;

function bind() {
    if (_bound || typeof document === 'undefined') return;
    _bound = true;
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !_stack.length) return;
        e.preventDefault();
        _stack[_stack.length - 1]();
    });
}

/**
 * Register something Escape should close. Call the returned function when it closes by any
 * other route, or the stack will keep a handler for a thing that is no longer on screen.
 * @param {() => void} onDismiss
 * @returns {() => void} remover
 */
export function pushDismissible(onDismiss) {
    bind();
    _stack.push(onDismiss);
    return () => {
        const i = _stack.lastIndexOf(onDismiss);
        if (i > -1) _stack.splice(i, 1);
    };
}

/**
 * Move an already-registered handler to the top, for a thing that was raised rather than
 * opened, such as a popup clicked to the front.
 * @param {() => void} onDismiss
 * @returns {void}
 */
export function raiseDismissible(onDismiss) {
    const i = _stack.lastIndexOf(onDismiss);
    if (i > -1 && i !== _stack.length - 1) {
        _stack.splice(i, 1);
        _stack.push(onDismiss);
    }
}

/** How many dismissible things are open. @returns {number} */
export function dismissibleCount() { return _stack.length; }
