/**
 * Rung 3: geometry, measured in a real browser.
 *
 * Every assertion here is a NUMBER read off `getBoundingClientRect`, not an image. When one
 * of these fails it tells you which edge is on the wrong side of which other edge, which is
 * a diagnosis. A screenshot diff would tell you that 12,431 pixels changed, which is not.
 *
 * ── Select by aria-label, never by title ─────────────────────────────────────────────────
 * tooltip.js LIFTS an element's `title` into `data-tip` the first time it is hovered, so the
 * attribute is gone by the second interaction. A `[title^="Show"]` selector therefore passes
 * once and then hangs, which cost a debugging round here. `aria-label` is never rewritten,
 * and it is the accessible name — the thing a test should be asserting against anyway.
 */

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // A clean slate: postures and popup placement are viewer preferences, and a test that
    // inherits the previous test's preferences is not a test.
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('body[data-ready="true"]');
});

test('at boot: panel docked left, no table, the mark parked at the bottom edge', async ({ page }) => {
    const panel = await page.locator('#sgs-panel').boundingBox();
    const vp = page.viewportSize();
    if (!panel || !vp) throw new Error('missing furniture');

    expect(panel.x).toBeLessThan(24);
    expect(panel.y).toBeLessThan(24);
    // Docked and automatic: the panel reaches the bottom inset.
    expect(panel.y + panel.height).toBeGreaterThan(vp.height - 24);

    // The table does not exist until a table is asked for; its whole closed-state footprint
    // is the mark tab, centred on the bottom edge.
    await expect(page.locator('#sgs-table')).toHaveCount(0);
    const mark = await page.locator('#sgs-table-mark').boundingBox();
    if (!mark) throw new Error('no mark');
    expect(mark.y + mark.height).toBeGreaterThan(vp.height - 2);
    expect(Math.abs(mark.x + mark.width / 2 - vp.width / 2)).toBeLessThan(4);
});

test('the layer rows drive the map layers', async ({ page }) => {
    const visible = () => page.evaluate(() =>
        window.sgsMap.getLayoutProperty('neighborhoods-fill', 'visibility'));

    expect(await visible()).toBe('visible');
    await page.locator('.sgs-row[data-layer="neighborhoods"] input[type=checkbox]').uncheck();
    expect(await visible()).toBe('none');
});

/**
 * Step a section's chevron until it shows its head alone. The chevron has three steps
 * (natural, tight, head) and skips tight when it would change nothing, so how many presses
 * that takes depends on the data, which is exactly what a test should not hardcode.
 * @param {import('@playwright/test').Page} page
 * @param {string} chevron
 */
async function foldToHead(page, chevron) {
    for (let i = 0; i < 3; i++) {
        if ((await page.locator(chevron).getAttribute('aria-expanded')) === 'false') return;
        await page.locator(chevron).click();
    }
    await expect(page.locator(chevron)).toHaveAttribute('aria-expanded', 'false');
}

/** The rendered height of one element. @param {import('@playwright/test').Page} page @param {string} sel */
async function heightOf(page, sel) {
    return (await page.locator(sel).boundingBox())?.height ?? 0;
}

test('the open table spans the bottom and displaces the panel; folded it keeps reporting; closed it leaves the mark', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');

    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();

    // Open: a full-width band at the foot.
    const table = await page.locator('#sgs-table').boundingBox();
    if (!table) throw new Error('no table');
    expect(table.width).toBeGreaterThan(vp.width * 0.9);
    expect(table.height).toBeGreaterThan(150);
    expect(table.y + table.height).toBeGreaterThan(vp.height - 24);
    await expect(page.locator('.sgs-table-title')).toHaveText('Stations');
    // The count is asserted against the table it is counting, never against a literal. A
    // literal here is a test of the demo data, and it fails the day the demo data changes for
    // reasons that have nothing to do with the table.
    const rows = await page.locator('.sgs-table-body tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    await expect(page.locator('.sgs-table-count')).toHaveText(`${rows} rows`);

    // Displacement: the panel's bottom sits ABOVE the table, not underneath it.
    const panel = await page.locator('#sgs-panel').boundingBox();
    if (!panel) throw new Error('no panel');
    expect(panel.y + panel.height).toBeLessThan(table.y);

    // Folded: the head alone, still full width, still reporting.
    await foldToHead(page, '.sgs-table-fold');
    const folded = await page.locator('#sgs-table').boundingBox();
    expect(folded?.height).toBeLessThan(60);
    expect(folded?.width).toBeGreaterThan(vp.width * 0.9);
    await expect(page.locator('.sgs-table-count')).toHaveText(`${rows} rows`);
    // And the panel takes the space back.
    const panelAfterFold = await page.locator('#sgs-panel').boundingBox();
    expect((panelAfterFold?.y ?? 0) + (panelAfterFold?.height ?? 0))
        .toBeGreaterThan(panel.y + panel.height + 100);

    // Closed: the table leaves entirely and the mark returns.
    await page.locator('#sgs-table button[aria-label^="Close"]').click();
    await expect(page.locator('#sgs-table')).toHaveCount(0);
    await expect(page.locator('#sgs-table-mark')).toBeVisible();

    // The mark reopens what last held the table. Scoped to the live table: the one that just
    // closed may still be shrinking into the mark, id-less but with its title in it.
    await page.locator('#sgs-table-mark').click();
    await expect(page.locator('#sgs-table .sgs-table-title')).toHaveText('Stations');
});

test('the panel undocks, and docks again', async ({ page }) => {
    const dockBtn = page.locator('.sgs-panel-dock');
    const docked = await page.locator('#sgs-panel').boundingBox();

    await dockBtn.click();
    await expect(page.locator('#sgs-panel')).toHaveClass(/sgs-panel--undocked/);
    const undocked = await page.locator('#sgs-panel').boundingBox();
    // Undocked, it hugs its content, so it no longer reaches the bottom of the window.
    expect(undocked?.height).toBeLessThan((docked?.height ?? 0) - 40);

    await dockBtn.click();
    await expect(page.locator('#sgs-panel')).not.toHaveClass(/sgs-panel--undocked/);
});

test('resizing an undocked panel resizes it in place instead of docking it', async ({ page }) => {
    await page.locator('.sgs-panel-dock').click();
    await expect(page.locator('#sgs-panel')).toHaveClass(/sgs-panel--undocked/);

    const before = await page.locator('#sgs-panel').boundingBox();
    if (!before) throw new Error('no panel');

    // Drag the right-edge grip 80px right.
    const grip = await page.locator('.sgs-grip--w').boundingBox();
    if (!grip) throw new Error('no grip');
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 80, grip.y + grip.height / 2, { steps: 4 });
    await page.mouse.up();

    const after = await page.locator('#sgs-panel').boundingBox();
    if (!after) throw new Error('no panel');
    // Still undocked, still where it was, only wider. The failure mode this guards is the
    // grip silently switching the posture and snapping the panel back to the left edge.
    await expect(page.locator('#sgs-panel')).toHaveClass(/sgs-panel--undocked/);
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    expect(after.width).toBeGreaterThan(before.width + 60);
});

