/* EmbedYap — Dashboard: KPIs, installed-over-time, by-area, by-sequence, next pour, exports */
function Dashboard({ embeds, isPhone }){
  const k = kpis(embeds);
  const series = installSeries(embeds);
  const [toast, setToast] = React.useState(null);
  function exp(kind){ const f = window.exportEmbeds(embeds, kind); if(f){ setToast(f); setTimeout(()=>setToast(null), 2600); } }

  const byArea = AREAS.map(a=>{ const list=embeds.filter(e=>e.area===a); return { a, pinned:list.length, installed:list.filter(e=>e.installed).length }; });
  const bySeq = SEQUENCES.map(s=>{ const list=embeds.filter(e=>e.sequence===s); return { s, pinned:list.length, installed:list.filter(e=>e.installed).length }; });
  // next pour = embeds tagged on the plan (zone "Next pour" toggle)
  const nextPins = embeds.filter(e=>e.nextPour);
  const nextRemaining = nextPins.filter(e=>!e.installed).length;
  const ngMap = {}; nextPins.forEach(e=>{ const key=`${seqLabel(e.sequence)} · Ph ${e.phase||'1'} · ${e.area}`; const g=ngMap[key]||(ngMap[key]={total:0,inst:0}); g.total++; if(e.installed) g.inst++; });
  const nextGroups = Object.entries(ngMap).map(([k,v])=>({ k, ...v })).sort((a,b)=>a.k.localeCompare(b.k, undefined, {numeric:true}));

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
      <div className="ey-fade" style={{ maxWidth:1180, margin:'0 auto', padding:isPhone?'18px 14px 90px':'28px 30px 60px' }}>
        <Header title="Dashboard" sub="Embed install — live status">
          <Btn kind="ghost" size="sm" icon="export" onClick={()=>exp('csv')}>CSV</Btn>
          <Btn kind="navy" size="sm" icon="export" onClick={()=>exp('pdf')}>PDF</Btn>
        </Header>

        {/* KPI tiles */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${isPhone?2:5},1fr)`, gap:12, marginTop:18 }}>
          <Kpi label="Expected" value={k.expected} sub="design count" />
          <Kpi label="Pinned" value={k.pinned} sub="placed on plan" accent={T.color.blue} />
          <Kpi label="Installed" value={k.installed} sub="cast & set" accent={T.color.green} />
          <Kpi label="Complete" value={k.pct+'%'} sub="of pinned" accent={T.color.amber} ring={k.pct} />
          <Kpi label="Open RFIs" value={k.openRFI} sub="needs answer" accent={T.color.red} />
        </div>

        {/* by area + by sequence */}
        <div style={{ display:'grid', gridTemplateColumns: isPhone?'1fr':'1fr 1fr', gap:14, marginTop:14 }}>
          <Card pad={20} glow>
            <ChartHead title="Install by area" note="installed / placed" />
            <div style={{ display:'flex', flexDirection:'column', gap:13, marginTop:14 }}>
              {byArea.map(r=>(
                <BarRow key={r.a} label={'Area '+r.a} value={r.installed} max={r.pinned}
                  color={['#2FD6A6','#4FA3F2','#C45CCB','#F0556B'][AREAS.indexOf(r.a)]} />
              ))}
            </div>
          </Card>
          <Card pad={20} glow>
            <ChartHead title="Installed by sequence" note="installed / placed" />
            <SeqBars data={bySeq} />
          </Card>
        </div>

        {/* installed over time + next pour */}
        <div style={{ display:'grid', gridTemplateColumns: isPhone?'1fr':'1.6fr 1fr', gap:14, marginTop:14 }}>
          <Card pad={20} glow>
            <ChartHead title="Installed over time" note={`${series.length} pour days · cumulative`} />
            <AreaChart series={series} total={k.pinned} />
          </Card>
          <Card pad={20} glow>
            <ChartHead title="Next pour" note="tagged on the plan" />
            {nextPins.length===0 ? (
              <div style={{ marginTop:16, fontSize:13, color:T.color.steel400, lineHeight:1.55 }}>
                No next pour tagged yet. On the <b style={{color:'#fff'}}>Plan</b>, draw a markup and turn on <b style={{color:T.color.pink}}>Next pour</b> to flag the embeds for the upcoming pour.
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:12 }}>
                  <span style={{ fontFamily:T.font.display, fontWeight:800, fontSize:40, lineHeight:.9, color:T.color.pink }}>{nextRemaining}</span>
                  <span style={{ fontSize:13, color:T.color.steel300 }}>embeds to set<br/><span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400 }}>{nextPins.length} tagged total</span></span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:14 }}>
                  {nextGroups.map(g=>(
                    <div key={g.k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'9px 12px', borderRadius:T.radius.md,
                      background:'rgba(255,111,181,.08)', border:'1px solid rgba(255,111,181,.3)' }}>
                      <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:14 }}>{g.k}</span>
                      <span style={{ fontFamily:T.font.mono, fontSize:13, color: g.inst===g.total?T.color.green:T.color.steel200 }}>{g.inst}/{g.total} set</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* anchor bolts × sequence matrix */}
        <Card pad={0} glow style={{ marginTop:14, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px 0' }}><ChartHead title="Anchor bolts by sequence" note="count per mark · installed / total" /></div>
          <SeqMatrix embeds={embeds} isPhone={isPhone} />
        </Card>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:isPhone?80:24, left:'50%', transform:'translateX(-50%)', zIndex:60,
          background:steelPlate('#1B2433','#0E141D'), border:'1px solid rgba(47,214,166,.4)', borderRadius:T.radius.md,
          padding:'12px 18px', display:'flex', alignItems:'center', gap:10, boxShadow:T.shadow.panel, animation:'panelInUp .3s both' }}>
          <Icon name="check" size={16} style={{ color:T.color.green }} />
          <span style={{ fontFamily:T.font.body, fontSize:14 }}>Exported <b>{toast}</b></span>
        </div>
      )}
    </div>
  );
}

function Header({ title, sub, children }){
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
      <div>
        <Kicker>{sub}</Kicker>
        <h1 style={{ fontFamily:T.font.display, fontWeight:800, fontSize:34, margin:'6px 0 0', textTransform:'uppercase', letterSpacing:'.01em' }}>{title}</h1>
      </div>
      <div style={{ display:'flex', gap:8 }}>{children}</div>
    </div>
  );
}
function ChartHead({ title, note }){
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
      <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:17, textTransform:'uppercase', letterSpacing:'.03em' }}>{title}</span>
      <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400, letterSpacing:'.06em' }}>{note}</span>
    </div>
  );
}

function Kpi({ label, value, sub, accent=T.color.steel200, ring }){
  return (
    <Card pad={16} style={{ overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-10, right:-10, width:60, height:60, borderRadius:'50%',
        background:`radial-gradient(circle, ${accent}22, transparent 70%)` }} />
      <Kicker>{label}</Kicker>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, marginTop:8 }}>
        <span style={{ fontFamily:T.font.display, fontWeight:800, fontSize:38, lineHeight:.9, color:accent==='#9DAAC0'?'#fff':accent }}>{value}</span>
      </div>
      <div style={{ fontSize:11.5, color:T.color.steel400, marginTop:6, fontFamily:T.font.mono, letterSpacing:'.04em' }}>{sub}</div>
      {ring!=null && (
        <div style={{ position:'absolute', bottom:14, right:14 }}>
          <Ring pct={ring} color={accent} />
        </div>
      )}
    </Card>
  );
}
function Ring({ pct, color, size=34 }){
  const r=(size-5)/2, c=2*Math.PI*r;
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(150,170,205,.18)" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c*(1-pct/100)} style={{ transition:'stroke-dashoffset 1s ease' }} />
    </svg>
  );
}

function AreaChart({ series, total }){
  const W=560,H=180,pad=8; const max=series[series.length-1]?.cum||1;
  const xs=series.map((_,i)=> pad + (W-2*pad)*(i/Math.max(1,series.length-1)));
  const ys=series.map(d=> H-pad - (H-2*pad)*(d.cum/max));
  const path = xs.map((x,i)=>`${i?'L':'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const area = `${path} L${xs[xs.length-1]} ${H-pad} L${xs[0]} ${H-pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', marginTop:10, display:'block' }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2FD6A6" stopOpacity=".42" /><stop offset="100%" stopColor="#2FD6A6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0,.25,.5,.75,1].map(g=>(<line key={g} x1={pad} x2={W-pad} y1={pad+(H-2*pad)*g} y2={pad+(H-2*pad)*g} stroke="rgba(150,170,205,.1)" strokeWidth="1" />))}
      <path d={area} fill="url(#ag)" />
      <path d={path} fill="none" stroke="#2FD6A6" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x,i)=> i%4===0 || i===xs.length-1 ? <circle key={i} cx={x} cy={ys[i]} r="3" fill="#0C111A" stroke="#2FD6A6" strokeWidth="2" />:null)}
      <text x={pad} y={pad+10} fill={T.color.steel400} fontSize="11" fontFamily="'JetBrains Mono',monospace">{max} installed</text>
    </svg>
  );
}

