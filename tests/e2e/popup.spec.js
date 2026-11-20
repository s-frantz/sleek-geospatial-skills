/**
 * Rung 3: popups, and the promises they make.
 *
 * The promises are behavioural, so the assertions are numbers and counts: one popup per
 * plain click, a cascade under Ctrl, a leader line whose far end is the feature, a popup
 * that stays where it was put while the map moves under it.
 */

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('body[data-ready="true"]');
});

test('the popup field table is left unstriped: the stripe belongs to the table alone', async ({ page }) => {
    await clickAFeature(page, 0);
    const images = await page.locator('.sgs-popup').last().locator('.sgs-fields tr > *')
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundImage));
    // Enough rows that an even one is in the list, or "no stripe" would prove nothing.
    expect(images.length).toBeGreaterThan(4);
    expect(new Set(images)).toEqual(new Set(['none']));
});

test('the popup table button lights its row in a table opened some other way, rather than closing it', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-table')).toHaveCount(1);

    // A district's popup over a table of stations: nothing there was lit by THIS button, so
    // the press means "show me my row", and the table switches to districts to do it.
    await clickAFeature(page, 3);
    const popup = page.locator('.sgs-popup').last();
    const title = (await popup.locator('.sgs-popup-title').textContent()) ?? '';
    await popup.locator('.sgs-popup-table').click();
    await expect(page.locator('.sgs-table-title')).toHaveText('Neighborhoods');
    await expect(page.locator('#sgs-table tbody tr.sgs-row-hit td').nth(2)).toHaveText(title);
});

test('the popup table button takes three presses: find the row, clear it, close the table', async ({ page }) => {
    await clickAFeature(page, 3);
    const popup = page.locator('.sgs-popup').last();
    const title = (await popup.locator('.sgs-popup-title').textContent()) ?? '';
    const btn = popup.locator('.sgs-popup-table');
    const hit = page.locator('#sgs-table tbody tr.sgs-row-hit');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // FIND: the table opens on the feature's row, lit and in view, and the button shows
    // pressed, drawn as a table with a row lit.
    await btn.click();
    await expect(hit).toHaveCount(1);
    // Cells run go-to, id, name: the lit row is the popup's own feature, by name.
    await expect(hit.locator('td').nth(2)).toHaveText(title);
    const r = await hit.boundingBox();
    const b = await page.locator('#sgs-table .sgs-table-body').boundingBox();
    if (!r || !b) throw new Error('no geometry');
    expect(r.y).toBeGreaterThanOrEqual(b.y - 1);
    expect(r.y + r.height).toBeLessThanOrEqual(b.y + b.height + 1);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn.locator('svg')).toHaveAttribute('data-glyph', 'table-lit');
    await expect(btn).toHaveAttribute('aria-label', 'Clear this feature\'s row');

    // CLEAR: the row goes dark, the table stays, and the button says what comes next.
    await btn.click();
    await expect(hit).toHaveCount(0);
    await expect(page.locator('#sgs-table')).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('aria-label', 'Close the table');

    // CLOSE.
    await btn.click();
    await expect(page.locator('#sgs-table')).toHaveCount(0);
    await expect(btn).toHaveAttribute('aria-label', 'Find this feature in the table');
});

test('closing the popup whose button lit the row puts the row out, and leaves the table', async ({ page }) => {
    await clickAFeature(page, 3);
    const popup = page.locator('.sgs-popup').last();
    await popup.locator('.sgs-popup-table').click();
    await expect(page.locator('#sgs-table tbody tr.sgs-row-hit')).toHaveCount(1);
    await popup.locator('button[aria-label="Close the popup"]').click();
    await expect(page.locator('#sgs-table tbody tr.sgs-row-hit')).toHaveCount(0);
    await expect(page.locator('#sgs-table')).toHaveCount(1);
});

test('a clicked feature is drawn selected while its popup is open, and plain again after', async ({ page }) => {
    const filter = () => page.evaluate(() => JSON.stringify(window.sgsMap.getFilter('neighborhoods-selected')));
    expect(await filter()).toBe('["literal",false]');
    await clickAFeature(page, 3);
    await expect.poll(filter).toContain('"in"');
    await page.locator('.sgs-popup').last().locator('button[aria-label="Close the popup"]').click();
    await expect.poll(filter).toBe('["literal",false]');
});

