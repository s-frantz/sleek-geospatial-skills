#!/usr/bin/env node
/**
 * sgs-clone.mjs — find a clone of sleek-geospatial-skills, from anywhere.
 *
 * WHY THIS EXISTS. An app copied out of this repo needs the clone for exactly two questions:
 * "did upstream change since my watermark?" (sgs:status) and "did I change since my
 * watermark?" (sgs:drift). Both are answered by reading release history — `git show
 * <tag>:<file>` — so both need a real .git, and neither needs the clone to be in any
 * particular place. Nothing else in an app touches the clone at all: it does not build, run,
 * test or ship through it.
 *
 * That makes the clone a TOOL CHECKOUT, not a dependency, and this module treats it as one.
 * The app never records a path to it (sgs.json stays purely a version pin), so the clone can
 * be moved, deleted and re-cloned at will, at whatever level of a monorepo suits — one at the
 * root serving twenty apps, or one per app, or one somewhere else entirely with SGS_CLONE
 * pointing at it. Delete it and every app still runs; you lose two answers until it is back.
 *
 * Search order, first hit wins:
 *   1. $SGS_CLONE                     an explicit path, for anything unusual
 *   2. this script's own repo         when running from inside the clone itself
 *   3. .sgs/ or sleek-geospatial-skills/ in the app dir or any ancestor of it
 *
 * A directory that looks like the clone but has no .git is a NEAR MISS, reported by name:
 * it answers neither question, and saying "not found" about a directory sitting right there
 * sends people looking in the wrong place.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory names a clone is conventionally given, in preference order. */
const CLONE_DIRS = ['.sgs', 'sleek-geospatial-skills'];

export const CLONE_URL = 'https://github.com/s-frantz/sleek-geospatial-skills';

/** @param {string} dir @returns {boolean} */
function looksLikeClone(dir) {
    return existsSync(path.join(dir, 'scripts', 'sgs-components.json'));
}

/**
 * Is `dir` ITSELF the root of a git repository? `rev-parse --git-dir` is not enough: it walks
 * UP, so a clone stripped of its .git and left sitting inside a monorepo answers yes and
 * borrows the monorepo's history. That was not hypothetical - it produced a drift run where
 * every component reported "watermark not in this clone" and the summary still said "No
 * drift". So compare the toplevel git reports against the directory asked about.
 * @param {string} dir @returns {boolean}
 */
function isGitRepo(dir) {
    try {
        const top = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], {
            encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
        return same(top, dir);
    } catch {
        return false;
    }
}

/**
 * @param {string} startDir the app (or any) directory to search from
 * @returns {{clone: string|null, nearMisses: string[]}}
 */
export function findClone(startDir) {
    /** @type {string[]} */
    const nearMisses = [];
    /** @param {string} dir @returns {string|null} */
    const accept = (dir) => {
        if (!looksLikeClone(dir)) return null;
        if (!isGitRepo(dir)) {
            if (!nearMisses.includes(dir)) nearMisses.push(dir);
            return null;
        }
        return dir;
    };

    const env = process.env.SGS_CLONE;
    if (env) {
        const dir = path.resolve(env);
        const hit = accept(dir);
        // An explicit pointer that misses is an error worth surfacing on its own: silently
        // falling through to a search would hide the typo behind a working answer.
        if (hit) return { clone: hit, nearMisses };
        if (!nearMisses.includes(dir)) nearMisses.push(dir);
        return { clone: null, nearMisses };
    }

    // Running from inside the clone (the maintainer's case, and sgs:init's).
    const own = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    const ownHit = accept(own);
    if (ownHit) return { clone: ownHit, nearMisses };

    let dir = path.resolve(startDir);
    for (;;) {
        for (const name of CLONE_DIRS) {
            const hit = accept(path.join(dir, name));
            if (hit) return { clone: hit, nearMisses };
        }
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    return { clone: null, nearMisses };
}

/**
 * Find the clone or exit 1 with something a person can act on. Every caller here needs git
 * history to say anything true, and a confident wrong answer is worse than no answer: this
 * generalises a lesson from before the first release (drift once reported EVERY file as new when it could not
 * read history).
 * @param {string} startDir @param {string} what the question being asked, for the message
 * @returns {string}
 */
export function requireClone(startDir, what) {
    const { clone, nearMisses } = findClone(startDir);
    if (clone) return clone;

    console.error(`Could not find a clone of sleek-geospatial-skills to read release history from.`);
    console.error('');
    for (const miss of nearMisses) {
        console.error(`  ${miss} looks like the clone but has no .git, so it cannot answer`);
        console.error(`  ${what}. A copied directory is not a clone.`);
        console.error('');
    }
    console.error('The clone is a tool checkout, not a dependency: your app runs, builds and');
    console.error('ships without it. It is only needed for sgs:status and sgs:drift. Put one');
    console.error('anywhere at or above this app, named .sgs or sleek-geospatial-skills:');
    console.error('');
    console.error(`    git clone ${CLONE_URL} .sgs`);
    console.error('');
    console.error('or point at an existing one:  SGS_CLONE=/path/to/clone npm run sgs:status');
    process.exit(1);
}