test('zoom to lands the layer clear of the panel and the table', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Zoom"]').click();
    await page.waitForTimeout(900);

    const panel = await page.locator('#sgs-panel').boundingBox();
    const table = await page.locator('#sgs-table').boundingBox();
    if (!panel || !table) throw new Error('missing furniture');

    // Project the layer's own bounding box back to the screen and check it landed in the
    // part of the window a person can actually see.
    const corners = await page.evaluate(async () => {
        const fc = await (await fetch('data/neighborhoods.geojson')).json();
        let minX = 180, minY = 90, maxX = -180, maxY = -90;
        for (const f of fc.features) {
            for (const ring of f.geometry.coordinates) {
                for (const [x, y] of ring) {
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                }
            }
        }
        const a = window.sgsMap.project([minX, maxY]);
        const b = window.sgsMap.project([maxX, minY]);
        return { left: a.x, top: a.y, right: b.x, bottom: b.y };
    });

    expect(corners.left).toBeGreaterThan(panel.x + panel.width);
    expect(corners.bottom).toBeLessThan(table.y);
});

test('occlusion follows the panel geometry, not whether it is docked', async ({ page }) => {
    const readPad = () => page.evaluate(async () => {
        const src = '/js/utils/visible-area.js';
        const m = await import(src);
        return m.visiblePadding().left;
    });

    const padWhileDocked = await readPad();
    expect(padWhileDocked).toBeGreaterThan(48);

    // Undock: the panel parks away from the left edge (its default home is x=60), so the
    // left band is released.
    await page.locator('.sgs-panel-dock').click();
    expect(await readPad()).toBe(48);

    // Now drag it back against the left edge. Occlusion is a question about WHERE
    // THE PANEL IS: an undocked panel hugging the edge covers exactly as much map as a docked one,
    // so the band comes back; docked or not never entered into it.
    const head = await page.locator('.sgs-panel-head').boundingBox();
    if (!head) throw new Error('no head');
    await page.mouse.move(head.x + head.width / 2, head.y + head.height / 2);
    await page.mouse.down();
    await page.mouse.move(12 + head.width / 2, head.y + head.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await readPad()).toBeGreaterThan(48);
});

test('quick settings opens to the LEFT of the gear, top-aligned with it', async ({ page }) => {
    await page.locator('[data-glyph="gear"]').first().click();
    const panel = await page.locator('.sgs-quick').boundingBox();
    const gear = await page.locator('[data-glyph="gear"]').first().boundingBox();
    if (!panel || !gear) throw new Error('missing');
    // Beside the control stack, never under it: the stack below the gear stays reachable.
    expect(panel.x + panel.width).toBeLessThanOrEqual(gear.x);
    expect(Math.abs(panel.y - gear.y)).toBeLessThan(6);
});

test('tooltips use the shared themed bubble and stay on screen at the right edge', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('[data-glyph="gear"]').first().hover();
    await expect(page.locator('.sgs-tooltip--visible')).toBeVisible();
    const tip = await page.locator('.sgs-tooltip').boundingBox();
    if (!tip) throw new Error('no tooltip');
    // Clamped: hovering the right-edge control stack must not push the bubble off screen.
    expect(tip.x + tip.width).toBeLessThanOrEqual(vp.width - 4);
    // And the native title has been lifted, so only ONE bubble can exist.
    expect(await page.locator('[data-glyph="gear"]').first().evaluate(
        (el) => /** @type {HTMLElement} */ (el.closest('button')).hasAttribute('title'),
    )).toBe(false);
});

test('the control stack carries zoom, compass, geolocate; the bottom right carries scale and attribution', async ({ page }) => {
    await expect(page.locator('.maplibregl-ctrl-top-right .maplibregl-ctrl-zoom-in')).toBeVisible();
    await expect(page.locator('.maplibregl-ctrl-top-right .maplibregl-ctrl-compass')).toBeVisible();
    await expect(page.locator('.maplibregl-ctrl-top-right .maplibregl-ctrl-geolocate')).toBeVisible();
    await expect(page.locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-scale')).toBeVisible();
    await expect(page.locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib')).toBeVisible();
});

test('the 1 and 2 keys zoom without the canvas needing focus', async ({ page }) => {
    const z0 = await page.evaluate(() => window.sgsMap.getZoom());
    await page.keyboard.press('2');
    await page.waitForTimeout(600);
    const z1 = await page.evaluate(() => window.sgsMap.getZoom());
    expect(z1).toBeGreaterThan(z0 + 0.5);
    await page.keyboard.press('1');
    await page.waitForTimeout(600);
    const z2 = await page.evaluate(() => window.sgsMap.getZoom());
    expect(z2).toBeLessThan(z1 - 0.5);
});

test('the table button toggles: open, then close', async ({ page }) => {
    const btn = page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]');
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await btn.click();
    await expect(page.locator('#sgs-table')).toHaveCount(1);

    // Pressing the same button again is the obvious way to put the table away.
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await btn.click();
    await expect(page.locator('#sgs-table')).toHaveCount(0);
    await expect(page.locator('#sgs-table-mark')).toBeVisible();
});

test('the head buttons of the panel and the table are spaced by one rule', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-table')).toHaveCount(1);

    /** The gaps between neighbouring icon buttons in one head, left to right. @param {string} head */
    const gaps = (head) => page.locator(`${head} .sgs-icon-btn`).evaluateAll((els) => {
        const rects = els.map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0)
            .sort((a, b) => a.left - b.left);
        return rects.slice(1).map((r, i) => Math.round((r.left - rects[i].right) * 10) / 10);
    });

    const panel = await gaps('.sgs-panel-head');
    const table = await gaps('.sgs-table-head');
    // Dock, fold, close on the panel (FULL is the table's alone), and FULL besides on the table.
    expect(panel.length).toBeGreaterThanOrEqual(2);
    expect(table.length).toBeGreaterThanOrEqual(3);
    // Every gap the same, in both heads.
    expect(new Set([...panel, ...table]).size).toBe(1);
});

test('a second layer switches the table rather than closing it', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await expect(page.locator('.sgs-table-title')).toHaveText('Stations');

    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-table')).toHaveCount(1);
    await expect(page.locator('.sgs-table-title')).toHaveText('Neighborhoods');
});