/**
 * Click a district polygon, choosing the point by ASKING THE MAP what it has rendered
 * rather than guessing a coordinate.
 *
 * The first version of this helper clicked the centre of the viewport, which happens to
 * fall in a gap between demo polygons, so every popup test failed for a reason that had
 * nothing to do with popups. And a point can be ON a polygon yet UNDER the panel, in which
 * case the click goes to the layer list: `queryRenderedFeatures` answers about the map and
 * knows nothing about the DOM over it, so `elementFromPoint` gets a veto. A test whose
 * setup is a guess reports on the guess.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [nth] which rendered district to click
 * @param {boolean} [ctrl] hold Ctrl for the click
 */
async function clickAFeature(page, nth = 0, ctrl = false) {
    const points = await renderedDistricts(page);
    const pt = points[nth % points.length];
    if (ctrl) await page.keyboard.down('Control');
    await page.mouse.click(pt.x, pt.y);
    if (ctrl) await page.keyboard.up('Control');
    await page.locator('.sgs-popup').first().waitFor();
    return pt;
}

/**
 * One clickable screen point per district on screen, WAITING for the layer to have painted.
 *
 * `body[data-ready]` says the app has wired itself up, not that the source has rendered, and
 * `queryRenderedFeatures` only answers about what is rendered NOW. While the demo layer was
 * twelve rectangles covering most of the viewport that race was invisible; with 94 real
 * neighbourhood polygons it failed a different third of the popup tests on every run (#9).
 * So this polls until the map reports itself loaded AND the sweep finds something, and when it
 * never does, the failure names the layer rather than the click. No fixed sleep: one long
 * enough for a slow machine would be paid by every test on a fast one.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{x: number, y: number}>>}
 */
async function renderedDistricts(page) {
    try {
        const handle = await page.waitForFunction(() => {
            const m = window.sgsMap;
            if (!m.loaded()) return null;
            const c = m.getCanvas();
            const w = c.clientWidth;
            const h = c.clientHeight;
            /** @type {Map<string, {x: number, y: number}>} */
            const found = new Map();
            for (let y = 40; y < h - 40; y += 12) {
                for (let x = 40; x < w - 40; x += 12) {
                    const top = document.elementFromPoint(x, y);
                    if (!top || !top.closest('#map')) continue;
                    const hit = m.queryRenderedFeatures([x, y], { layers: ['neighborhoods-fill'] });
                    for (const f of hit) {
                        const id = f.properties.id;
                        if (!found.has(id)) found.set(id, { x, y });
                    }
                }
            }
            return found.size ? [...found.values()] : null;
        }, undefined, { timeout: 10_000, polling: 100 });
        return /** @type {Array<{x: number, y: number}>} */ (await handle.jsonValue());
    } catch {
        throw new Error('the neighborhoods layer never rendered a district on screen within 10s');
    }
}

/** @param {import('@playwright/test').Page} page @param {number} [i] */
async function popupBox(page, i = 0) {
    const b = await page.locator('.sgs-popup').nth(i).boundingBox();
    if (!b) throw new Error('no popup box');
    return b;
}

test('a popup opens with the feature fields in it', async ({ page }) => {
    await clickAFeature(page);
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
    await expect(page.locator('.sgs-popup .sgs-fields tr')).toHaveCount(5);
});

test('a plain click REPLACES the open popup; Ctrl keeps it', async ({ page }) => {
    await clickAFeature(page, 0);
    await clickAFeature(page, 5);
    // Two plain clicks, one popup: browsing does not accumulate.
    await expect(page.locator('.sgs-popup')).toHaveCount(1);

    await clickAFeature(page, 0, true);
    // Ctrl is the deliberate comparison gesture.
    await expect(page.locator('.sgs-popup')).toHaveCount(2);
});

test('clean popups open beside the panel and stacked ones cascade right', async ({ page }) => {
    await clickAFeature(page, 0);
    const panel = await page.locator('#sgs-panel').boundingBox();
    const first = await popupBox(page);
    if (!panel) throw new Error('no panel');

    // The clean home: just right of the occluding panel, at the top, out of the map's way.
    expect(first.x).toBeGreaterThanOrEqual(panel.x + panel.width);
    expect(first.x).toBeLessThan(panel.x + panel.width + 40);
    expect(first.y).toBeLessThan(24);

    await clickAFeature(page, 5, true);
    const second = await popupBox(page, 1);
    // Cascade: one step right, same top, so both title bars stay grabbable.
    expect(Math.round(second.x - first.x)).toBe(40);
    expect(Math.abs(second.y - first.y)).toBeLessThan(2);
});

