/* EmbedYap — Ironworker Run: canvas rendering + game-over leaderboard */

function drawScene(ctx, E){
  const W=E.W, H=E.H, gy=E.groundY();
  // sky / steel backdrop
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#10161F'); g.addColorStop(.6,'#0C111A'); g.addColorStop(1,'#0A0E15');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // parallax girders (vertical columns receding)
  ctx.save();
  const off=(E.run*0.4)%160;
  for(let x=-off; x<W+160; x+=160){
    ctx.fillStyle='rgba(40,77,140,0.06)'; ctx.fillRect(x,0,46,gy);
    ctx.strokeStyle='rgba(96,140,210,0.07)'; ctx.lineWidth=1; ctx.strokeRect(x,0,46,gy);
  }
  // faint diagonal bracing
  const off2=(E.run*0.7)%240;
  ctx.strokeStyle='rgba(96,140,210,0.05)'; ctx.lineWidth=2;
  for(let x=-off2; x<W+240; x+=240){ ctx.beginPath(); ctx.moveTo(x,gy-10); ctx.lineTo(x+120,40); ctx.stroke(); }
  ctx.restore();

  // gaps: regions where beam is missing
  const gaps=E.obs.filter(o=>o.kind==='gap');
  // beam top flange
  function beamSegment(x0,x1){
    if(x1<=x0) return;
    const bg=ctx.createLinearGradient(0,gy,0,gy+26); bg.addColorStop(0,'#3A485E'); bg.addColorStop(.18,'#2B3749'); bg.addColorStop(1,'#161B24');
    ctx.fillStyle=bg; ctx.fillRect(x0,gy,x1-x0,26);
    ctx.fillStyle='rgba(157,170,192,0.55)'; ctx.fillRect(x0,gy,x1-x0,2); // top highlight
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x0,gy+24,x1-x0,2);
    // rivets
    ctx.fillStyle='rgba(157,170,192,0.4)';
    for(let rx=x0 - (E.run%26); rx<x1; rx+=26){ if(rx>x0+4){ ctx.beginPath(); ctx.arc(rx,gy+13,2.1,0,7); ctx.fill(); } }
    // web below
    ctx.fillStyle='#10151D'; ctx.fillRect(x0+8,gy+26,x1-x0-16,H-gy-26);
    ctx.fillStyle='rgba(96,140,210,0.05)'; ctx.fillRect((x0+x1)/2-3,gy+26,6,H-gy-26);
  }
  // build beam minus gaps
  let segs=[[0,W]];
  for(const gp of gaps){ const ns=[]; for(const [a,b] of segs){ if(gp.x>b||gp.x+gp.w<a){ ns.push([a,b]); } else { if(a<gp.x) ns.push([a,gp.x]); if(gp.x+gp.w<b) ns.push([gp.x+gp.w,b]); } } segs=ns; }
  for(const [a,b] of segs) beamSegment(a,b);
  // gap edges glow
  for(const gp of gaps){ ctx.fillStyle='rgba(126,120,240,0.6)'; ctx.fillRect(gp.x-2,gy,2,26); ctx.fillRect(gp.x+gp.w,gy,2,26); }

  // obstacles
  for(const o of E.obs){ if(o.kind==='gap') continue; drawObstacle(ctx,o,gy); }

  // player
  drawIron(ctx, W*0.16, gy + E.player.y, E.player, E.run, E.player.onGround);

  // sparks
  for(const s of E.sparks){ ctx.globalAlpha=Math.max(0,s.life*2.2); ctx.fillStyle= s.life>0.25?'#CFE9FF':'#52E6E0';
    ctx.fillRect(s.x,s.y,2.4,2.4); } ctx.globalAlpha=1;
}

function drawObstacle(ctx,o,gy){
  const x=o.x;
  if(o.kind==='high'){
    const y=gy-o.float-o.h;
    if(o.draw==='knife'){ // knife plate up high
      ctx.fillStyle='#4FA3F2'; ctx.fillRect(x,y,o.w,o.h);
      ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(x,y,o.w,3);
      ctx.fillStyle='#0C111A'; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(x+10+i*14,y+o.h/2,2.4,0,7); ctx.fill(); }
      ctx.strokeStyle='#28355C'; ctx.lineWidth=2; ctx.strokeRect(x,y,o.w,o.h);
    } else { // embed post hanging
      ctx.fillStyle='#536B8A'; ctx.fillRect(x+o.w/2-5,y,10,o.h+10);
      ctx.fillStyle='#2B3749'; ctx.fillRect(x,y,o.w,9);
    }
    // tether line to top
    ctx.strokeStyle='rgba(150,170,205,.25)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x+o.w/2,y); ctx.lineTo(x+o.w/2,0); ctx.stroke();
  } else {
    const y=gy-o.h;
    if(o.draw==='rod'){ ctx.fillStyle='#F0556B'; ctx.fillRect(x+o.w/2-3,y,6,o.h); ctx.fillStyle='#9DAAC0'; ctx.fillRect(x+o.w/2-6,y+o.h*0.2,12,4);
      for(let i=0;i<3;i++){ ctx.fillStyle='#0C111A'; ctx.fillRect(x+o.w/2-3,y+8+i*7,6,2); } }
    else if(o.draw==='coupler'){ ctx.fillStyle='#7E8DA6'; ctx.fillRect(x,y,o.w,o.h); ctx.fillStyle='#536B8A'; ctx.fillRect(x+3,y+3,o.w-6,o.h-6);
      ctx.strokeStyle='#0C111A'; ctx.lineWidth=2; for(let i=0;i<o.h;i+=6){ ctx.beginPath(); ctx.moveTo(x,y+i); ctx.lineTo(x+o.w,y+i); ctx.stroke(); } }
    else { ctx.fillStyle='#3A485E'; ctx.fillRect(x,y,o.w,o.h); ctx.fillStyle='#536B8A'; ctx.fillRect(x-3,y,o.w+6,7); ctx.fillStyle='#2B3749'; ctx.fillRect(x-3,gy-7,o.w+6,7); }
    ctx.fillStyle='rgba(240,85,107,.22)'; ctx.fillRect(x-2,y-2,o.w+4,2);
  }
}