function BarRow({ label, value, max, color }){
  const pct = max? Math.round(value/max*100):0;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
        <span style={{ fontFamily:T.font.display, fontWeight:600, letterSpacing:'.02em' }}>{label}</span>
        <span style={{ fontFamily:T.font.mono, color:T.color.steel300, fontSize:12 }}>{value}<span style={{ color:T.color.steel400 }}>/{max} · {pct}%</span></span>
      </div>
      <div style={{ height:10, borderRadius:6, background:'rgba(0,0,0,.32)', overflow:'hidden', border:'1px solid '+T.color.line }}>
        <div style={{ width:pct+'%', height:'100%', background:`linear-gradient(90deg,${color}cc,${color})`, borderRadius:6,
          transition:'width .9s cubic-bezier(.2,.8,.2,1)', boxShadow:`0 0 12px -2px ${color}` }} />
      </div>
    </div>
  );
}

/* anchor-bolt mark × sequence count matrix (installed / total per cell) */
function SeqMatrix({ embeds, isPhone }){
  const { seqs, marks, seqTotals } = embedsBySequence(embeds);
  const cols = `120px repeat(${seqs.length}, 1fr) 64px`;
  const cell = { textAlign:'center', fontFamily:T.font.mono, fontSize:12.5, padding:'8px 4px' };
  const head = { ...cell, fontSize:10.5, letterSpacing:'.1em', textTransform:'uppercase', color:T.color.steel400 };
  if(!marks.length) return <div style={{ padding:'18px 20px', color:T.color.steel400, fontFamily:T.font.mono, fontSize:12.5 }}>No embeds yet.</div>;
  return (
    <div style={{ marginTop:12, maxHeight:340, overflow:'auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', borderBottom:'1px solid '+T.color.line, position:'sticky', top:0, background:steelPlate('#161D29','#10151E'), zIndex:1 }}>
        <span style={{ ...head, textAlign:'left', paddingLeft:20 }}>Mark</span>
        {seqs.map(s=><span key={s} style={head}>{seqLabel(s)}</span>)}
        <span style={{ ...head, paddingRight:16 }}>Total</span>
      </div>
      {marks.map((m,i)=>(
        <div key={m.mark} style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', borderBottom: i<marks.length-1?'1px solid '+T.color.lineSoft:'none' }}>
          <span style={{ ...cell, textAlign:'left', paddingLeft:20, color:T.color.amberHot, fontWeight:700 }}>{m.mark}</span>
          {seqs.map(s=>{ const c=m.seq[s]||{pinned:0,inst:0}; const done=c.pinned>0&&c.inst===c.pinned;
            return <span key={s} style={{ ...cell, color: c.pinned?(done?T.color.green:'#fff'):T.color.steel600 }}>
              {c.pinned? <span>{c.inst}<span style={{ color:T.color.steel400 }}>/{c.pinned}</span></span> : '·'}</span>; })}
          <span style={{ ...cell, paddingRight:16, fontWeight:700 }}>{m.inst}<span style={{ color:T.color.steel400 }}>/{m.total}</span></span>
        </div>
      ))}
      <div style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', borderTop:'1px solid '+T.color.line, background:'rgba(30,58,107,.14)' }}>
        <span style={{ ...cell, textAlign:'left', paddingLeft:20, fontWeight:700, textTransform:'uppercase', fontSize:11 }}>Total</span>
        {seqs.map(s=><span key={s} style={{ ...cell, fontWeight:700 }}>{seqTotals[s].inst}<span style={{ color:T.color.steel400 }}>/{seqTotals[s].pinned}</span></span>)}
        <span style={{ ...cell, paddingRight:16, fontWeight:700 }}>{marks.reduce((a,m)=>a+m.inst,0)}<span style={{ color:T.color.steel400 }}>/{marks.reduce((a,m)=>a+m.total,0)}</span></span>
      </div>
    </div>
  );
}