test('the leader line runs from the clicked feature to the popup', async ({ page }) => {
    const pt = await clickAFeature(page);
    const popup = await popupBox(page);
    const line = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x1: Number(el.getAttribute('x1')), y1: Number(el.getAttribute('y1')),
        x2: Number(el.getAttribute('x2')), y2: Number(el.getAttribute('y2')),
    }));
    // Feature end: where we clicked. Popup end: the popup's centre.
    expect(Math.abs(line.x1 - pt.x)).toBeLessThan(3);
    expect(Math.abs(line.y1 - pt.y)).toBeLessThan(3);
    expect(Math.abs(line.x2 - (popup.x + popup.width / 2))).toBeLessThan(3);
    expect(Math.abs(line.y2 - (popup.y + popup.height / 2))).toBeLessThan(3);
});

test('a popup stays where it was put while the map pans; only its leader tracks', async ({ page }) => {
    await clickAFeature(page);
    const before = await popupBox(page);
    const lineBefore = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x1: Number(el.getAttribute('x1')), y1: Number(el.getAttribute('y1')),
    }));

    await page.evaluate(() => window.sgsMap.panBy([120, 60], { duration: 0 }));
    await page.waitForTimeout(200);

    const after = await popupBox(page);
    const lineAfter = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x1: Number(el.getAttribute('x1')), y1: Number(el.getAttribute('y1')),
    }));

    // The popup is the reader's: it does not chase the camera.
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    // The feature moved 120,60 up-left in screen space, and the leader followed it.
    expect(lineAfter.x1 - lineBefore.x1).toBeCloseTo(-120, 0);
    expect(lineAfter.y1 - lineBefore.y1).toBeCloseTo(-60, 0);
});

test('a popup drags by its head, and the leader follows the popup end', async ({ page }) => {
    await clickAFeature(page);
    const before = await popupBox(page);

    const head = await page.locator('.sgs-popup-head').boundingBox();
    if (!head) throw new Error('no head');
    await page.mouse.move(head.x + head.width / 3, head.y + head.height / 2);
    await page.mouse.down();
    await page.mouse.move(head.x + head.width / 3 + 150, head.y + head.height / 2 + 90, { steps: 5 });
    await page.mouse.up();

    const after = await popupBox(page);
    expect(after.x - before.x).toBeCloseTo(150, -1);
    expect(after.y - before.y).toBeCloseTo(90, -1);

    const line = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x2: Number(el.getAttribute('x2')), y2: Number(el.getAttribute('y2')),
    }));
    expect(Math.abs(line.x2 - (after.x + after.width / 2))).toBeLessThan(3);
    expect(Math.abs(line.y2 - (after.y + after.height / 2))).toBeLessThan(3);
});

test('adjacent opens the popup beside the feature instead of at the clean home', async ({ page }) => {
    await page.locator('[data-glyph="gear"]').first().click();
    await page.getByRole('radio', { name: 'Adjacent' }).click();
    await page.keyboard.press('Escape');

    const pt = await clickAFeature(page);
    const popup = await popupBox(page);
    const strategy = await page.locator('.sgs-popup').first().getAttribute('data-strategy');
    expect(strategy).not.toBe('clean');
    // Near the question, not parked at the top of the screen.
    const cx = popup.x + popup.width / 2;
    const cy = popup.y + popup.height / 2;
    expect(Math.hypot(cx - pt.x, cy - pt.y)).toBeLessThan(450);
});

test('escape closes the topmost popup only', async ({ page }) => {
    await clickAFeature(page, 0);
    await clickAFeature(page, 5, true);
    await expect(page.locator('.sgs-popup')).toHaveCount(2);

    await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
});

test('a clean popup never covers the panel or the table', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await clickAFeature(page);

    const popup = await popupBox(page);
    for (const sel of ['#sgs-panel', '#sgs-table']) {
        const f = await page.locator(sel).boundingBox();
        if (!f) throw new Error(`no box for ${sel}`);
        const clear = popup.x >= f.x + f.width || popup.x + popup.width <= f.x
            || popup.y >= f.y + f.height || popup.y + popup.height <= f.y;
        expect(clear, `popup overlaps ${sel}`).toBe(true);
    }
});

