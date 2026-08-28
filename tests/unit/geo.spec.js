/**
 * Rung 2: bounding boxes. Small, but it is the input to every camera move in the app, so a
 * quiet mistake here shows up as "zoom to does nothing" rather than as an error.
 */

import { describe, it, expect } from 'vitest';
import { bboxOf, isDegenerate } from '../../app/js/utils/geo.js';

const point = { type: 'Point', coordinates: [-122.6, 45.5] };
const polygon = {
    type: 'Polygon',
    coordinates: [[[-122.7, 45.4], [-122.5, 45.4], [-122.5, 45.6], [-122.7, 45.6], [-122.7, 45.4]]],
};

describe('bboxOf', () => {
    it('bounds a bare geometry', () => {
        expect(bboxOf(polygon)).toEqual([-122.7, 45.4, -122.5, 45.6]);
    });

    it('bounds a feature', () => {
        expect(bboxOf({ type: 'Feature', properties: {}, geometry: polygon }))
            .toEqual([-122.7, 45.4, -122.5, 45.6]);
    });

    it('bounds a collection across all of its members', () => {
        const fc = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: {}, geometry: point },
                { type: 'Feature', properties: {}, geometry: polygon },
            ],
        };
        expect(bboxOf(fc)).toEqual([-122.7, 45.4, -122.5, 45.6]);
    });

    it('returns null rather than an infinite box when there is nothing to bound', () => {
        expect(bboxOf({ type: 'FeatureCollection', features: [] })).toBeNull();
        expect(bboxOf(null)).toBeNull();
    });

    it('handles a MultiPolygon, which is one nesting level deeper', () => {
        const mp = { type: 'MultiPolygon', coordinates: [polygon.coordinates, [[[0, 0], [1, 0], [1, 1], [0, 0]]]] };
        expect(bboxOf(mp)).toEqual([-122.7, 0, 1, 45.6]);
    });
});

describe('isDegenerate', () => {
    it('recognises a single point, which needs easeTo rather than fitBounds', () => {
        expect(isDegenerate(/** @type {any} */ (bboxOf(point)))).toBe(true);
        expect(isDegenerate(/** @type {any} */ (bboxOf(polygon)))).toBe(false);
    });
});
