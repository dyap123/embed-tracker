# EmbedYap — DEVLOG

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