test('the large window opens over a popup, and escape closes only the top one', async ({ page }) => {
    await clickAFeature(page);
    await page.locator('[data-glyph="info"]').first().click();
    await expect(page.locator('.sgs-window')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-window')).toHaveCount(0);
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
});

/**
 * Find a station and a direction to approach it from, by asking the map: walk out from the
 * station's centre until MapLibre's own EXACT point query stops hitting it. That first miss is
 * the edge as MapLibre sees it, radius and stroke included, so nothing here hard-codes either.
 * Districts are hidden first, because they cover most of the map and "nothing opens" has to
 * mean nothing, not a district.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{edge: {x: number, y: number}, name: string, dir: [number, number]}>}
 */
async function aStationEdge(page) {
    await page.evaluate(() => {
        for (const id of ['neighborhoods-fill', 'neighborhoods-line']) {
            window.sgsMap.setLayoutProperty(id, 'visibility', 'none');
        }
    });
    const handle = await page.waitForFunction(() => {
        const m = window.sgsMap;
        if (!m.loaded()) return null;
        const c = m.getCanvas().getBoundingClientRect();
        const only = { layers: ['stations-circle'] };
        const onMap = (/** @type {number} */ x, /** @type {number} */ y) => {
            const el = document.elementFromPoint(c.left + x, c.top + y);
            return !!el && !!el.closest('#map');
        };
        for (const f of m.querySourceFeatures('stations')) {
            const p = m.project(f.geometry.coordinates);
            for (const dir of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                let d = 0;
                while (d < 60 && m.queryRenderedFeatures([p.x + dir[0] * d, p.y + dir[1] * d], only)
                    .some((h) => h.properties.id === f.properties.id)) d++;
                if (d === 0 || d >= 60) continue;
                // The far test point must be clear of EVERY station, with room for the hit box.
                const far = { x: p.x + dir[0] * (d + 20), y: p.y + dir[1] * (d + 20) };
                const box = [[far.x - 8, far.y - 8], [far.x + 8, far.y + 8]];
                if (m.queryRenderedFeatures(box, only).length) continue;
                if (!onMap(p.x + dir[0] * d, p.y + dir[1] * d) || !onMap(far.x, far.y)) continue;
                return {
                    edge: { x: c.left + p.x + dir[0] * d, y: c.top + p.y + dir[1] * d },
                    name: String(f.properties.name), dir,
                };
            }
        }
        return null;
    }, undefined, { timeout: 10_000, polling: 100 });
    return /** @type {any} */ (await handle.jsonValue());
}

test('a click a few px off a small feature still opens it; one well clear opens nothing (#26)', async ({ page }) => {
    const { edge, name, dir } = await aStationEdge(page);
    const near = { x: edge.x + dir[0] * 5, y: edge.y + dir[1] * 5 };
    const far = { x: edge.x + dir[0] * 20, y: edge.y + dir[1] * 20 };

    // The premise: an exact point query 5px off the edge finds nothing, so only the
    // tolerance can make this click land.
    const exact = await page.evaluate(({ x, y }) => {
        const c = window.sgsMap.getCanvas().getBoundingClientRect();
        return window.sgsMap.queryRenderedFeatures([x - c.left, y - c.top], { layers: ['stations-circle'] }).length;
    }, near);
    expect(exact).toBe(0);

    // Asserting an absence needs a moment for a wrong popup to appear in; there is no event
    // to wait for when the right answer is that nothing happens.
    await page.mouse.click(far.x, far.y);
    await page.waitForTimeout(150);
    await expect(page.locator('.sgs-popup')).toHaveCount(0);

    await page.mouse.click(near.x, near.y);
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
    await expect(page.locator('.sgs-popup-title')).toHaveText(name);
});

test('the pointer cursor promises exactly what a click would do (#26)', async ({ page }) => {
    const { edge, dir } = await aStationEdge(page);
    const cursor = () => page.evaluate(() => window.sgsMap.getCanvas().style.cursor);

    await page.mouse.move(edge.x + dir[0] * 5, edge.y + dir[1] * 5);
    await expect.poll(cursor).toBe('pointer');
    await page.mouse.move(edge.x + dir[0] * 20, edge.y + dir[1] * 20);
    await expect.poll(cursor).toBe('');
});

test('a clean popup opens below a table docked along the top, as it opens beside the panel (#24)', async ({ page }) => {
    // Without anything along the top, the column's top is the viewport margin.
    await clickAFeature(page, 0);
    expect(Math.round((await popupBox(page)).y)).toBe(10);
    await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-popup')).toHaveCount(0);

    // The table docked along the top is the demo's top-edge furniture, and an app's title bar
    // is the same case: full width, against the top, marked as furniture. A second init script
    // runs after beforeEach's clear, so the reader's last edge survives the reload.
    await page.addInitScript(() => localStorage.setItem('sgs-prefs', JSON.stringify({ tableEdge: 'top' })));
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[aria-label^="Show"]').click();
    await expect(page.locator('#sgs-table')).toHaveClass(/sgs-table--top/);

    await clickAFeature(page, 0);
    const table = await page.locator('#sgs-table').boundingBox();
    if (!table) throw new Error('no table');
    expect(Math.round((await popupBox(page)).y)).toBe(Math.round(table.y + table.height) + 10);
});
