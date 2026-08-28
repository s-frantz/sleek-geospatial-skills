---
name: boot-order
description: Get a no-build-step MapLibre app to start in the right order - vendored globals with defer, a module entry point that cannot race them, and why the vendor files are self-hosted. Use when setting up index.html, adding a third-party library, or debugging "X is not defined" at startup.
---

# Boot order

A MapLibre app with no bundler has exactly one ordering problem, and it is solved by two
attributes in `app/index.html`.

## The rule

```html
<script defer src="vendor/maplibre-gl.js"></script>
<script type="module" src="js/main.js"></script>
```

A classic script with `defer` runs after the document parses, in document order. A
`type="module"` script is **always deferred**, and modules execute after deferred classic
scripts. So by the time `main.js` runs, `maplibregl` exists. No load event, no polling, no
`DOMContentLoaded` wrapper, no bundler.

Get this wrong and the symptom is `maplibregl is not defined`, intermittently, usually only on
a fast connection or only on a slow one.

## What NOT to do about it

- Do not wrap the app in `window.addEventListener('load', ...)`. It works, and it costs you the
  ability to `await` at module top level, which is where configuration loading belongs.
- Do not poll for the global.
- Do not move the vendor script into the module with a dynamic `import()`. UMD bundles that
  assign to `window` do not always survive that.

## The one thing that must go before both

Theme restoration. It is an inline blocking script in `<head>`, and it has to be blocking,
because anything deferred runs after first paint and the reader sees a flash. See
`theme-tokens`.

## Self-hosting

`app/vendor/` holds pinned copies rather than CDN links. Three reasons, in order of how often
they matter:

1. **One origin.** No third-party DNS, no third-party TLS, nothing to be slow or down.
2. **Nothing changes without a commit.** A CDN version range can move under you; a file in the
   repo cannot.
3. **Supply chain.** What you reviewed is what ships.

`app/vendor/README.md` records the project, version and licence of everything in there. Update
it in the same commit as the file, or it stops being true.

## Checklist for adding a library

- [ ] Copy the built file into `app/vendor/`, pinned to a version.
- [ ] Add a row to `app/vendor/README.md`: project, version, licence.
- [ ] Add `<script defer src="vendor/...">` BEFORE the module entry point.
- [ ] Declare the global in `types/globals.d.ts`, or `tsc --noEmit` will not know it exists.
