/* EmbedYap — Map screen (centerpiece): pan/zoom plan, ~300 anchor-bolt pins,
   marquee multi-select, pin detail + note, manager markup tools (rect + polygon,
   reshape, copy/paste/delete/undo), interactive embed placement, grid editor. */

const STATE_ORDER = ['installed','next','todo'];   // knife plate is an attribute, not a status

// markup layers: PWJV (plain) + WCG Pours (the pour layer). Legacy 'WCG'/'Pours' fold in.
function zoneLayer(z){ const l=z&&z.layer; return (l==='WCG'||l==='Pours'||l==='WCG Pours') ? 'WCG Pours' : (l||'PWJV'); }
const LAYERS = [['PWJV','126,120,240'],['WCG Pours','82,230,224']];
// a pour assigned slurry IS a backfill pour — name carries it (e.g. "… Slurry", "… Backfill"). Used by the Backfill show/hide.
function isBackfillPour(z){ return /slurry|backfill/i.test((z&&z.name)||''); }
// a pour created in the CUP dashboard has no box yet — it's placed by drawing one here
function hasGeom(z){ return (Array.isArray(z&&z.points) && z.points.length>=3) || (typeof (z&&z.w)==='number' && z.w>0 && typeof z.h==='number' && z.h>0); }
function pourTitle(z, n){ return (z&&z.name) ? z.name : ('#'+(n||'?')); }

/* ---- geometry helpers ---- */
function normZone(d){ const x=Math.min(d.x0,d.x1), y=Math.min(d.y0,d.y1); return { x, y, w:Math.abs(d.x1-d.x0), h:Math.abs(d.y1-d.y0) }; }
function isPoly(z){ return Array.isArray(z && z.points) && z.points.length>=3; }
function rectToPoly(z){ return [[z.x,z.y],[z.x+z.w,z.y],[z.x+z.w,z.y+z.h],[z.x,z.y+z.h]]; }
function zonePts(z){ return isPoly(z)? z.points : rectToPoly(z); }
function bboxOf(pts){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; pts.forEach(([x,y])=>{ x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y); }); return { x:x0, y:y0, w:x1-x0, h:y1-y0 }; }
function pointInPoly(px,py,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const [xi,yi]=pts[i],[xj,yj]=pts[j]; if(((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/((yj-yi)||1e-9)+xi)) c=!c; } return c; }

/* ---- grid edit helpers ---- */
function buildGridCfg(grid){
  const cols=(grid&&grid.cols)?[...grid.cols]:[...gridCols()];
  const rows=(grid&&grid.rows)?[...grid.rows]:[...gridRows()];
  return { cols, rows,
    colW:(grid&&grid.colW&&grid.colW.length===cols.length-1)?[...grid.colW]:Array(Math.max(0,cols.length-1)).fill(1),
    rowH:(grid&&grid.rowH&&grid.rowH.length===rows.length-1)?[...grid.rowH]:Array(Math.max(0,rows.length-1)).fill(1),
    plan:{...((grid&&grid.plan)||gridPlan())} };
}
const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
// drag gridline `i` (axis 'col'|'row') to normalized position nf (0..1 over the blueprint)
function setGridLine(cfg, axis, i, nf){
  const isCol=axis==='col'; const arr=isCol?cfg.cols:cfg.rows; const wkey=isCol?'colW':'rowH';
  const n=arr.length, pl=cfg.plan, lo=isCol?'x0':'y0', hi=isCol?'x1':'y1';
  if(i<=0) return { ...cfg, plan:{ ...pl, [lo]:clampN(nf, 0, pl[hi]-0.02) } };
  if(i>=n-1) return { ...cfg, plan:{ ...pl, [hi]:clampN(nf, pl[lo]+0.02, 1) } };
  const f=cumFrac(cfg[wkey], n); const pf=(nf-pl[lo])/((pl[hi]-pl[lo])||1);
  f[i]=clampN(pf, f[i-1]+0.004, f[i+1]-0.004);
  const w=[]; for(let j=0;j<n-1;j++) w.push(Math.max(0.004, f[j+1]-f[j]));
  return { ...cfg, [wkey]:w };
}

