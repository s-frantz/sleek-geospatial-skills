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

test('at boot: panel docked left, no dock, the sliver parked at the bottom edge', async ({ page }) => {
    const panel = await page.locator('#sgs-panel').boundingBox();
    const vp = page.viewportSize();
    if (!panel || !vp) throw new Error('missing furniture');

    expect(panel.x).toBeLessThan(24);
    expect(panel.y).toBeLessThan(24);
    // Docked and automatic: the panel reaches the bottom inset.
    expect(panel.y + panel.height).toBeGreaterThan(vp.height - 24);

    // The dock does not exist until a table is asked for; its whole closed-state footprint
    // is the sliver tab, centred on the bottom edge.
    await expect(page.locator('#sgs-dock')).toHaveCount(0);
    const sliver = await page.locator('#sgs-dock-sliver').boundingBox();
    if (!sliver) throw new Error('no sliver');
    expect(sliver.y + sliver.height).toBeGreaterThan(vp.height - 2);
    expect(Math.abs(sliver.x + sliver.width / 2 - vp.width / 2)).toBeLessThan(4);
});

test('the layer rows drive the map layers', async ({ page }) => {
    const visible = () => page.evaluate(() =>
        window.sgsMap.getLayoutProperty('neighborhoods-fill', 'visibility'));

    expect(await visible()).toBe('visible');
    await page.locator('.sgs-row[data-layer="neighborhoods"] input[type=checkbox]').uncheck();
    expect(await visible()).toBe('none');
});

test('the open dock spans the bottom and displaces the panel; folded it keeps reporting; closed it leaves the sliver', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');

    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();

    // Open: a full-width band at the foot.
    const dock = await page.locator('#sgs-dock').boundingBox();
    if (!dock) throw new Error('no dock');
    expect(dock.width).toBeGreaterThan(vp.width * 0.9);
    expect(dock.height).toBeGreaterThan(150);
    expect(dock.y + dock.height).toBeGreaterThan(vp.height - 24);
    await expect(page.locator('.sgs-dock-title')).toHaveText('Stations');
    // The count is asserted against the table it is counting, never against a literal. A
    // literal here is a test of the demo data, and it fails the day the demo data changes for
    // reasons that have nothing to do with the dock.
    const rows = await page.locator('.sgs-dock-body tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    await expect(page.locator('.sgs-dock-count')).toHaveText(`${rows} rows`);

    // Displacement: the panel's bottom sits ABOVE the dock, not underneath it.
    const panel = await page.locator('#sgs-panel').boundingBox();
    if (!panel) throw new Error('no panel');
    expect(panel.y + panel.height).toBeLessThan(dock.y);

    // Folded: the head alone, still full width, still reporting.
    await page.locator('.sgs-dock-fold').click();
    const folded = await page.locator('#sgs-dock').boundingBox();
    expect(folded?.height).toBeLessThan(60);
    expect(folded?.width).toBeGreaterThan(vp.width * 0.9);
    await expect(page.locator('.sgs-dock-count')).toHaveText(`${rows} rows`);
    // And the panel takes the space back.
    const panelAfterFold = await page.locator('#sgs-panel').boundingBox();
    expect((panelAfterFold?.y ?? 0) + (panelAfterFold?.height ?? 0))
        .toBeGreaterThan(panel.y + panel.height + 100);

    // Closed: the dock leaves entirely and the sliver returns.
    await page.locator('#sgs-dock button[aria-label^="Close"]').click();
    await expect(page.locator('#sgs-dock')).toHaveCount(0);
    await expect(page.locator('#sgs-dock-sliver')).toBeVisible();

    // The sliver reopens what last held the dock.
    await page.locator('#sgs-dock-sliver').click();
    await expect(page.locator('.sgs-dock-title')).toHaveText('Stations');
});

test('the panel unpins to float, and re-pins back to docked', async ({ page }) => {
    const pin = page.locator('.sgs-panel-pin');
    const docked = await page.locator('#sgs-panel').boundingBox();

    await pin.click();
    await expect(page.locator('#sgs-panel')).toHaveClass(/sgs-panel--float/);
    const floating = await page.locator('#sgs-panel').boundingBox();
    // Floating hugs its content, so it no longer reaches the bottom of the window.
    expect(floating?.height).toBeLessThan((docked?.height ?? 0) - 40);

    await pin.click();
    await expect(page.locator('#sgs-panel')).not.toHaveClass(/sgs-panel--float/);
});

