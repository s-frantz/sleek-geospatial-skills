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
        window.sgsMap.getLayoutProperty('districts-fill', 'visibility'));

    expect(await visible()).toBe('visible');
    await page.locator('.sgs-row[data-layer="districts"] input[type=checkbox]').uncheck();
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
    await expect(page.locator('.sgs-dock-count')).toHaveText('24 rows');

    // Displacement: the panel's bottom sits ABOVE the dock, not underneath it.
    const panel = await page.locator('#sgs-panel').boundingBox();
    if (!panel) throw new Error('no panel');
    expect(panel.y + panel.height).toBeLessThan(dock.y);

    // Folded: the head alone, still full width, still reporting.
    await page.locator('.sgs-dock-fold').click();
    const folded = await page.locator('#sgs-dock').boundingBox();
    expect(folded?.height).toBeLessThan(60);
    expect(folded?.width).toBeGreaterThan(vp.width * 0.9);
    await expect(page.locator('.sgs-dock-count')).toHaveText('24 rows');
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
    const pin = page.locator('#sgs-panel-berth button[aria-pressed]').first();
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
    await page.locator('#sgs-panel-berth button[aria-pressed]').first().click();
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
    await page.locator('.sgs-row[data-layer="districts"]').hover();
    await page.locator('.sgs-row[data-layer="districts"] button[aria-label^="Show"]').click();
    await page.locator('.sgs-row[data-layer="districts"]').hover();
    await page.locator('.sgs-row[data-layer="districts"] button[aria-label^="Zoom"]').click();
    await page.waitForTimeout(900);

    const panel = await page.locator('#sgs-panel').boundingBox();
    const dock = await page.locator('#sgs-dock').boundingBox();
    if (!panel || !dock) throw new Error('missing furniture');

    // Project the layer's own bounding box back to the screen and check it landed in the
    // part of the window a person can actually see.
    const corners = await page.evaluate(async () => {
        const fc = await (await fetch('data/districts.geojson')).json();
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
    await page.locator('#sgs-panel-berth button[aria-pressed]').first().click();
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

    await page.locator('.sgs-row[data-layer="districts"]').hover();
    await page.locator('.sgs-row[data-layer="districts"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-dock')).toHaveCount(1);
    await expect(page.locator('.sgs-dock-title')).toHaveText('Districts');
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
    const row = page.locator('.sgs-row[data-layer="districts"]');
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