function MapScreen({ embeds, updateEmbed, bulkUpdate, user, isPhone, zones=[], onAddZone, onUpdateZone, onRemoveZone, onRestoreZone, onAddPin, onRemovePin, onRestorePin, onMovePins, onBulkInstall, onBulkDelivery, onBulkStubDelivery, grid, savedGrid, gridDraft, onGridDraft, onSaveGrid, pourMode }){
  const vpRef = React.useRef(null);
  const rootRef = React.useRef(null);
  const canvasRef = React.useRef(null);   // pin layer (replaces ~340 DOM pin nodes)
  const drawnView = React.useRef({ tx:0, ty:0, s:-1 });   // view at last full canvas repaint
  const [box, setBox] = React.useState({ w:1000, h:700 });
  const [view, setView] = React.useState({ s:1, tx:0, ty:0, init:false });
  const [selId, setSelId] = React.useState(null);
  const [selPins, setSelPins] = React.useState([]);       // multi-selected embed ids
  const [filter, setFilter] = React.useState('all');      // status filter
  const [cat, setCat] = React.useState('all');            // knife-plate filter
  const [stub, setStub] = React.useState('all');          // stub-column filter
  const [colorMode, setColorMode] = React.useState('install');   // 'install' | 'delivery' — what the dot color shows
  /* Delivery layer only: do stub columns count toward a pin's color?
     ON  (default) — a pin reads the WORST of its anchor bolt and its stub column, so a location
                     isn't green until both have landed. This is "is this spot ready to build".
     OFF           — bolts only. A delivered anchor bolt reads green even if its stub column is
                     still off site, and the stub ■ markers come off the map entirely. This is
                     "what bolts do I actually have", which is the question the yard asks. */
  const [scLayer, setScLayer] = React.useState(()=>{ try{ return localStorage.getItem('embedyap_sclayer')!=='0'; }catch(_){ return true; } });
  React.useEffect(()=>{ try{ localStorage.setItem('embedyap_sclayer', scLayer?'1':'0'); }catch(_){} },[scLayer]);
  // anchor positions are LOCKED by default (per browser) so they can't be dragged accidentally; unlock to reposition
  const [locked, setLocked] = React.useState(()=>{ try{ const v=localStorage.getItem('embedyap_pinlock'); return v==null ? true : v!=='0'; }catch(_){ return true; } });
  React.useEffect(()=>{ try{ localStorage.setItem('embedyap_pinlock', locked?'1':'0'); }catch(_){} },[locked]);
  const [tool, setTool] = React.useState('select');       // 'select' (marquee) | 'move' | 'pan'
  const [dragPins, setDragPins] = React.useState(null);   // {id:{nx,ny}} live positions while moving placed pins
  const [ghost, setGhost] = React.useState(null);         // {x,y} cursor preview while placing
  const [showLegend, setShowLegend] = React.useState(true);
  const [layerVis, setLayerVis] = React.useState({ PWJV:true, 'WCG Pours':true });   // per-layer markup show/hide
  const [showBackfill, setShowBackfill] = React.useState(true);   // show/hide slurry-backfill pours within the WCG layer
  const [expandedPours, setExpandedPours] = React.useState(()=>new Set());   // pour ids whose full name/info is shown (tap the # badge)
  const togglePourLabel = (id)=> setExpandedPours(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const [showPours, setShowPours] = React.useState(false);   // pours / pre-pour checklist drawer
  const [drawMode, setDrawMode] = React.useState('off');  // 'off' | 'rect' | 'poly' | 'pin'
  const [place, setPlace] = React.useState({ knifePlate:false, stubColumn:false, sequence:'1', phase:'1', area:'A', mark:'' });
  const [draft, setDraft] = React.useState(null);         // rect zone being dragged
  const [marq, setMarq] = React.useState(null);           // marquee selection rect
  const [poly, setPoly] = React.useState([]);             // polygon vertices in progress
  const [editZone, setEditZone] = React.useState(null);
  const [infoZone, setInfoZone] = React.useState(null);   // zone whose detailed region info panel is open
  const [selZone, setSelZone] = React.useState(null);
  const [reshape, setReshape] = React.useState(false);
  const [liveZones, setLiveZones] = React.useState(null);
  const [gridMode, setGridMode] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);     // {message, onYes}
  const [q, setQ] = React.useState('');
  const [full, setFull] = React.useState(false);
  const touched = React.useRef(false);
  const clip = React.useRef(null);          // copied markup
  const clipEmbed = React.useRef(null);     // copied embed (for ⌘C/⌘V place)
  const undo = React.useRef([]);

  const manager = !!user.manager;

  // ---- viewport measure ----
  React.useEffect(()=>{
    const el = vpRef.current; if(!el) return;
    const ro = new ResizeObserver(()=>{ const r=el.getBoundingClientRect(); setBox({ w:r.width, h:r.height }); });
    ro.observe(el); return ()=>ro.disconnect();
  },[]);
  const plan = React.useMemo(()=>{
    const pad = isPhone?12:36;
    const aw = box.w-pad*2, ah = box.h-pad*2;
    let pw = Math.min(aw, ah*BP_W/BP_H); let ph = pw*BP_H/BP_W;
    return { pw, ph, ox:(box.w-pw)/2, oy:(box.h-ph)/2 };
  },[box,isPhone]);
  React.useEffect(()=>{ if(!touched.current) setView({ s:1, tx:plan.ox, ty:plan.oy, init:true }); },[plan]);
  function fit(){ touched.current=false; setView({ s:1, tx:plan.ox, ty:plan.oy, init:true }); }
  function focusZone(z){ const bb=isPoly(z)?bboxOf(z.points):z; const cx=(bb.x+bb.w/2)*plan.pw, cy=(bb.y+bb.h/2)*plan.ph;  // pan/zoom to a pour
    const s=clampS(2.2); touched.current=true; setView({ s, tx:box.w/2 - cx*s, ty:box.h/2 - cy*s, init:true }); }
  React.useEffect(()=>{ if(drawMode!=='pin') setGhost(null); },[drawMode]);   // clear cursor preview

  // ---- fullscreen ----
  React.useEffect(()=>{ const h=()=>setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange',h); return ()=>document.removeEventListener('fullscreenchange',h); },[]);
  function toggleFull(){ const el=rootRef.current; if(!el) return; if(document.fullscreenElement) document.exitFullscreen(); else if(el.requestFullscreen) el.requestFullscreen(); }

  // The map is sized/positioned explicitly (not CSS-transform-scaled), so it's
  // painted within the viewport clip — no giant composited layer to blank out.
  const clampS = s => Math.max(0.4, Math.min(8, s));
  function zoomAt(px, py, factor){ touched.current=true; setView(v=>{ const ns=clampS(v.s*factor); const k=ns/v.s; return { ...v, s:ns, tx: px-(px-v.tx)*k, ty: py-(py-v.ty)*k }; }); }

  // wheel zoom scoped to the map — but let panels (data-ui) scroll normally
  React.useEffect(()=>{
    const el = vpRef.current; if(!el) return;
    const onWheelNative = (e)=>{
      if (e.target.closest && e.target.closest('[data-ui]')) return;   // panel scroll — don't hijack
      e.preventDefault(); const r=el.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
      touched.current=true; setView(v=>{ const ns=clampS(v.s*(e.deltaY<0?1.12:0.89)); const k=ns/v.s; return { ...v, s:ns, tx:x-(x-v.tx)*k, ty:y-(y-v.ty)*k }; }); };
    el.addEventListener('wheel', onWheelNative, { passive:false });
    return ()=> el.removeEventListener('wheel', onWheelNative);
  },[]);

  // ---- pointer model ----
  const drag = React.useRef(null);     // panning
  const pinch = React.useRef(null);
  const drawing = React.useRef(null);  // rect zone draft
  const marquee = React.useRef(null);  // marquee draft
  const vdrag = React.useRef(null);
  const sdrag = React.useRef(null);
  const pdrag = React.useRef(null);    // moving a placed pin {id, nx, ny, moved}
  const gdrag = React.useRef(null);    // dragging a gridline {axis, i}
  function relXY(e){ const r=vpRef.current.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; }
  function toFrac(px,py){ return { fx:((px-view.tx)/view.s)/plan.pw, fy:((py-view.ty)/view.s)/plan.ph }; }

  // ---- canvas pin layer -------------------------------------------------
  // ~340 pins used to be DOM nodes (one wrapper + dot + markers + label each);
  // they're now painted on a single screen-space <canvas>, with pointer hit-testing
  // for select/drag. Cuts the map's node count and makes pan/zoom re-paints cheap.
  const HITR = 14;                              // pin tap radius in screen px
  function pinScreen(e){
    const dp = dragPins && dragPins[e.id];
    const nx = dp?dp.nx:e.nx, ny = dp?dp.ny:e.ny;
    return { sx: view.tx + nx*plan.pw*view.s, sy: view.ty + ny*plan.ph*view.s };
  }
  function pinAt(x,y){                          // nearest visible pin within HITR, else null
    let best=null, bestD=HITR*HITR;
    for(const e of visible){ const {sx,sy}=pinScreen(e); const d=(sx-x)*(sx-x)+(sy-y)*(sy-y); if(d<=bestD){ bestD=d; best=e; } }
    return best;
  }
  // shared pin pointer-down: shift/⌘ toggles the group, plain grab starts a move/select drag.
  // Called from the viewport handler and from the zone handler (so a pin on top of a zone wins).
  function pinPointerDown(e, hit){
    if (e.metaKey||e.ctrlKey||e.shiftKey){ setSelPins(p=> p.includes(hit.id)? p.filter(id=>id!==hit.id) : [...p,hit.id]); setSelId(null); return; }
    const r=relXY(e); const sf=toFrac(r.x,r.y);
    const ids = (pickSet.has(hit.id) && selPins.length>0) ? selPins.slice() : [hit.id];
    const base={}; ids.forEach(id=>{ const em=embeds.find(x2=>x2.id===id); if(em) base[id]={ nx:em.nx, ny:em.ny }; });
    try{ vpRef.current.setPointerCapture(e.pointerId); }catch(_){}
    pdrag.current={ ids, base, sf, hitId:hit.id, moved:false, last:null };
  }
  function roundRectPath(ctx,x,y,w,h,r){ ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  // what the delivery layer paints for a pin — bolt+stub together, or bolts only when the SC layer is off
  function mapDelivery(e){ return scLayer ? siteDeliveryState(e) : deliveryState(e); }
  const scOn = colorMode!=='delivery' || scLayer;   // stub ■ markers are only suppressed on the delivery layer
  function drawPin(ctx,e,x,y,on,picked){
    let col;
    if (colorMode==='delivery'){ col = DELIVERY[mapDelivery(e)].color; }   // delivery layer: green/yellow/red by on-site status
    else { const st=pinState(e); col=(e.hasStub && st!=='installed') ? '#FF9650' : STATE[st].color; }
    const r=on?8:6;
    ctx.beginPath(); ctx.arc(x,y, r+(picked?3:(on?3:1.5)), 0, 6.2832);   // glow / selection ring
    ctx.fillStyle = picked ? '#ffffff' : (col+'55'); ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fillStyle=col; ctx.fill();   // dot
    ctx.lineWidth=2; ctx.strokeStyle = on?'#ffffff':'rgba(8,11,16,.85)'; ctx.stroke();
    const mo=r+1.5;
    if(e.hasKnife){ ctx.save(); ctx.translate(x-mo,y-mo); ctx.rotate(0.7853982); ctx.fillStyle=T.color.blue;   // knife plate ◆ top-left
      ctx.fillRect(-3,-3,6,6); ctx.lineWidth=1.5; ctx.strokeStyle='#0C111A'; ctx.strokeRect(-3,-3,6,6); ctx.restore(); }
    // stub ■ bottom-left — orange normally; on the delivery layer it carries the stub column's own on-site status.
    // Hidden entirely when the SC layer is switched off, so the map shows nothing but anchor bolts.
    if(e.hasStub && scOn){ ctx.fillStyle = colorMode==='delivery' ? DELIVERY[stubDeliveryState(e)].color : '#FF9650';
      ctx.fillRect(x-mo-3,y+mo-3,6,6); ctx.lineWidth=1.5; ctx.strokeStyle='#0C111A'; ctx.strokeRect(x-mo-3,y+mo-3,6,6); }
    if(e.note){ ctx.beginPath(); ctx.arc(x+mo,y-mo,3.5,0,6.2832); ctx.fillStyle=T.color.amberHot;   // note ● top-right
      ctx.fill(); ctx.lineWidth=1.5; ctx.strokeStyle='#0C111A'; ctx.stroke(); }
    if(labelsOn||on){ const txt=String((labelsOn?e.mark:e.grid)||''); if(txt){
      ctx.font="500 9.5px 'JetBrains Mono', ui-monospace, monospace";
      const tw=ctx.measureText(txt).width, pad=4, h=13, ly=y+r+3.5;
      ctx.fillStyle='rgba(8,11,16,.78)'; roundRectPath(ctx, x-tw/2-pad, ly, tw+pad*2, h, 3); ctx.fill();
      ctx.lineWidth=1; ctx.strokeStyle='rgba(150,170,205,.2)'; ctx.stroke();
      ctx.fillStyle='#dfe7f2'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt, x, ly+h/2+0.5);
    }}
  }
  function drawPins(){
    const cv=canvasRef.current; if(!cv) return;
    const dpr=Math.min(window.devicePixelRatio||1, 2);
    const W=box.w, H=box.h, bw=Math.round(W*dpr), bh=Math.round(H*dpr);
    if(cv.width!==bw||cv.height!==bh){ cv.width=bw; cv.height=bh; }
    const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
    const hi=[];                                 // draw selected/picked last so they sit on top
    for(const e of visible){ const {sx,sy}=pinScreen(e);
      if(sx<-140||sy<-140||sx>W+140||sy>H+140) continue;   // cull offscreen (generous margin so a pan slides nearby pins in)
      const on=e.id===selId, picked=pickSet.has(e.id);
      if(on||picked) hi.push([e,sx,sy,on,picked]); else drawPin(ctx,e,sx,sy,false,false);
    }
    for(const a of hi) drawPin(ctx,a[0],a[1],a[2],a[3],a[4]);
  }

  function onPointerDown(e){
    if (e.button===1){ e.preventDefault(); const r=relXY(e); try{ vpRef.current.setPointerCapture(e.pointerId); }catch(err){}  // middle-click drag = pan, any tool
      touched.current=true; drag.current={ x:r.x, y:r.y, tx:view.tx, ty:view.ty }; return; }
    if (e.target.closest('[data-pin]')) return;
    if (e.target.closest('[data-handle]')) return;   // reshape handles keep their own grab; zones fall through so a drag marquees pins over them
    if (e.target.closest('button, input, textarea, select, a, [data-ui]')) return;
    const {x,y}=relXY(e); const f=toFrac(x,y);
    try{ vpRef.current.setPointerCapture(e.pointerId); }catch(err){}
    if (drawMode==='pin'){ const key=onAddPin({ x:+f.fx.toFixed(4), y:+f.fy.toFixed(4), embedId:place.mark||'NEW', knifePlate:place.knifePlate, stubColumn:place.stubColumn, sequence:place.sequence, phase:place.phase, area:place.area });
      pushUndo({ type:'pinRemove', id:key }); return; }   // stay in placement mode
    if (drawMode==='rect'){ drawing.current={ x0:f.fx, y0:f.fy, x1:f.fx, y1:f.fy }; setDraft({ ...drawing.current }); return; }
    if (drawMode==='poly'){ setPoly(p=>[...p,[+f.fx.toFixed(4),+f.fy.toFixed(4)]]); return; }
    // drawMode 'off': empty-area drag = marquee select (Select tool) or pan (Pan tool); pins drag themselves
    setSelZone(null); setReshape(false);
    // canvas pins: hit-test the click — a hit pin selects/drags (mirrors the old per-pin handler)
    const hit = pinAt(x,y);
    if (hit){ pinPointerDown(e, hit); return; }
    if (tool==='pan'){ touched.current=true; drag.current={ x, y, tx:view.tx, ty:view.ty }; return; }
    marquee.current={ x0:f.fx, y0:f.fy, x1:f.fx, y1:f.fy, additive:e.shiftKey||e.metaKey||e.ctrlKey, zoneId: manager?zoneAtFrac(f.fx,f.fy):null };
    setMarq({ x:f.fx, y:f.fy, w:0, h:0 });
  }
  function onPointerMove(e){
    const {x,y}=relXY(e); const f=toFrac(x,y);
    if (gdrag.current){ const g=gdrag.current; onGridDraft(setGridLine(gridDraft, g.axis, g.i, g.axis==='col'?f.fx:f.fy)); return; }
    if (drawMode==='pin'){ setGhost({ x:f.fx, y:f.fy }); return; }    // new embed follows the cursor
    if (pdrag.current){ if(locked) return;   // positions locked — ignore the drag (pointer-up still selects the pin)
      const pd=pdrag.current; const dx=f.fx-pd.sf.fx, dy=f.fy-pd.sf.fy;
      const dp={}; pd.ids.forEach(id=>{ const b=pd.base[id]; if(b) dp[id]={ nx:b.nx+dx, ny:b.ny+dy }; });
      pd.moved=true; pd.last=dp; setDragPins(dp); return; }
    if (vdrag.current){ setLiveZones(applyVertex(vdrag.current.id, vdrag.current.vi, f.fx, f.fy)); return; }
    if (sdrag.current){ setLiveZones(translateZone(sdrag.current, f.fx-sdrag.current.fx, f.fy-sdrag.current.fy)); return; }
    if (drawing.current){ drawing.current={ ...drawing.current, x1:f.fx, y1:f.fy }; setDraft({ ...drawing.current }); return; }
    if (marquee.current){ marquee.current={ ...marquee.current, x1:f.fx, y1:f.fy }; setMarq(normZone(marquee.current)); return; }
    if (drag.current){ setView(v=>({ ...v, tx:drag.current.tx+(x-drag.current.x), ty:drag.current.ty+(y-drag.current.y) })); }
  }
  function onPointerUp(e){
    if (gdrag.current){ gdrag.current=null; return; }
    if (pdrag.current){ const pd=pdrag.current; pdrag.current=null; setDragPins(null);
      if (pd.moved && pd.last){
        const prev = pd.ids.filter(id=>pd.base[id]).map(id=>({ id, x:pd.base[id].nx, y:pd.base[id].ny }));
        const next = pd.ids.filter(id=>pd.last[id]).map(id=>({ id, x:+pd.last[id].nx.toFixed(4), y:+pd.last[id].ny.toFixed(4) }));
        pushUndo({ type:'pinMove', moves:prev }); onMovePins(next);
      } else { setSelId(prev=> prev===pd.hitId ? null : pd.hitId); setSelPins([]); }   // click without drag → toggle: select & show detail, or dismiss if already selected
      return; }
    if (vdrag.current){ commitLive(vdrag.current.id); vdrag.current=null; return; }
    if (sdrag.current){ commitLive(sdrag.current.id); sdrag.current=null; return; }
    if (drawing.current){ const z=normZone(drawing.current); drawing.current=null; setDraft(null);
      if(z.w>0.02&&z.h>0.02){ setEditZone({ ...z, area:'B', pour:'2', _new:true }); } setDrawMode('off'); return; }
    if (marquee.current){ const mq=marquee.current; const r=normZone(mq); const add=mq.additive; marquee.current=null; setMarq(null);
      if (r.w<0.006 && r.h<0.006){                                          // a click, not a drag
        if (mq.zoneId){ setSelZone(mq.zoneId); setReshape(false); setSelPins([]); setSelId(null); }   // click on a zone → select it (Edit/Info/Reshape bar)
        else if(!add){ setSelPins([]); setSelId(null); } }
      else { const ids=visible.filter(em=> em.nx>=r.x&&em.nx<=r.x+r.w&&em.ny>=r.y&&em.ny<=r.y+r.h).map(em=>em.id);
        setSelPins(prev=> add ? Array.from(new Set([...prev,...ids])) : ids); setSelId(null); }
      return; }
    if (drag.current){ drag.current=null; setView(v=>({...v})); return; }   // pan ended → re-render so the canvas repaints fresh at the final position
    drag.current=null;
  }
  function onTouchMove(e){
    if (e.touches.length===2){ e.preventDefault(); const [a,b]=e.touches; const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      const r=vpRef.current.getBoundingClientRect(); const mx=(a.clientX+b.clientX)/2-r.left, my=(a.clientY+b.clientY)/2-r.top;
      if(pinch.current){ zoomAt(mx,my, d/pinch.current); } pinch.current=d; }
  }
  function onTouchEnd(){ pinch.current=null; }

  function finishPoly(){ if(poly.length>=3){ const bb=bboxOf(poly); setEditZone({ ...bb, points:poly.map(p=>[+p[0],+p[1]]), area:'B', pour:'2', _new:true }); } setPoly([]); setDrawMode('off'); }

  // ---- markup geometry edits ----
  function workingZone(id){ return (liveZones||zones).find(z=>z.id===id) || zones.find(z=>z.id===id); }
  function applyVertex(id, vi, fx, fy){ const z=workingZone(id); if(!z) return liveZones;
    const pts=zonePts(z).map((p,i)=> i===vi?[+fx.toFixed(4),+fy.toFixed(4)]:p); return mergeLive({ ...z, points:pts, ...bboxOf(pts) }); }
  function translateZone(sd, dx, dy){ const z=zones.find(zz=>zz.id===sd.id); if(!z) return liveZones;
    const pts=zonePts(sd.base).map(([x,y])=>[+(x+dx).toFixed(4),+(y+dy).toFixed(4)]);
    return mergeLive(isPoly(sd.base)?{ ...z, points:pts, ...bboxOf(pts) }:{ ...z, x:+(sd.base.x+dx).toFixed(4), y:+(sd.base.y+dy).toFixed(4) }); }
  function mergeLive(merged){ return (liveZones||zones).map(z=> z.id===merged.id?merged:z); }
  function commitLive(id){ const z=(liveZones||[]).find(zz=>zz.id===id); setLiveZones(null); if(!z) return;
    const prev=zones.find(zz=>zz.id===id); const patch=isPoly(z)?{ points:z.points, x:z.x, y:z.y, w:z.w, h:z.h }:{ x:z.x, y:z.y };
    pushUndo({ type:'set', id, z:prev }); onUpdateZone(id, patch); }
  function addVertex(id, edgeIdx){ const z=zones.find(zz=>zz.id===id); if(!z) return; const pts=zonePts(z);
    const a=pts[edgeIdx], b=pts[(edgeIdx+1)%pts.length]; const mid=[+((a[0]+b[0])/2).toFixed(4),+((a[1]+b[1])/2).toFixed(4)];
    const np=[...pts.slice(0,edgeIdx+1), mid, ...pts.slice(edgeIdx+1)]; pushUndo({ type:'set', id, z:{...z} }); onUpdateZone(id, { points:np, ...bboxOf(np) }); }
  function removeVertex(id, vi){ const z=zones.find(zz=>zz.id===id); if(!z) return; const pts=zonePts(z); if(pts.length<=3) return;
    const np=pts.filter((_,i)=>i!==vi); pushUndo({ type:'set', id, z:{...z} }); onUpdateZone(id, { points:np, ...bboxOf(np) }); }

  // ---- undo / clipboard / delete (zones + pins) ----
  function pushUndo(inv){ undo.current.push(inv); if(undo.current.length>80) undo.current.shift(); }
  function doUndo(){ const inv=undo.current.pop(); if(!inv) return;
    if(inv.type==='remove') onRemoveZone(inv.id);
    else if(inv.type==='set'){ inv.z?onRestoreZone(inv.id, inv.z):onRemoveZone(inv.id); }
    else if(inv.type==='pinRemove') onRemovePin(inv.id);
    else if(inv.type==='pinRemoveMany') (inv.ids||[]).forEach(id=>onRemovePin(id));
    else if(inv.type==='pinRestore') onRestorePin(inv.id, inv.data);
    else if(inv.type==='pinMove') onMovePins(inv.moves); }
  function deleteZone(id){ const prev=zones.find(z=>z.id===id); if(!prev) return; pushUndo({ type:'set', id, z:prev }); onRemoveZone(id); setSelZone(null); setReshape(false); }
  function copyZone(id){ const z=zones.find(zz=>zz.id===id); if(z){ const {id:_d, createdAt:_c, ...rest}=z; clip.current=rest; } }
  function pasteZone(){ if(!clip.current) return; const z=clip.current; const off=0.025;
    const payload=isPoly(z)?{ ...z, points:z.points.map(([x,y])=>[+(x+off).toFixed(4),+(y+off).toFixed(4)]), x:z.x+off, y:z.y+off }:{ ...z, x:(z.x||0)+off, y:(z.y||0)+off };
    const key=onAddZone(payload); pushUndo({ type:'remove', id:key }); setSelZone(key); }

  // copy selection → single embed drops into placement mode; a group duplicates in place
  function copyEmbeds(){
    if (selPins.length>0){
      const items = selPins.map(id=>embeds.find(x=>x.id===id)).filter(Boolean)
        .map(e=>({ mark:e.mark, knifePlate:!!e.hasKnife, stubColumn:!!e.hasStub, sequence:e.sequence, phase:e.phase, area:e.area, nx:e.nx, ny:e.ny }));
      clipEmbed.current = { multi:true, items };
    } else if (selId){
      const e=embeds.find(x=>x.id===selId); if(e) clipEmbed.current={ multi:false, items:[{ mark:e.mark, knifePlate:!!e.hasKnife, stubColumn:!!e.hasStub, sequence:e.sequence, phase:e.phase, area:e.area }] };
    }
  }
  function pasteEmbeds(){
    const c=clipEmbed.current; if(!c || !c.items || !c.items.length) return;
    if (c.multi){
      const off=0.02, keys=[];
      c.items.forEach(it=>{ const key=onAddPin({ x:(it.nx||0)+off, y:(it.ny||0)+off, embedId:it.mark||'NEW', knifePlate:it.knifePlate, stubColumn:it.stubColumn, sequence:it.sequence, phase:it.phase, area:it.area }); keys.push(key); });
      pushUndo({ type:'pinRemoveMany', ids:keys }); setSelPins(keys); setSelId(null);
    } else {
      const it=c.items[0]; setPlace({ mark:it.mark||'', knifePlate:!!it.knifePlate, stubColumn:!!it.stubColumn, sequence:it.sequence||'1', phase:it.phase||'1', area:it.area||'A' }); setDrawMode('pin');
    }
  }

  function rawPin(e){ return { embedId:e.mark, x:e.nx, y:e.ny, exact:true, sequence:e.sequence, area:e.area, knifePlate:!!e.hasKnife, stubColumn:!!e.hasStub, installed:!!e.installed, installedAt:e.installedAt||null, note:e.note||'' }; }
  function deletePins(ids){ ids.forEach(id=>{ const e=embeds.find(x=>x.id===id); if(e) pushUndo({ type:'pinRestore', id, data:rawPin(e) }); onRemovePin(id); }); setSelPins([]); setSelId(null); }
  function requestDeletePins(ids){ if(!ids.length) return;
    if(ids.length>1) setConfirm({ message:`Delete ${ids.length} embeds? You can undo with ⌘Z.`, onYes:()=>{ deletePins(ids); setConfirm(null); } });
    else deletePins(ids); }

  // keyboard shortcuts (undo + selection for all; markup/delete gated to managers)
  React.useEffect(()=>{
    function onKey(e){
      const t=e.target; if(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const meta=e.metaKey||e.ctrlKey;
      // while drawing a polygon: ⌘Z / Delete removes the last point
      if (drawMode==='poly' && poly.length>0 && ((meta && /^[zZ]$/.test(e.key)) || e.key==='Backspace' || e.key==='Delete')){
        e.preventDefault(); setPoly(p=>p.slice(0,-1)); return; }
      if (meta && /^[zZ]$/.test(e.key)){ e.preventDefault(); doUndo(); }                         // undo (anyone)
      else if (meta && /^[aA]$/.test(e.key)){ e.preventDefault(); setSelPins(visible.map(em=>em.id)); setSelId(null); }
      else if (meta && /^[cC]$/.test(e.key)){ if(selPins.length||selId){ e.preventDefault(); copyEmbeds(); } else if(manager && selZone){ e.preventDefault(); copyZone(selZone); } }
      else if (meta && /^[vV]$/.test(e.key)){ if(clipEmbed.current){ e.preventDefault(); pasteEmbeds(); } else if(manager){ e.preventDefault(); pasteZone(); } }
      else if (manager && (e.key==='Delete'||e.key==='Backspace')){
        if(selPins.length){ e.preventDefault(); requestDeletePins(selPins); }
        else if(selZone){ e.preventDefault(); deleteZone(selZone); } }
      else if (e.key==='Escape'){
        // spam Esc to peel back one layer at a time: dialogs → drawing → selected item → selections
        if(confirm){ setConfirm(null); }
        else if(editZone){ setEditZone(null); }
        else if(infoZone){ setInfoZone(null); }
        else if(poly.length){ setPoly([]); setDrawMode('off'); }
        else if(drawMode!=='off'){ setDrawMode('off'); }
        else if(selId){ setSelId(null); }                       // dismiss the selected pin's detail panel
        else if(selPins.length){ setSelPins([]); }              // clear a multi-selection
        else if(selZone){ setSelZone(null); setReshape(false); } // deselect a zone
        else if(showPours){ setShowPours(false); }
      }
      else if (manager && e.key==='Enter'){ if(drawMode==='poly'&&poly.length>=3){ e.preventDefault(); finishPoly(); } }
    }
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey);
  },[manager, selId, selZone, selPins, poly, drawMode, editZone, infoZone, confirm, showPours, zones, liveZones, visibleKey()]);
  function visibleKey(){ return embeds.length+'/'+filter+'/'+cat+'/'+stub+'/'+q; }

  // ---- derived ----
  const sel = embeds.find(e=>e.id===selId)||null;
  const ql = q.trim().toLowerCase();
  const visible = embeds.filter(e=>
    (filter==='all' || pinState(e)===filter) &&
    (cat==='all' || (cat==='kp' ? e.hasKnife : !e.hasKnife)) &&
    (stub==='all' || (stub==='sc' ? e.hasStub : !e.hasStub)) &&
    (!ql || String(e.mark||'').toLowerCase().includes(ql) || String(e.grid||'').toLowerCase().includes(ql) || (e.hasStub && String(e.stubType||'').toLowerCase().includes(ql))) );
  const counts = STATE_ORDER.reduce((m,k)=>{ m[k]=embeds.filter(e=>pinState(e)===k).length; return m; },{});
  const deliveryCounts = DELIVERY_ORDER.reduce((m,k)=>{ m[k]=embeds.filter(e=>mapDelivery(e)===k).length; return m; },{});   // matches the painted pin colors, SC layer included
  const knifeCount = embeds.filter(e=>e.hasKnife).length;
  const stubCount = embeds.filter(e=>e.hasStub).length;
  const stubWaiting = embeds.filter(e=>e.hasStub && stubDeliveryState(e)!=='delivered').length;   // stub columns still off site
  const selStubs = selPins.filter(id=>{ const e=embeds.find(x=>x.id===id); return e && e.hasStub; });   // stub-column pins inside a multi-selection
  const labelsOn = view.s > 2.2;
  const renderZones = liveZones || zones;
  const selectedZone = renderZones.find(z=>z.id===selZone) || null;
  const pickSet = new Set(selPins);
  // topmost visible zone containing a normalized point (same filter as the rendered polygons)
  function zoneAtFrac(fx,fy){
    const vis = renderZones.filter(z=>layerVis[zoneLayer(z)] && hasGeom(z) && (showBackfill || !isBackfillPour(z)));
    for(let i=vis.length-1;i>=0;i--){ if(pointInPoly(fx,fy, zonePts(vis[i]))) return vis[i].id; }
    return null;
  }
  // pour order #: WCG-Pours zones numbered by date (then created)
  const pourNo = React.useMemo(()=>{
    const ps = zones.filter(z=>zoneLayer(z)==='WCG Pours').slice()
      .sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.createdAt||0)-(b.createdAt||0));
    const m={}; ps.forEach((z,i)=>{ m[z.id]=i+1; }); return m;
  },[zones]);
  function clearNextPour(){
    // highlight is derived from zones now — clearing the tag instantly un-highlights the embeds
    zones.filter(z=>z.nextPour).forEach(z=> onUpdateZone(z.id, { nextPour:false }));
  }

  function commitZone(z){
    const pts = z.points ? z.points : rectToPoly(z);
    const bb = bboxOf(pts);
    // placing a box onto an existing (CUP-created) pour: just write the geometry to it
    if (z.attachTo){
      pushUndo({ type:'set', id:z.attachTo, z:zones.find(zz=>zz.id===z.attachTo) });
      onUpdateZone(z.attachTo, { ...bb, ...(z.points?{points:z.points}:{ points:null }) });
      setSelZone(z.attachTo); setEditZone(null); return;
    }
    const ids = embeds.filter(e=> pointInPoly(e.nx, e.ny, pts)).map(e=>e.id);
    // nextPour highlight is derived live from the zone (no pin stamping) — only assign rewrites pins
    if (z.assign){ bulkUpdate(ids, { area:z.area, sequence:z.pour, phase:z.phase||'1', pour:`${z.area}·P${z.pour}` }); }
    if (z.done) onBulkInstall(ids, true);                  // pour complete → stamps install date + who + credits points
    if (z.setDelivery) onBulkDelivery && onBulkDelivery(ids, z.setDelivery);   // mark delivery status for every embed inside
    const payload = { ...bb, name:z.name||'', area:z.area, pour:z.pour, phase:z.phase||'1', count:ids.length, done:!!z.done, nextPour:!!z.nextPour, assign:!!z.assign, color:z.color||'126,120,240', layer:zoneLayer(z), date:z.date||'', ...(z.points?{points:z.points}:{}) };
    if (z._new){ const key=onAddZone(payload); pushUndo({ type:'remove', id:key }); } else { pushUndo({ type:'set', id:z.id, z:zones.find(zz=>zz.id===z.id) }); onUpdateZone(z.id, payload); }
    setEditZone(null);
  }

  const uPerPx = 1/((plan.pw||1)*view.s);
  const swU = 2.2*uPerPx, handleU = 7*uPerPx;
  const cursor = drawMode!=='off' ? 'crosshair' : (tool==='pan' ? (drag.current?'grabbing':'grab') : 'crosshair');

  // repaint the pin canvas after every commit (cheap: a few hundred simple arcs)
  React.useLayoutEffect(()=>{
    const cv=canvasRef.current; if(!cv) return;
    const dv=drawnView.current;
    // during an active pan at the same zoom, slide the already-painted canvas via a cheap GPU
    // transform so the pins stay pixel-locked to the blueprint (no per-frame repaint / swim)
    if (drag.current && dv.s===view.s){
      cv.style.transform = `translate(${view.tx-dv.tx}px, ${view.ty-dv.ty}px)`;
      return;
    }
    cv.style.transform = 'none';
    drawPins();
    drawnView.current = { tx:view.tx, ty:view.ty, s:view.s };
  });

  return (
    <div ref={rootRef} style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:T.color.graphite }}>
      <MapToolbar {...{filter,setFilter,cat,setCat,stub,setStub,colorMode,setColorMode,scLayer,setScLayer,locked,setLocked,tool,setTool,drawMode,setDrawMode,place,setPlace,gridMode,setGridMode,onToggleGrid:()=>{ const next=!gridMode; setGridMode(next); onGridDraft(next?buildGridCfg(savedGrid):null); },manager,isPhone,pourMode,layerVis,setLayerVis,showBackfill,setShowBackfill,pours:showPours,setPours:setShowPours,
        q,setQ,full,toggleFull, poly, finishPoly, cancel:()=>{ setPoly([]); setDrawMode('off'); },
        zoomIn:()=>zoomAt(box.w/2,box.h/2,1.25), zoomOut:()=>zoomAt(box.w/2,box.h/2,0.8), reset:fit, scale:view.s }} />

      <div ref={vpRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onMouseDown={e=>{ if(e.button===1) e.preventDefault(); }} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ position:'relative', flex:1, overflow:'hidden', cursor, touchAction:'none', userSelect:'none', WebkitUserSelect:'none' }}>

        <div style={{ position:'absolute', left:view.tx, top:view.ty, width:plan.pw*view.s, height:plan.ph*view.s,
          borderRadius:8, boxShadow:'0 0 0 1px rgba(150,170,205,.18), 0 30px 90px -30px rgba(0,0,0,.9)' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:8, overflow:'hidden' }}><Blueprint grid={grid} /></div>

          {/* gridline drag handles (while editing the grid) */}
          {gridMode && gridDraft && (<>
            {gridDraft.cols.map((c,i)=>{ const gx=colX(i); const edge=i===0||i===gridDraft.cols.length-1; return (
              <div key={'gch'+i} onPointerDown={e=>{ e.stopPropagation(); try{vpRef.current.setPointerCapture(e.pointerId);}catch(_){}; gdrag.current={ axis:'col', i }; }}
                title={`Column ${c} — drag`} style={{ position:'absolute', left:gx*100+'%', top:0, bottom:0, width:18, transform:'translateX(-50%)', cursor:'ew-resize', zIndex:8, display:'flex', justifyContent:'center' }}>
                <div style={{ width:edge?3:2, height:'100%', background:edge?'rgba(245,194,75,.9)':'rgba(82,230,224,.7)' }} />
                <div style={{ position:'absolute', top:2, background:edge?'#F5C24B':'#52E6E0', color:'#06140e', fontFamily:T.font.mono, fontSize:9, fontWeight:700, padding:'1px 4px', borderRadius:3, whiteSpace:'nowrap' }}>{c}</div>
              </div>
            ); })}
            {gridDraft.rows.map((r,j)=>{ const gy=rowY(j); const edge=j===0||j===gridDraft.rows.length-1; return (
              <div key={'grh'+j} onPointerDown={e=>{ e.stopPropagation(); try{vpRef.current.setPointerCapture(e.pointerId);}catch(_){}; gdrag.current={ axis:'row', j:j, i:j }; }}
                title={`Row ${r} — drag`} style={{ position:'absolute', top:gy*100+'%', left:0, right:0, height:18, transform:'translateY(-50%)', cursor:'ns-resize', zIndex:8, display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <div style={{ height:edge?3:2, width:'100%', background:edge?'rgba(245,194,75,.9)':'rgba(82,230,224,.7)' }} />
                <div style={{ position:'absolute', left:2, background:edge?'#F5C24B':'#52E6E0', color:'#06140e', fontFamily:T.font.mono, fontSize:9, fontWeight:700, padding:'1px 4px', borderRadius:3, whiteSpace:'nowrap' }}>{r}</div>
              </div>
            ); })}
          </>)}

          {/* markup + marquee overlay */}
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible', pointerEvents:'none' }}>
            {renderZones.filter(z=>layerVis[zoneLayer(z)] && hasGeom(z) && (showBackfill || !isBackfillPour(z))).map(z=>{
              const pts=zonePts(z); const gc=z.done?'47,214,166':z.nextPour?'82,230,224':(z.color||'126,120,240'); const on=z.id===selZone; const dpts=pts.map(p=>p.join(',')).join(' ');
              return (
                <g key={z.id}>
                  <polygon data-zone points={dpts} fill={`rgba(${gc},${z.done?0.20:0.12})`}
                    stroke={`rgba(${gc},${on?1:0.9})`} strokeWidth={on?swU*1.6:swU} strokeDasharray={z.done?'none':`${swU*3} ${swU*3}`}
                    style={{ pointerEvents: (manager && drawMode==='off')?'auto':'none', cursor: (manager && reshape && on)?'move':'crosshair' }}
                    onPointerDown={manager?(e)=>{
                      if(e.button!==0) return;   // middle/right-click bubbles to the viewport → pan, not move
                      const r=relXY(e);
                      if(drawMode==='off'){ const hit=pinAt(r.x,r.y); if(hit){ e.stopPropagation(); pinPointerDown(e,hit); return; } }   // a pin on top of the zone is grabbed first
                      // only intercept to MOVE this zone while it's already selected + reshaping;
                      // a plain press falls through to the viewport so a drag marquee-selects the pins inside.
                      if(reshape && z.id===selZone){
                        e.stopPropagation();
                        try{vpRef.current.setPointerCapture(e.pointerId);}catch(_){}
                        const f=toFrac(r.x,r.y); sdrag.current={ id:z.id, base:{...z, points:isPoly(z)?z.points:undefined}, fx:f.fx, fy:f.fy };
                      } }:undefined}
                    onDoubleClick={manager?(e)=>{ e.stopPropagation(); setSelZone(z.id); setReshape(false); setSelPins([]); setSelId(null); }:undefined} />
                  {on && reshape && pts.map((p,i)=>(
                    <circle key={'h'+i} data-handle cx={p[0]} cy={p[1]} r={handleU} fill="#fff" stroke={`rgba(${gc},1)`} strokeWidth={swU}
                      style={{ pointerEvents:'auto', cursor:'grab' }}
                      onPointerDown={(e)=>{ e.stopPropagation(); try{vpRef.current.setPointerCapture(e.pointerId);}catch(_){}; vdrag.current={ id:z.id, vi:i }; }}
                      onDoubleClick={(e)=>{ e.stopPropagation(); removeVertex(z.id, i); }} />
                  ))}
                  {on && reshape && pts.map((p,i)=>{ const b=pts[(i+1)%pts.length]; const mx=(p[0]+b[0])/2, my=(p[1]+b[1])/2; return (
                    <circle key={'e'+i} data-handle cx={mx} cy={my} r={handleU*0.78} fill={`rgba(${gc},.55)`} stroke="#fff" strokeWidth={swU*0.7}
                      style={{ pointerEvents:'auto', cursor:'copy' }} onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>{ e.stopPropagation(); addVertex(z.id, i); }} />
                  ); })}
                </g>
              );
            })}
            {poly.length>0 && (<>
              <polyline points={poly.map(p=>p.join(',')).join(' ')} fill="rgba(126,120,240,.12)" stroke={T.color.amberHot} strokeWidth={swU} />
              {poly.map((p,i)=><circle key={'pp'+i} cx={p[0]} cy={p[1]} r={handleU*0.8} fill={T.color.amberHot} />)}
            </>)}
            {draft && (()=>{ const z=normZone(draft); return <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="rgba(126,120,240,.14)" stroke={T.color.amberHot} strokeWidth={swU} strokeDasharray={`${swU*3} ${swU*3}`} />; })()}
            {marq && <rect x={marq.x} y={marq.y} width={marq.w} height={marq.h} fill="rgba(166,160,255,.12)" stroke={T.color.amberHot} strokeWidth={swU} strokeDasharray={`${swU*2} ${swU*2}`} />}
          </svg>

          {/* zone labels */}
          {renderZones.filter(z=>layerVis[zoneLayer(z)] && hasGeom(z) && (showBackfill || !isBackfillPour(z))).map(z=>{ const bb=isPoly(z)?bboxOf(z.points):z;
            const gc=z.done?'47,214,166':z.nextPour?'82,230,224':(z.color||'126,120,240');
            const isPour=zoneLayer(z)==='WCG Pours';
            if (isPour){
              // compact numbered badge at the zone centre; tap it to expand the full name/info
              const expanded = expandedPours.has(z.id);
              const numBadge = <span><span style={{ fontSize:10, opacity:.6 }}>#</span>{pourNo[z.id]||'?'}</span>;
              return (
                <div key={'lb'+z.id} style={{ position:'absolute', left:(bb.x+bb.w/2)*100+'%', top:(bb.y+bb.h/2)*100+'%',
                  transform:'translate(-50%,-50%)', pointerEvents:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:2, zIndex:expanded?7:1 }}>
                  <span data-ui onClick={(e)=>{ e.stopPropagation(); togglePourLabel(z.id); }}
                    title={expanded?'Tap to collapse':(z.name||'Pour '+(pourNo[z.id]||''))}
                    style={{ display:'inline-flex', alignItems:'baseline', gap:1, pointerEvents:'auto', cursor:'pointer',
                    maxWidth: expanded?220:'none', whiteSpace: expanded?'normal':'nowrap', textAlign:'center', background:'rgba(10,14,20,.82)', color:`rgb(${gc})`,
                    fontFamily:T.font.display, fontWeight:700, fontSize:14, lineHeight:1.15, padding:'3px 9px', borderRadius:T.radius.md,
                    border:`1px solid rgba(${gc},.5)` }}>
                    {expanded ? (z.name || numBadge) : numBadge}{z.done?<span style={{ fontSize:11, marginLeft:3, color:'#47D6A6' }}>✓</span>:null}
                  </span>
                  {expanded && (z.nextPour || z.date) && <span style={{ fontFamily:T.font.mono, fontSize:9, fontWeight:600, color:T.color.steel300,
                    background:'rgba(10,14,20,.62)', padding:'1px 6px', borderRadius:5, whiteSpace:'nowrap' }}>
                    {z.nextPour?'NEXT':''}{z.nextPour&&z.date?' · ':''}{z.date?shortDate(z.date):''}</span>}
                </div>
              );
            }
            const lbl = `${seqLabel(z.pour)} · ${z.area}${z.done?' ✓':''}`; return (
            <div key={'lb'+z.id} style={{ position:'absolute', left:bb.x*100+'%', top:bb.y*100+'%', pointerEvents:'none' }}>
              <span style={{ position:'absolute', top:0, left:0, transformOrigin:'0 0',
                background:`rgba(${gc},1)`, color:'#06140e', fontFamily:T.font.mono, fontSize:11, fontWeight:700,
                padding:'1px 6px', borderRadius:'3px 0 3px 0', whiteSpace:'nowrap' }}>{lbl}</span>
            </div>
          ); })}

          {/* pins are painted on the screen-space canvas below (see drawPins); kept out of the DOM */}

          {/* ghost preview — new embed following the cursor while placing */}
          {drawMode==='pin' && ghost && (
            <div style={{ position:'absolute', left:ghost.x*100+'%', top:ghost.y*100+'%', width:0, height:0, pointerEvents:'none', zIndex:6 }}>
              <div style={{ transform:'translate(-50%,-50%)', transformOrigin:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:2, opacity:.75 }}>
                <span style={{ position:'relative', width:13, height:13, borderRadius:'50%', background:T.color.amberHot, border:'2px dashed #fff', boxShadow:'0 0 10px rgba(166,160,255,.7)' }}>
                  {place.knifePlate && <span style={{ position:'absolute', top:-5, left:-5, width:7, height:7, background:T.color.blue, border:'1.5px solid #0C111A', transform:'rotate(45deg)' }} />}
                  {place.stubColumn && <span style={{ position:'absolute', bottom:-5, left:-5, width:7, height:7, background:'#FF9650', border:'1.5px solid #0C111A' }} />}
                </span>
                <span style={{ fontFamily:T.font.mono, fontSize:9.5, color:'#fff', background:'rgba(8,11,16,.8)', padding:'1px 4px', borderRadius:3, whiteSpace:'nowrap' }}>{place.mark||'NEW'}</span>
              </div>
            </div>
          )}
        </div>

        {/* pin layer — screen-space, painted by drawPins(); pointer events pass through to the viewport */}
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:2 }} />

        {/* sticky grid ruler — keeps column/row labels at the screen edges when zoomed in */}
        <GridRuler view={view} plan={plan} box={box} />

        {/* interactive embed-placement panel — docked right so the map stays visible */}
        {drawMode==='pin' && (
          <div data-ui style={{ position:'absolute', top:14, right:14, bottom:14, width:isPhone?'88%':280, zIndex:14, display:'flex', flexDirection:'column', gap:14,
            background:steelPlate('#161D29','#0F141C'), border:'1px solid '+T.color.line, borderRadius:T.radius.xl, padding:18, boxShadow:T.shadow.panel }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <Icon name="pinAdd" size={18} style={{ color:T.color.amber }} />
              <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:17, textTransform:'uppercase', letterSpacing:'.03em' }}>Placing embeds</span>
            </div>
            <p style={{ fontSize:12.5, color:T.color.steel300, margin:0, lineHeight:1.5 }}>Click anywhere on the plan to drop an anchor bolt — it keeps adding so you can place several, then hit Done.</p>
            <Field label="Mark / piece"><input value={place.mark} onChange={ev=>setPlace(p=>({...p,mark:ev.target.value}))} placeholder="e.g. 201A"
              style={{ ...inputStyle, padding:'9px 11px', fontSize:13.5, fontFamily:T.font.mono }} /></Field>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
              background:'rgba(0,0,0,.22)', border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:'11px 14px' }}>
              <div><div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:14, textTransform:'uppercase', letterSpacing:'.03em', color:place.knifePlate?T.color.blue:'#fff' }}>Knife plate</div>
                <div style={{ fontSize:11.5, color:T.color.steel300, marginTop:2 }}>Is there a knife plate here?</div></div>
              <Toggle on={place.knifePlate} onChange={()=>setPlace(p=>({...p,knifePlate:!p.knifePlate}))} />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
              background:'rgba(0,0,0,.22)', border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:'11px 14px' }}>
              <div><div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:14, textTransform:'uppercase', letterSpacing:'.03em', color:place.stubColumn?'#FF9650':'#fff' }}>Stub column</div>
                <div style={{ fontSize:11.5, color:T.color.steel300, marginTop:2 }}>Is there a stub column here?</div></div>
              <Toggle on={place.stubColumn} onChange={()=>setPlace(p=>({...p,stubColumn:!p.stubColumn}))} />
            </div>
            <Field label="Sequence"><Segmented value={place.sequence} onChange={v=>setPlace(p=>({...p,sequence:v}))} options={SEQUENCES} /></Field>
            <Field label="Phase"><Segmented value={place.phase} onChange={v=>setPlace(p=>({...p,phase:v}))} options={PHASES} /></Field>
            <Field label="Area"><Segmented value={place.area} onChange={v=>setPlace(p=>({...p,area:v}))} options={AREAS} /></Field>
            <Btn kind="primary" icon="check" style={{ marginTop:'auto' }} onClick={()=>setDrawMode('off')}>Done</Btn>
          </div>
        )}

        {/* multi-select action bar */}
        {selPins.length>0 && drawMode==='off' && (
          <div data-ui style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:13, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'center', maxWidth:'calc(100vw - 28px)',
            background:steelPlate('#161D29','#0F141C'), border:'1px solid '+T.color.cyan, borderRadius:T.radius.lg, padding:'7px 10px', boxShadow:T.shadow.card }}>
            <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:13.5, padding:'0 4px' }}>{selPins.length} selected</span>
            <Btn size="sm" kind="primary" icon="check" onClick={()=>onBulkInstall(selPins, true)}>Mark done</Btn>
            <Btn size="sm" kind="ghost" icon="close" onClick={()=>onBulkInstall(selPins, false)}>Un-install</Btn>
            <div style={{ width:1, height:20, background:T.color.line }} />
            {/* bulk delivery — set the delivery-to-site status of every selected pin */}
            {[['delivered','Delivered','47,214,166'],['transit','On the way','245,194,75'],['none','Not delivered','240,85,107']].map(([st,label,rgb])=>(
              <button key={st} onClick={()=>onBulkDelivery && onBulkDelivery(selPins, st)} title={'Mark '+selPins.length+' as '+label.toLowerCase()}
                style={{ display:'flex', alignItems:'center', gap:6, height:28, padding:'0 11px', borderRadius:T.radius.pill,
                  background:`rgba(${rgb},.16)`, border:`1px solid rgba(${rgb},.5)`, color:`rgb(${rgb})`, fontFamily:T.font.display, fontWeight:700, fontSize:11.5, letterSpacing:'.03em', whiteSpace:'nowrap' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:`rgb(${rgb})`, boxShadow:`0 0 6px -1px rgb(${rgb})` }} />{label}
              </button>
            ))}
            {/* stub columns in the selection get their own delivery row — a load of stub
                columns lands separately from the anchor bolts */}
            {selStubs.length>0 && onBulkStubDelivery && (
              <>
                <div style={{ width:1, height:20, background:T.color.line }} />
                <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:11.5, letterSpacing:'.04em', color:'#FF9650', whiteSpace:'nowrap' }}>SC ×{selStubs.length}</span>
                {[['delivered','Delivered','47,214,166'],['transit','On the way','245,194,75'],['none','Not delivered','240,85,107']].map(([st,label,rgb])=>(
                  <button key={'sc-'+st} onClick={()=>onBulkStubDelivery(selStubs, st)} title={'Mark '+selStubs.length+' stub column(s) as '+label.toLowerCase()}
                    style={{ display:'flex', alignItems:'center', gap:6, height:28, padding:'0 11px', borderRadius:T.radius.pill,
                      background:`rgba(${rgb},.10)`, border:`1px dashed rgba(${rgb},.5)`, color:`rgb(${rgb})`, fontFamily:T.font.display, fontWeight:700, fontSize:11.5, letterSpacing:'.03em', whiteSpace:'nowrap' }}>
                    <span style={{ width:8, height:8, background:`rgb(${rgb})`, boxShadow:`0 0 6px -1px rgb(${rgb})` }} />{label}
                  </button>
                ))}
              </>
            )}
            <div style={{ width:1, height:20, background:T.color.line }} />
            <Btn size="sm" kind="ghost" icon="layers" onClick={()=>copyEmbeds()}>Copy</Btn>
            {manager && <Btn size="sm" kind="danger" icon="trash" onClick={()=>requestDeletePins(selPins)}>Delete</Btn>}
            <Btn size="sm" kind="ghost" icon="close" onClick={()=>setSelPins([])}>Clear</Btn>
          </div>
        )}

        {/* selected-markup action bar */}
        {selectedZone && manager && !editZone && selPins.length===0 && (
          <div data-ui style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:12, display:'flex', gap:6,
            background:steelPlate('#161D29','#0F141C'), border:'1px solid '+T.color.line, borderRadius:T.radius.pill, padding:'6px 8px', boxShadow:T.shadow.card }}>
            <Btn size="sm" kind="ghost" icon="gear" onClick={()=>setEditZone({ ...selectedZone, _new:false })}>Edit</Btn>
            <Btn size="sm" kind="primary" icon="search" onClick={()=>setInfoZone(selectedZone)}>Info</Btn>
            <Btn size="sm" kind={reshape?'primary':'ghost'} icon="zone" onClick={()=>setReshape(r=>!r)}>{reshape?'Reshaping':'Reshape'}</Btn>
            <Btn size="sm" kind="ghost" icon="layers" onClick={()=>copyZone(selectedZone.id)}>Copy</Btn>
            <Btn size="sm" kind="ghost" icon="trash" onClick={()=>deleteZone(selectedZone.id)}>Delete</Btn>
          </div>
        )}

        {showLegend && <Legend counts={counts} deliveryCounts={deliveryCounts} colorMode={colorMode} scLayer={scLayer} total={embeds.length} knifeCount={knifeCount} stubCount={stubCount} stubWaiting={stubWaiting} onClose={()=>setShowLegend(false)} />}
        {!showLegend && <Btn size="sm" kind="solid" icon="layers" onClick={()=>setShowLegend(true)} style={{ position:'absolute', left:14, bottom:14 }}>Legend</Btn>}

        <div style={{ position:'absolute', right:14, bottom:14, fontFamily:T.font.mono, fontSize:11, color:T.color.steel400,
          background:'rgba(8,11,16,.6)', padding:'4px 9px', borderRadius:6, border:'1px solid '+T.color.line }}>
          {Math.round(view.s*100)}% · {visible.length} pins{drawMode==='pin'?' · CLICK TO PLACE':drawMode==='rect'?' · DRAG A BOX':drawMode==='poly'?' · CLICK POINTS · ENTER TO FINISH · ⌘Z REMOVES LAST PT':(tool==='select'?(locked?' · 🔒 PINS LOCKED · DRAG EMPTY TO SELECT':' · 🔓 DRAG A PIN TO MOVE · DRAG EMPTY TO SELECT'):' · DRAG TO PAN')}
        </div>

        {sel && <PinDetail key={sel.id} embed={sel} isPhone={isPhone} onClose={()=>setSelId(null)} updateEmbed={updateEmbed}
          manager={manager} onDelete={manager?()=>{ requestDeletePins([sel.id]); setSelId(null); }:null} />}
        {infoZone && <RegionInfo zone={infoZone} embeds={embeds} isPhone={isPhone} pourNo={pourNo[infoZone.id]} onClose={()=>setInfoZone(null)}
          onBulkDelivery={onBulkDelivery} onBulkInstall={onBulkInstall} />}
        {editZone && <ZoneEditor zone={editZone} embeds={embeds} onCancel={()=>setEditZone(null)} onApply={commitZone}
          unplaced={zones.filter(z=>zoneLayer(z)==='WCG Pours' && !hasGeom(z))}
          onDelete={editZone._new?null:()=>{ deleteZone(editZone.id); setEditZone(null); }} />}
        {gridMode && manager && gridDraft && <GridEditor cfg={gridDraft} onChange={onGridDraft}
          onClose={()=>{ setGridMode(false); onGridDraft(null); }}
          onSave={()=>{ onSaveGrid(gridDraft); setGridMode(false); }}
          onReset={()=>{ onSaveGrid(null); setGridMode(false); }} />}
        {showPours && <PoursDrawer zones={zones} embeds={embeds} manager={manager} user={user} isPhone={isPhone} showBackfill={showBackfill}
          onUpdateZone={onUpdateZone} onClose={()=>setShowPours(false)} onClearNextPour={clearNextPour} onGoto={(z)=>{ focusZone(z); if(isPhone) setShowPours(false); }} />}
        {confirm && <ConfirmDialog message={confirm.message} onYes={confirm.onYes} onNo={()=>setConfirm(null)} />}
      </div>
    </div>
  );
}

