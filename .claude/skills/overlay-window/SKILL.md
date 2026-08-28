---
name: overlay-window
description: One modal shell for every large window - backdrop, draggable header, and Escape closing only the topmost thing on screen via a single dismiss stack rather than a keydown handler per feature. Use when adding a modal, dialog, about box, welcome pane or settings sheet, or when Escape closes too much.
---

# Overlay window

`app/js/ui/overlay-window.js` for the shell, `app/js/ui/dismiss-stack.js` for the key,
`app/js/ui/about-window.js` for a worked example.

## The shell

```js
const { body, close } = createOverlayWindow({ title: 'A large window', windowClass: 'sgs-window--wide' });
body.append(yourContent);
```

Dimmed backdrop, centred panel draggable by its header, close button, and three ways out: the
button, the backdrop, and Escape. The caller owns the body and nothing else.

Two details in the shell that are easy to omit and annoying to debug:

- **Backdrop click tests `e.target === overlay`, on `pointerdown`.** A sloppy drag that starts
  inside the panel and ends on the backdrop must not close the window.
- **`onRequestClose` exists for windows that should not simply vanish**: an exit animation, or
  unsaved state. Supply it and the shell asks rather than removes.

## Escape has ONE owner

This is the part worth taking even if you take nothing else.

Three things here want Escape: the popup, the overlay window, and the settings popover. Left to
themselves each adds its own `document` keydown, and then one Escape closes all three, because
**every listener on the same node runs regardless of what any of them does to the event**.
`stopPropagation` does not help: it stops other NODES, not siblings on the same one.

So Escape has an owner. Anything dismissible registers:

```js
const unregister = pushDismissible(() => close());
```

One listener at the top of the app calls the **last thing pushed**. That yields the behaviour
the app actually wants for free: the most recently opened thing is what Escape closes, and
everything underneath is left alone. `raiseDismissible` moves an existing entry to the top for
something raised rather than opened, such as a popup clicked to the front.

Always call the returned `unregister` when the thing closes by any other route, or the stack
keeps a handler for something no longer on screen.

**The general rule:** when two features want the same key, the answer is not a cleverer guard
in each of them. It is a stack, owned once.

## Layout slots for a large window

`about-window.js` demonstrates the shape most large windows converge on. They differ completely
in what they say and hardly at all in how they are shaped, so the shape is the reusable part:

| slot | for |
|---|---|
| HEAD | supplied by the shell: title, drag handle, close |
| LEDE | one wide paragraph: why this window exists |
| COLS | two columns collapsing to one; a grid, so the collapse is one line |
| ASIDE | bordered block for the secondary thing: a caveat, a link out |
| FOOT | actions, right-aligned, **primary last** |

Primary last because the eye lands on the right end of a row of buttons.

## Checklist

- [ ] Built with `createOverlayWindow`, not by hand.
- [ ] `role="dialog"`, `aria-modal`, and an accessible name.
- [ ] Registered on the dismiss stack, and unregistered on close.
- [ ] Backdrop click checks the target.
- [ ] Actions right-aligned, primary last.
