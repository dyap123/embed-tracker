/* EmbedYap — app shell: nav, routing, responsive, Firebase-backed embed state */
function useIsPhone(){
  const [p,setP]=React.useState(typeof window!=='undefined' && window.innerWidth<=760);
  React.useEffect(()=>{ const h=()=>setP(window.innerWidth<=760); window.addEventListener('resize',h); return ()=>window.removeEventListener('resize',h); },[]);
  return p;
}

const NAV = [
  { id:'map',       label:'Plan',      icon:'map' },
  { id:'dashboard', label:'Dashboard', icon:'dash' },
  { id:'inventory', label:'Inventory', icon:'inventory' },
  { id:'crew',      label:'Crew',      icon:'crew' },
  { id:'arcade',    label:'Arcade',    icon:'game' },
];
const today = ()=> new Date().toISOString().slice(0,10);

function App(){
  const isPhone = useIsPhone();
  const [user, setUser] = React.useState(()=>{ try{ return JSON.parse(sessionStorage.getItem('embedyap_user'))||null; }catch(e){ return null; } });
  const [screen, setScreen] = React.useState('map');
  const [pins, setPins] = React.useState({});         // raw Firebase pins
  const [master, setMaster] = React.useState({});      // Firebase embeds master (per-mark types)
  const [crew, setCrew] = React.useState([]);          // Firebase users
  const [zones, setZones] = React.useState([]);        // Firebase zones
  const [grid, setGrid] = React.useState(null);        // Firebase editable grid config
  const [toast, setToast] = React.useState(null);
  const [railOpen, setRailOpen] = React.useState(true);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const userRef = React.useRef(user); userRef.current = user;

  // ---- live Firebase subscriptions + one-time crew seed ----
  React.useEffect(()=>{
    window.fb.listen('pins', v=> setPins(v||{}));
    window.fb.listen('embeds', v=> setMaster(v||{}));
    window.fb.listen('zones', v=> setZones(Object.entries(v||{}).map(([k,z])=>({...z,id:k}))));
    window.fb.listen('grid', v=>{ setGridCfg(v); setGrid(v||null); });
    window.fb.listen('users', v=>{
      const arr = Object.values(v||{}).filter(Boolean);
      setCrew(arr.length?arr:CREW);
      window.CREW = arr.length?arr:CREW;                 // SignIn/Crew read window.CREW
      // keep the signed-in user synced with Firebase (profile edits, points…)
      setUser(u=>{ if(!u) return u; const live=arr.find(c=>c.id===u.id); return live?{...u,...live}:u; });
    });
    window.fb.get('users').then(v=>{ if(!v||!Object.keys(v).length){ CREW.forEach(c=>window.fb.set('users/'+c.id,{...c,updates:0})); } });
  },[]);

  const embeds = React.useMemo(()=> Object.entries(pins).map(([k,p])=>pinToEmbed(k,p)).filter(e=>e.mark), [pins, grid]);

  function saveGrid(cfg){ setGridCfg(cfg); setGrid(cfg); window.fb.set('grid', cfg); }

  function flash(msg){ setToast(msg); clearTimeout(flash._t); flash._t=setTimeout(()=>setToast(null), 2600); }
  function track(kind){ const u=userRef.current; if(u&&u.id) window.fb.inc('users/'+u.id+'/updates',1); flash(remarkFor(kind)); }

  function updateEmbed(id, patch){
    const p = { ...patch };
    let kind = 'edit';
    if ('installed' in p){
      kind = p.installed ? 'install' : 'uninstall';
      if (p.installed && !p.installedAt) p.installedAt = today();
      if (!p.installed) p.installedAt = null;
      const u=userRef.current;
      if (u&&u.id){ window.fb.inc('users/'+u.id+'/points', p.installed?10:-10); window.fb.inc('users/'+u.id+'/installs', p.installed?1:-1); }
    } else if ('rfi' in p){ kind = 'rfi'; }
    window.fb.update('pins/'+id, p);
    track(kind);
  }
  function bulkUpdate(ids, patch){ ids.forEach(id=> window.fb.update('pins/'+id, patch)); track('zone'); }

  // ---- embed pin CRUD (manager, via plan editing) ----
  function addPin(p){ const key='P'+Math.random().toString(36).slice(2,9);
    window.fb.set('pins/'+key, { embedId:p.embedId||'NEW', x:+(p.x||0).toFixed(4), y:+(p.y||0).toFixed(4), exact:true,
      sequence:p.sequence||'CUP', area:p.area||'A', knifePlate:!!p.knifePlate, installed:false, createdAt:Date.now() });
    track('edit'); return key; }
  function removePin(id){ const e=embeds.find(x=>x.id===id);
    if (e && e.installed){ const u=userRef.current; if(u&&u.id){ window.fb.inc('users/'+u.id+'/points',-10); window.fb.inc('users/'+u.id+'/installs',-1); } }
    window.fb.remove('pins/'+id); track('edit'); }
  function restorePin(id, data){ window.fb.set('pins/'+id, { ...data, createdAt:Date.now() }); }   // undo of delete
  function movePins(moves){ moves.forEach(m=> window.fb.update('pins/'+m.id, { x:+(+m.x).toFixed(4), y:+(+m.y).toFixed(4), exact:true })); track('edit'); }

  // ---- zones (Firebase-backed; pour-sequence highlight + mark-complete) ----
  function addZone(z){ const key='Z'+Math.random().toString(36).slice(2,9); window.fb.set('zones/'+key, {...z, createdAt:Date.now()}); return key; }
  function updateZone(id, patch){ window.fb.update('zones/'+id, patch); if(patch.done) track('seqdone'); }
  function removeZone(id){ window.fb.remove('zones/'+id); }
  function restoreZone(id, z){ const {id:_drop, ...rest}=z||{}; window.fb.set('zones/'+id, rest); }   // for undo

  function signIn(u){ setUser(u); try{ sessionStorage.setItem('embedyap_user', JSON.stringify(u)); }catch(e){} }
  function saveProfile(patch){ if(!userRef.current) return; const id=userRef.current.id;
    window.fb.update('users/'+id, patch);
    setUser(u=>{ const nu={...u,...patch}; try{ sessionStorage.setItem('embedyap_user', JSON.stringify(nu)); }catch(e){} return nu; });
    flash(remarkFor('edit')); }
  function signOut(){ setUser(null); sessionStorage.removeItem('embedyap_user'); setScreen('map'); }

  if(!user) return <><SignIn onSignIn={signIn} crew={crew} embeds={embeds} />{toast&&<RemarkToast msg={toast} />}</>;

  const screenEl = {
    map: <MapScreen embeds={embeds} updateEmbed={updateEmbed} bulkUpdate={bulkUpdate} user={user} isPhone={isPhone}
            zones={zones} onAddZone={addZone} onUpdateZone={updateZone} onRemoveZone={removeZone} onRestoreZone={restoreZone}
            onAddPin={addPin} onRemovePin={removePin} onRestorePin={restorePin} onMovePins={movePins} grid={grid} onSaveGrid={saveGrid} />,
    dashboard: <Dashboard embeds={embeds} isPhone={isPhone} />,
    inventory: <Inventory embeds={embeds} isPhone={isPhone} types={master}
                 onEditType={(mark,patch)=>{ window.fb.update('embeds/'+mark, patch); track('edit'); }} canEdit={!!user.manager} />,
    crew: <Crew embeds={embeds} user={user} isPhone={isPhone} crew={crew} />,
    arcade: (
      <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
        <div className="ey-fade" style={{ maxWidth:980, margin:'0 auto', padding:isPhone?'16px 12px 90px':'24px 28px 48px' }}>
          <h2 style={{ fontFamily:T.font.display, fontWeight:800, fontSize:26, margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'.02em' }}>Ironworker Run</h2>
          <div style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel400, marginBottom:14 }}>BREAK-TIME ARCADE · DODGE THE EMBEDS</div>
          <div style={{ height:isPhone?440:'min(560px,72vh)' }}><Game user={user} isPhone={isPhone} /></div>
        </div>
      </div>
    ),
  }[screen];

  if(isPhone){
    return (
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:T.color.graphite }}>
        <PhoneHeader user={user} screen={screen} onSignOut={signOut} onProfile={()=>setProfileOpen(true)} />
        <div style={{ position:'relative', flex:1, minHeight:0 }}>{screenEl}</div>
        <div style={{ display:'flex', borderTop:'1px solid '+T.color.line, background:steelPlate('#141A24','#0C111A') }}>
          {NAV.map(n=>{ const on=screen===n.id; return (
            <button key={n.id} onClick={()=>setScreen(n.id)} style={{ flex:1, padding:'9px 0 11px', display:'flex', flexDirection:'column',
              alignItems:'center', gap:3, color:on?'#fff':T.color.steel400, position:'relative' }}>
              <Icon name={n.icon} size={21} stroke={on?2.2:1.8} />
              <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:11, letterSpacing:'.04em', textTransform:'uppercase' }}>{n.label}</span>
            </button>
          ); })}
        </div>
        {toast && <RemarkToast msg={toast} />}
        {profileOpen && <Profile user={user} onClose={()=>setProfileOpen(false)} onSave={saveProfile} />}
      </div>
    );
  }

  const railW = railOpen ? 196 : 70;
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', background:T.color.graphite }}>
      {toast && <RemarkToast msg={toast} />}
      {/* collapsible rail — brand, nav, user chip; icon-only when collapsed */}
      <aside style={{ width:railW, flex:`0 0 ${railW}px`, display:'flex', flexDirection:'column', padding:railOpen?'18px 14px':'18px 0',
        borderRight:'1px solid '+T.color.line, background:steelPlate('#10161F','#0A0E15'), position:'relative', zIndex:8,
        transition:'width .22s cubic-bezier(.3,.8,.3,1), flex-basis .22s cubic-bezier(.3,.8,.3,1)' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:TEX.brushed, opacity:.4, pointerEvents:'none' }} />

        {/* brand row: hamburger + (logo/wordmark when open) */}
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:10,
          justifyContent:railOpen?'flex-start':'center' }}>
          <button onClick={()=>setRailOpen(o=>!o)} title={railOpen?'Collapse menu':'Expand menu'}
            style={{ width:38, height:38, flex:'0 0 auto', borderRadius:T.radius.md, display:'grid', placeItems:'center',
              color:T.color.steel200, border:'1px solid '+T.color.line, background:'rgba(146,164,196,.06)' }}>
            <Icon name="menu" size={20} />
          </button>
          {railOpen && <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
            <LogoMark size={30} />
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:T.font.display, fontWeight:800, fontSize:17, letterSpacing:'.01em', textTransform:'uppercase', lineHeight:1 }}>Embed<span style={{ color:T.color.amberHot }}>Yap</span></div>
              <div style={{ fontFamily:T.font.mono, fontSize:8.5, color:T.color.steel400, letterSpacing:'.12em', marginTop:3 }}>LACC · A101</div>
            </div>
          </div>}
        </div>

        <div style={{ position:'relative', zIndex:1, height:1, background:T.color.line, margin:railOpen?'16px 2px 14px':'16px 12px 14px' }} />

        {/* nav — labeled rows when open, centered icon tiles when collapsed */}
        <nav style={{ display:'flex', flexDirection:'column', gap:6, position:'relative', zIndex:1 }}>
          {NAV.map(n=>{ const on=screen===n.id; return (
            <button key={n.id} onClick={()=>setScreen(n.id)} title={n.label}
              style={{ display:'flex', alignItems:'center', justifyContent:railOpen?'flex-start':'center', gap:12,
                width:railOpen?'auto':46, height:railOpen?'auto':46, margin:railOpen?0:'0 auto',
                padding:railOpen?'10px 12px':0, borderRadius:T.radius.md,
                color:on?'#fff':T.color.steel200, background:on?'linear-gradient(180deg,#243047,#18212e)':(railOpen?'transparent':'rgba(146,164,196,.07)'),
                border:'1px solid '+(on?T.color.line:(railOpen?'transparent':T.color.line)), transition:'all .15s', textAlign:'left' }}>
              <Icon name={n.icon} size={railOpen?20:22} stroke={on?2.2:1.8} />
              {railOpen && <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:13, letterSpacing:'.04em', textTransform:'uppercase' }}>{n.label}</span>}
            </button>
          ); })}
        </nav>

        {/* user chip + sign out */}
        <div style={{ marginTop:'auto', position:'relative', zIndex:1, display:'flex', alignItems:'center',
          gap:10, padding:railOpen?'12px 8px 2px':'12px 0 2px', justifyContent:railOpen?'flex-start':'center',
          borderTop:'1px solid '+T.color.line, marginInline:railOpen?0:10 }}>
          <button onClick={()=>setProfileOpen(true)} title="Edit profile" style={{ width:34, height:34, borderRadius:9, flex:'0 0 auto', background:user.manager?accentPlate:steelPlate('#26313F','#1A2230'),
            color:'#fff', display:'grid', placeItems:'center', fontFamily:T.font.display, fontWeight:700, fontSize:user.avatarEmoji?17:13, border:'1px solid '+T.color.line, cursor:'pointer' }}>{user.avatarEmoji||user.initials}</button>
          {railOpen && <>
            <div onClick={()=>setProfileOpen(true)} style={{ minWidth:0, flex:1, cursor:'pointer' }}>
              <div style={{ fontFamily:T.font.display, fontWeight:600, fontSize:13, lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.name}{user.emojis&&user.emojis.length?' '+user.emojis.slice(0,3).join(''):''}</div>
              <div style={{ fontFamily:T.font.mono, fontSize:9.5, color:T.color.steel400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.manager?'MANAGER':user.role}</div>
            </div>
            <button onClick={signOut} title="Sign out" style={{ width:30, height:30, borderRadius:8, flex:'0 0 auto', display:'grid', placeItems:'center', color:T.color.steel400, border:'1px solid '+T.color.line, background:'rgba(0,0,0,.2)' }}><Icon name="power" size={16} /></button>
          </>}
        </div>
        {!railOpen && (
          <button onClick={signOut} title="Sign out" style={{ position:'relative', zIndex:1, margin:'8px auto 0', width:30, height:30, borderRadius:8, display:'grid', placeItems:'center', color:T.color.steel400, border:'1px solid '+T.color.line, background:'rgba(0,0,0,.2)' }}><Icon name="power" size={16} /></button>
        )}
      </aside>

      {/* main — full height, no top bar */}
      <div style={{ flex:1, minWidth:0, position:'relative' }}>{screenEl}</div>
      {profileOpen && <Profile user={user} onClose={()=>setProfileOpen(false)} onSave={saveProfile} />}
    </div>
  );
}