/* ---- confirm dialog ---- */
function ConfirmDialog({ message, onYes, onNo }){
  return (
    <div data-ui onClick={onNo} style={{ position:'absolute', inset:0, background:'rgba(6,9,14,.55)', zIndex:60, display:'grid', placeItems:'center', padding:18 }}>
      <Card onClick={e=>e.stopPropagation()} pad={22} glow style={{ width:'min(380px,100%)', boxShadow:T.shadow.panel }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
          <Icon name="trash" size={18} style={{ color:T.color.red }} />
          <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:19, textTransform:'uppercase', letterSpacing:'.03em' }}>Are you sure?</span>
        </div>
        <p style={{ fontSize:14, color:T.color.steel200, margin:'0 0 18px', lineHeight:1.5 }}>{message}</p>
        <div style={{ display:'flex', gap:10 }}>
          <Btn kind="ghost" onClick={onNo} style={{ marginLeft:'auto' }}>Cancel</Btn>
          <Btn kind="danger" icon="trash" onClick={onYes}>Delete</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ---- toolbar ---- */
function MapToolbar({ filter,setFilter,cat,setCat,stub,setStub,colorMode,setColorMode,scLayer,setScLayer,locked,setLocked,tool,setTool,drawMode,setDrawMode,place,setPlace,gridMode,setGridMode,onToggleGrid,manager,isPhone,pourMode,layerVis,setLayerVis,showBackfill,setShowBackfill,pours,setPours,q,setQ,full,toggleFull,poly,finishPoly,cancel,zoomIn,zoomOut,reset,scale }){
  const [fOpen,setFOpen] = React.useState(false);
  const activeFilters = (filter!=='all'?1:0)+(cat!=='all'?1:0)+(stub!=='all'?1:0);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', flexWrap:'wrap',
      borderBottom:'1px solid '+T.color.line, background:steelPlate('#141A24','#0E131B'), position:'relative', zIndex:6 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <Icon name={pourMode?'clipboard':'target'} size={18} style={{ color:T.color.amber }} />
        <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:18, textTransform:'uppercase', letterSpacing:'.03em' }}>{pourMode?'Pour map':'Plan'}</span>
      </div>
      <div style={{ width:1, height:24, background:T.color.line }} />
      {/* select / pan tool */}
      <Segmented size="sm" value={tool} onChange={setTool} options={[{value:'select',label:'Select'},{value:'pan',label:'Pan'}]} />
      {/* lock anchor positions — default on, per browser. Unlock only to deliberately reposition pins. */}
      <button onClick={()=>setLocked(v=>!v)} title={locked?'Anchor positions locked — click to unlock for repositioning':'Positions UNLOCKED — a drag moves pins. Click to lock.'}
        style={{ display:'flex', alignItems:'center', gap:6, height:30, padding:'0 11px', borderRadius:T.radius.md,
          background: locked?'rgba(47,214,166,.16)':'rgba(245,166,35,.20)', border:'1px solid '+(locked?'rgba(47,214,166,.5)':'rgba(245,166,35,.65)'),
          color: locked?T.color.green:'#F5A623', fontFamily:T.font.display, fontWeight:700, fontSize:12, letterSpacing:'.03em' }}>
        <Icon name={locked?'lock':'unlock'} size={14}/>{locked?'Locked':'Unlocked'}
      </button>
      {/* filters — collapsed into one popover */}
      <div style={{ position:'relative' }}>
        <button onClick={()=>setFOpen(o=>!o)} title="Filters"
          style={{ display:'flex', alignItems:'center', gap:6, height:30, padding:'0 11px', borderRadius:T.radius.md,
            background: (fOpen||activeFilters)?'rgba(126,120,240,.18)':'rgba(0,0,0,.3)', border:'1px solid '+((fOpen||activeFilters)?'rgba(126,120,240,.6)':T.color.line),
            color:(fOpen||activeFilters)?'#A6A0FF':T.color.steel200, fontFamily:T.font.display, fontWeight:700, fontSize:12, letterSpacing:'.03em' }}>
          <Icon name="filter" size={14}/>Filters{activeFilters?<span style={{ background:'#A6A0FF', color:'#0A0B16', borderRadius:8, fontSize:10, padding:'0 5px', fontFamily:T.font.mono }}>{activeFilters}</span>:null}
        </button>
        {fOpen && (
          <div data-ui style={{ position:'absolute', top:36, left:0, zIndex:20, width:248, display:'flex', flexDirection:'column', gap:12,
            background:steelPlate('#161D29','#0F141C'), border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:14, boxShadow:T.shadow.panel }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Kicker>Filters</Kicker>
              {activeFilters>0 && <button onClick={()=>{ setFilter('all'); setCat('all'); setStub('all'); }} style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400 }}>RESET</button>}
            </div>
            <div><Kicker>Show</Kicker><div style={{ marginTop:5 }}><Segmented size="sm" value={filter} onChange={setFilter}
              options={[{value:'all',label:'All'},{value:'todo',label:'To do'},{value:'installed',label:'Done'},{value:'next',label:'Next'}]} /></div></div>
            <div><Kicker>Knife plate</Kicker><div style={{ marginTop:5 }}><Segmented size="sm" value={cat} onChange={setCat} options={[{value:'all',label:'All'},{value:'kp',label:'Has KP'},{value:'nokp',label:'No KP'}]} /></div></div>
            <div><Kicker>Stub column</Kicker><div style={{ marginTop:5 }}><Segmented size="sm" value={stub} onChange={setStub} options={[{value:'all',label:'All'},{value:'sc',label:'Has SC'},{value:'nosc',label:'No SC'}]} /></div></div>
          </div>
        )}
      </div>
      {/* color the dots by install status or by delivery-to-site status */}
      <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,.3)', border:'1px solid '+T.color.line, borderRadius:T.radius.md, padding:'0 4px 0 9px', height:30 }} title="What the pin colors show">
        <Icon name="layers" size={13} style={{ color:colorMode==='delivery'?'#FF9650':T.color.steel400 }} />
        <Segmented size="sm" value={colorMode} onChange={setColorMode} options={[{value:'install',label:'Install'},{value:'delivery',label:'Delivery'}]} />
      </div>
      {/* Delivery layer only: fold the stub columns into the pin color, or show anchor bolts on their own.
          Off answers "which bolts are actually here", without a missing stub column painting the pin red. */}
      {colorMode==='delivery' && (
        <button onClick={()=>setScLayer(v=>!v)}
          title={scLayer ? 'Stub columns counted — a pin stays red until its stub column is on site. Click for bolts only.'
                         : 'Bolts only — pin color ignores stub columns. Click to count them again.'}
          style={{ display:'flex', alignItems:'center', gap:7, height:30, padding:'0 10px', whiteSpace:'nowrap',
            background: scLayer ? 'rgba(255,150,80,.14)' : 'rgba(0,0,0,.3)',
            border:'1px solid '+(scLayer ? 'rgba(255,150,80,.5)' : T.color.line), borderRadius:T.radius.md }}>
          <span style={{ width:9, height:9, display:'inline-block', flex:'0 0 auto',
            background: scLayer ? '#FF9650' : 'transparent', border:'1.5px solid '+(scLayer?'#FF9650':T.color.steel400) }} />
          <span style={{ fontFamily:T.font.mono, fontSize:11, letterSpacing:'.04em',
            color: scLayer ? '#FF9650' : T.color.steel300 }}>{scLayer ? 'SC ON' : 'BOLTS ONLY'}</span>
        </button>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,.3)', border:'1px solid '+T.color.line, borderRadius:T.radius.md, padding:'0 10px', height:30 }}>
        <Icon name="search" size={14} style={{ color:T.color.steel400 }} />
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Find mark / stub type…"
          style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontFamily:T.font.mono, fontSize:12, width:isPhone?92:118 }} />
        {q && <button onClick={()=>setQ('')} style={{ color:T.color.steel400 }}><Icon name="close" size={12}/></button>}
      </div>
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
        {manager && drawMode==='poly' && poly.length>=3 && <Btn size="sm" kind="primary" icon="check" onClick={finishPoly}>Finish</Btn>}
        {manager && (drawMode==='rect'||drawMode==='poly') && <Btn size="sm" kind="ghost" icon="close" onClick={cancel}>Cancel</Btn>}
        {/* Add embed — open to everyone on the roster (hidden on the markup-focused Pour map) */}
        {drawMode==='off' && !pourMode && <Btn size="sm" kind="ghost" icon="pinAdd" onClick={()=>setDrawMode('pin')}>Add embed</Btn>}
        {manager && drawMode==='off' && <>
          <Btn size="sm" kind="ghost" icon="zone" onClick={()=>setDrawMode('rect')}>Box</Btn>
          <Btn size="sm" kind="ghost" icon="polygon" onClick={()=>setDrawMode('poly')}>Polygon</Btn>
          <Btn size="sm" kind={gridMode?'primary':'ghost'} icon="grid" onClick={onToggleGrid}>Grid</Btn>
        </>}
        <div style={{ display:'flex', gap:4 }}>
          {LAYERS.map(([L,rgb])=>{ const on=layerVis[L]; return (
            <button key={L} onClick={()=>setLayerVis(v=>({...v,[L]:!v[L]}))} title={(on?'Hide ':'Show ')+L+' markups'}
              style={{ display:'flex', alignItems:'center', gap:5, height:30, padding:'0 9px', borderRadius:T.radius.md,
                background:on?`rgba(${rgb},.18)`:'rgba(0,0,0,.3)', border:'1px solid '+(on?`rgba(${rgb},.6)`:T.color.line),
                color:on?`rgb(${rgb})`:T.color.steel400, fontFamily:T.font.display, fontWeight:700, fontSize:11, letterSpacing:'.04em' }}>
              <Icon name={on?'eye':'eyeOff'} size={14}/>{L}
            </button>
          ); })}
          {/* show/hide slurry-backfill pours (a pour assigned slurry = backfill) */}
          <button onClick={()=>setShowBackfill(v=>!v)} title={(showBackfill?'Hide':'Show')+' slurry / backfill pours'}
            style={{ display:'flex', alignItems:'center', gap:5, height:30, padding:'0 9px', borderRadius:T.radius.md,
              background:showBackfill?'rgba(255,150,80,.18)':'rgba(0,0,0,.3)', border:'1px solid '+(showBackfill?'rgba(255,150,80,.6)':T.color.line),
              color:showBackfill?'#FF9650':T.color.steel400, fontFamily:T.font.display, fontWeight:700, fontSize:11, letterSpacing:'.04em' }}>
            <Icon name={showBackfill?'eye':'eyeOff'} size={14}/>Backfill
          </button>
        </div>
        <Btn size="sm" kind={pours?'primary':'ghost'} icon="clipboard" onClick={()=>setPours(p=>!p)}>Pours</Btn>
        <button onClick={toggleFull} title={full?'Exit full screen':'Full screen'} style={{ ...zbtn, width:32, height:30, background:'rgba(0,0,0,.3)', border:'1px solid '+T.color.line }}><Icon name={full?'minimize':'maximize'} size={16}/></button>
        <div style={{ display:'flex', gap:2, background:'rgba(0,0,0,.3)', borderRadius:T.radius.md, padding:3, border:'1px solid '+T.color.line }}>
          <button onClick={zoomOut} style={zbtn}><Icon name="minus" size={16}/></button>
          <button onClick={reset} style={{ ...zbtn, width:'auto', padding:'0 8px', fontFamily:T.font.mono, fontSize:11 }}>FIT</button>
          <button onClick={zoomIn} style={zbtn}><Icon name="plus" size={16}/></button>
        </div>
      </div>
    </div>
  );
}
const zbtn = { width:30, height:28, display:'grid', placeItems:'center', borderRadius:6, color:T.color.steel200 };