function SeqBars({ data }){
  const max = Math.max(...data.map(d=>d.pinned),1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:14, height:172, marginTop:14, padding:'0 4px' }}>
      {data.map(d=>(
        <div key={d.s} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, height:'100%' }}>
          <div style={{ flex:1, width:'100%', maxWidth:54, display:'flex', flexDirection:'column', justifyContent:'flex-end', position:'relative' }}>
            <div title={`${d.pinned} pinned`} style={{ height:(d.pinned/max*100)+'%', minHeight:4, background:'rgba(79,163,242,.18)',
              border:'1px solid rgba(79,163,242,.35)', borderRadius:'6px 6px 0 0', position:'relative', transformOrigin:'bottom', animation:'growBar .8s ease both' }}>
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:(d.installed/d.pinned*100||0)+'%',
                background:'linear-gradient(180deg,#2FD6A6,#1f9e7e)', borderRadius:'0 0 0 0', boxShadow:'0 0 14px -2px #2FD6A6' }} />
              <span style={{ position:'absolute', top:-20, left:0, right:0, textAlign:'center', fontFamily:T.font.mono, fontSize:11.5, fontWeight:700, color:T.color.green }}>{d.installed}</span>
            </div>
          </div>
          <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:13.5, color:T.color.steel200, textAlign:'center', lineHeight:1.05 }}>{seqLabel(d.s)}</span>
          <span style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400, marginTop:-4 }}>{d.installed}/{d.pinned}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Dashboard, Header, Kpi });
