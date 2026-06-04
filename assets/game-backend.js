/* ====================================================================
   OEGame — backend for "Ironworker Run" (dodge-the-embeds arcade).
   Firebase-backed (window.fb, namespace embed-tracker/game/), but exposes
   the exact interface the design's Game.jsx expects:
     OEGame.submit(userOrName, score)  -> Promise({ ok, rank })
     OEGame.leaderboard()              -> Array [{ user, score, at }]  (SYNCHRONOUS)
   A live Firebase listener keeps a local cache so leaderboard() can be sync.

   Firebase shape (embed-tracker/game/):
     best/{uid}       -> number (race-safe via fb.max)
     best_meta/{uid}  -> { user(name), score, at }
     feed/{runId}     -> { user, score, at }  (recent runs, capped)
==================================================================== */
(function () {
  const G = 'game';
  const OBSTACLES = ['Anchor Rod', 'Knife Plate', 'Embed Post', 'Coupler', 'Stub Column'];
  const sane = (s) => String(s || '').replace(/[.#$\[\]\/]/g, '_').slice(0, 40) || 'guest';
  const nameOf = (u) => (typeof u === 'string' ? u : (u && u.name) || 'Guest');

  let cache = [];   // [{ _uid, user, score, at }] sorted desc — kept live by the listener
  function refresh(v) {
    cache = Object.entries(v || {}).map(([uid, m]) => ({
      _uid: uid, user: (m && (m.user || m.name)) || uid, score: (m && m.score) || 0, at: (m && m.at) || 0,
    })).sort((a, b) => b.score - a.score);
  }
  try { window.fb.listen(G + '/best_meta', refresh); } catch (e) { /* fb not ready */ }

  function submit(u, score) {
    const name = nameOf(u), uid = sane(name); score = Math.round(score || 0);
    window.fb.max(G + '/best/' + uid, score);
    return window.fb.get(G + '/best_meta/' + uid).then((m) => {
      const prev = (m && m.score) || 0, best = Math.max(prev, score);
      if (score >= prev) window.fb.set(G + '/best_meta/' + uid, { user: name, score: best, at: Date.now() });
      // recent-runs feed (capped to 40)
      const rid = 'r' + Math.random().toString(36).slice(2, 9);
      window.fb.set(G + '/feed/' + rid, { user: name, score, at: Date.now() });
      window.fb.get(G + '/feed').then((f) => { if (!f) return; const ks = Object.keys(f);
        if (ks.length > 40) ks.map((k) => [k, (f[k] && f[k].at) || 0]).sort((a, b) => a[1] - b[1]).slice(0, ks.length - 40).forEach(([k]) => window.fb.remove(G + '/feed/' + k)); });
      // optimistic local update so leaderboard() is fresh inside the .then()
      const i = cache.findIndex((r) => r._uid === uid);
      if (i >= 0) { if (best > cache[i].score) cache[i] = { _uid: uid, user: name, score: best, at: Date.now() }; }
      else cache.push({ _uid: uid, user: name, score: best, at: Date.now() });
      cache.sort((a, b) => b.score - a.score);
      return { ok: true, rank: cache.findIndex((r) => r._uid === uid) + 1 };
    });
  }
  function leaderboard() { return cache.slice(); }                 // SYNC — design calls it directly
  function listenLeaderboard(cb) { return window.fb.listen(G + '/best_meta', (v) => { refresh(v); cb(cache.slice()); }); }
  function listenFeed(cb) { return window.fb.listen(G + '/feed', (v) => cb(Object.values(v || {}).filter(Boolean).sort((a, b) => (b.at || 0) - (a.at || 0)))); }

  window.OEGame = { submit, leaderboard, listenLeaderboard, listenFeed, OBSTACLES };
})();