/* ---- legend ---- */
function Legend({ counts, deliveryCounts={}, colorMode='install', scLayer=true, total, knifeCount, stubCount, stubWaiting=0, onClose }){
  const delivery = colorMode==='delivery';
  const boltsOnly = delivery && !scLayer;   // SC layer off — stub ■ are off the map, so drop them from the legend too
  return (
    <div data-ui style={{ position:'absolute', left:14, bottom:14, background:steelPlate('#161D29','#0F141C'),
      border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:'12px 14px', boxShadow:T.shadow.card, minWidth:174 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9 }}>
        <Kicker>{delivery?(boltsOnly?'Delivery · bolts':'Delivery'):'Legend'}</Kicker>
        <button onClick={onClose} style={{ color:T.color.steel400 }}><Icon name="close" size={13}/></button>
      </div>
      <div style={{ display:'grid', gap:7 }}>
        {delivery
          ? DELIVERY_ORDER.map(k=>(
              <div key={k} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13 }}>
                <Dot color={DELIVERY[k].color} size={11} />
                <span style={{ color:T.color.offwhite, flex:1 }}>{DELIVERY[k].label}</span>
                <span style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel300 }}>{deliveryCounts[k]||0}</span>
              </div>
            ))
          : STATE_ORDER.map(k=>(
              <div key={k} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13 }}>
                <Dot color={STATE[k].color} size={11} />
                <span style={{ color:T.color.offwhite, flex:1 }}>{STATE[k].label}</span>
                <span style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel300 }}>{counts[k]}</span>
              </div>
            ))}
        <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, marginTop:1 }}>
          <span style={{ width:9, height:9, background:T.color.blue, transform:'rotate(45deg)', display:'inline-block', marginLeft:1 }} />
          <span style={{ color:T.color.offwhite, flex:1 }}>Knife plate</span>
          <span style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel300 }}>{knifeCount}</span>
        </div>
        {!boltsOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:13 }}>
            <span style={{ width:9, height:9, background:'#FF9650', display:'inline-block', marginLeft:1 }} />
            <span style={{ color:T.color.offwhite, flex:1 }}>Stub column</span>
            <span style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel300 }}>{stubCount}</span>
          </div>
        )}
        {/* SC layer off — say so, and keep the number visible so it is clear what is being ignored */}
        {boltsOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:12.5, marginTop:1 }}>
            <span style={{ width:9, height:9, border:'1.5px solid '+T.color.steel400, display:'inline-block', marginLeft:1 }} />
            <span style={{ color:T.color.steel300, flex:1, fontStyle:'italic' }}>{stubCount} SC hidden</span>
          </div>
        )}
        {/* on the delivery layer a pin reads red while its stub column is off site — call that out */}
        {delivery && !boltsOnly && stubCount>0 && (
          <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:13 }}>
            <span style={{ width:9, height:9, background:T.color.red, display:'inline-block', marginLeft:1 }} />
            <span style={{ color:T.color.offwhite, flex:1 }}>SC not on site</span>
            <span style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel300 }}>{stubWaiting}</span>
          </div>
        )}
      </div>
      <div style={{ marginTop:9, paddingTop:9, borderTop:'1px solid '+T.color.line, display:'flex', justifyContent:'space-between', fontFamily:T.font.mono, fontSize:11.5, color:T.color.steel400 }}>
        <span>TOTAL PINNED</span><span style={{ color:'#fff' }}>{total}</span>
      </div>
    </div>
  );
}