function PhoneHeader({ user, screen, onSignOut, onProfile }){
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 16px',
      borderBottom:'1px solid '+T.color.line, background:steelPlate('#10151E','#0B0F16'), zIndex:7 }}>
      <span style={{ fontFamily:T.font.display, fontWeight:800, fontSize:19, textTransform:'uppercase' }}>Embed<span style={{ color:T.color.amberHot }}>Yap</span></span>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onProfile} title="Edit profile" style={{ width:30, height:30, borderRadius:8, background:user.manager?accentPlate:steelPlate('#26313F','#1A2230'),
          color:'#fff', display:'grid', placeItems:'center', fontFamily:T.font.display, fontWeight:700, fontSize:user.avatarEmoji?15:12, border:'1px solid '+T.color.line }}>{user.avatarEmoji||user.initials}</button>
        <button onClick={onSignOut} style={{ color:T.color.steel400 }}><Icon name="power" size={18} /></button>
      </div>
    </div>
  );
}
/* motivational remark toast — fires after each tracked update */
function RemarkToast({ msg }){
  return (
    <div className="ey-fade" style={{ position:'fixed', bottom:isPhoneNow()?78:22, left:'50%', transform:'translateX(-50%)', zIndex:120,
      display:'flex', alignItems:'center', gap:9, padding:'11px 18px', borderRadius:T.radius.pill,
      background:accentPlate, color:'#fff', fontFamily:T.font.display, fontWeight:600, fontSize:14, letterSpacing:'.02em',
      boxShadow:T.shadow.accentGlow, border:'1px solid rgba(255,255,255,.18)', maxWidth:'90vw', whiteSpace:'nowrap' }}>
      <Icon name="check" size={16} /> {msg}
    </div>
  );
}
function isPhoneNow(){ return typeof window!=='undefined' && window.innerWidth<=760; }
window.App = App;
