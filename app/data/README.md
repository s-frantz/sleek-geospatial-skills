# Demo data

## neighborhoods.geojson

Portland, Oregon neighborhood boundaries. Real data, not invented.

- **Source:** City of Portland, PortlandMaps Open Data, `Public/Boundaries/MapServer` layer 1
  ("Portland Neighborhoods"), via the ArcGIS REST query endpoint.
- **Licence:** Open Data Commons Public Domain Dedication and License (PDDL) v1.0, per the
  [City of Portland Terms of Use for Open Data](https://www.portlandmaps.com/bps/arpa/tos.pdf).
  A public domain dedication: no attribution requirement and no share-alike, which is what
  makes it safe to carry inside an MIT repo that gets copied wholesale into other people's
  applications. Data under a share-alike licence, ODbL in particular, would push an obligation
  onto every app scaffolded from here, and is the reason this is not OpenStreetMap-derived.
- **Retrieved:** 2026-09-01.

Four things were done to it, all of them reversible from the source:

1. **Generalised** to a 0.0005 degree tolerance, about 55m, server-side. The full-resolution
   file is roughly twice the size for detail that is under a pixel at the zoom this demo opens
   at, and it holds up when you zoom to a single feature.
2. **Filtered** to the 94 plain neighborhoods. The source layer also carries 25
   shared-jurisdiction rows naming two associations (`ALAMEDA/IRVINGTON`) and 6 `MC UNCLAIMED`
   county fragments; both render as slivers, and two of them generalise to zero area, which
   would put a feature in the demo that cannot be zoomed to.
3. **Cut to eight adjacent inner neighborhoods** on both sides of the river: Boise, Buckman,
   Eliot, Irvington, Kerns, Lloyd, Sabin and Sullivan's Gulch. The city has 94 and the demo
   read like a dataset rather than an example — a layer list nobody scrolls, a table nobody
   reads to the bottom, and 50KB of coordinates in a repo whose whole argument is that every
   file in it teaches something. Eight is enough to demonstrate a fill, a hover, a zoom-to, a
   sortable-looking table and a legend, and few enough that a reader can hold the whole demo
   in their head while reading the code that draws it. It also keeps the two layers in one
   extent, so the map opens with everything visible and nothing has to be hunted for.
4. **Given derived fields.** `area_km2` and `perimeter_km` are computed from the geometry
   itself, so the table has honest numeric columns to format and the field-type badges have
   something other than strings to describe. `coalition` is the source `COALIT` code expanded
   to its name.

`scripts/` does not carry the conversion: it ran once, and a build step for a file that
changes when a city redraws a boundary would be a step that never runs.

## stations.geojson

Invented. Six points scattered over the same eight-neighborhood extent, carrying one field of
each type the table and the popups have to render: two strings, a categorical string driving
the symbology, a number, and a boolean. Nothing about them is a claim, and the count is chosen
the same way the neighborhood count is — enough to show the behaviour, few enough to read.
