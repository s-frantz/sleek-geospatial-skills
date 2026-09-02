/**
 * icon-ink.mjs — measure what an icon actually DRAWS, and fail when it is wrong.
 *
 * The problem this exists to solve: you cannot tell whether an icon is centred by looking at
 * it, and you cannot work it out from the path data either, because what matters is the ink
 * after stroking, scaling and rounding. So measure the pixels.
 *
 * How it works, per button:
 *   1. screenshot the button at 2x, so half-pixel offsets are visible;
 *   2. take the button's face colour as the modal opaque colour in that screenshot, so the
 *      measurement does not care what the theme is;
 *   3. every pixel far enough from the face is INK; the bounding box of the ink is the glyph;
 *   4. compare the ink's size against its target, and the ink's CENTRE against the BUTTON's
 *      centre.
 *
 * The two numbers to read:
 *   ink w x h   the glyph's real bounding box, in CSS pixels. Long axis should match `want`.
 *   dx, dy      ink centre minus BUTTON centre. Negative dy means the glyph sits high.
 *
 * SIZE and CENTRING are separate problems with separate fixes: SIZE_FACTOR and NUDGE in
 * app/js/icons.js. Fix one at a time and re-measure. Do not adjust either because a
 * screenshot looked better afterwards. See the `ui-icons` skill.
 *
 * Exits non-zero when any of our own controls is out of tolerance, so it works in a chain.
 * MapLibre's built-in zoom buttons are measured too, but only reported: their artwork is not
 * ours to correct, and it is useful to see what the neighbours weigh.
 */

import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TARGETS = JSON.parse(
    await readFile(new URL('./icon-targets.json', import.meta.url), 'utf8'),
);

const PORT = Number(process.env.PORT || 4319);
const URL_ = process.env.SGS_URL || `http://localhost:${PORT}/`;
const SCALE = 2;
/** How far from the face colour a pixel must be to count as ink, 0..255 per channel. */
const INK_THRESHOLD = 40;
/** Border and corner radius live within this many CSS pixels of the edge; glyphs do not. */
const INSET_CSS = 2;

/**
 * Find the drawn ink inside one button's screenshot.
 *
 * Two things make this less obvious than it sounds, and both have already produced a wrong
 * answer here:
 *
 *   TRANSPARENCY. A button at the end of a control group has rounded corners, so its corner
 *   pixels are transparent, not the button colour. Sampling the corners for the face colour
 *   therefore yields black, every opaque pixel then looks like ink, and the measurement comes
 *   back as "the glyph is exactly the size of the button". So transparent pixels are excluded
 *   outright, and the face is the MODAL opaque colour, which is the button's fill by a wide
 *   margin in any icon button.
 *
 *   THE FRAME. A control group has a 1px border and a corner radius, and both are drawn in
 *   the button's own screenshot. Left in, the rounded top corner alone dragged a plus's
 *   measured box up by 3px and made it 5px taller than it is. The inset is expressed in CSS
 *   pixels because that is what the frame is specified in: 2px clears the border and the
 *   antialiased corner, and no glyph here comes within 2px of its button's edge.
 *
 * @param {PNG} png
 * @returns {{w: number, h: number, cx: number, cy: number, top: number, right: number, bottom: number, left: number}|null}
 */
