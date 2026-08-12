# EmbedYap — DEVLOG

## 2026-08-12 — RFI removed, replaced by a note (280A was unclickable)

**The bug:** adding an RFI to **280A** made the pin impossible to open, and the
crash took the panel down with it.

`Add RFI` seeded `{ number, status, description, links: [] }`. Firebase RTDB does
not store empty children — an empty array is equivalent to null, so the key was
dropped on write. It came back as `undefined`, and the panel's

```js
{embed.rfi.links.map((l,i)=> ... )}
```

threw `TypeError: Cannot read properties of undefined (reading 'map')` on every
render of that pin. Only one pin in the whole job (`Pz68e30t` / 280A) ever had an
RFI, which is why nothing else looked broken.

**The lesson:** never seed an empty array or empty object into RTDB and then read
it back as a structure. Round-trip it or guard the read. A flat scalar has nothing
to drop.

### What replaced it — Note
One plain string on the pin: `pins/<id>/note`. No nesting, no arrays.

- **Saved on blur**, not per keystroke — a re-render can't steal focus mid-sentence
  (same reason the stub-type input works this way; see the fcf5678 / 914e762 fixes).
- The textarea is **keyed on the stored value** (`key={'note:'+(embed.note||'')}`)
  so an external change — most importantly **Clear** — remounts it. Without the key
  it kept showing stale text that would get re-saved on the next blur.
- ⌘/Ctrl+Enter blurs to save.

Carried through everywhere RFI used to appear:

| Surface | Was | Now |
|---|---|---|
| Map pin, top-right ● | RFI status color | periwinkle dot when a note exists |
| Dashboard KPI | Open RFIs / needs answer | Notes / embeds flagged |
| Badge-in ticker | `N open RFIs` | `N notes` |
| CSV + Excel | `RFI`, `RFI Status` | `Note` |
| Summary sheet | Open RFIs | Notes |
| `kpis()` | `openRFI` | `noted` |
| Icon | `rfi` (speech bubble) | `note` (lined page) |

### 280A restored
Deleted `pins/Pz68e30t/rfi` only. Everything else survived untouched — position
(0.6696, 0.7626), knife plate, delivery `transit`, Sequence 2, Area A, `A·P2`.
Full 378-pin snapshot at `~/openyap-backups/embed-tracker-pins-2026-08-12.json`.

Verified end to end against the real database: opened 280A (the click that used to
crash), wrote a note, confirmed a flat string landed in RTDB, cleared it, no console
errors. Test data removed — 0 pins carry an rfi, 0 carry a note.

Shipped `8fb730c`, live.

## 2026-07-28 — Stub-column delivery tracked apart from the anchor bolt

**The bug:** delivery was a single per-pin status, so a pin whose anchor bolt was
marked delivered read **green** on the Delivery layer even when the stub column at
that location hadn't shown up. Two separate pieces, two separate trucks — one status
couldn't describe both.

### Data model
Pins gain three fields (additive; old pins read as `'none'`):
```
stubDelivery     'none' | 'transit' | 'delivered'
stubDeliveredAt  'YYYY-MM-DD'   (stamped on delivered, cleared otherwise)
stubDeliveredBy  crew name
```
Deliberately **not** implied by `installed` — unlike the bolt, where installed steel
is on site by definition. The stub column sets on the bolts *after* the pour, so
casting the anchor in says nothing about the column having landed.

### The rule (`app/data.jsx`)
- `stubDeliveryState(e)` — the stub's own status; `null` when there's no stub here.
- `siteDeliveryState(e)` — the **worst** of the bolt and (if present) its stub, ranked
  `delivered > transit > none`. Same three keys as `deliveryState`, so `DELIVERY[...]`
  lookups work unchanged. A delivered bolt whose stub is off site reads red.

`deliveryState()` is untouched — it still means the anchor bolt alone.

### Where it shows
- **Map** (`MapScreen.jsx`) — the Delivery layer paints `siteDeliveryState`; the stub ■
  marker at the pin's bottom-left carries its own delivery color on that layer; legend
  counts use the combined state (so they match the pins) plus an "SC not on site" row.
- **Pin detail** (`MapDetail.jsx`) — the Delivery card is now two rows, `DELIVERY ·
  ANCHOR BOLT` and `STUB COLUMN · <type>`, each 3-way. The stub row stays editable
  after install (see above). Card tint + header badge follow the combined state.
- **Multi-select** — when a selection contains stub pins, an orange `SC ×n` row
  (dashed buttons) sets stub delivery on just those, via `bulkSetStubDelivery` in
  `App.jsx`. A stub-column load lands as one drop, so bulk is the normal path.
- **Exports** (`exports.jsx`) — added `Stub Type`, `SC Delivery`, `SC Received`.

### Deliberately NOT changed
Inventory and Dashboard "delivered" counts still track **anchor bolts only**. Dropping
a bolt from the delivered count because its stub column is late would distort material
tracking. Only the map and its legend use the combined rule.

### Rollout notes
- Every stub pin reads **red** on the Delivery layer until its stub is marked — there's
  no historical data for it. Backfill with the `SC ×n` bulk row on a marquee selection.
- `dist/*.js` is browser-cached between visits (the `?v=Date.now()` bust was dropped for
  perf), so crew may need **Cmd+Shift+R** once. `index.html` itself is no-store.

### Testing without the auth gate
`main` is the deployed, open-Firebase config; `openyap-core-integration` adds the
sign-in gate. To exercise `dist/` against the live DB from either branch:
```bash
git show main:index.html > _test.html    # untracked; delete when done
python3 -m http.server 8777              # open http://localhost:8777/_test.html
```
⚠️ That points at the **live** RTDB — anything you toggle writes real data. For pure UI
work, render a component against a fake pin with a stubbed `updateEmbed` instead.