/* ---- grid editor (CUP-style: add gridlines / rename / edit bay distances) ---- */
function GridEditor({ cfg, onChange, onClose, onSave, onReset }){
  const [tab, setTab] = React.useState('cols');   // 'cols' | 'rows' | 'plan'
  const set = patch => onChange({ ...cfg, ...patch });
  const cols = cfg.cols||[], rows = cfg.rows||[], colW = cfg.colW||[], rowH = cfg.rowH||[];

  function addCol(){ const last=cols[cols.length-1]||'A'; const next = /^[A-Z]$/.test(last)? String.fromCharCode(Math.min(90,last.charCodeAt(0)+1)) : last+"'";
    set({ cols:[...cols, next], colW:[...colW, colW[colW.length-1]||1] }); }
  function delCol(){ if(cols.length<=2) return; set({ cols:cols.slice(0,-1), colW:colW.slice(0,-1) }); }
  function addRow(){ const last=rows[rows.length-1]; const n=parseInt(last,10); const next=isNaN(n)? last+"'":String(n-1);
    set({ rows:[...rows, next], rowH:[...rowH, rowH[rowH.length-1]||1] }); }
  function delRow(){ if(rows.length<=2) return; set({ rows:rows.slice(0,-1), rowH:rowH.slice(0,-1) }); }
  const lbl = (key,i)=> (e)=>{ const v=[...cfg[key]]; v[i]=e.target.value; set({ [key]:v }); };
  const bay = (key,i)=> (e)=>{ const v=[...cfg[key]]; v[i]=Math.max(0.05,+e.target.value||0.05); set({ [key]:v }); };
  const margin = (k)=> (e)=> set({ plan:{ ...cfg.plan, [k]:Math.max(0,Math.min(1,+e.target.value||0)) } });
  function evenBays(key, n){ set({ [key]: Array(Math.max(0,n-1)).fill(1) }); }

  const fld = { ...inputStyle, padding:'6px 8px', fontSize:12.5, width:'100%' };
  const sec = { fontFamily:T.font.mono, fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:T.color.steel400, margin:'4px 0 10px' };
  const tabBtn = (k,label)=> <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'7px 0', borderRadius:T.radius.md, fontFamily:T.font.display, fontWeight:700, fontSize:11.5, letterSpacing:'.04em',
    background:tab===k?'rgba(126,120,240,.2)':'rgba(0,0,0,.25)', border:'1px solid '+(tab===k?'rgba(126,120,240,.6)':T.color.line), color:tab===k?'#A6A0FF':T.color.steel400 }}>{label}</button>;

  return (
    <div data-ui style={{ position:'absolute', top:0, right:0, bottom:0, width:isPhoneNow()?'100%':344, zIndex:20, display:'flex', flexDirection:'column',
      background:steelPlate('#141B26','#0E131B'), borderLeft:'1px solid '+T.color.line, boxShadow:'-20px 0 60px -30px rgba(0,0,0,.9)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid '+T.color.line }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <Icon name="grid" size={18} style={{ color:T.color.amber }} />
          <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16, textTransform:'uppercase' }}>Edit grid</span>
        </div>
        <button onClick={onClose} style={{ color:T.color.steel400 }}><Icon name="close" size={16}/></button>
      </div>

      <div style={{ padding:'10px 16px 0', display:'flex', gap:6 }}>{tabBtn('cols','Columns')}{tabBtn('rows','Rows')}{tabBtn('plan','Margins')}</div>
      <div style={{ padding:'8px 16px 4px', fontFamily:T.font.mono, fontSize:10.5, color:T.color.cyan, display:'flex', alignItems:'center', gap:6 }}>
        <Icon name="target" size={12}/> Drag the lines on the map to align them to the embeds.
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'4px 16px 16px' }}>
        {tab==='plan' && (<>
          <div style={sec}>Plan margins (0–1) — outer grid box</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[['x0','Left'],['x1','Right'],['y0','Top'],['y1','Bottom']].map(([k,l])=>(
              <label key={k} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ fontFamily:T.font.mono, fontSize:9.5, color:T.color.steel400 }}>{l}</span>
                <input type="number" step="0.005" value={cfg.plan[k]} onChange={margin(k)} style={fld} />
              </label>
            ))}
          </div>
          <p style={{ fontSize:11.5, color:T.color.steel300, marginTop:12, lineHeight:1.5 }}>The outer (amber) lines are the plan box — drag them on the map or set them here.</p>
        </>)}

        {tab==='cols' && (<>
          <div style={{ ...sec, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>Columns ({cols.length})</span>
            <span style={{ display:'flex', gap:6 }}>
              <button title="Even spacing" onClick={()=>evenBays('colW', cols.length)} style={miniBtn}><Icon name="grid" size={12}/></button>
              <button onClick={delCol} style={miniBtn}><Icon name="minus" size={13}/></button>
              <button onClick={addCol} style={miniBtn}><Icon name="plus" size={13}/></button>
            </span>
          </div>
          {cols.map((c,i)=>(
            <div key={'c'+i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ width:16, fontFamily:T.font.mono, fontSize:10, color:T.color.steel400, textAlign:'right' }}>{i+1}</span>
              <input value={c} onChange={lbl('cols',i)} style={{ ...fld, width:60 }} />
              {i<cols.length-1 && <>
                <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400 }}>↔</span>
                <input type="number" step="0.25" value={colW[i]} onChange={bay('colW',i)} style={{ ...fld, flex:1 }} title="Bay width to next column" />
              </>}
            </div>
          ))}
        </>)}

        {tab==='rows' && (<>
          <div style={{ ...sec, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>Rows ({rows.length})</span>
            <span style={{ display:'flex', gap:6 }}>
              <button title="Even spacing" onClick={()=>evenBays('rowH', rows.length)} style={miniBtn}><Icon name="grid" size={12}/></button>
              <button onClick={delRow} style={miniBtn}><Icon name="minus" size={13}/></button>
              <button onClick={addRow} style={miniBtn}><Icon name="plus" size={13}/></button>
            </span>
          </div>
          {rows.map((r,i)=>(
            <div key={'r'+i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ width:16, fontFamily:T.font.mono, fontSize:10, color:T.color.steel400, textAlign:'right' }}>{i+1}</span>
              <input value={r} onChange={lbl('rows',i)} style={{ ...fld, width:60 }} />
              {i<rows.length-1 && <>
                <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400 }}>↕</span>
                <input type="number" step="0.25" value={rowH[i]} onChange={bay('rowH',i)} style={{ ...fld, flex:1 }} title="Bay height to next row" />
              </>}
            </div>
          ))}
        </>)}
      </div>

      <div style={{ display:'flex', gap:8, padding:'12px 16px', borderTop:'1px solid '+T.color.line }}>
        <Btn kind="ghost" size="sm" onClick={onReset}>Reset</Btn>
        <Btn kind="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn kind="primary" size="sm" icon="check" style={{ marginLeft:'auto' }} onClick={onSave}>Save grid</Btn>
      </div>
    </div>
  );
}
const miniBtn = { width:26, height:24, display:'grid', placeItems:'center', borderRadius:6, color:T.color.steel200, border:'1px solid '+T.color.line, background:'rgba(0,0,0,.25)' };

