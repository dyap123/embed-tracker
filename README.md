# OpenEmbed — LACC Embed Install Tracker

Interactive plan-map tracker for structural embeds (anchor rods, knife plates, embed posts) on the LACC job. Sibling app to **OpenBreak** / **CUP** — shares the same Firebase project (`gen-lang-client-0119642855`), namespaced under `embed-tracker/`.

## What it does
- **Map** — the SME drawing maps (Anchor Bolt / Knife Plate) as zoom/pan backdrops with colour-coded **embed pins**. Filter by **Sequence (CUP, 1–4)** and **Area (A–D)**. Managers "+ Place" pins (pick embed + area, tap the drawing). Tap any pin to **check off Installed** (celebrate + a leaderboard point) or **attach an RFI** (number, status, description, Drive/URL links) + notes.
- **Dashboard** — KPIs + Chart.js: installs by area, expected-vs-installed by sequence, open RFIs, and a **Next Pour** widget that reads your CUP dashboard's live pour (shared Firebase root `active-pour`).
- **Inventory** — per-embed qty (takeoff) vs pinned vs installed vs remaining.
- **Crew** — roster + PIN sign-in, points **leaderboard**, and the **Embed Runner** (Dino) arcade game.

## Run locally
```bash
cd ~/embed-tracker
python3 -m http.server 8477
# → http://localhost:8477
```
No build step (React + Babel compile in the browser).

## Data model (Firebase RTDB, namespace `embed-tracker/`)
- `embeds/{id}` — master from the takeoff `{id, seq, desc, qty, bolts, len, plate}` (auto-seeded on first run from `SEED_EMBEDS` in `assets/App.jsx`).
- `pins/{key}` — placed embeds `{embedId, sequence, area, mapId, x, y (0–1), installed, status, installedBy, rfi:{number,title,status,desc,links[]}, notes}`.
- `users/{id}` — `{name, role:'manager'|'intern', points, dinoHi}`. Manager PIN: `050103`.

## Notes
- Maps are rendered from the PDFs in `~/Documents/Embeds` (`assets/maps/*.png`). Re-render with PyMuPDF if drawings change.
- Pins are linked to **takeoff embed IDs** and placed manually (the PDF piece marks differ from the sheet IDs).
- A few **`SAMPLE - delete`** pins are seeded for demo — managers can delete them from the pin popup.
- Deploy: GitHub Pages (`.nojekyll` present); push to a `dyap123/embed-tracker` repo and enable Pages.
- RFIs store links (no binary uploads). The Stitch/Claude design can re-skin the UI later — components are modular.
