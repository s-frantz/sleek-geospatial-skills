/**
 * One word per thing, the same in the code as on screen: the section across the bottom is the
 * TABLE, a section is DOCKED or UNDOCKED, and a closed one leaves a MARK (VOCABULARY.md).
 *
 * The code used to carry five words for the two positions (berthed, pinned, docked; floating,
 * loose) and called the table "the dock" while its own button said "Dock the table". Nothing
 * broke because of it, which is why it grew: every comment that borrowed a stray word was
 * locally readable. This reads the source so the retired words cannot come back one at a time.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} dir @param {RegExp} want @returns {string[]} */
function files(dir, want) {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? files(p, want) : want.test(p) ? [p] : [];
    });
}

const SOURCES = [
    ...files('app/js', /\.js$/),
    ...files('app/css', /\.css$/),
    'app/index.html',
    ...files('.claude/skills', /SKILL\.md$/),
    'README.md',
    'VOCABULARY.md',
    'CONTRIBUTING.md',
];

/** @type {Array<[RegExp, string]>} */
const RETIRED = [
    [/berth/i, 'say docked, or name the edge'],
    [/sliver/i, 'say mark'],
    [/\bloose\b/i, 'say undocked'],
    [/\bfloat(s|ed|ing)?\b/i, 'say undocked'],
    [/\bun-?pin/i, 'say undock'],
    [/sgs-dock|dock\.js/, 'the table is the table'],
    [/\bthe dock\b(?! (button|point))/i, 'the table is the table'],
];

/**
 * Lines allowed to keep an old word, each for a reason: a field type named `float` is a number,
 * not a position, and `panelPosture` is a stored value from before, read once and never written.
 * @param {string} file @param {string} line
 */
const excused = (file, line) => /field-badge/.test(file) || /panelPosture/.test(line);

describe('the furniture vocabulary', () => {
    for (const [word, instead] of RETIRED) {
        it(`never says ${word}: ${instead}`, () => {
            const hits = [];
            for (const f of SOURCES) {
                readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
                    if (word.test(line) && !excused(f, line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
                });
            }
            expect(hits).toEqual([]);
        });
    }
});