test('the panel folds to its head and closes to a left-edge mark', async ({ page }) => {
    const open = await page.locator('#sgs-panel').boundingBox();
    if (!open) throw new Error('no panel');

    // FOLD: the head stays in its slot, the body collapses.
    await foldToHead(page, '.sgs-panel-fold');
    const folded = await page.locator('#sgs-panel').boundingBox();
    expect(folded?.height).toBeLessThan(60);
    expect(await page.locator('.sgs-panel-title').isVisible()).toBe(true);
    await expect(page.locator('#sgs-panel-body')).toBeHidden();

    await page.locator('.sgs-panel-fold').click();
    const unfolded = await page.locator('#sgs-panel').boundingBox();
    expect(unfolded?.height).toBeCloseTo(open.height, -1);

    // CLOSE: the section leaves the layout and its mark appears on the left edge.
    await page.locator('.sgs-panel-close').click();
    await expect(page.locator('#sgs-panel')).toBeHidden();
    const mark = await page.locator('#sgs-panel-mark').boundingBox();
    if (!mark) throw new Error('no panel mark');
    expect(mark.x).toBeLessThan(2);

    // And a closed panel stops occluding the left edge for the camera.
    const pad = await page.evaluate(async () => {
        const src = '/js/utils/visible-area.js';
        const m = await import(src);
        return m.visiblePadding().left;
    });
    expect(pad).toBe(48);

    await page.locator('#sgs-panel-mark').click();
    await expect(page.locator('#sgs-panel')).toBeVisible();
});

test('closing the panel or the table pulses its mark once, briefly', async ({ page }) => {
    const panelMark = page.locator('#sgs-panel-mark');
    const tableMark = page.locator('#sgs-table-mark');
    // Nothing has closed yet, so nothing pulses: the table's mark is on screen from first
    // paint, and a pulse there would announce a close that never happened.
    await expect(tableMark).not.toHaveClass(/sgs-mark--flash/);

    await page.locator('.sgs-panel-close').click();
    await expect(panelMark).toHaveClass(/sgs-mark--flash/);
    // Brief: gone again within a second, with no further input.
    await expect(panelMark).not.toHaveClass(/sgs-mark--flash/, { timeout: 1500 });
    // Opening does not pulse.
    await panelMark.click();
    await expect(panelMark).not.toHaveClass(/sgs-mark--flash/);

    // The table leaves by a different path (it removes itself), and gets the same pulse.
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await page.locator('#sgs-table button[aria-label="Close the table"]').click();
    await expect(tableMark).toHaveClass(/sgs-mark--flash/);
    await expect(tableMark).not.toHaveClass(/sgs-mark--flash/, { timeout: 1500 });
});

test('MapLibre control glyphs are adopted: our svg, no baked background', async ({ page }) => {
    for (const [cls, glyph] of [
        ['maplibregl-ctrl-zoom-in', 'plus'],
        ['maplibregl-ctrl-zoom-out', 'minus'],
        ['maplibregl-ctrl-compass', 'compass'],
        ['maplibregl-ctrl-geolocate', 'locate'],
    ]) {
        const span = page.locator(`.${cls} .maplibregl-ctrl-icon`);
        expect(await span.locator('svg').getAttribute('data-glyph'), cls).toBe(glyph);
        // The baked artwork must be gone, or it renders UNDERNEATH ours and the glyph grows
        // an extra bar. This is the assertion that catches a specificity regression.
        expect(await span.evaluate((el) => getComputedStyle(el).backgroundImage), cls).toBe('none');
    }
});

test('layer rows, popup titles and the table head all carry the swatch and type pill', async ({ page }) => {
    const row = page.locator('.sgs-row[data-layer="neighborhoods"]');
    await expect(row.locator('.sgs-swatch')).toBeVisible();
    await expect(row.locator('.sgs-source-pill')).toHaveText('{GEO}');

    await row.hover();
    await row.locator('button[aria-label^="Show"]').click();
    await expect(page.locator('.sgs-table-swatch .sgs-swatch')).toBeVisible();
    await expect(page.locator('.sgs-table-pill .sgs-source-pill')).toHaveText('{GEO}');
});

test('field type badges appear in popups and in the table header', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();

    // The table's header: one badge per column, typed from the data.
    const heads = page.locator('#sgs-table thead .sgs-field-badge');
    await expect(heads).toHaveCount(5);
    // capacity is an integer, online is a boolean, name is a string.
    await expect(heads.nth(1)).toHaveText('abc');
    await expect(heads.nth(3)).toHaveText('123');
    await expect(heads.nth(4)).toHaveText('T/F');
});

test('every other table row carries a stripe, far fainter than hover', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();

    /** The painted stripe on one row's first data cell. @param {number} n 1-based */
    const stripe = (n) => page.locator(`#sgs-table tbody tr:nth-child(${n}) td`).nth(1)
        .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(await stripe(1)).toBe('none');
    expect(await stripe(2)).toContain('gradient');
    expect(await stripe(3)).toBe('none');

    // Strength, as a number: the stripe's alpha against hover's, both resolved in place.
    const alpha = await page.locator('#sgs-table table').evaluate((table) => {
        const probe = document.createElement('span');
        table.appendChild(probe);
        /** @param {string} v */
        const read = (v) => {
            probe.style.color = v;
            const c = getComputedStyle(probe).color;
            const m = c.match(/\/\s*([\d.]+)\)/) ?? c.match(/rgba\([^)]*,\s*([\d.]+)\)/);
            return m ? Number(m[1]) : 1;
        };
        const out = { stripe: read('var(--sgs-row-stripe)'), hover: read('var(--sgs-hover)') };
        probe.remove();
        return out;
    });
    expect(alpha.stripe).toBeGreaterThan(0);
    expect(alpha.stripe).toBeLessThan(alpha.hover / 2);
});

test('the app boots without a console error', async ({ page }) => {
    // MapLibre reports an invalid layer as an `error` EVENT, logged to the console, and carries
    // on: a flash layer with a bad filter was silently never added while every other test here
    // passed. The console is the one place that failure is visible, so it is asserted on.
    // Errors only (the basemap's own style emits warnings), and not the GPU driver's
    // performance notices, which headless Chrome logs at error level.
    /** @type {string[]} */
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error' && !m.text().includes('GL Driver Message')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
});