function inkBox(png) {
    const { width, height, data } = png;
    const idx = (/** @type {number} */ x, /** @type {number} */ y) => (y * width + x) * 4;

    // Modal opaque colour, on a coarse 8-level grid so antialiasing does not split the face
    // across several near-identical buckets.
    /** @type {Map<number, number>} */
    const counts = new Map();
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = idx(x, y);
            if (data[i + 3] < 250) continue;
            const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }
    let bestKey = -1, bestN = 0;
    for (const [k, n] of counts) if (n > bestN) { bestN = n; bestKey = k; }
    if (bestKey < 0) return null;
    const face = [((bestKey >> 10) & 31) << 3, ((bestKey >> 5) & 31) << 3, (bestKey & 31) << 3];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const inset = INSET_CSS * SCALE;
    for (let y = inset; y < height - inset; y++) {
        for (let x = inset; x < width - inset; x++) {
            const i = idx(x, y);
            if (data[i + 3] < 250) continue;
            const d = Math.max(
                Math.abs(data[i] - face[0]),
                Math.abs(data[i + 1] - face[1]),
                Math.abs(data[i + 2] - face[2]),
            );
            if (d < INK_THRESHOLD) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    if (!Number.isFinite(minX)) return null;

    return {
        w: (maxX - minX + 1) / SCALE,
        h: (maxY - minY + 1) / SCALE,
        cx: (minX + maxX + 1) / 2 / SCALE,
        cy: (minY + maxY + 1) / 2 / SCALE,
        left: minX / SCALE,
        top: minY / SCALE,
        right: (width - 1 - maxX) / SCALE,
        bottom: (height - 1 - maxY) / SCALE,
    };
}

/** @param {number} n @param {number} [w] @returns {string} */
const f = (n, w = 6) => n.toFixed(2).padStart(w);

async function main() {
    // Start the app unless something is already serving it.
    /** @type {import('node:child_process').ChildProcess|null} */
    let server = null;
    if (!process.env.SGS_URL) {
        server = spawn(process.execPath, [fileURLToPath(new URL('./serve.mjs', import.meta.url))], {
            env: { ...process.env, PORT: String(PORT) },
            stdio: 'ignore',
        });
        await new Promise((r) => setTimeout(r, 400));
    }

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: SCALE });
    await page.goto(URL_, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="true"]', { timeout: 20_000 });
    // Let the control stack settle before screenshotting it.
    await page.waitForTimeout(300);

    // The control stack, plus the panel's berth. Both are on screen from first paint, which
    // is the requirement: a glyph that needs three clicks to reach cannot be in a check that
    // runs on every change.
    const handles = await page.locator(
        '.maplibregl-ctrl-top-right button, #sgs-panel-berth button',
    ).all();

    console.log('');
    console.log('  glyph            ink w x h     want     dx      dy    headroom T/R/B/L');
    console.log('  ' + '-'.repeat(74));

    let failures = 0;
    for (const h of handles) {
        const box = await h.boundingBox();
        if (!box) continue;
        // Ours is decided by whether the button holds one of OUR glyphs, not by a class:
        // the same measurement applies wherever an icon from icons.js is used.
        const meta = await h.evaluate((el) => {
            const svg = el.querySelector('svg[data-glyph]');
            return svg
                ? { name: svg.getAttribute('data-glyph'), ink: Number(svg.getAttribute('data-ink')) }
                : { name: el.getAttribute('aria-label') || 'unnamed', ink: null };
        });
        const ours = meta.ink !== null;
        const name = meta.name || 'unnamed';

        const png = PNG.sync.read(await h.screenshot());
        const ink = inkBox(png);
        if (!ink) {
            console.log(`  ${name.padEnd(16)} no ink found`);
            if (ours) failures++;
            continue;
        }

        // The target is what the CALLER asked for, recorded on the element. The overrides
        // file exists for the rare glyph that should genuinely read a different size from its
        // neighbours, and for the buttons that are not ours.
        const want = TARGETS.want[name] ?? meta.ink ?? TARGETS.defaultWant;

        // Correct for where the BUTTON sits, before asking where the ink sits inside it.
        //
        // The screenshot is cropped on whole device pixels, FLOORED (measured, not assumed:
        // rounding to nearest moved the pin's reported offset the wrong way, from 1.00 to
        // 1.14, and flooring put it at the 0.14 that matches the button's own fraction). A
        // button whose CSS box starts at x=181.86 is captured from x=181, so everything
        // inside it sits 0.86px later in the crop than its box centre would suggest.
        // The panel is `width: max-content`, which means its width comes from text metrics
        // and is fractional almost always: renaming a demo layer moved this button by 0.86px
        // and reported the pin glyph as 1px off centre, art that had not been touched.
        //
        // What this tool is for is the glyph's centring INSIDE its button, which is a fact
        // about the art. Where the button landed is a fact about the layout, and charging it
        // to the glyph would put a compensation for one label's width into the icon table.
        // Subtracting the crop offset separates the two. It also means genuine half-pixel
        // chrome renders soft and goes unreported here; that is a layout check, not this one.
        const cropDx = box.x - Math.floor(box.x);
        const cropDy = box.y - Math.floor(box.y);
        const dx = ink.cx - (box.width / 2 + cropDx);
        const dy = ink.cy - (box.height / 2 + cropDy);
        const long = Math.max(ink.w, ink.h);

        const sizeBad = ours && Math.abs(long - want) > TARGETS.sizeTolerance;
        const centreBad = ours && (Math.abs(dx) > TARGETS.centreTolerance || Math.abs(dy) > TARGETS.centreTolerance);
        if (sizeBad || centreBad) failures++;

        const flag = !ours ? '  (not ours)' : sizeBad || centreBad ? '  <-- OFF' : '';
        console.log(
            `  ${name.padEnd(16)}${f(ink.w)} x${f(ink.h)}  ${ours ? f(want, 5) : '    -'}  ${f(dx)}  ${f(dy)}`
            + `   ${f(ink.top, 5)} ${f(ink.right, 5)} ${f(ink.bottom, 5)} ${f(ink.left, 5)}${flag}`,
        );
    }

    console.log('');
    console.log(`  size tolerance ${TARGETS.sizeTolerance}px on the long axis,`
        + ` centre tolerance ${TARGETS.centreTolerance}px on each axis`);
    console.log(failures ? `  ${failures} glyph(s) out of tolerance` : '  all measured glyphs within tolerance');
    console.log('');

    await browser.close();
    server?.kill();
    process.exit(failures ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
