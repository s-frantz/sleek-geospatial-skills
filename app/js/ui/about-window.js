/**
 * about-window.js — the LARGE window, as a layout rather than as content.
 *
 * Almost every map app grows one of these: a welcome pane, a tour, an about box, a report, a
 * first-run explainer. They differ completely in what they say and hardly at all in how they
 * are shaped, so what is worth having ready is the shape.
 *
 * The slots, and what each is for:
 *   HEAD   supplied by the overlay shell: title, drag handle, close.
 *   RAIL   supplied by the shell when the window is given PAGES: the list down the left.
 *   LEDE   one wide paragraph. The page's reason for existing, in a sentence or two.
 *   COLS   a two-column band that collapses to one on a narrow viewport. This is where most
 *          of the content goes, and the collapse is why it is a grid rather than a flex row.
 *   ASIDE  a bordered block for the secondary thing: a tip, a caveat, a link out.
 *   FOOT   actions, right-aligned, primary last. Last, not first, because the eye lands on
 *          the right end of a row of buttons.
 *
 * ── Why the demo window has three pages ──────────────────────────────────────────────────
 * Not because it has three things to say. Because a window built as a single body teaches
 * that a window holds one thing, and the next person who needs two builds a second window,
 * then a third, and the app grows a family of modals that each know how to close themselves
 * slightly differently. One window with a rail is the shape to learn, so the demo shows the
 * shape even though its content is placeholder. Delete pages you do not need; a window given
 * no pages has no rail and costs nothing.
 *
 * The text below is placeholder and says so. Replace it; keep the slots.
 */

import { createOverlayWindow } from './overlay-window.js';

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor '
    + 'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud '
    + 'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

/**
 * LEDE, COLS and ASIDE, built into whichever pane asked for them. Every page here is the same
 * arrangement with different words, which is the point: the slots are the reusable part.
 * @param {HTMLElement} pane
 * @param {string} lede
 * @param {[string, string]} headings
 * @param {string} aside
 * @returns {void}
 */
function buildPage(pane, lede, headings, aside) {
    const p0 = document.createElement('p');
    p0.className = 'sgs-lede';
    p0.textContent = lede;

    const cols = document.createElement('div');
    cols.className = 'sgs-cols';
    for (const heading of headings) {
        const col = document.createElement('section');
        const h = document.createElement('h3');
        h.textContent = heading;
        const p = document.createElement('p');
        p.textContent = LOREM;
        col.append(h, p);
        cols.appendChild(col);
    }

    const asideEl = document.createElement('div');
    asideEl.className = 'sgs-aside';
    asideEl.textContent = aside;

    pane.append(p0, cols, asideEl);
}

/** @returns {void} */
export function openAboutWindow() {
    const { body, close } = createOverlayWindow({
        title: 'A large window',
        windowClass: 'sgs-window--wide',
        pages: [
            {
                id: 'overview',
                label: 'Overview',
                render: (pane) => buildPage(
                    pane,
                    'Placeholder. This window exists to demonstrate the layout, not to say '
                        + 'anything. The rail on the left and the slots below are the parts '
                        + 'worth keeping.',
                    ['First column', 'Second column'],
                    'An aside: the secondary block, for a caveat or a link out. Bordered so it '
                        + 'reads as a different kind of thing, not merely as another paragraph.',
                ),
            },
            {
                id: 'slots',
                label: 'The slots',
                render: (pane) => buildPage(
                    pane,
                    'A second page, built the first time it is opened and kept afterwards, so '
                        + 'scroll position and anything half-filled survive a trip to another '
                        + 'page and back.',
                    ['Head and rail', 'Lede, columns, aside'],
                    'Each page owns its own body. The head, the rail and the footer belong to '
                        + 'the window, so they do not have to be rebuilt per page.',
                ),
            },
            {
                id: 'notes',
                label: 'Notes',
                render: (pane) => buildPage(
                    pane,
                    'A third page, to show that the rail grows down rather than eliding the way '
                        + 'a row of tabs would once there are more than about five.',
                    ['Why a list', 'Why not tabs'],
                    'Delete the pages you do not need. A window created without any has no rail '
                        + 'and is exactly the window this one used to be.',
                ),
            },
        ],
    });

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

    // The footer belongs to the WINDOW, not to a page: its actions are the window's actions,
    // and repeating them per page would mean three Close buttons that had better agree.
    body.appendChild(foot);
}
