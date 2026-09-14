/**
 * tooltip.js — one themed tooltip for the whole app.
 *
 * Native `title=` bubbles are the browser's rectangular, un-themed hover box: they ignore
 * the app's tokens, they ignore dark mode, and near the right edge of the screen they open
 * wherever the OS pleases. This module replaces them globally with ZERO call-site changes:
 * on hover, an element's `title` is lifted into `data-tip` (which suppresses the native
 * bubble from then on) and shown in ONE shared, rounded, token-styled element.
 *
 * Everything is event delegation on the document, so dynamically created elements — every
 * control, popup button and table button in this app — are covered without registering
 * anything. Elements can also opt in directly with `data-tip="..."`.
 *
 * ── Placement: BESIDE beats BELOW at an edge ─────────────────────────────────────────────
 * The default is centred under the element. But the control stack sits at the right
 * edge, and a label centred under a button 30px from the edge cannot be centred: clamping
 * shoves it sideways until it no longer points at anything, and a wider label ends up under
 * the NEXT button down.
 *
 * So when centring below would overflow the right edge, the bubble opens to the LEFT of the
 * element instead, vertically centred on it — into the empty half of the screen, reading as
 * coming FROM the thing it names. Below-flips-above handles the same problem vertically.
 *
 * The rule is written as "would this need clamping?" rather than "is this a control?" so it
 * holds for anything placed near an edge, including surfaces that do not exist yet.
 *
 * Call installTooltips() once at boot.
 */

const SHOW_DELAY = 450;

/** @type {HTMLElement|null} */
let _el = null;
/** @type {ReturnType<typeof setTimeout>|undefined} */
let _showTimer;
/** @type {HTMLElement|null} */
let _current = null;

function _ensureEl() {
    if (_el && document.body.contains(_el)) return _el;
    _el = document.createElement('div');
    _el.className = 'sgs-tooltip';
    _el.setAttribute('role', 'tooltip');
    document.body.appendChild(_el);
    return _el;
}

/** @param {HTMLElement} target */
function _show(target) {
    const text = target.dataset.tip;
    if (!text) return;
    const el = _ensureEl();
    el.textContent = text;
    el.classList.add('sgs-tooltip--visible');
    const r = target.getBoundingClientRect();
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const MARGIN = 6;
    const GAP = 8;

    // Centred below, if that fits without being shoved sideways.
    const wantX = r.left + r.width / 2 - tw / 2;
    const overflowsRight = wantX + tw > window.innerWidth - MARGIN;
    const overflowsLeft = wantX < MARGIN;

    let x;
    let y;
    if (overflowsRight && !overflowsLeft) {
        // Beside, on the left: the empty half of the screen at a right-hand edge.
        el.dataset.side = 'left';
        x = r.left - GAP - tw;
        y = r.top + r.height / 2 - th / 2;
    } else {
        el.dataset.side = 'below';
        x = Math.max(MARGIN, Math.min(wantX, window.innerWidth - tw - MARGIN));
        y = r.bottom + GAP;
        if (y + th > window.innerHeight - MARGIN) y = r.top - th - GAP;
    }
    // Whichever branch ran, the bubble stays on screen.
    x = Math.max(MARGIN, Math.min(x, window.innerWidth - tw - MARGIN));
    y = Math.max(MARGIN, Math.min(y, window.innerHeight - th - MARGIN));

    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
}

function _hide() {
    clearTimeout(_showTimer);
    _current = null;
    _el?.classList.remove('sgs-tooltip--visible');
}

/**
 * Install the delegated handlers. Call once at boot.
 * @param {Document} [root]
 * @returns {void}
 */
export function installTooltips(root = document) {
    root.addEventListener('mouseover', (e) => {
        const t = /** @type {HTMLElement|null} */ (
            /** @type {HTMLElement} */ (e.target).closest?.('[title], [data-tip]')
        );
        if (!t) return;
        // Lift title into data-tip: the native bubble never shows again for this element,
        // and a re-assigned title (btn.title = '...') re-lifts on the next hover.
        if (t.hasAttribute('title')) {
            const title = t.getAttribute('title');
            if (title) t.dataset.tip = title;
            t.removeAttribute('title');
        }
        if (!t.dataset.tip || t === _current) return;
        _current = t;
        clearTimeout(_showTimer);
        _showTimer = setTimeout(() => { if (_current === t) _show(t); }, SHOW_DELAY);
    });
    root.addEventListener('mouseout', (e) => {
        const rel = /** @type {Node|null} */ (/** @type {MouseEvent} */ (e).relatedTarget);
        if (_current && (!rel || !_current.contains(rel))) _hide();
    });
    // Any press or scroll means the reader moved on.
    root.addEventListener('mousedown', _hide, true);
    window.addEventListener('scroll', _hide, true);
}