// chunky vector ironworker in hi-vis vest + hard hat
function drawIron(ctx, x, feetY, p, run, onGround){
  const duck=p.duck; const h= duck?26:46, w=30, top=feetY-h;
  const navy='#28355C', vest='#52E6E0', stripe='#EAF2FF', skin='#C68A5E', hat='#A6A0FF';
  const phase=Math.sin(run*0.9);
  ctx.save(); ctx.translate(x,0);
  // shadow
  ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(w/2, feetY+3, w*0.5, 4, 0,0,7); ctx.fill();
  // legs
  ctx.fillStyle=navy; const legY=top+h-14;
  if(onGround && !duck){ const a=phase*7; ctx.fillRect(8, legY, 6, 14+a); ctx.fillRect(17, legY, 6, 14-a);
    ctx.fillStyle='#11151C'; ctx.fillRect(7,legY+14+a-3,9,3); ctx.fillRect(17,legY+14-a-3,9,3); }
  else { ctx.fillRect(8,legY,6,duck?6:11); ctx.fillRect(17,legY,6,duck?6:11);
    ctx.fillStyle='#11151C'; ctx.fillRect(7,legY+(duck?6:11)-3,9,3); ctx.fillRect(17,legY+(duck?6:11)-3,9,3); }
  // torso vest
  const bodyH= duck?16:24, bodyY= top+(duck?8:6);
  ctx.fillStyle=vest; ctx.fillRect(5,bodyY,20,bodyH);
  ctx.fillStyle=stripe; ctx.fillRect(5,bodyY+bodyH*0.34,20,3); ctx.fillRect(5,bodyY+bodyH*0.64,20,3);
  ctx.fillStyle='#13294B'; ctx.fillRect(13,bodyY,4,bodyH); // zipper
  // arm
  ctx.fillStyle=vest; const armSwing=onGround&&!duck?phase*6:0; ctx.fillRect(22,bodyY+2, 5, 13); ctx.save(); ctx.translate(24,bodyY+12); ctx.rotate(armSwing*0.03); ctx.restore();
  ctx.fillStyle=skin; ctx.fillRect(22,bodyY+13,5,4);
  // head
  ctx.fillStyle=skin; ctx.fillRect(9,top-(duck?-2:2),13,12);
  // hard hat
  ctx.fillStyle=hat; ctx.beginPath(); ctx.ellipse(15.5, top+(duck?2:-1), 10, 7, 0, Math.PI,0); ctx.fill();
  ctx.fillRect(5.5, top+(duck?1:-2), 20, 3); ctx.fillStyle='#7E78F0'; ctx.fillRect(14,top+(duck?-3:-7),3,6);
  ctx.restore();
}

function GameOver({ score, board, rank, user, onRetry, isPhone }){
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:isPhone?'column':'row',
      background:'radial-gradient(circle at 40% 30%, rgba(12,17,26,.7), rgba(8,11,16,.93))', backdropFilter:'blur(2px)' }}>
      {/* score */}
      <div style={{ flex:'1 1 0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24,
        borderRight:isPhone?'none':'1px solid '+T.color.line }}>
        <Kicker style={{ color:T.color.steel300 }}>Run complete</Kicker>
        <div style={{ fontFamily:T.font.display, fontWeight:800, fontSize:isPhone?60:76, lineHeight:.9, color:T.color.amberHot,
          margin:'8px 0 2px', textShadow:'0 0 30px rgba(126,120,240,.6)', animation:'stampIn .5s both' }}>{score}</div>
        <div style={{ fontFamily:T.font.mono, fontSize:13, letterSpacing:'.2em', color:T.color.steel300 }}>FEET WALKED</div>
        {rank && <Badge color={T.color.amber} fill style={{ marginTop:14, fontSize:12 }}>{rank===1?'🏆 NEW #1':'RANKED #'+rank}</Badge>}
        <Btn kind="primary" size="lg" icon="power" style={{ marginTop:20 }} onClick={onRetry}>Run again</Btn>
      </div>
      {/* leaderboard */}
      <div style={{ flex:'1 1 0', padding:isPhone?'14px 18px 18px':24, overflowY:'auto', minHeight:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <Icon name="trophy" size={17} style={{ color:T.color.amber }} />
          <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:17, textTransform:'uppercase', letterSpacing:'.06em' }}>Top runs</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {board.slice(0,7).map((r,i)=>{
            const me = r.user===(user?.name) && r.score===score;
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'8px 11px', borderRadius:T.radius.sm,
                background: me?'linear-gradient(90deg,rgba(126,120,240,.22),transparent)':'rgba(146,164,196,.05)',
                border:'1px solid '+(me?'rgba(126,120,240,.45)':T.color.lineSoft) }}>
                <span style={{ fontFamily:T.font.display, fontWeight:800, fontSize:16, width:22, color:i===0?T.color.amberHot:i<3?'#fff':T.color.steel400 }}>{i+1}</span>
                <span style={{ flex:1, fontFamily:T.font.body, fontWeight:600, fontSize:14, color:me?'#fff':T.color.offwhite }}>{r.user}{me&&' (you)'}</span>
                <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:14, color:me?T.color.amberHot:T.color.steel200 }}>{r.score}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { drawScene, drawIron, drawObstacle, GameOver });