test('resizing a floating panel resizes it in place instead of re-docking it', async ({ page }) => {
    await page.locator('.sgs-panel-pin').click();
    await expect(page.locator('#sgs-panel')).toHaveClass(/sgs-panel--float/);

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
    // Still floating, still where it was, only wider. The failure mode this guards is the
    // grip silently switching the posture and snapping the panel back to the left edge.
    await expect(page.locator('#sgs-panel')).toHaveClass(/sgs-panel--float/);
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    expect(after.width).toBeGreaterThan(before.width + 60);
});

test('zoom to lands the layer clear of the panel and the dock', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Zoom"]').click();
    await page.waitForTimeout(900);

    const panel = await page.locator('#sgs-panel').boundingBox();
    const dock = await page.locator('#sgs-dock').boundingBox();
    if (!panel || !dock) throw new Error('missing furniture');

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
    expect(corners.bottom).toBeLessThan(dock.y);
});

test('occlusion follows the panel geometry, not its pin state', async ({ page }) => {
    const readPad = () => page.evaluate(async () => {
        const src = '/js/utils/visible-area.js';
        const m = await import(src);
        return m.visiblePadding().left;
    });

    const padWhileDocked = await readPad();
    expect(padWhileDocked).toBeGreaterThan(48);

    // Unpin: the float parks away from the left edge (its default home is x=60), so the
    // left band is released.
    await page.locator('.sgs-panel-pin').click();
    expect(await readPad()).toBe(48);

    // Now drag the float back against the left edge. Occlusion is a question about WHERE
    // THE PANEL IS: a float hugging the edge covers exactly as much map as a docked one,
    // so the band comes back — pin state never entered into it.
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
    await expect(page.locator('#sgs-dock')).toHaveCount(1);

    // Pressing the same button again is the obvious way to put the table away.
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await btn.click();
    await expect(page.locator('#sgs-dock')).toHaveCount(0);
    await expect(page.locator('#sgs-dock-sliver')).toBeVisible();
});

test('a second layer switches the table rather than closing it', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await expect(page.locator('.sgs-dock-title')).toHaveText('Stations');

    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-dock')).toHaveCount(1);
    await expect(page.locator('.sgs-dock-title')).toHaveText('Neighborhoods');
});

