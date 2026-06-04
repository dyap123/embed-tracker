/* EmbedYap — Crew: install-points leaderboard + Ironworker Run */
function Crew({ embeds, user, isPhone, crew }){
  const ROSTER = (crew && crew.length) ? crew : (window.CREW || CREW);
  const ranked = [...ROSTER].sort((a,b)=>(b.points||0)-(a.points||0));
  const topPts = (ranked[0] && ranked[0].points) || 1;
  const top3 = ranked.slice(0,3);
  const rest = ranked.slice(3);
  const order=[1,0,2]; // podium center = #1

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
      <div className="ey-fade" style={{ maxWidth:1080, margin:'0 auto', padding:isPhone?'18px 14px 90px':'28px 30px 60px' }}>
        <Header title="Crew" sub="Install points · rank ladder" />

        {/* podium */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, alignItems:'end', marginTop:20 }}>
          {order.map(idx=>{
            const c=top3[idx]; if(!c) return <div key={idx}/>;
            const place=idx+1; const tall=place===1;
            const medal=['#A6A0FF','#C7D0DE','#C45CCB'][idx];
            return (
              <Card key={c.id} pad={16} glow style={{ textAlign:'center', paddingTop:tall?22:16,
                border:'1px solid '+(place===1?'rgba(242,201,76,.45)':T.color.line),
                background: place===1?'linear-gradient(180deg,rgba(242,201,76,.1),#0F141C)':steelPlate('#161D29','#0F141C') }}>
                <div style={{ position:'relative', width:tall?64:52, height:tall?64:52, margin:'0 auto 10px' }}>
                  <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:steelPlate('#26313F','#1A2230'),
                    display:'grid', placeItems:'center', fontFamily:T.font.display, fontWeight:800, fontSize:tall?26:21,
                    border:'2px solid '+medal, color:'#fff' }}>{c.initials}</div>
                  <span style={{ position:'absolute', bottom:-6, right:-6, width:24, height:24, borderRadius:'50%', background:medal,
                    color:'#1b1206', fontFamily:T.font.display, fontWeight:800, fontSize:13, display:'grid', placeItems:'center', border:'2px solid #0F141C' }}>{place}</span>
                </div>
                <div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:tall?18:16, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                <div style={{ fontSize:11.5, color:T.color.steel300 }}>{c.role}</div>
                <div style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:tall?24:19, color:medal, marginTop:8 }}>{(c.points||0).toLocaleString()}</div>
                <div style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400, letterSpacing:'.1em' }}>{c.installs||0} INSTALLS</div>
              </Card>
            );
          })}
        </div>

        {/* ladder */}
        <Card pad={0} glow style={{ marginTop:14 }}>
          {rest.map((c,i)=>{
            const me = user && c.id===user.id;
            return (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:13, padding:'13px 18px',
                borderBottom: i<rest.length-1?'1px solid '+T.color.lineSoft:'none',
                background: me?'linear-gradient(90deg,rgba(126,120,240,.14),transparent)':'transparent' }}>
                <span style={{ fontFamily:T.font.display, fontWeight:800, fontSize:18, width:28, color:T.color.steel400 }}>{i+4}</span>
                <span style={{ width:38, height:38, borderRadius:9, flex:'0 0 auto', background:steelPlate('#26313F','#1A2230'),
                  display:'grid', placeItems:'center', fontFamily:T.font.display, fontWeight:700, fontSize:15, border:'1px solid '+T.color.line }}>{c.initials}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:T.font.display, fontWeight:600, fontSize:16 }}>{c.name}{me&&<span style={{color:T.color.amberHot,fontSize:12,marginLeft:8}}>YOU</span>}</div>
                  <div style={{ fontSize:12, color:T.color.steel300 }}>{c.role} · {c.installs||0} installs · {c.updates||0} updates</div>
                </div>
                {/* points bar */}
                <div style={{ width:isPhone?70:160, display:'flex', alignItems:'center', gap:10 }}>
                  {!isPhone && <div style={{ flex:1, height:6, borderRadius:4, background:'rgba(0,0,0,.3)', overflow:'hidden' }}>
                    <div style={{ width:((c.points||0)/topPts*100)+'%', height:'100%', background:'linear-gradient(90deg,#28355C,#7E78F0)', borderRadius:4 }} /></div>}
                  <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:14, color:'#fff', minWidth:46, textAlign:'right' }}>{c.points.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </Card>

        {/* the game */}
        <div style={{ marginTop:22 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
            <h2 style={{ fontFamily:T.font.display, fontWeight:800, fontSize:24, margin:0, textTransform:'uppercase', letterSpacing:'.02em' }}>Ironworker Run</h2>
            <span style={{ fontFamily:T.font.mono, fontSize:12, color:T.color.steel400 }}>BREAK-TIME ARCADE</span>
          </div>
          <div style={{ height:isPhone?420:440 }}>
            <Game user={user} isPhone={isPhone} />
          </div>
        </div>
      </div>
    </div>
  );
}
window.Crew = Crew;