test('zooming to a row flashes its feature on the map and makes it the current row', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    const row = page.locator('#sgs-table tbody tr').nth(2);
    const key = await row.getAttribute('data-key');
    if (!key) throw new Error('row has no key');

    // Record every filter the flash layers are given, from inside the page. Sampling the map by
    // animation frame is not evidence: headless Chromium renders here at about 23fps, which
    // leaves a handful of frames to land in each showing, and a sampled test can miss one.
    await page.evaluate(() => {
        const w = /** @type {any} */ (window);
        const m = w.sgsMap;
        /** @type {Array<[string, string, boolean]>} */
        const calls = [];
        w.flashCalls = calls;
        const set = m.setFilter.bind(m);
        m.setFilter = (/** @type {string} */ id, /** @type {unknown} */ f, /** @type {any[]} */ ...rest) => {
            if (id.startsWith('neighborhoods-flash')) calls.push([id, JSON.stringify(f), m.isMoving()]);
            return set(id, f, ...rest);
        };
    });

    await row.locator('.sgs-go-col button').click();
    await expect(row).toHaveClass(/sgs-row-hit/);
    await expect(page.locator('#sgs-table tbody tr.sgs-row-hit')).toHaveCount(1);

    // ONE showing, on both polygon flash layers: the body filled as well as the edge drawn
    // heavy, because an edge alone vanishes once the camera has fitted the polygon to the
    // screen and its edge is the screen's edge. Then matching nothing again.
    await expect.poll(
        () => page.evaluate(() => /** @type {any} */ (window).flashCalls.length), { timeout: 5000 },
    ).toBe(4);
    const calls = await page.evaluate(() => /** @type {any} */ (window).flashCalls);
    const on = `["==",["get","id"],"${key}"]`;
    const off = '["literal",false]';
    for (const id of ['neighborhoods-flash', 'neighborhoods-flash-fill']) {
        const mine = calls.filter((/** @type {any[]} */ c) => c[0] === id);
        expect(mine.map((/** @type {any[]} */ c) => c[1]), id).toEqual([on, off]);
        // Lit on the press, while the camera is still on its way: not held back for its arrival.
        expect(mine[0][2], `${id} lit while moving`).toBe(true);
    }
});

/* ── Regressions ─────────────────────────────────────────────────────────────────────────
   Three geometry bugs that all shipped looking plausible. Each assertion below is the
   number that was wrong. */

test('folding the panel collapses its height without changing its width', async ({ page }) => {
    const open = await page.locator('#sgs-panel').boundingBox();
    if (!open) throw new Error('no panel');

    await foldToHead(page, '.sgs-panel-fold');
    const folded = await page.locator('#sgs-panel').boundingBox();
    if (!folded) throw new Error('no panel');

    // The bug: in the automatic width the panel is `width: max-content`, so collapsing the
    // body shrank it to the width of its own header and folding read as the panel moving.
    expect(folded.height).toBeLessThan(60);
    expect(folded.width).toBeCloseTo(open.width, 0);

    // And unfolding gives the automatic width back, because the FOLD is what set it.
    await page.locator('.sgs-panel-fold').click();
    const back = await page.locator('#sgs-panel').boundingBox();
    expect(back?.width).toBeCloseTo(open.width, 0);
});

test('setting a height keeps a width the reader already set', async ({ page }) => {
    const panel = page.locator('#sgs-panel');
    const start = await panel.boundingBox();
    if (!start) throw new Error('no panel');

    // Widen by the right grip.
    const wGrip = page.locator('.sgs-grip[data-grip="w"]');
    const wBox = await wGrip.boundingBox();
    if (!wBox) throw new Error('no width grip');
    await page.mouse.move(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 340, wBox.y + wBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const widened = await panel.boundingBox();
    if (!widened) throw new Error('no panel');
    expect(widened.width).toBeGreaterThan(start.width + 40);

    // Now shorten by the bottom grip. The bug: posture was one enum, so becoming `manual-h`
    // cleared `--sgs-panel-w` and the width snapped back to automatic.
    const hGrip = page.locator('.sgs-grip[data-grip="h"]');
    const hBox = await hGrip.boundingBox();
    if (!hBox) throw new Error('no height grip');
    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(hBox.x + hBox.width / 2, start.y + 300, { steps: 8 });
    await page.mouse.up();

    const both = await panel.boundingBox();
    if (!both) throw new Error('no panel');
    expect(both.height).toBeLessThan(widened.height - 40);
    expect(both.width).toBeCloseTo(widened.width, 0);

    // Each grip releases its own axis and only its own.
    await hGrip.dblclick();
    const released = await panel.boundingBox();
    expect(released?.width).toBeCloseTo(widened.width, 0);
    expect(released?.height).toBeGreaterThan(both.height + 40);
});

test('dragging the large window by its head moves it by the drag distance', async ({ page }) => {
    await page.locator('[data-glyph="info"]').first().click();
    const win = page.locator('.sgs-window');
    const before = await win.boundingBox();
    if (!before) throw new Error('no window');

    const head = page.locator('.sgs-window-head');
    const hb = await head.boundingBox();
    if (!hb) throw new Error('no window head');

    // The bug: the window is `position: relative`, centred by `place-items: center`, so
    // left/top were an offset from the centred position rather than a viewport coordinate.
    // Writing its own rect into them threw it right and down by its own distance from the
    // corner. A 60px drag moved it several hundred pixels.
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 60, hb.y + hb.height / 2 + 40, { steps: 10 });
    await page.mouse.up();

    const after = await win.boundingBox();
    if (!after) throw new Error('no window');
    expect(after.x - before.x).toBeCloseTo(60, 0);
    expect(after.y - before.y).toBeCloseTo(40, 0);
    expect(after.width).toBeCloseTo(before.width, 0);
});

test('the table rises to symmetric margins and folds the panel out of its way', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');

    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-table')).toHaveCount(1);
    await expect(page.locator('#sgs-panel-body')).toBeVisible();

    // Drag the table's top grip well past the top of the screen. It should stop where its top
    // margin equals its bottom one, not at the old arbitrary 70%.
    const grip = page.locator('.sgs-table-grip--h');
    const gb = await grip.boundingBox();
    if (!gb) throw new Error('no table grip');
    await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
    await page.mouse.down();
    await page.mouse.move(gb.x + gb.width / 2, -200, { steps: 12 });
    await page.mouse.up();

    const table = await page.locator('#sgs-table').boundingBox();
    if (!table) throw new Error('no table');
    expect(table.y).toBeCloseTo(vp.height - table.y - table.height, 0);
    expect(table.y).toBeGreaterThan(4);

    // On the way up it folded the layer panel, which had run out of usable height.
    await expect(page.locator('#sgs-panel-body')).toBeHidden();

    // And on the way back down it gives it back, because the table is what took it.
    const gb2 = await grip.boundingBox();
    if (!gb2) throw new Error('no table grip');
    await page.mouse.move(gb2.x + gb2.width / 2, gb2.y + gb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(gb2.x + gb2.width / 2, vp.height - 240, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('#sgs-panel-body')).toBeVisible();
});