/* ---- sticky grid ruler: projects the current grid lines onto the viewport edges ---- */
function GridRuler({ view, plan, box }){
  if (!view || view.s < 1.2) return null;                 // only when zoomed in
  const C=gridCols(), R=gridRows(); const cols=[], rows=[];
  for(let i=0;i<C.length;i++){ const x=view.tx + colX(i)*plan.pw*view.s; if(x>=26 && x<=box.w-6) cols.push([x, C[i]]); }
  for(let i=0;i<R.length;i++){ const y=view.ty + rowY(i)*plan.ph*view.s; if(y>=22 && y<=box.h-6) rows.push([y, R[i]]); }
  const chip = { position:'absolute', fontFamily:T.font.mono, fontSize:10.5, fontWeight:600, color:'#cdd6e6',
    background:'rgba(8,11,16,.82)', border:'1px solid '+T.color.line, borderRadius:4, padding:'1px 5px', whiteSpace:'nowrap' };
  const tick = 'rgba(150,170,205,.35)';
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:9 }}>
      {/* faint edge gutters so the labels read as a ruler */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:24, background:'linear-gradient(180deg,rgba(8,11,16,.55),transparent)' }} />
      <div style={{ position:'absolute', top:0, bottom:0, left:0, width:26, background:'linear-gradient(90deg,rgba(8,11,16,.55),transparent)' }} />
      {cols.map(([x,l],k)=>(<React.Fragment key={'c'+k}>
        <div style={{ position:'absolute', left:x, top:0, width:1, height:7, background:tick }} />
        <div style={{ ...chip, left:x, top:8, transform:'translateX(-50%)' }}>{l}</div>
      </React.Fragment>))}
      {rows.map(([y,l],k)=>(<React.Fragment key={'r'+k}>
        <div style={{ position:'absolute', left:0, top:y, height:1, width:7, background:tick }} />
        <div style={{ ...chip, left:8, top:y, transform:'translateY(-50%)' }}>{l}</div>
      </React.Fragment>))}
    </div>
  );
}

