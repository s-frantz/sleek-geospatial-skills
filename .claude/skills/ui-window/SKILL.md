---
name: ui-window
description: One modal shell for every large window - backdrop, draggable header, an optional rail of pages so one window holds several, and Escape closing only the topmost thing on screen via a single dismiss stack rather than a keydown handler per feature. Use when adding a modal, dialog, about box, welcome pane, settings sheet or multi-page window, or when Escape closes too much.
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
| RAIL | supplied by the shell when the window is given PAGES: the list down the left |
| FOOT | actions, right-aligned, **primary last** |

Primary last because the eye lands on the right end of a row of buttons.

## One window with pages, not several windows

```js
createOverlayWindow({
    title: 'Settings',
    pages: [
        { id: 'general', label: 'General', render: (pane) => { /* built on first visit */ } },
        { id: 'data',    label: 'Data',    render: (pane) => { /* ... */ } },
    ],
});
```

Given `pages`, the shell grows a rail down the left and `body` becomes the pane area. Given
none it behaves exactly as before, because a window holding one thing should not pay for a rail
listing one thing.

Four decisions in there, each of which is the answer to a mistake:

**A rail, not a tab strip.** Horizontal tabs run out of room at about five and start eliding,
which teaches readers that this window holds a few things. A column of labels grows to a dozen
without changing shape or implying a limit that is not real.

**The demo window has three pages and nothing to say on any of them.** That is deliberate. A
shell demonstrated with a single body teaches that a window holds one thing, so the next person
who needs two builds a second window, and the app grows a family of modals that each learned to
close themselves slightly differently. The shape is the lesson; the placeholder text says so out
loud.

**Pages are built once and kept.** Rebuilding on every switch is one line shorter and throws
away scroll position, a half-filled form and an expanded section every time the reader looks at
something else and comes back. What a page is doing is part of what the window IS, until the
window closes.

**The footer belongs to the window, not to a page.** Its actions are the window's actions.
Repeating them per page gives you three Close buttons that had better agree, and one day they
will not.

### The two accessibility details worth copying

- `role="tablist"` / `role="tab"` / `role="tabpanel"`, so a screen reader is told this is one
  region with several views rather than a list of links that happen to swap the content.
- **Only the selected tab is in the tab order** (`tabIndex = -1` on the rest), and arrow keys
  move within the rail. Leaving every tab tabbable is the common mistake and it turns one
  control into as many Tab stops as there are pages.

### The CSS trap

`.sgs-window-split` is a grid and carries `min-height: 0`. A grid item's default `min-height` is
`auto`, which refuses to shrink below its content — so without that line the pane's `overflow:
auto` silently does nothing and a long page pushes the window past its own `max-height`.

## Checklist

- [ ] Built with `createOverlayWindow`, not by hand.
- [ ] `role="dialog"`, `aria-modal`, and an accessible name.
- [ ] Registered on the dismiss stack, and unregistered on close.
- [ ] Backdrop click checks the target.
- [ ] Actions right-aligned, primary last, and in the WINDOW's footer rather than repeated per
      page.
- [ ] A window with more than one view uses `pages` rather than a second window.
- [ ] Tabs carry the tablist roles, only the selected one is tabbable, and arrows move between
      them.
- [ ] Any scrolling region inside a grid has `min-height: 0` on the item that contains it.