/**
 * Snap, dock and FULL.
 *
 * The drags below all grab a HEAD and move it, which is the reader's gesture, rather than
 * calling into the module. That matters here more than usual: the bug these replace was not
 * in the snap arithmetic, it was that letting go never consulted it at all.
 */

/**
 * Drag an element by its head to an absolute viewport position.
 * @param {import('@playwright/test').Page} page
 * @param {string} head selector for the grab handle
 * @param {number} toX @param {number} toY
 */
async function dragHead(page, head, toX, toY) {
    const h = await page.locator(head).boundingBox();
    if (!h) throw new Error(`no handle: ${head}`);
    // Grab well clear of the buttons at the right end of every head.
    await page.mouse.move(h.x + 40, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 10 });
    await page.mouse.up();
}

test('the panel dragged back near its edge docks itself', async ({ page }) => {
    const panel = page.locator('#sgs-panel');
    await page.locator('.sgs-panel-dock').click();
    await expect(panel).toHaveClass(/sgs-panel--undocked/);

    // Out to the middle of the map: nowhere near its edge, so it stays undocked.
    await dragHead(page, '.sgs-panel-head', 500, 400);
    await expect(panel).toHaveClass(/sgs-panel--undocked/);

    // And back to the corner. Inside the catch radius, letting go re-docks it, and the panel
    // reaches the bottom inset again the way a docked panel does.
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await dragHead(page, '.sgs-panel-head', 50, 30);
    await expect(panel).not.toHaveClass(/sgs-panel--undocked/);
    const box = await panel.boundingBox();
    if (!box) throw new Error('no panel');
    expect(box.x).toBeLessThan(24);
    expect(box.y).toBeLessThan(24);
    expect(box.y + box.height).toBeGreaterThan(vp.height - 24);
});

test('the panel shows it will snap before the reader lets go', async ({ page }) => {
    await page.locator('.sgs-panel-dock').click();
    const panel = page.locator('#sgs-panel');

    const h = await page.locator('.sgs-panel-head').boundingBox();
    if (!h) throw new Error('no head');
    await page.mouse.move(h.x + 40, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(500, 400, { steps: 6 });
    await expect(panel).not.toHaveClass(/sgs-snapping/);
    await page.mouse.move(60, 40, { steps: 6 });
    await expect(panel).toHaveClass(/sgs-snapping/);
    await page.mouse.up();
    // The cue belongs to the drag; it must not survive it.
    await expect(panel).not.toHaveClass(/sgs-snapping/);
});

test('the docked table drags undocked by its head, as the panel does, and its head says so', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    const table = page.locator('#sgs-table');
    await expect(table).not.toHaveClass(/sgs-table--undocked/);

    // Grabbable while docked, not only once already undocked: the cursor is the affordance.
    expect(await page.locator('.sgs-table-head').evaluate((el) => getComputedStyle(el).cursor)).toBe('grab');

    // No button pressed: the drag alone undocks it.
    await dragHead(page, '.sgs-table-head', vp.width / 2, 200);
    await expect(table).toHaveClass(/sgs-table--undocked/);
    await expect(page.locator('.sgs-table-dock')).toHaveAttribute('aria-pressed', 'false');
    const box = await table.boundingBox();
    if (!box) throw new Error('no table');
    expect(box.y + box.height).toBeLessThan(vp.height - 60);
});

test('a folded table drags undocked too, and stays folded when it is put down', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await foldToHead(page, '.sgs-table-fold');

    await dragHead(page, '.sgs-table-head', vp.width / 2, 200);
    const table = page.locator('#sgs-table');
    await expect(table).toHaveClass(/sgs-table--undocked/);
    // The browser fires a click at the end of the drag; it must not unfold the bar.
    await expect(page.locator('.sgs-table-fold')).toHaveAttribute('aria-expanded', 'false');
    const box = await table.boundingBox();
    if (!box) throw new Error('no table');
    expect(box.height).toBeLessThan(60);
    expect(box.y).toBeLessThan(260);
});

test('the table undocks, drags, and snaps back to the bottom edge', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    const table = page.locator('#sgs-table');
    await expect(table).toHaveCount(1);

    const docked = await table.boundingBox();
    if (!docked) throw new Error('no table');
    // Docked, the table spans the viewport and sits on the bottom inset.
    expect(docked.x).toBeLessThan(24);
    expect(docked.width).toBeGreaterThan(vp.width - 48);
    expect(docked.y + docked.height).toBeGreaterThan(vp.height - 24);

    await page.locator('.sgs-table-dock').click();
    await expect(table).toHaveClass(/sgs-table--undocked/);
    await dragHead(page, '.sgs-table-head', 420, 200);
    const undocked = await table.boundingBox();
    if (!undocked) throw new Error('no table');
    // Undocked it leaves the bottom, so it stops being the bottom edge and the panel gets its own
    // bottom anchor back. It keeps its width: undocking moves a table, never resizes it.
    expect(undocked.width).toBeCloseTo(docked.width, 0);
    expect(undocked.y + undocked.height).toBeLessThan(vp.height - 60);
    const panel = await page.locator('#sgs-panel').boundingBox();
    if (!panel) throw new Error('no panel');
    expect(panel.y + panel.height).toBeGreaterThan(vp.height - 24);

    // Dropped back at the foot of the map it docks itself: full-bleed again, on the inset.
    await dragHead(page, '.sgs-table-head', 30, vp.height - undocked.height + 10);
    await expect(table).not.toHaveClass(/sgs-table--undocked/);
    const redocked = await table.boundingBox();
    if (!redocked) throw new Error('no table');
    expect(redocked.width).toBeGreaterThan(vp.width - 48);
    expect(redocked.y + redocked.height).toBeGreaterThan(vp.height - 24);
});