/* ---- Pours drawer: every "Pours" markup = a pour, with an editable pre-pour checklist
   and a link to the live pour on the CUP dashboard. Pours layer zones only. ---- */
const CUP_LIVE_URL = 'https://dyap123.github.io/cup-dashboard/?view=live';
function poursItems(z){ const stored = Array.isArray(z.checklist)?z.checklist:[]; const have=new Set(stored.map(i=>i&&i.text)); const merged=stored.slice();
  (window.PREPOUR_DEFAULT||[]).forEach(t=>{ if(!have.has(t)) merged.push({ text:t, done:false }); }); return merged; }
// inspections are due the day before the pour
function inspDueDate(iso){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); if(!m) return ''; const dt=new Date(+m[1],+m[2]-1,+m[3]); dt.setDate(dt.getDate()-1);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function inspDaysUntil(iso){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); if(!m) return null; const d=new Date(+m[1],+m[2]-1,+m[3]); const n=new Date(); n.setHours(0,0,0,0); d.setHours(0,0,0,0); return Math.round((d-n)/86400000); }
function fmtTimeEmbed(t){ const m=/^(\d{1,2}):(\d{2})$/.exec(t||''); if(!m) return ''; let h=+m[1]; const ap=h<12?'AM':'PM'; h=h%12||12; return h+':'+m[2]+' '+ap; }
function inspDueInfo(z, doneN, total){
  const due = inspDueDate(z && z.date); if(!due) return null;
  const dleft = inspDaysUntil(due); const complete = total>0 && doneN===total;
  let col = T.color.steel400, lbl = 'Due '+shortDate(due);
  if (complete) col = T.color.green;
  else if (dleft<0){ col=T.color.red; lbl='Overdue · '+shortDate(due); }
  else if (dleft===0){ col=T.color.yellow; lbl='Due today'; }
  else if (dleft===1){ col=T.color.yellow; lbl='Due tomorrow'; }
  return { col, lbl };
}

