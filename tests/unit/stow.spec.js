/**
 * Rung 2: the chevron's cycle, as arithmetic.
 *
 * One chevron, four views, and one owner for the order they come in. The panel and the table
 * used to fold with two different mechanisms, and the second copy of anything is where the
 * two orders start to differ. nextFoldMode() is that one owner, so it is tested here once.
 */

import { describe, it, expect } from 'vitest';
import { nextFoldMode } from '../../app/js/ui/stow.js';

const BOTH = { tight: true, snug: true };

describe('nextFoldMode', () => {
    it('steps natural, tight, header, snug, and round to natural again', () => {
        expect(nextFoldMode('natural', BOTH)).toBe('tight');
        expect(nextFoldMode('tight', BOTH)).toBe('header');
        expect(nextFoldMode('header', BOTH)).toBe('snug');
        expect(nextFoldMode('snug', BOTH)).toBe('natural');
    });

    it('skips tight only when the rows could not all fit on screen', () => {
        expect(nextFoldMode('natural', { tight: false, snug: true })).toBe('header');
    });

    it('skips snug when there is no width to take in, since it would be tight again', () => {
        expect(nextFoldMode('header', { tight: true, snug: false })).toBe('natural');
    });

    it('with neither fitted view on offer, it is a plain fold and unfold', () => {
        const none = { tight: false, snug: false };
        expect(nextFoldMode('natural', none)).toBe('header');
        expect(nextFoldMode('header', none)).toBe('natural');
    });
});