test('the undocked table snaps back when held against the bottom anywhere, the middle included', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    const table = page.locator('#sgs-table');
    await expect(table).toHaveCount(1);

    /** Undock it and park it mid-map, well clear of every edge. */
    const undockMidMap = async () => {
        await page.locator('.sgs-table-dock').click();
        await expect(table).toHaveClass(/sgs-table--undocked/);
        await dragHead(page, '.sgs-table-head', vp.width / 2, 200);
        await expect(table).toHaveClass(/sgs-table--undocked/);
        const box = await table.boundingBox();
        if (!box) throw new Error('no table');
        return box;
    };

    // Dropped at the foot of the map in the MIDDLE, far from the bottom-left corner. This is
    // the case the corner test missed: it stayed undocked.
    let undocked = await undockMidMap();
    const h = await page.locator('.sgs-table-head').boundingBox();
    if (!h) throw new Error('no head');
    await page.mouse.move(h.x + 40, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(vp.width / 2, vp.height - undocked.height + 10, { steps: 10 });
    // The cue shows before letting go, as it does for the panel.
    await expect(table).toHaveClass(/sgs-snapping/);
    await page.mouse.up();
    await expect(table).not.toHaveClass(/sgs-snapping/);
    await expect(table).not.toHaveClass(/sgs-table--undocked/);
    let docked = await table.boundingBox();
    if (!docked) throw new Error('no table');
    expect(docked.x).toBeLessThan(24);
    expect(docked.width).toBeGreaterThan(vp.width - 48);
    expect(docked.y + docked.height).toBeGreaterThan(vp.height - 24);

    // Pushed down PAST its docked top, near the right, until little more than the head shows:
    // shoving it into the edge it belongs on puts it back too.
    undocked = await undockMidMap();
    await dragHead(page, '.sgs-table-head', vp.width - 120, vp.height - 20);
    await expect(table).not.toHaveClass(/sgs-table--undocked/);
    docked = await table.boundingBox();
    if (!docked) throw new Error('no table');
    expect(docked.width).toBeGreaterThan(vp.width - 48);
    expect(docked.y + docked.height).toBeGreaterThan(vp.height - 24);
    expect(docked.y + docked.height).toBeLessThanOrEqual(vp.height);
});

test('the table is the one thing that fills the map: the panel has no FULL', async ({ page }) => {
    await expect(page.locator('.sgs-panel-full')).toHaveCount(0);
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await expect(page.locator('.sgs-table-full')).toHaveCount(1);
});

test('one chevron, four views, on the table: natural, its rows, its head, its rows and columns', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    const table = page.locator('#sgs-table');
    const chev = page.locator('.sgs-table-fold');
    const natural = await table.boundingBox();
    if (!natural) throw new Error('no table');
    const rows = async () => (await heightOf(page, '.sgs-table-body table')) + (await heightOf(page, '.sgs-table-head'));

    // TIGHT: the table plus its head, no blank band.
    await chev.click();
    await expect(table).toHaveClass(/sgs-table--tight/);
    expect(Math.abs((await heightOf(page, '#sgs-table')) - await rows())).toBeLessThan(4);

    // HEAD.
    await chev.click();
    await expect(chev).toHaveAttribute('aria-expanded', 'false');
    expect(await heightOf(page, '#sgs-table')).toBeLessThan(60);

    // SNUG: the rows' height AND the columns' width.
    await chev.click();
    await expect(table).toHaveClass(/sgs-table--snug/);
    const snug = await table.boundingBox();
    if (!snug) throw new Error('no table');
    const tableW = await page.locator('.sgs-table-body table').evaluate((t) => t.getBoundingClientRect().width);
    expect(snug.width).toBeLessThan(natural.width - 100);
    expect(Math.abs(snug.width - tableW)).toBeLessThan(6);
    expect(Math.abs(snug.height - await rows())).toBeLessThan(4);

    // NATURAL again, to the pixel both ways, because no view wrote over a size.
    await chev.click();
    const back = await table.boundingBox();
    if (!back) throw new Error('no table');
    expect(back.height).toBeCloseTo(natural.height, 0);
    expect(back.width).toBeCloseTo(natural.width, 0);
});

test('the fitted view grows the table to rows that fit on screen', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    const natural = await heightOf(page, '#sgs-table');
    const rows = (await heightOf(page, '.sgs-table-body table')) + (await heightOf(page, '.sgs-table-head'));
    // The precondition, checked rather than assumed: this layer's rows need more than natural.
    expect(rows).toBeGreaterThan(natural + 2);
    await page.locator('.sgs-table-fold').click();
    await expect(page.locator('#sgs-table')).toHaveClass(/sgs-table--tight/);
    expect(Math.abs((await heightOf(page, '#sgs-table')) - rows)).toBeLessThan(4);
});

test('the fitted view is skipped only when the rows could not all fit on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 240 });
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    const rows = (await heightOf(page, '.sgs-table-body table')) + (await heightOf(page, '.sgs-table-head'));
    // The precondition: taller than the most the table may be (the viewport less its insets).
    expect(rows).toBeGreaterThan(240 - 20);
    await page.locator('.sgs-table-fold').click();
    await expect(page.locator('.sgs-table-fold')).toHaveAttribute('aria-expanded', 'false');
});

/**
 * Which way a chevron points once its transition settles, read off its computed transform. The
 * glyph points down unrotated.
 * @param {import('@playwright/test').Page} page @param {string} sel
 */
const pointing = (page, sel) => page.locator(`${sel} svg`).evaluate((el) => {
    const t = getComputedStyle(el).transform.replace(/\s/g, '');
    if (t === 'none' || t.startsWith('matrix(1,0,0,1')) return 'down';
    if (t.startsWith('matrix(-1,')) return 'up';
    if (t.startsWith('matrix(0,1,-1,0')) return 'left';
    if (t.startsWith('matrix(0,-1,1,0')) return 'right';
    return t;
});

test('the table\'s chevron points one way per view: down, right, up, left, and down again', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    const ways = ['down', 'right', 'up', 'left', 'down'];
    for (let i = 0; i < ways.length; i++) {
        await expect.poll(() => pointing(page, '.sgs-table-fold')).toBe(ways[i]);
        if (i < ways.length - 1) await page.locator('.sgs-table-fold').click();
    }
});

test('the panel goes round the same dial, skipping SNUG at its own width', async ({ page }) => {
    const chev = page.locator('.sgs-panel-fold');
    const natural = await heightOf(page, '#sgs-panel');

    await expect.poll(() => pointing(page, '.sgs-panel-fold')).toBe('down');
    await chev.click();
    expect(await heightOf(page, '#sgs-panel')).toBeLessThan(natural - 100);
    await expect.poll(() => pointing(page, '.sgs-panel-fold')).toBe('right');

    await chev.click();
    expect(await heightOf(page, '#sgs-panel')).toBeLessThan(60);
    await expect.poll(() => pointing(page, '.sgs-panel-fold')).toBe('up');

    // The automatic width is already the rows' own, so SNUG would be TIGHT again: skipped.
    await chev.click();
    expect(await heightOf(page, '#sgs-panel')).toBeCloseTo(natural, 0);
    await expect.poll(() => pointing(page, '.sgs-panel-fold')).toBe('down');
});

