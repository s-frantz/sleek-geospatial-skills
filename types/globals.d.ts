// Ambient declarations for the vendored globals.
//
// The app has no build step and no bundler, so MapLibre arrives as a window global rather
// than an import. This file is what lets `tsc --noEmit` type-check the app anyway: it is a
// declaration of what the page provides, not a dependency the app loads.

declare const maplibregl: any;

interface Window {
    maplibregl: any;
    /** Test hook: the live map, exposed so Playwright specs can drive the camera. */
    sgsMap?: any;
}
