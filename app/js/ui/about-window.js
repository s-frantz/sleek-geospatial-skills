/**
 * about-window.js — the LARGE window, as a layout rather than as content.
 *
 * Almost every map app grows one of these: a welcome pane, a tour, an about box, a report, a
 * first-run explainer. They differ completely in what they say and hardly at all in how they
 * are shaped, so what is worth having ready is the shape.
 *
 * The slots, and what each is for:
 *   HEAD   supplied by the overlay shell: title, drag handle, close.
 *   LEDE   one wide paragraph. The window's reason for existing, in a sentence or two.
 *   COLS   a two-column band that collapses to one on a narrow viewport. This is where most
 *          of the content goes, and the collapse is why it is a grid rather than a flex row.
 *   ASIDE  a bordered block for the secondary thing: a tip, a caveat, a link out.
 *   FOOT   actions, right-aligned, primary last. Last, not first, because the eye lands on
 *          the right end of a row of buttons.
 *
 * The text below is placeholder and says so. Replace it; keep the slots.
 */

import { createOverlayWindow } from './overlay-window.js';

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor '
    + 'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud '
    + 'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

/** @returns {void} */
export function openAboutWindow() {
    const { body, close } = createOverlayWindow({
        title: 'A large window',
        windowClass: 'sgs-window--wide',
    });

    const lede = document.createElement('p');
    lede.className = 'sgs-lede';
    lede.textContent = 'Placeholder. This window exists to demonstrate the layout, not to say '
        + 'anything. The slots below are the parts worth keeping.';

    const cols = document.createElement('div');
    cols.className = 'sgs-cols';
    for (const heading of ['First column', 'Second column']) {
        const col = document.createElement('section');
        const h = document.createElement('h3');
        h.textContent = heading;
        const p = document.createElement('p');
        p.textContent = LOREM;
        col.append(h, p);
        cols.appendChild(col);
    }

    const aside = document.createElement('div');
    aside.className = 'sgs-aside';
    aside.textContent = 'An aside: the secondary block, for a caveat or a link out. Bordered so '
        + 'it reads as a different kind of thing, not merely as another paragraph.';

    const foot = document.createElement('div');
    foot.className = 'sgs-window-foot';
    const secondary = document.createElement('button');
    secondary.type = 'button';
    secondary.className = 'sgs-btn';
    secondary.textContent = 'Secondary';
    const primary = document.createElement('button');
    primary.type = 'button';
    primary.className = 'sgs-btn sgs-btn--primary';
    primary.textContent = 'Close';
    primary.addEventListener('click', close);
    secondary.addEventListener('click', close);
    foot.append(secondary, primary);

    body.append(lede, cols, aside, foot);
}