### Shipped
`ce5ef84` on `main` (GitHub Pages, live), merged into `openyap-core-integration` as
`ba3561a`. Revert with `git revert ce5ef84` — the new pin fields are additive and
harmless if left in the DB.

## 2026-06-26 — React → vanilla "nano" runtime (no framework, no build)

**What happened:** removed React entirely. The app now runs on `vendor/nano.js`,
a ~640-line in-house React-compatible runtime (zero deps, no CDN, no build step).
The existing precompiled component code runs on it **unchanged**.

### How it works
- `vendor/nano.js` defines `window.React` (`createElement`, `Fragment`, `memo`,
  `useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect`,
  `useLayoutEffect`) and `window.ReactDOM` (`createRoot`). It's a keyed DOM
  reconciler that reuses real nodes across renders, so `<canvas>` contexts and
  input focus/caret survive.
- `index.html` loads `vendor/nano.js` **in place of the two React UMD CDN
  scripts** (it's the first `<script>`, before the deferred component files, so
  `window.React` exists before any component runs). Everything else in
  `index.html` is unchanged: Firebase compat + the inline `window.fb` wrapper
  (namespace `embed-tracker/`, shared project `gen-lang-client-0119642855`),
  xlsx-js-style, jsPDF, `assets/game-backend.js`, then `dist/*.js` + `dist/main.js`.
- The components in `dist/*.js` are the **same Babel-compiled output** as before
  (`React.createElement(...)` form). nano's `createElement` has the identical
  signature, so they just work. App-wide React API surface is exactly: createElement,
  Fragment, memo, useState, useRef, useEffect, useMemo, useLayoutEffect, createRoot —
  all implemented.

### How to run (no build needed)
```bash
cd ~/embed-tracker
python3 -m http.server 8488 --bind 127.0.0.1 --directory ~/embed-tracker
# open http://localhost:8488   (sign-in manager PIN: 050103)
```
Live site (GitHub Pages, served from `main` root, `.nojekyll`, no Actions):
https://dyap123.github.io/embed-tracker/

### How to edit
Two interchangeable paths — both produce nano-compatible code:
- **Direct (no build):** edit `dist/*.js` (createElement form) and refresh.
- **JSX (optional build):** edit `app/*.jsx`, run `npm run build` (Babel → `dist/`).
  Still works because Babel's classic-runtime output targets `React.createElement`,
  which nano provides.
(If we ever do the purist cleanup: rename `dist/`→`src/`, delete `app/*.jsx` +
Babel, optionally add `htm` for JSX-like templates without a build.)

### Tests
```bash
node vendor/nano.test.js     # 56 runtime assertions (style px, keyed reconcile,
                             # controlled-input focus, onChange mapping, SVG ns,
                             # effects, memo, refs, fragments, focus regressions)
```
Offline integration tests (load real components on nano in a fake DOM, render the
full signed-in app with the snapshot, navigate every screen) lived in the session
scratchpad — re-creatable from `vendor/nano.test.js` patterns if needed.

### Two focus bugs found & fixed during rollout (both have regression tests)
1. **Stale positional keys** — `flatten()` dropped null/false children before
   indexing, so a `{cond && <x/>}` sibling toggling shifted following elements and
   remounted inputs. Fix: React-style implicit keys (null slots still consume an index).
2. **Sibling-component re-render moved a focused node** — a component renders its DOM
   as a *slice* of a shared parent (e.g. SignIn's `Icon` svg beside the PIN input);
   on re-render its reconcile assumed it was last (anchor=null) and shoved its node to
   the end, so the outer pass moved the focused input to fix order → blur. Fix: thread
   a DOM `anchor` through patch/renderInst/reconcileChildren; `placeBefore()` only
   moves genuinely-misplaced nodes.

### Data
Full Firebase RTDB snapshot saved at `backups/embed-tracker-2026-06-26.json`
(376 pins, 107 types, 21 zones, 9 crew, grid, seqMeta, game). Re-pull anytime:
```bash
curl -s 'https://gen-lang-client-0119642855-default-rtdb.firebaseio.com/embed-tracker.json' -o backups/embed-tracker-$(date +%Y-%m-%d).json
```
The app still reads/writes the same live shared Firebase — no data migration.

### ⚠️ HOW TO RESTORE THE OLD REACT VERSION
The pre-migration React build is permanently pinned by the tag
**`backup-react-2026-06-26`** (commit `4c51284`). The vanilla work was developed on
branch `vanilla-port` and fast-forward-merged to `main`.

- Inspect the old version:  `git checkout backup-react-2026-06-26`
- **Revert the live site to React:**
  ```bash
  git reset --hard backup-react-2026-06-26
  git push --force origin main
  ```
  (GitHub Pages redeploys in ~1 min.)
- The migration touched only 4 files (`vendor/nano.js`, `vendor/nano.test.js`,
  `index.html`, `backups/…json`) and **no component code**, so a surgical revert is
  also possible: restore `index.html`'s two React CDN `<script>` tags and delete
  `vendor/nano.js`.

### Open follow-ups (optional, not required for it to work)
- Purist cleanup: `dist/`→`src/`, drop Babel + `app/*.jsx`, optional `htm`.
- Lock down Firebase security rules — the DB is currently open/unauthenticated
  (anyone with the URL can read all data, incl. crew PINs). Pre-existing condition.
