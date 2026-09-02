---
name: ui-theme
description: Light, dark and system themes with no flash of the wrong colours - three states not two, the blocking pre-paint restore, and a token palette defined on bare :root. Use when adding colours, adding a theme toggle, or fixing a white flash on load.
---

# Theme tokens

## Three states, not two

`light`, `dark`, and **system**. System is the important one and it is easy to get wrong:

| state | root attribute | what decides |
|---|---|---|
| light | `data-theme="light"` | the reader chose |
| dark | `data-theme="dark"` | the reader chose |
| system | *no attribute* | `prefers-color-scheme` |

System is the ABSENCE of the attribute. Writing `data-theme="system"` gives you a fourth thing
every rule has to handle and buys nothing: the absence already says it. See `app/js/ui/theme.js`.

The consequence for CSS is a specific three-block shape, in `app/css/tokens.css`:

```css
:root { --sgs-bg: #fff; /* every token, always */ }

@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --sgs-bg: #171a20; }
}

:root[data-theme="dark"] { --sgs-bg: #171a20; }
```

The `:not([data-theme="light"])` guard is what lets an explicit light choice beat a dark
operating system. Without it the toggle appears to work in one direction only, which is
reported as "dark mode is stuck".

## Never define a colour only inside a media query

Every token gets a value on bare `:root`. The dark blocks only REDEFINE. A colour whose sole
definition lives inside `@media (prefers-color-scheme: dark)` is missing in one of the three
states, and you will find out from a screenshot rather than from a test.

## The flash

Restoring the theme from a module is too late: modules are deferred, so the page has already
painted. The restore is an inline blocking script in `<head>`, before the stylesheet:

```html
<script>
    try {
        var stored = localStorage.getItem('sgs-theme');
        if (stored === 'light' || stored === 'dark') {
            document.documentElement.setAttribute('data-theme', stored);
        }
    } catch (e) { /* private mode: system theme is a fine answer */ }
</script>
```

The `try` matters. `localStorage` does not merely return null in some privacy modes, it
throws, and an unguarded throw here means the page never renders at all.

## Adding a colour

- [ ] Define it on bare `:root` first.
- [ ] Redefine it in BOTH dark blocks, or in neither.
- [ ] Use `var(--sgs-...)` at the point of use. No literal colours outside the token block.
- [ ] Check both themes. `getTheme()` / `setTheme()` from `app/js/ui/theme.js`, or the gear.
