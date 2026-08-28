/**
 * settings-control.js — the gear, and where it belongs.
 *
 * Settings are application-level, not layer-level, so the gear sits with the other app chrome
 * in the control stack rather than in the panel's head. The panel's head is about the panel's
 * contents; putting an app-wide control there implies its scope is the panel, and someone will
 * eventually file a bug saying the theme toggle "only changes the layer list".
 *
 * The button is nothing but a spec. Everything about how it is built, sized and coloured
 * belongs to control-stack.js, so a second custom control cannot drift from this one.
 */

import { makeControl } from './control-stack.js';
import { toggleQuickSettings } from './quick-settings.js';

/** @returns {ReturnType<typeof makeControl>} */
export function settingsControl() {
    return makeControl([{
        glyph: 'gear',
        title: 'Settings',
        onClick: (btn) => toggleQuickSettings(btn),
    }]);
}