test('with a wider width set, the panel offers SNUG: its rows and its own width, pointing left', async ({ page }) => {
    const panel = page.locator('#sgs-panel');
    const grip = await page.locator('.sgs-grip--w').boundingBox();
    if (!grip) throw new Error('no grip');
    await page.mouse.move(grip.x + grip.width / 2, grip.y + 200);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 120, grip.y + 200, { steps: 5 });
    await page.mouse.up();
    const wide = await panel.boundingBox();
    if (!wide) throw new Error('no panel');

    const chev = page.locator('.sgs-panel-fold');
    await chev.click();
    await chev.click();
    await chev.click();
    await expect(panel).toHaveClass(/sgs-panel--snug/);
    await expect.poll(() => pointing(page, '.sgs-panel-fold')).toBe('left');
    const snug = await panel.boundingBox();
    if (!snug) throw new Error('no panel');
    expect(snug.width).toBeLessThan(wide.width - 60);
    expect(snug.height).toBeLessThan(wide.height - 100);

    // And the set width is still there underneath, to the pixel.
    await chev.click();
    const back = await panel.boundingBox();
    expect(back?.width).toBeCloseTo(wide.width, 0);
});

test('the panel docks when held against the left edge anywhere, and not with Ctrl held', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    const panel = page.locator('#sgs-panel');
    await page.locator('.sgs-panel-dock').click();
    await dragHead(page, '.sgs-panel-head', 500, 300);
    await expect(panel).toHaveClass(/sgs-panel--undocked/);

    // With Ctrl held the snap is off: parked against the edge halfway down, it stays undocked.
    await page.keyboard.down('Control');
    await dragHead(page, '.sgs-panel-head', 50, vp.height / 2);
    await page.keyboard.up('Control');
    await expect(panel).toHaveClass(/sgs-panel--undocked/);

    // The same drop without Ctrl docks it: halfway down the edge, nowhere near the top corner
    // the old test compared against.
    await dragHead(page, '.sgs-panel-head', 500, 300);
    await dragHead(page, '.sgs-panel-head', 50, vp.height / 2);
    await expect(panel).not.toHaveClass(/sgs-panel--undocked/);
    const box = await panel.boundingBox();
    if (!box) throw new Error('no panel');
    expect(box.y).toBeLessThan(24);
    expect(box.y + box.height).toBeGreaterThan(vp.height - 24);
});

test('closing the table shrinks it into its tab, fast, and the tab pulses in the chrome\'s own greys', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await page.evaluate(() => {
        const w = /** @type {any} */ (window);
        w.stows = [];
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (/** @type {any} */ frames, /** @type {any} */ opts) {
            if (this.classList.contains('sgs-table')) w.stows.push({ to: frames[frames.length - 1].transform, ms: opts.duration });
            return animate.call(this, frames, opts);
        };
    });
    await page.locator('#sgs-table button[aria-label="Close the table"]').click();
    await expect(page.locator('#sgs-table')).toHaveCount(0);
    await expect(page.locator('.sgs-table')).toHaveCount(0);
    await expect(page.locator('#sgs-table-mark')).toBeVisible();
    const stows = await page.evaluate(() => /** @type {any} */ (window).stows);
    expect(stows).toHaveLength(1);
    expect(stows[0].to).toContain('scale(');
    expect(stows[0].ms).toBeLessThanOrEqual(200);

    // The pulse names no accent colour: it is the tab going to full ink, not going blue.
    const pulse = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
            for (const rule of sheet.cssRules) {
                if (rule instanceof CSSKeyframesRule && rule.name === 'sgs-mark-arrive') return rule.cssText;
            }
        }
        return '';
    });
    expect(pulse).toContain('--sgs-fg');
    expect(pulse).not.toContain('accent');
    // Held dark for the first 30% of a full second: 300ms of outline before it settles.
    expect(pulse).toContain('30%');
    const mark = page.locator('#sgs-table-mark');
    await expect(mark).toHaveClass(/sgs-mark--flash/);
    expect(await mark.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('1s');
});

test('the selected ring hugs a point: its inner edge meets the dot\'s white edge', async ({ page }) => {
    const p = await page.evaluate(() => {
        const m = window.sgsMap;
        return {
            ring: m.getPaintProperty('stations-selected', 'circle-radius'),
            ringW: m.getPaintProperty('stations-selected', 'circle-stroke-width'),
            dot: m.getPaintProperty('stations-circle', 'circle-radius'),
            edge: m.getPaintProperty('stations-circle', 'circle-stroke-width'),
        };
    });
    expect(p.ring - p.ringW / 2).toBeCloseTo(p.dot + p.edge, 5);
});

test('fitting the table to its columns keeps its left edge, docked or not', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    const table = page.locator('#sgs-table');
    const chev = page.locator('.sgs-table-fold');
    const left = async () => (await table.boundingBox())?.x ?? NaN;
    const before = await left();

    // Natural, tight, head, snug: three presses, and the last one narrows the table from the
    // right, so its left edge stays at the inset.
    for (let i = 0; i < 3; i++) await chev.click();
    await expect(table).toHaveClass(/sgs-table--snug/);
    expect(Math.abs(await left() - before)).toBeLessThan(2);

    // Undocked while snug, it stays exactly where it was drawn.
    await page.locator('.sgs-table-dock').click();
    await expect(table).toHaveClass(/sgs-table--undocked/);
    expect(Math.abs(await left() - before)).toBeLessThan(2);
});

test('both dock buttons say Dock and Undock: one verb for one gesture', async ({ page }) => {
    // The accessible name, not `title`: the one tooltip lifts `title` into `data-tip` while the
    // pointer is over a button, which a click always is (tooltip.js). The two carry one text.
    const panelDock = page.locator('.sgs-panel-dock');
    await expect(panelDock).toHaveAttribute('aria-label', 'Undock the layer panel');
    await panelDock.click();
    await expect(panelDock).toHaveAttribute('aria-label', 'Dock the layer panel');

    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    const tableDock = page.locator('.sgs-table-dock');
    await expect(tableDock).toHaveAttribute('aria-label', 'Undock the table');
    await tableDock.click();
    await expect(tableDock).toHaveAttribute('aria-label', 'Dock the table');
});

test('the three heads share one look, and every grip one pill', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    // A popup, for its head: a click on a station, found by asking the map.
    const pt = await page.evaluate(() => {
        const m = window.sgsMap;
        const f = m.queryRenderedFeatures({ layers: ['stations-circle'] })[0];
        return f ? m.project(/** @type {any} */ (f.geometry).coordinates) : null;
    });
    if (pt) await page.mouse.click(pt.x, pt.y);

    const look = (/** @type {string} */ sel) => page.locator(sel).first().evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.padding, s.gap, s.backgroundColor, s.borderBottom, s.cursor].join(' | ');
    });
    const panel = await look('.sgs-panel-head');
    expect(await look('.sgs-table-head')).toBe(panel);
    if (pt) expect(await look('.sgs-popup-head')).toBe(panel);

    const pill = (/** @type {string} */ sel) => page.locator(sel).first()
        .evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
    expect(await pill('.sgs-grip--w')).toBe(await pill('.sgs-table-grip--h'));
});