function PoursDrawer({ zones=[], embeds=[], manager, user, isPhone, showBackfill=true, onUpdateZone, onClose, onGoto, onClearNextPour }){
  const today = ()=> new Date().toISOString().slice(0,10);
  const pours = zones.filter(z=>zoneLayer(z)==='WCG Pours' && (showBackfill || !isBackfillPour(z)))
    .sort((a,b)=> (a.date||'9999').localeCompare(b.date||'9999') || (a.createdAt||0)-(b.createdAt||0));
  const anyNext = zones.some(z=>z.nextPour) || embeds.some(e=>e.nextPour);
  return (
    <div data-ui style={{ position:'absolute', top:0, right:0, bottom:0, width:isPhone?'100%':360, zIndex:20, display:'flex', flexDirection:'column',
      background:steelPlate('#141B26','#0E131B'), borderLeft:'1px solid '+T.color.line, boxShadow:'-20px 0 60px -30px rgba(0,0,0,.9)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid '+T.color.line }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <Icon name="clipboard" size={18} style={{ color:T.color.amber }} />
          <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16, textTransform:'uppercase' }}>Pours · pre-pour</span>
        </div>
        <button onClick={onClose} style={{ color:T.color.steel400 }}><Icon name="close" size={16}/></button>
      </div>
      {manager && anyNext && (
        <div style={{ padding:'9px 16px', borderBottom:'1px solid '+T.color.line, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, background:'rgba(82,230,224,.06)' }}>
          <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.cyan }}>Next-pour tags active</span>
          <Btn size="sm" kind="ghost" icon="close" onClick={onClearNextPour}>Clear next-pour</Btn>
        </div>
      )}
      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px 16px' }}>
        {pours.length===0 && <div style={{ fontFamily:T.font.mono, fontSize:12.5, color:T.color.steel400, padding:'14px 8px', lineHeight:1.6 }}>
          No pours yet. Draw a <b style={{color:'#fff'}}>Box</b> or <b style={{color:'#fff'}}>Polygon</b> on the map and set its layer to <b style={{color:'#fff'}}>WCG Pours</b> — it shows here with a pre-pour checklist.</div>}
        {pours.map((z,i)=> <PourRow key={z.id} z={z} n={i+1} manager={manager} user={user} today={today} onUpdateZone={onUpdateZone} onGoto={onGoto} />)}
      </div>
    </div>
  );
}

const POUR_STATUS = ['PENDING','ORDERED','COMPLETE'];
const POUR_STATUS_RGB = { PENDING:'59,130,246', ORDERED:'245,158,11', COMPLETE:'47,214,166' };  // matches CUP dashboard
function pourStatus(z){ return z.status || (z.done ? 'COMPLETE' : 'PENDING'); }

function PourRow({ z, n, manager, user, today, onUpdateZone, onGoto }){
  const [exp, setExp] = React.useState(false);
  const items = poursItems(z);
  const doneN = items.filter(i=>i.done).length;
  const status = pourStatus(z);
  const gc = z.nextPour ? '82,230,224' : (POUR_STATUS_RGB[status] || z.color || '245,194,75');
  const mix = z.mix || {};
  const placed = hasGeom(z);
  const dueInfo = inspDueInfo(z, doneN, items.length);
  const title = `${pourTitle(z,n)}${z.date?' · '+shortDate(z.date):''}${z.time?' · '+fmtTimeEmbed(z.time):''}`;
  const sub = [ z.nextPour ? 'NEXT' : null, status, (+z.cy ? (+z.cy + ' CY') : null), (placed ? null : 'NOT PLACED'), (z.cupPourId ? ('CUP ' + z.cupPourId) : null) ].filter(Boolean).join(' · ');
  function writeItems(next){ onUpdateZone(z.id, { checklist:next }); }
  function toggle(i){ const it=items[i]; writeItems(items.map((x,k)=> k===i ? (it.done?{...x,done:false,by:null,at:null}:{...x,done:true,by:user.name,at:today()}) : x)); }
  function rename(i,text){ writeItems(items.map((x,k)=> k===i?{...x,text}:x)); }
  function remove(i){ writeItems(items.filter((_,k)=>k!==i)); }
  function add(){ writeItems([...items, { text:'New item', done:false }]); }
  function setStatus(s){ onUpdateZone(z.id, { status:s, done: s==='COMPLETE' }); }   // mirror CUP <-> embed
  return (
    <div style={{ border:'1px solid '+T.color.line, borderRadius:T.radius.lg, marginBottom:9, overflow:'hidden', background:'rgba(0,0,0,.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 12px' }}>
        <span style={{ width:9, height:9, borderRadius:2, flex:'0 0 auto', background:`rgb(${gc})` }} />
        <div onClick={()=>setExp(e=>!e)} style={{ flex:1, minWidth:0, cursor:'pointer' }}>
          <div style={{ fontFamily:T.font.display, fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
          <div style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400, marginTop:2 }}>{sub}</div>
        </div>
        {dueInfo && <span title="Inspections due (day before pour)" style={{ display:'inline-flex', alignItems:'center', gap:3, flex:'0 0 auto', fontFamily:T.font.mono, fontSize:9, fontWeight:700, color:dueInfo.col, background:'rgba(0,0,0,.25)', border:'1px solid '+T.color.line, borderRadius:5, padding:'2px 5px', whiteSpace:'nowrap' }}><Icon name="calendar" size={10} style={{ color:dueInfo.col }}/>{dueInfo.lbl}</span>}
        {placed
          ? <button onClick={()=>onGoto&&onGoto(z)} title="Go to pour on map" style={{ color:T.color.cyan, padding:4 }}><Icon name="target" size={15}/></button>
          : <span title="Draw its box on the map to place it" style={{ color:T.color.amberHot, fontFamily:T.font.mono, fontSize:9, fontWeight:700, padding:'2px 5px', border:'1px solid rgba(245,194,75,.4)', borderRadius:5 }}>PLACE</span>}
        <span style={{ fontFamily:T.font.mono, fontSize:12, color: doneN===items.length&&items.length?T.color.green:T.color.steel300 }}>{doneN}/{items.length}</span>
        <button onClick={()=>setExp(e=>!e)} style={{ color:T.color.steel400, padding:2 }}><Icon name="chevronDown" size={15} style={{ transform:exp?'rotate(180deg)':'none', transition:'transform .2s' }} /></button>
      </div>
      {exp && (
        <div style={{ padding:'2px 12px 13px', display:'flex', flexDirection:'column', gap:7 }}>
          {/* pour status — synced with the CUP dashboard */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {POUR_STATUS.map(s=>{ const on=status===s; const rgb=POUR_STATUS_RGB[s]; return (
              <button key={s} onClick={()=>setStatus(s)} style={{ flex:1, padding:'6px 0', borderRadius:T.radius.md, fontFamily:T.font.display, fontWeight:700, fontSize:10.5, letterSpacing:'.04em',
                background:on?`rgba(${rgb},.18)`:'rgba(0,0,0,.25)', border:'1px solid '+(on?`rgba(${rgb},.6)`:T.color.line), color:on?`rgb(${rgb})`:T.color.steel400 }}>{s}</button>
            ); })}
          </div>
          {/* pour date + start time + CY — editable here or on the CUP dashboard */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1 }}>
              <DatePopover value={z.date||''} disabled={!manager} onChange={d=>onUpdateZone(z.id,{ date:d })} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(0,0,0,.25)', border:'1px solid '+T.color.line, borderRadius:T.radius.md, padding:'0 8px', height:34 }} title="Pour start time">
              <Icon name="clock" size={13} style={{ color:'#FFB85C' }} />
              {manager
                ? <input type="time" defaultValue={z.time||''} onBlur={e=>{ if(e.target.value!==(z.time||'')) onUpdateZone(z.id,{ time:e.target.value }); }}
                    style={{ background:'transparent', border:'none', outline:'none', color:'#FFB85C', fontFamily:T.font.mono, fontWeight:700, fontSize:12.5, colorScheme:'dark', width:74 }} />
                : <span style={{ color:'#FFB85C', fontFamily:T.font.mono, fontWeight:700, fontSize:12 }}>{z.time?fmtTimeEmbed(z.time):'—'}</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,.25)', border:'1px solid '+T.color.line, borderRadius:T.radius.md, padding:'0 9px', height:34 }}>
              {manager
                ? <input type="number" min="0" step="1" defaultValue={+z.cy||0} onFocus={e=>e.target.select()}
                    onBlur={e=>{ const v=+e.target.value||0; if(v!==(+z.cy||0)) onUpdateZone(z.id,{ cy:v }); }}
                    style={{ background:'transparent', border:'none', outline:'none', color:'#34D399', fontFamily:T.font.mono, fontWeight:700, fontSize:14, width:44, textAlign:'right' }} />
                : <span style={{ color:'#34D399', fontFamily:T.font.mono, fontWeight:700, fontSize:14 }}>{+z.cy||0}</span>}
              <span style={{ fontFamily:T.font.mono, fontSize:10, color:T.color.steel400 }}>CY</span>
            </div>
          </div>
          {(mix.psi || mix.slump || mix.aggregate || mix.lc3) ? (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel300, padding:'2px 2px 4px' }}>
              {mix.psi ? <span><span style={{color:T.color.steel400}}>PSI </span>{mix.psi}</span> : null}
              {mix.slump ? <span><span style={{color:T.color.steel400}}>Slump </span>{mix.slump}</span> : null}
              {mix.aggregate ? <span><span style={{color:T.color.steel400}}>Agg </span>{mix.aggregate}</span> : null}
              {mix.lc3 ? <span style={{color:T.color.green}}>LC3 ✓</span> : null}
            </div>
          ) : null}
          {/* pre-pour inspections — due the day before the pour */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginTop:2, paddingTop:7, borderTop:'1px solid '+T.color.lineSoft }}>
            <span style={{ fontFamily:T.font.mono, fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:T.color.steel400 }}>Pre-pour {doneN}/{items.length}</span>
            {dueInfo && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontFamily:T.font.mono, fontSize:10, fontWeight:700, color:dueInfo.col }}><Icon name="calendar" size={11} style={{ color:dueInfo.col }}/>{dueInfo.lbl}</span>}
          </div>
          {items.map((it,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:9 }}>
              <button onClick={()=>toggle(i)} title={it.done?'Uncheck':'Check'} style={{ width:22, height:22, flex:'0 0 auto', borderRadius:6, display:'grid', placeItems:'center',
                background:it.done?T.color.green:'rgba(0,0,0,.25)', border:'1px solid '+(it.done?T.color.green:T.color.line) }}>
                {it.done && <Icon name="check" size={14} style={{ color:'#06140e' }} />}
              </button>
              {manager
                ? <input defaultValue={it.text} onBlur={e=>{ if(e.target.value!==it.text) rename(i, e.target.value); }}
                    style={{ ...inputStyle, flex:1, padding:'6px 9px', fontSize:12.5 }} />
                : <span style={{ flex:1, fontSize:13, color:it.done?T.color.steel300:'#fff', textDecoration:it.done?'line-through':'none' }}>{it.text}</span>}
              {it.done && it.by && <span style={{ fontFamily:T.font.mono, fontSize:9.5, color:T.color.steel400, whiteSpace:'nowrap' }}>{it.by.split(' ')[0]}{it.at?' · '+shortDate(it.at):''}</span>}
              {manager && <button onClick={()=>remove(i)} title="Remove" style={{ color:T.color.steel400, padding:3 }}><Icon name="trash" size={13}/></button>}
            </div>
          ))}
          {manager && <button onClick={add} style={{ display:'flex', alignItems:'center', gap:6, color:T.color.amberHot, fontFamily:T.font.mono, fontSize:12, padding:'4px 0', letterSpacing:'.04em' }}>
            <Icon name="plus" size={13}/> ADD ITEM</button>}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, paddingTop:10, borderTop:'1px solid '+T.color.lineSoft }}>
            <input defaultValue={z.cupPourId||''} placeholder="CUP pour (e.g. B-2)" onBlur={e=>{ if(e.target.value!==(z.cupPourId||'')) onUpdateZone(z.id,{ cupPourId:e.target.value }); }}
              style={{ ...inputStyle, width:130, padding:'7px 9px', fontSize:12.5, fontFamily:T.font.mono }} />
            <Btn size="sm" kind="primary" icon="arrowRight" onClick={()=>window.open(CUP_LIVE_URL,'_blank','noopener')}>Go to live pour</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

window.MapScreen = MapScreen;
