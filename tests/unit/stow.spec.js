/**
 * Rung 2: the chevron's cycle, as arithmetic.
 *
 * One chevron, three views, and one owner for the order they come in. The panel and the table
 * used to fold with two different mechanisms, and the second copy of anything is where the
 * two orders start to differ. nextFoldMode() is that one owner, so it is tested here once.
 */

import { describe, it, expect } from 'vitest';
import { nextFoldMode } from '../../app/js/ui/stow.js';

describe('nextFoldMode', () => {
    it('steps natural, tight, header, and round to natural again', () => {
        expect(nextFoldMode('natural', true)).toBe('tight');
        expect(nextFoldMode('tight', true)).toBe('header');
        expect(nextFoldMode('header', true)).toBe('natural');
    });

    it('skips tight when fitting to the rows would change nothing', () => {
        // A press that changes nothing reads as a broken button, so the step is not offered.
        expect(nextFoldMode('natural', false)).toBe('header');
        expect(nextFoldMode('header', false)).toBe('natural');
    });

    it('never leaves the header for anything but natural', () => {
        // Unfolding is one press back to the section's own height, never to a fitted view.
        expect(nextFoldMode('header', true)).toBe('natural');
    });
});
