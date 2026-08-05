#!/usr/bin/env node
/* Stamp dist/*.js script tags in index.html with a content hash.
 *
 * WHY THIS EXISTS: the tags were bare `src="dist/Inventory.js"`. GitHub Pages serves those
 * with a cache header, so a browser that had loaded the app before kept running the OLD
 * bundle after a deploy — the fix was live on the server and invisible in the field. It cost
 * a round of "you changed it and it still does the old thing", which is the worst kind of
 * bug because it makes correct work look broken.
 *
 * A content hash means the URL only changes when the FILE changes, so an unchanged bundle
 * still comes from cache and a changed one cannot. Runs as part of `npm run build`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const INDEX = path.join(ROOT, 'index.html');

let html = fs.readFileSync(INDEX, 'utf8');
let changed = 0;

// src="dist/Foo.js" or src="dist/Foo.js?v=abc123"
html = html.replace(/(\bsrc=")(dist\/[A-Za-z0-9_.-]+\.js)(?:\?v=[A-Za-z0-9]+)?(")/g,
  (m, pre, file, post) => {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) return m;             // leave anything we cannot verify alone
    const h = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
    changed++;
    return `${pre}${file}?v=${h}${post}`;
  });

fs.writeFileSync(INDEX, html);
console.log(`stamped ${changed} script tag(s) in index.html`);
