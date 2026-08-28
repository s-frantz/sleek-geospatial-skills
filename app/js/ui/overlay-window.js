/**
 * overlay-window.js — the one large-window shell.
 *
 * Dimmed backdrop, centred panel draggable by its header, close button, and three ways out:
 * the button, the backdrop, and Escape. Callers own the body and append whatever they like
 * after the header.
 *
 * ── The stack ────────────────────────────────────────────────────────────────────────────
 * Windows layer. A confirmation opens over a settings sheet, a detail opens over that. So
 * Escape closes only the TOPMOST: a key that dismisses everything at once destroys context the
 * reader spent several clicks assembling, and it does it silently. Which thing is topmost is
 * not this module's business, because popups and the settings popover are in the same contest.
 * It belongs to dismiss-stack.js, and every window simply registers there.
 *
 * ── Why a caller might not want removal ──────────────────────────────────────────────────
 * `onRequestClose` exists for windows with an exit animation or unsaved state: when it is
 * supplied, the shell asks and the caller decides. Without it, close means close.
 */

import { icon } from '../icons.js';
import { makeDraggable } from '../utils/draggable.js';
import { pushDismissible } from './dismiss-stack.js';

/** @type {Array<{overlay: HTMLElement}>} */
const _stack = [];

/**
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.windowClass] extra classes for the panel, for size variants
 * @param {(() => void)|null} [opts.onRequestClose] when given, the CALLER removes the window
 * @returns {{overlay: HTMLElement, panel: HTMLElement, header: HTMLElement, body: HTMLElement, close: () => void}}
 */
export function createOverlayWindow({ title = '', windowClass = '', onRequestClose = null } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'sgs-window-overlay';

    const panel = document.createElement('div');
    panel.className = `sgs-window ${windowClass}`.trim();
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (title) panel.setAttribute('aria-label', title);

    const header = document.createElement('div');
    header.className = 'sgs-window-head';
    const titleEl = document.createElement('span');
    titleEl.className = 'sgs-window-title';
    titleEl.textContent = title;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sgs-icon-btn';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = icon('close', 14);
    header.append(titleEl, closeBtn);

    const body = document.createElement('div');
    body.className = 'sgs-window-body';

    panel.append(header, body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    /** @type {() => void} */
    let unregister = () => {};
    const close = () => {
        const i = _stack.findIndex((s) => s.overlay === overlay);
        if (i > -1) _stack.splice(i, 1);
        unregister();
        overlay.remove();
    };
    const requestClose = onRequestClose ?? close;

    closeBtn.addEventListener('click', requestClose);
    overlay.addEventListener('pointerdown', (e) => {
        // Backdrop only. A pointerdown that started inside the panel and ended on the
        // backdrop (a sloppy drag) must not close the window.
        if (e.target === overlay) requestClose();
    });

    makeDraggable(panel, header);
    _stack.push({ overlay });
    unregister = pushDismissible(requestClose);

    return { overlay, panel, header, body, close };
}

/** How many windows are open. @returns {number} */
export function openWindowCount() { return _stack.length; }
