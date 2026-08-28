# Vendored third-party code

Self-hosted rather than pulled from a CDN: one origin, one fewer network dependency,
and nothing here can change under the app without a commit that says so.

| file | project | version | license |
|---|---|---|---|
| `maplibre-gl.js` | MapLibre GL JS | 5.24.0 | BSD-3-Clause |
| `maplibre-gl.css` | MapLibre GL JS | 5.24.0 | BSD-3-Clause |

See the `boot-order` skill for why these load with `defer` ahead of the module entry point.