test('the attribution is a small-cornered card, not a round pill', async ({ page }) => {
    const radius = await page.locator('.maplibregl-ctrl-attrib').evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThanOrEqual(6);
});

test('a folded table unfolds from its chevron, not from a click on its bar', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await foldToHead(page, '.sgs-table-fold');
    await page.locator('.sgs-table-title').click();
    await expect(page.locator('.sgs-table-fold')).toHaveAttribute('aria-expanded', 'false');
    expect(await page.locator('.sgs-table-head').evaluate((el) => getComputedStyle(el).cursor)).toBe('grab');
});

test('FULL on an undocked table takes the map, and letting go puts it back where it was', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    const table = page.locator('#sgs-table');
    await page.locator('.sgs-table-dock').click();
    await dragHead(page, '.sgs-table-head', vp.width / 2, 200);
    await expect(table).toHaveClass(/sgs-table--undocked/);
    const undocked = await table.boundingBox();
    if (!undocked) throw new Error('no table');

    await page.locator('.sgs-table-full').click();
    const full = await table.boundingBox();
    if (!full) throw new Error('no table');
    expect(full.x).toBeLessThan(24);
    expect(full.width).toBeGreaterThan(vp.width - 48);
    expect(full.y).toBeCloseTo(vp.height - full.y - full.height, 0);
    // A table that has taken the map is standing on the panel's room, undocked or not.
    await expect(page.locator('#sgs-panel-body')).toBeHidden();

    await page.locator('.sgs-table-full').click();
    await expect(table).toHaveClass(/sgs-table--undocked/);
    const back = await table.boundingBox();
    if (!back) throw new Error('no table');
    expect(back.x).toBeCloseTo(undocked.x, 0);
    expect(back.y).toBeCloseTo(undocked.y, 0);
    expect(back.width).toBeCloseTo(undocked.width, 0);
    expect(back.height).toBeCloseTo(undocked.height, 0);
    await expect(page.locator('#sgs-panel-body')).toBeVisible();
});

test('FULL on a folded table unfolds it: asking for the room is asking to see the rows', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await foldToHead(page, '.sgs-table-fold');
    await page.locator('.sgs-table-full').click();
    await expect(page.locator('.sgs-table-fold')).toHaveAttribute('aria-expanded', 'true');
    expect(await heightOf(page, '#sgs-table')).toBeGreaterThan(400);
});

test('a folded panel stays folded while the table is undocked', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await foldToHead(page, '.sgs-panel-fold');
    await page.locator('.sgs-table-dock').click();
    await expect(page.locator('#sgs-table')).toHaveClass(/sgs-table--undocked/);
    // The bug: the undocked-table rule gave the panel back its bottom anchor, and a folded panel
    // anchored at both ends stretched to full height around its hidden body.
    expect(await heightOf(page, '#sgs-panel')).toBeLessThan(60);
});

test('FULL on the table takes the map and folds the panel; the grip takes the room back', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-panel-body')).toBeVisible();

    await page.locator('.sgs-table-full').click();
    const table = await page.locator('#sgs-table').boundingBox();
    if (!table) throw new Error('no table');
    // Symmetric margins on every side: the limit the grip stops at, reached in one click.
    expect(table.y).toBeCloseTo(vp.height - table.y - table.height, 0);
    expect(table.x).toBeLessThan(24);
    expect(table.width).toBeGreaterThan(vp.width - 48);
    await expect(page.locator('#sgs-panel-body')).toBeHidden();

    // Dragging the edge is the reader taking the height back, so it cancels FULL rather than
    // being outranked by it — and the button says so.
    const gb = await page.locator('.sgs-table-grip--h').boundingBox();
    if (!gb) throw new Error('no grip');
    await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
    await page.mouse.down();
    await page.mouse.move(gb.x + gb.width / 2, vp.height - 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.sgs-table-full')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sgs-panel-body')).toBeVisible();
});

test('double-clicking the table grip fits the table rather than jumping to a fixed height', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    const table = page.locator('#sgs-table');
    await expect(table).toHaveCount(1);

    const gb = await page.locator('.sgs-table-grip--h').boundingBox();
    if (!gb) throw new Error('no grip');
    await page.mouse.dblclick(gb.x + gb.width / 2, gb.y + gb.height / 2);

    const box = await table.boundingBox();
    const grid = await page.locator('.sgs-table-body table').boundingBox();
    const head = await page.locator('.sgs-table-head').boundingBox();
    if (!box || !grid || !head) throw new Error('missing geometry');
    // TIGHT means the band is the table plus its head, with no blank strip underneath.
    expect(Math.abs(box.height - (grid.height + head.height))).toBeLessThan(4);
});

test('the large window carries a rail of pages, and switching keeps what a page was doing', async ({ page }) => {
    await page.locator('[data-glyph="info"]').first().click();
    const win = page.locator('.sgs-window');
    await expect(win).toBeVisible();

    // The rail is a tablist down the left of the pane, with the first page selected.
    const rail = page.locator('.sgs-window-rail');
    await expect(rail).toHaveAttribute('aria-orientation', 'vertical');
    const tabs = page.locator('.sgs-window-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.sgs-window-pane:not([hidden])')).toHaveCount(1);

    // Left of the pane, not above it, at this viewport.
    const railBox = await rail.boundingBox();
    const pane = await page.locator('.sgs-window-pane:not([hidden])').boundingBox();
    if (!railBox || !pane) throw new Error('no rail or pane');
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(pane.x + 1);

    // A page is built on first visit and KEPT: scroll it, leave, come back, still there.
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
    const second = page.locator('#sgs-pane-slots');
    await second.evaluate((el) => { el.scrollTop = 40; });
    const scrolled = await second.evaluate((el) => el.scrollTop);

    await tabs.nth(2).click();
    await expect(page.locator('#sgs-pane-notes')).toBeVisible();
    await tabs.nth(1).click();
    expect(await second.evaluate((el) => el.scrollTop)).toBe(scrolled);

    // Only the selected tab is in the tab order; arrows move within the rail.
    expect(await tabs.nth(1).evaluate((el) => el.tabIndex)).toBe(0);
    expect(await tabs.nth(0).evaluate((el) => el.tabIndex)).toBe(-1);
    await tabs.nth(1).focus();
    await page.keyboard.press('ArrowDown');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

    // The footer belongs to the window, not to a page: one Close, whichever page is showing.
    await expect(page.locator('.sgs-window-foot')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(win).toHaveCount(0);
});
