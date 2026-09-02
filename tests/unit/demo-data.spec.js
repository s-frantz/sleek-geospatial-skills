/**
 * Rung 2: the demo data is valid GeoJSON.
 *
 * This exists because it was not. The district polygons shipped as jittered rectangles whose
 * CLOSING vertex had been jittered too, so no ring's last position equalled its first: every
 * feature violated RFC 7946 section 3.1.6, and the renderer papered over it by closing the
 * rings itself. What a reader saw was a map of subtly wrong shapes with no error anywhere.
 *
 * Geometry that only ever reaches a forgiving renderer is geometry nobody has checked. These
 * assertions are the check, and they are cheap enough to run on every build.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** @param {string} name @returns {any} */
const load = (name) =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../app/data/${name}`, import.meta.url)), 'utf8'));

/** Planar shoelace. Sign is the winding: positive is counterclockwise. @param {number[][]} ring */
const signedArea = (ring) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return a / 2;
};

/** Every ring in a polygon or multipolygon, tagged with whether it is the exterior one. */
const ringsOf = (geometry) => {
    const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polys.flatMap((rings) => rings.map((ring, i) => ({ ring, exterior: i === 0 })));
};

describe.each(['neighborhoods.geojson', 'stations.geojson'])('%s', (name) => {
    const fc = load(name);

    it('is a FeatureCollection of features with geometry', () => {
        expect(fc.type).toBe('FeatureCollection');
        expect(fc.features.length).toBeGreaterThan(0);
        for (const f of fc.features) {
            expect(f.type).toBe('Feature');
            expect(f.geometry).toBeTruthy();
            expect(f.properties).toBeTruthy();
        }
    });

    it('carries coordinates in range, longitude first', () => {
        for (const f of fc.features) {
            const flat = (JSON.stringify(f.geometry.coordinates).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
            for (let i = 0; i < flat.length; i += 2) {
                expect(Math.abs(flat[i])).toBeLessThanOrEqual(180);
                expect(Math.abs(flat[i + 1])).toBeLessThanOrEqual(90);
            }
        }
    });

    it('gives every feature a unique id', () => {
        const ids = fc.features.map((f) => f.properties.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('neighborhoods.geojson polygons', () => {
    const fc = load('neighborhoods.geojson');

    // RFC 7946 3.1.6: "the first and last positions are equivalent, and they MUST contain
    // identical values; their representation SHOULD also be identical". The bug this catches
    // rendered fine and was wrong anyway.
    it('closes every ring exactly', () => {
        for (const f of fc.features) {
            for (const { ring } of ringsOf(f.geometry)) {
                const first = ring[0];
                const last = ring[ring.length - 1];
                expect(last, `${f.properties.name} ring is not closed`).toEqual(first);
            }
        }
    });

    it('gives every ring at least four positions', () => {
        for (const f of fc.features) {
            for (const { ring } of ringsOf(f.geometry)) {
                expect(ring.length, `${f.properties.name} ring is degenerate`).toBeGreaterThanOrEqual(4);
            }
        }
    });

    // RFC 7946 3.1.6 again: exterior rings counterclockwise, holes clockwise. MapLibre does
    // not care, but anything doing real geometry on the file does, and a mixed-winding file
    // is the kind of thing that works until it meets a library that reads the right-hand rule.
    it('winds exterior rings counterclockwise and holes clockwise', () => {
        for (const f of fc.features) {
            for (const { ring, exterior } of ringsOf(f.geometry)) {
                const ccw = signedArea(ring) > 0;
                expect(ccw, `${f.properties.name} ${exterior ? 'exterior' : 'hole'} winds the wrong way`)
                    .toBe(exterior);
            }
        }
    });

    it('encloses a real area, so every feature can be zoomed to', () => {
        for (const f of fc.features) {
            expect(f.properties.area_km2, `${f.properties.name} has no area`).toBeGreaterThan(0);
        }
    });
});
