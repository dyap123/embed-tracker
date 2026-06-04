/* EmbedYap — Sign in (crew roster + manager PIN, industrial badge-in) */
function SignIn({ onSignIn, crew }){
  const ROSTER = (crew && crew.length) ? crew : (window.CREW || CREW);
  const [sel, setSel] = React.useState(null);
  const [pin, setPin] = React.useState('');
  const [err, setErr] = React.useState(false);
  const user = ROSTER.find(c=>c.id===sel);
  const needPin = user && user.manager;

  function badgeIn(){
    if (!user) return;
    if (needPin && pin !== user.pin){ setErr(true); return; }
    onSignIn(user);
  }
  React.useEffect(()=>{ setPin(''); setErr(false); }, [sel]);

  return (
    <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'minmax(0,1fr)', overflow:'auto',
      background:'radial-gradient(120% 90% at 20% 0%, #16223A 0%, #0C111A 60%)' }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:TEX.grain, opacity:.06, mixBlendMode:'overlay', pointerEvents:'none' }} />
      <div className="ey-signin" style={{ display:'grid', gridTemplateColumns:'minmax(300px,440px) minmax(0,1fr)', minHeight:'100%' }}>

        {/* brand / badge panel */}
        <div style={{ background:navyPlate, borderRight:'1px solid '+T.color.line, padding:'48px 44px',
          display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:TEX.brushed, opacity:.5, pointerEvents:'none' }} />
          <div style={{ position:'relative' }}>
            <Logo />
            <div style={{ marginTop:36, maxWidth:330 }}>
              <Kicker style={{ color:'rgba(180,200,235,.7)' }}>LA Convention Center · Foundations</Kicker>
              <h1 style={{ fontFamily:T.font.display, fontWeight:800, fontSize:46, lineHeight:1.0, margin:'14px 0 0',
                letterSpacing:'-.01em', color:'#fff', textTransform:'uppercase' }}>Badge in<br/>to the field.</h1>
              <p style={{ color:'rgba(220,230,245,.66)', fontSize:15, lineHeight:1.55, marginTop:16 }}>
                Track every embed — anchor rods, knife plates, posts, couplers, stub columns — from pour to install. Tap your name to start your shift.
              </p>
            </div>
          </div>
          <div style={{ position:'relative', display:'flex', gap:22, color:'rgba(180,200,235,.7)', fontFamily:T.font.mono, fontSize:12, letterSpacing:'.06em' }}>
            <span>SHIFT · DAY</span><span>·</span><span>CREW 10</span><span>·</span><span>v0.9</span>
          </div>
        </div>

        {/* roster */}
        <div style={{ padding:'48px clamp(20px,4vw,56px)', position:'relative' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <h2 style={{ fontFamily:T.font.display, fontWeight:700, fontSize:26, margin:0, textTransform:'uppercase', letterSpacing:'.02em' }}>Crew roster</h2>
            <span style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel400, letterSpacing:'.1em' }}>TAP YOUR NAME</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(208px,1fr))', gap:12, marginTop:24 }}>
            {ROSTER.map(c=>{
              const on = c.id===sel;
              return (
                <button key={c.id} onClick={()=>setSel(c.id)} style={{
                  display:'flex', alignItems:'center', gap:13, textAlign:'left',
                  background: on?'linear-gradient(180deg,#243047,#19212e)':'rgba(146,164,196,.045)',
                  border:'1px solid '+(on?'rgba(126,120,240,.6)':T.color.line),
                  borderRadius:T.radius.lg, padding:'13px 15px', transition:'all .15s',
                  boxShadow: on?'0 10px 30px -14px rgba(126,120,240,.6)':'none' }}>
                  <span style={{ width:44, height:44, borderRadius:10, flex:'0 0 auto',
                    background: on?T.color.amber:steelPlate('#26313F','#1A2230'),
                    color: on?'#fff':T.color.offwhite, display:'grid', placeItems:'center',
                    fontFamily:T.font.display, fontWeight:800, fontSize:18, border:'1px solid '+T.color.line }}>{c.initials}</span>
                  <span style={{ minWidth:0, flex:'1 1 auto', display:'flex', flexDirection:'column', gap:2 }}>
                    <div style={{ fontFamily:T.font.display, fontWeight:600, fontSize:17, letterSpacing:'.01em', lineHeight:1.15, whiteSpace:'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize:12, color:T.color.steel300, display:'flex', alignItems:'center', gap:6 }}>
                      {c.role}{c.manager && <Badge color={T.color.amber} style={{ padding:'1px 5px', fontSize:9.5 }}>PIN</Badge>}
                    </div>
                  </span>
                </button>
              );
            })}
          </div>

          {/* badge-in dock */}
          <div style={{ marginTop:28, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
            background:'rgba(0,0,0,.25)', border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:16 }}>
            <div style={{ flex:'1 1 200px', minWidth:0 }}>
              <Kicker>{user? (needPin?'Manager PIN required':'Ready') : 'Select a crew member'}</Kicker>
              <div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:20, marginTop:4, color: user?'#fff':T.color.steel400 }}>
                {user? user.name : '—'}
              </div>
            </div>
            {needPin && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="lock" size={17} style={{ color:err?T.color.red:T.color.steel300 }} />
                <input value={pin} onChange={e=>{ setErr(false); setPin(e.target.value.replace(/\D/g,'').slice(0,6)); }}
                  inputMode="numeric" placeholder="••••••" maxLength={6}
                  onKeyDown={e=>e.key==='Enter'&&badgeIn()}
                  style={{ ...inputStyle, width:150, fontFamily:T.font.mono, fontSize:22, letterSpacing:'.28em', textAlign:'center',
                    padding:'9px 12px', borderColor: err?T.color.red:T.color.line }} />
              </div>
            )}
            <Btn kind="primary" size="lg" icon="power" disabled={!user} onClick={badgeIn}
              style={{ opacity:user?1:.5, cursor:user?'pointer':'not-allowed' }}>Badge in</Btn>
          </div>
          {err && <div style={{ color:T.color.red, fontSize:13, marginTop:10, fontFamily:T.font.mono }}>✕ Wrong PIN — managers use 050103.</div>}
          {needPin && !err && <div style={{ color:T.color.steel400, fontSize:12, marginTop:10, fontFamily:T.font.mono }}>Manager PIN · 050103</div>}
        </div>
      </div>
      <style>{`@media (max-width:820px){ .ey-signin{ grid-template-columns:minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}

function LogoMark({ size=42 }){
  return (
    <span style={{ width:size, height:size, borderRadius:size*0.26, display:'grid', placeItems:'center', position:'relative',
      background:steelPlate('#1B2236','#0F1320'), border:'1px solid rgba(126,120,240,.5)',
      boxShadow:'0 0 0 1px rgba(126,120,240,.12), 0 8px 24px -10px rgba(126,120,240,.7), inset 0 1px 0 rgba(255,255,255,.06)' }}>
      <span style={{ position:'absolute', inset:0, borderRadius:size*0.26,
        background:'radial-gradient(120% 120% at 30% 20%, rgba(126,120,240,.22), transparent 60%)' }} />
      {/* hex bolt-head — the embed anchor mark */}
      <svg width={size*0.64} height={size*0.64} viewBox="0 0 24 24" fill="none" style={{ position:'relative' }}>
        <path d="M12 2.4 20 7v10l-8 4.6L4 17V7l8-4.6Z" stroke="#A6A0FF" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3.5" stroke="#7E78F0" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="1.05" fill="#A6A0FF" />
      </svg>
    </span>
  );
}

function Logo({ size=1 }){
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
      <LogoMark size={38*size} />
      <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:27*size, letterSpacing:'.02em', color:'#fff', textTransform:'uppercase' }}>
        Embed<span style={{ color:T.color.amberHot }}>Yap</span>
      </span>
    </div>
  );
}
Object.assign(window, { SignIn, Logo, LogoMark });
