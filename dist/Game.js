/* EmbedYap — "Ironworker Run": side-scrolling endless runner.
   Run the beam, jump/duck embeds & gaps. Score = feet walked.
   Persistence via window.OEGame.submit(user, score) + live leaderboard. */

// ---- backend stub (a real window.OEGame.submit drops in unchanged) ----
if (!window.OEGame) {
  const KEY = 'oegame_runs_v1';
  const seed = [{
    user: 'Marcus Vela',
    score: 1840
  }, {
    user: 'Dre Okafor',
    score: 1620
  }, {
    user: 'Sal Petrakis',
    score: 1390
  }, {
    user: 'Tomás Reyes',
    score: 1170
  }, {
    user: 'Janelle Ford',
    score: 980
  }, {
    user: 'Bo Whitfield',
    score: 760
  }];
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || seed;
    } catch (e) {
      return seed;
    }
  }
  window.OEGame = {
    submit(user, score) {
      const runs = load();
      runs.push({
        user,
        score,
        at: Date.now()
      });
      runs.sort((a, b) => b.score - a.score);
      localStorage.setItem(KEY, JSON.stringify(runs.slice(0, 50)));
      return Promise.resolve({
        ok: true,
        rank: runs.findIndex(r => r.score <= score) + 1
      });
    },
    leaderboard() {
      return load().slice().sort((a, b) => b.score - a.score);
    }
  };
}
const OBSTACLES = [{
  kind: 'low',
  label: 'Anchor rod',
  draw: 'rod'
}, {
  kind: 'low',
  label: 'Coupler',
  draw: 'coupler'
}, {
  kind: 'low',
  label: 'Stub column',
  draw: 'stub'
}, {
  kind: 'high',
  label: 'Knife plate',
  draw: 'knife'
}, {
  kind: 'high',
  label: 'Embed post',
  draw: 'post'
}, {
  kind: 'gap',
  label: 'Beam gap',
  draw: 'gap'
}];
function Game({
  user,
  isPhone
}) {
  const cvs = React.useRef(null);
  const wrapRef = React.useRef(null);
  const scoreRef = React.useRef(null);
  const eng = React.useRef(null);
  const [status, setStatus] = React.useState('ready'); // ready|run|over
  const [finalScore, setFinalScore] = React.useState(0);
  const [board, setBoard] = React.useState(() => window.OEGame.leaderboard());
  const [myRank, setMyRank] = React.useState(null);
  const statusRef = React.useRef(status);
  statusRef.current = status;

  // resize canvas (handled per-frame in the loop via fit(); this is a fallback)
  React.useEffect(() => {
    const c = cvs.current,
      wrap = wrapRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      if (eng.current) eng.current.fit && eng.current.fit();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // engine
  React.useEffect(() => {
    const c = cvs.current;
    const ctx = c.getContext('2d');
    const rect = wrapRef.current.getBoundingClientRect();
    const E = {
      W: rect.width,
      H: rect.height,
      raf: 0,
      last: 0,
      groundFrac: 0.78,
      speed: 300,
      baseSpeed: 300,
      score: 0,
      t: 0,
      player: {
        y: 0,
        vy: 0,
        duck: false,
        onGround: true
      },
      obs: [],
      sparks: [],
      spawnX: 600,
      run: 0,
      reset() {
        this.speed = this.baseSpeed;
        this.score = 0;
        this.t = 0;
        this.obs = [];
        this.sparks = [];
        this.spawnX = this.W + 200;
        this.player = {
          y: 0,
          vy: 0,
          duck: false,
          onGround: true
        };
      },
      groundY() {
        return this.H * this.groundFrac;
      },
      jump() {
        if (this.player.onGround && statusRef.current === 'run') {
          this.player.vy = -Math.min(640, 520 + this.speed * 0.18);
          this.player.onGround = false;
        }
      },
      setDuck(d) {
        this.player.duck = d;
      },
      spawn() {
        const last = this.obs[this.obs.length - 1];
        const gapMin = 240 + this.speed * 0.42 + Math.random() * 120;
        if (!last || this.W - last.x > gapMin || last.x < this.W - 60) {
          if (last && last.x > this.W - 40) return;
          const o = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
          const base = {
            ...o,
            x: this.W + 40,
            scored: false,
            near: false
          };
          if (o.kind === 'low') {
            base.w = 22 + Math.random() * 16;
            base.h = 30 + Math.random() * 22;
          } else if (o.kind === 'high') {
            base.w = 46;
            base.h = 26;
            base.float = 64 + Math.random() * 10;
          } else {
            base.w = 70 + Math.random() * 46;
            base.h = 0;
          }
          this.obs.push(base);
        }
      },
      step(dt) {
        this.t += dt;
        this.speed = this.baseSpeed + Math.min(360, this.score * 0.06);
        this.score += this.speed * dt * 0.1; // feet
        // player physics
        const p = this.player,
          gy = this.groundY();
        p.vy += 1900 * dt;
        p.y += p.vy * dt;
        if (p.y >= 0) {
          p.y = 0;
          p.vy = 0;
          p.onGround = true;
        }
        // spawn
        if (this.obs.length === 0 || this.W - this.obs[this.obs.length - 1].x > 250 + this.speed * 0.4) this.spawn();
        // move + collide
        const ph = p.duck ? 26 : 46,
          pw = 30,
          px = this.W * 0.16;
        const pTop = gy - (p.duck ? 26 : 46) + p.y;
        for (const o of this.obs) {
          o.x -= this.speed * dt;
          // near-miss spark
          if (!o.scored && o.x + o.w < px) {
            o.scored = true;
            this.score += 8;
          }
          // collision
          if (o.kind === 'gap') {
            if (px + pw > o.x && px < o.x + o.w && p.onGround && p.y > -4) {
              this.die();
            }
          } else {
            const oy = o.kind === 'high' ? gy - o.float - o.h : gy - o.h;
            const ob = o.kind === 'high' ? gy - o.float : gy;
            if (px + pw > o.x && px < o.x + o.w && pTop < ob && pTop + ph > oy) {
              this.die();
            }
            // near miss sparks
            if (Math.abs(o.x + o.w / 2 - (px + pw / 2)) < 26 && !o.near) {
              const close = o.kind === 'high' ? pTop < oy + 18 : pTop + ph > oy - 16;
              if (close) {
                o.near = true;
                this.emitSparks(px + pw, pTop + ph / 2);
              }
            }
          }
        }
        this.obs = this.obs.filter(o => o.x + o.w > -20);
        // sparks
        for (const s of this.sparks) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vy += 900 * dt;
          s.life -= dt;
        }
        this.sparks = this.sparks.filter(s => s.life > 0);
        this.run += this.speed * dt * 0.02;
      },
      emitSparks(x, y) {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
          const sp = 120 + Math.random() * 260;
          this.sparks.push({
            x,
            y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0.4 + Math.random() * 0.3
          });
        }
      },
      die() {
        if (statusRef.current !== 'run') return;
        this.endNow();
      },
      endNow: null,
      fit() {
        const r = c.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(r.width)),
          h = Math.max(1, Math.round(r.height));
        if (c.width !== w * dpr || c.height !== h * dpr) {
          c.width = w * dpr;
          c.height = h * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        this.W = w;
        this.H = h;
      },
      draw() {
        drawScene(ctx, this);
      }
    };
    eng.current = E;
    E.fit();
    E.reset();
    E.draw();
    function loop(ts) {
      if (!E.last) E.last = ts;
      let dt = (ts - E.last) / 1000;
      E.last = ts;
      dt = Math.min(0.05, dt);
      E.fit();
      if (statusRef.current === 'run') {
        E.step(dt);
        if (scoreRef.current) scoreRef.current.textContent = Math.floor(E.score) + ' ft';
      }
      E.draw();
      E.raf = requestAnimationFrame(loop);
    }
    E.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(E.raf);
  }, []);
  function start() {
    const E = eng.current;
    E.reset();
    E.last = 0;
    setStatus('run');
    statusRef.current = 'run';
  }
  function end() {
    const E = eng.current;
    const sc = Math.floor(E.score);
    setFinalScore(sc);
    setStatus('over');
    statusRef.current = 'over';
    window.OEGame.submit(user?.name || 'Guest', sc).then(res => {
      setBoard(window.OEGame.leaderboard());
      setMyRank(res.rank);
    });
  }
  React.useEffect(() => {
    if (eng.current) eng.current.endNow = end;
  });

  // input
  React.useEffect(() => {
    function kd(e) {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (statusRef.current === 'run') eng.current.jump();else start();
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        eng.current.setDuck(true);
      }
    }
    function ku(e) {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') eng.current.setDuck(false);
    }
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: wrapRef,
    style: {
      position: 'relative',
      flex: 1,
      minHeight: isPhone ? 240 : 320,
      borderRadius: T.radius.lg,
      overflow: 'hidden',
      border: '1px solid ' + T.color.line,
      background: '#0A0E15',
      boxShadow: T.shadow.card,
      touchAction: 'none',
      userSelect: 'none'
    },
    onPointerDown: e => {
      const r = e.currentTarget.getBoundingClientRect();
      const lower = e.clientY - r.top > r.height * 0.62;
      if (statusRef.current !== 'run') {
        start();
        return;
      }
      if (lower) {
        eng.current.setDuck(true);
      } else {
        eng.current.jump();
      }
    },
    onPointerUp: () => eng.current.setDuck(false),
    onPointerLeave: () => eng.current.setDuck(false)
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: cvs,
    style: {
      display: 'block',
      width: '100%',
      height: '100%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      left: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "hardhat",
    size: 18,
    style: {
      color: T.color.amber
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      fontSize: 15
    }
  }, "Ironworker Run")), /*#__PURE__*/React.createElement("div", {
    ref: scoreRef,
    style: {
      position: 'absolute',
      top: 12,
      right: 16,
      fontFamily: T.font.mono,
      fontWeight: 700,
      fontSize: 20,
      color: T.color.amberHot
    }
  }, "0 ft"), status === 'ready' && /*#__PURE__*/React.createElement(Overlay, null, /*#__PURE__*/React.createElement(Icon, {
    name: "hardhat",
    size: 40,
    style: {
      color: T.color.amber
    }
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 30,
      margin: '10px 0 4px',
      textTransform: 'uppercase'
    }
  }, "Walk the beam"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: T.color.steel300,
      fontSize: 14,
      margin: 0,
      maxWidth: 360,
      textAlign: 'center'
    }
  }, "Dodge embeds & beam gaps. ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#fff'
    }
  }, isPhone ? 'Tap top' : 'Space / ↑'), " to jump, ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#fff'
    }
  }, isPhone ? 'hold bottom' : '↓'), " to duck."), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    size: "lg",
    icon: "power",
    style: {
      marginTop: 18
    },
    onClick: start
  }, "Start run")), status === 'over' && /*#__PURE__*/React.createElement(GameOver, {
    score: finalScore,
    board: board,
    rank: myRank,
    user: user,
    onRetry: start,
    isPhone: isPhone
  })), isPhone && status === 'run' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onTouchStart: () => eng.current.jump(),
    style: padBtn
  }, "JUMP"), /*#__PURE__*/React.createElement("button", {
    onTouchStart: () => eng.current.setDuck(true),
    onTouchEnd: () => eng.current.setDuck(false),
    style: padBtn
  }, "DUCK")));
}
const padBtn = {
  flex: 1,
  padding: '16px',
  borderRadius: T.radius.md,
  background: steelPlate('#26313F', '#1A2230'),
  border: '1px solid ' + T.color.line,
  color: '#fff',
  fontFamily: 'Saira Condensed',
  fontWeight: 700,
  letterSpacing: '.08em',
  fontSize: 18
};
function Overlay({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 40%, rgba(12,17,26,.55), rgba(8,11,16,.86))',
      backdropFilter: 'blur(1px)',
      padding: 20
    }
  }, children);
}
window.Game = Game;