test('the panel folds to its head and closes to a left-edge mark', async ({ page }) => {
    const open = await page.locator('#sgs-panel').boundingBox();
    if (!open) throw new Error('no panel');

    // FOLD: the head stays in its slot, the body collapses.
    await page.locator('.sgs-panel-fold').click();
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
    const mark = await page.locator('#sgs-panel-sliver').boundingBox();
    if (!mark) throw new Error('no panel mark');
    expect(mark.x).toBeLessThan(2);

    // And a closed panel stops occluding the left edge for the camera.
    const pad = await page.evaluate(async () => {
        const src = '/js/utils/visible-area.js';
        const m = await import(src);
        return m.visiblePadding().left;
    });
    expect(pad).toBe(48);

    await page.locator('#sgs-panel-sliver').click();
    await expect(page.locator('#sgs-panel')).toBeVisible();
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

test('layer rows, popup titles and the dock head all carry the swatch and type pill', async ({ page }) => {
    const row = page.locator('.sgs-row[data-layer="neighborhoods"]');
    await expect(row.locator('.sgs-swatch')).toBeVisible();
    await expect(row.locator('.sgs-source-pill')).toHaveText('{GEO}');

    await row.hover();
    await row.locator('button[aria-label^="Show"]').click();
    await expect(page.locator('.sgs-dock-swatch .sgs-swatch')).toBeVisible();
    await expect(page.locator('.sgs-dock-pill .sgs-source-pill')).toHaveText('{GEO}');
});

test('field type badges appear in popups and in the table header', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();

    // The dock's header: one badge per column, typed from the data.
    const heads = page.locator('#sgs-dock thead .sgs-field-badge');
    await expect(heads).toHaveCount(5);
    // capacity is an integer, online is a boolean, name is a string.
    await expect(heads.nth(1)).toHaveText('abc');
    await expect(heads.nth(3)).toHaveText('123');
    await expect(heads.nth(4)).toHaveText('T/F');
});

/* ── Regressions ─────────────────────────────────────────────────────────────────────────
   Three geometry bugs that all shipped looking plausible. Each assertion below is the
   number that was wrong. */

test('folding the panel collapses its height without changing its width', async ({ page }) => {
    const open = await page.locator('#sgs-panel').boundingBox();
    if (!open) throw new Error('no panel');

    await page.locator('.sgs-panel-fold').click();
    const folded = await page.locator('#sgs-panel').boundingBox();
    if (!folded) throw new Error('no panel');

    // The bug: in the automatic width the panel is `width: max-content`, so collapsing the
    // body shrank it to the width of its own header and folding read as the panel moving.
    expect(folded.height).toBeLessThan(60);
    expect(folded.width).toBeCloseTo(open.width, 0);

    // And unfolding gives the automatic width back, because the FOLD is what pinned it.
    await page.locator('.sgs-panel-fold').click();
    const back = await page.locator('#sgs-panel').boundingBox();
    expect(back?.width).toBeCloseTo(open.width, 0);
});

test('pinning a height keeps a width the reader already pinned', async ({ page }) => {
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

test('the dock rises to symmetric margins and folds the panel out of its way', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');

    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-dock')).toHaveCount(1);
    await expect(page.locator('#sgs-panel-body')).toBeVisible();

    // Drag the dock's top grip well past the top of the screen. It should stop where its top
    // margin equals its bottom one, not at the old arbitrary 70%.
    const grip = page.locator('.sgs-dock-grip--h');
    const gb = await grip.boundingBox();
    if (!gb) throw new Error('no dock grip');
    await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
    await page.mouse.down();
    await page.mouse.move(gb.x + gb.width / 2, -200, { steps: 12 });
    await page.mouse.up();

    const dock = await page.locator('#sgs-dock').boundingBox();
    if (!dock) throw new Error('no dock');
    expect(dock.y).toBeCloseTo(vp.height - dock.y - dock.height, 0);
    expect(dock.y).toBeGreaterThan(4);

    // On the way up it folded the layer panel, which had run out of usable height.
    await expect(page.locator('#sgs-panel-body')).toBeHidden();

    // And on the way back down it gives it back, because the dock is what took it.
    const gb2 = await grip.boundingBox();
    if (!gb2) throw new Error('no dock grip');
    await page.mouse.move(gb2.x + gb2.width / 2, gb2.y + gb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(gb2.x + gb2.width / 2, vp.height - 240, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('#sgs-panel-body')).toBeVisible();
});

/**
 * Snap, pin and FULL.
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

test('the panel dragged back near its berth re-docks itself', async ({ page }) => {
    const panel = page.locator('#sgs-panel');
    await page.locator('.sgs-panel-pin').click();
    await expect(panel).toHaveClass(/sgs-panel--float/);

    // Out to the middle of the map: nowhere near the berth, so it stays loose.
    await dragHead(page, '.sgs-panel-head', 500, 400);
    await expect(panel).toHaveClass(/sgs-panel--float/);

    // And back to the corner. Inside the catch radius, letting go re-berths it, and the panel
    // reaches the bottom inset again the way a docked panel does.
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await dragHead(page, '.sgs-panel-head', 50, 30);
    await expect(panel).not.toHaveClass(/sgs-panel--float/);
    const box = await panel.boundingBox();
    if (!box) throw new Error('no panel');
    expect(box.x).toBeLessThan(24);
    expect(box.y).toBeLessThan(24);
    expect(box.y + box.height).toBeGreaterThan(vp.height - 24);
});

test('the panel shows it will snap before the reader lets go', async ({ page }) => {
    await page.locator('.sgs-panel-pin').click();
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

test('the table unpins, drags loose, and snaps back to the bottom berth', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    const dock = page.locator('#sgs-dock');
    await expect(dock).toHaveCount(1);

    const berthed = await dock.boundingBox();
    if (!berthed) throw new Error('no dock');
    // Berthed, the dock spans the viewport and sits on the bottom inset.
    expect(berthed.x).toBeLessThan(24);
    expect(berthed.width).toBeGreaterThan(vp.width - 48);
    expect(berthed.y + berthed.height).toBeGreaterThan(vp.height - 24);

    await page.locator('.sgs-dock-pin').click();
    await expect(dock).toHaveClass(/sgs-dock--float/);
    await dragHead(page, '.sgs-dock-head', 420, 200);
    const loose = await dock.boundingBox();
    if (!loose) throw new Error('no dock');
    // Loose it takes a width and leaves the bottom, so it stops being the bottom edge — and
    // the panel gets its own bottom anchor back.
    expect(loose.width).toBeLessThan(vp.width - 100);
    expect(loose.y + loose.height).toBeLessThan(vp.height - 60);
    const panel = await page.locator('#sgs-panel').boundingBox();
    if (!panel) throw new Error('no panel');
    expect(panel.y + panel.height).toBeGreaterThan(vp.height - 24);

    // Dropped back at the foot of the map it berths itself: full-bleed again, on the inset.
    await dragHead(page, '.sgs-dock-head', 30, vp.height - loose.height + 10);
    await expect(dock).not.toHaveClass(/sgs-dock--float/);
    const reberthed = await dock.boundingBox();
    if (!reberthed) throw new Error('no dock');
    expect(reberthed.width).toBeGreaterThan(vp.width - 48);
    expect(reberthed.y + reberthed.height).toBeGreaterThan(vp.height - 24);
});

test('FULL fills the map and gives back the exact width the reader pinned', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    const panel = page.locator('#sgs-panel');

    // Pin a width the reader would notice losing.
    const grip = await page.locator('.sgs-grip--w').boundingBox();
    if (!grip) throw new Error('no grip');
    await page.mouse.move(grip.x + grip.width / 2, grip.y + 200);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 90, grip.y + 200, { steps: 5 });
    await page.mouse.up();
    const pinned = await panel.boundingBox();
    if (!pinned) throw new Error('no panel');

    await page.locator('.sgs-panel-full').click();
    const full = await panel.boundingBox();
    if (!full) throw new Error('no panel');
    expect(full.width).toBeGreaterThan(pinned.width + 60);
    expect(full.width).toBeCloseTo(vp.width * 0.6, 0);

    // Releasing restores the pinned width to the pixel, because FULL never overwrote it.
    await page.locator('.sgs-panel-full').click();
    const back = await panel.boundingBox();
    if (!back) throw new Error('no panel');
    expect(back.width).toBeCloseTo(pinned.width, 0);
});

test('FULL on the table takes the map and folds the panel; the grip takes the room back', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-panel-body')).toBeVisible();

    await page.locator('.sgs-dock-full').click();
    const dock = await page.locator('#sgs-dock').boundingBox();
    if (!dock) throw new Error('no dock');
    // Symmetric margins on every side: the limit the grip stops at, reached in one click.
    expect(dock.y).toBeCloseTo(vp.height - dock.y - dock.height, 0);
    expect(dock.x).toBeLessThan(24);
    expect(dock.width).toBeGreaterThan(vp.width - 48);
    await expect(page.locator('#sgs-panel-body')).toBeHidden();

    // Dragging the edge is the reader taking the height back, so it cancels FULL rather than
    // being outranked by it — and the button says so.
    const gb = await page.locator('.sgs-dock-grip--h').boundingBox();
    if (!gb) throw new Error('no grip');
    await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
    await page.mouse.down();
    await page.mouse.move(gb.x + gb.width / 2, vp.height - 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.sgs-dock-full')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sgs-panel-body')).toBeVisible();
});

test('double-clicking the dock grip fits the table rather than jumping to a fixed height', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    const dock = page.locator('#sgs-dock');
    await expect(dock).toHaveCount(1);

    const gb = await page.locator('.sgs-dock-grip--h').boundingBox();
    if (!gb) throw new Error('no grip');
    await page.mouse.dblclick(gb.x + gb.width / 2, gb.y + gb.height / 2);

    const box = await dock.boundingBox();
    const table = await page.locator('.sgs-dock-body table').boundingBox();
    const head = await page.locator('.sgs-dock-head').boundingBox();
    if (!box || !table || !head) throw new Error('missing geometry');
    // TIGHT means the band is the table plus its head, with no blank strip underneath.
    expect(Math.abs(box.height - (table.height + head.height))).toBeLessThan(4);
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
