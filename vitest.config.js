import { defineConfig } from 'vitest/config';

/**
 * Rung 2: the decisions that are arithmetic, tested as arithmetic. No browser, no server, no
 * fixtures. If a piece of logic needs a running page to test, that is usually a sign it is
 * reading the document when it could have been handed the numbers.
 */
export default defineConfig({
    test: {
        include: ['tests/unit/**/*.spec.js'],
        environment: 'node',
    },
});
