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
 *
 * ── Pages ────────────────────────────────────────────────────────────────────────────────
 * A window that holds one thing and a window that holds several are the same window, and an
 * app that does not know the second kind exists builds the second kind as three windows. So
 * the shell takes an optional list of PAGES and grows a rail down the left, and the reader
 * learns from the shape of one window that any of them can hold more.
 *
 * The rail is VERTICAL and it is a list, not a tab strip. Horizontal tabs run out of room at
 * about five and then start eliding, which teaches the opposite lesson: that this window holds
 * a few things. A column of labels grows to a dozen without changing shape or telling anyone
 * anything untrue.
 *
 * Pages are built on first visit and then KEPT. Rebuilding on every switch is one line shorter
 * and throws away scroll position, a half-filled form, and an expanded section every time the
 * reader looks at something else and comes back. What a page is doing is part of what the
 * window is, until the window closes.
 *
 * Without `pages` the shell behaves exactly as it did: `body` is the whole body and there is
 * no rail. A window with one page should not pay for a rail listing one thing.
 */

import { iconButton } from './buttons.js';
import { makeDraggable } from '../utils/draggable.js';
import { pushDismissible } from './dismiss-stack.js';

/** @type {Array<{overlay: HTMLElement}>} */
const _stack = [];

/**
/**
 * @typedef {object} WindowPage
 * @property {string} id
 * @property {string} label what the rail shows
 * @property {(pane: HTMLElement) => void} render called once, the first time the page is shown
 */

/**
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.windowClass] extra classes for the panel, for size variants
 * @param {WindowPage[]} [opts.pages] when given, the window grows a rail and `body` is the pane
 * @param {(() => void)|null} [opts.onRequestClose] when given, the CALLER removes the window
 * @returns {{overlay: HTMLElement, panel: HTMLElement, header: HTMLElement, body: HTMLElement, close: () => void, showPage: (id: string) => void}}
 */
export function createOverlayWindow({ title = '', windowClass = '', pages = [], onRequestClose = null } = {}) {
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
    const closeBtn = iconButton({ glyph: 'close', size: 14, label: 'Close' });
    header.append(titleEl, closeBtn);

    const body = document.createElement('div');
    body.className = 'sgs-window-body';

    /** @type {(id: string) => void} */
    let showPage = () => {};

    if (pages.length) {
        const split = document.createElement('div');
        split.className = 'sgs-window-split';

        const rail = document.createElement('div');
        rail.className = 'sgs-window-rail';
        // A tablist, so a screen reader is told this is one region with several views rather
        // than a list of links that happen to change the page under them.
        rail.setAttribute('role', 'tablist');
        rail.setAttribute('aria-orientation', 'vertical');

        /** @type {Map<string, {btn: HTMLButtonElement, pane: HTMLElement, built: boolean, page: WindowPage}>} */
        const built = new Map();

        showPage = (id) => {
            const target = built.get(id);
            if (!target) return;
            for (const [key, entry] of built) {
                const on = key === id;
                entry.btn.setAttribute('aria-selected', String(on));
                // Only the selected tab is in the tab order: arrow keys move within a
                // tablist, Tab leaves it. Every tab being tabbable is the common mistake and
                // it turns one control into as many stops as there are pages.
                entry.btn.tabIndex = on ? 0 : -1;
                entry.pane.hidden = !on;
            }
            if (!target.built) {
                target.built = true;
                target.page.render(target.pane);
            }
        };

        for (const page of pages) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sgs-window-tab';
            btn.id = `sgs-tab-${page.id}`;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-controls', `sgs-pane-${page.id}`);
            btn.textContent = page.label;
            btn.addEventListener('click', () => showPage(page.id));
            rail.appendChild(btn);

            const pane = document.createElement('div');
            pane.className = 'sgs-window-pane';
            pane.id = `sgs-pane-${page.id}`;
            pane.setAttribute('role', 'tabpanel');
            pane.setAttribute('aria-labelledby', btn.id);
            pane.hidden = true;
            body.appendChild(pane);

            built.set(page.id, { btn, pane, built: false, page });
        }

        rail.addEventListener('keydown', (e) => {
            const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            const ids = [...built.keys()];
            const at = ids.findIndex((id) => built.get(id)?.btn.getAttribute('aria-selected') === 'true');
            const next = ids[(at + step + ids.length) % ids.length];
            showPage(next);
            built.get(next)?.btn.focus();
        });

        split.append(rail, body);
        panel.append(header, split);
        showPage(pages[0].id);
    } else {
        panel.append(header, body);
    }

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

    return { overlay, panel, header, body, close, showPage };
}

/** How many windows are open. @returns {number} */
export function openWindowCount() { return _stack.length; }
