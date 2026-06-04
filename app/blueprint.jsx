/* EmbedYap — blueprint map background.
   A quiet, re-rendered structural plan (column grid + pile layout) in the
   EmbedYap palette. Drawn from the LACC grid labels, NOT the noisy PDF.
   Lives in a 1600×1200 (4:3) coordinate space; pins overlay by % so they
   stay aligned under pan/zoom. */
const BP_W = 1600, BP_H = 1200;

const Blueprint = React.memo(function Blueprint({ grid }){
  // read the live (editable) grid config — colX/rowY already honor custom spacing
  const COLS = gridCols(), ROWS = gridRows();
  const cx = i => colX(i)*BP_W;
  const cy = i => rowY(i)*BP_H;
  const left = cx(0), right = cx(COLS.length-1), top = cy(0), bot = cy(ROWS.length-1);

  const piles = [];
  for (let ci=0; ci<COLS.length; ci++)
    for (let ri=0; ri<ROWS.length; ri++)
      piles.push([cx(ci), cy(ri), ci, ri]);

  const line = 'rgba(150,170,205,0.16)';
  const lineMaj = 'rgba(150,170,205,0.30)';
  const navyLine = 'rgba(96,140,210,0.22)';
  const lbl = 'rgba(170,188,218,0.55)';

  return (
    <svg viewBox={`0 0 ${BP_W} ${BP_H}`} preserveAspectRatio="none"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block' }}>
      <defs>
        <radialGradient id="bpbg" cx="42%" cy="36%" r="85%">
          <stop offset="0%" stopColor="#19222F" />
          <stop offset="55%" stopColor="#121925" />
          <stop offset="100%" stopColor="#0C111A" />
        </radialGradient>
        <pattern id="fine" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgba(150,170,205,0.05)" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width={BP_W} height={BP_H} fill="url(#bpbg)" />
      <rect width={BP_W} height={BP_H} fill="url(#fine)" />

      {/* building footprint — full slab rectangle (uniform navy tint across the whole plan) */}
      <rect x={left-26} y={top-26} width={(right+26)-(left-26)} height={(bot+26)-(top-26)}
        fill="rgba(30,58,107,0.10)" stroke={navyLine} strokeWidth="2" />

      {/* structural grid lines */}
      {COLS.map((c,i)=>(
        <line key={'cl'+i} x1={cx(i)} y1={top-26} x2={cx(i)} y2={bot+26}
          stroke={i%3===0?lineMaj:line} strokeWidth={i%3===0?1.4:1} strokeDasharray={i%3===0?'none':'2 7'} />
      ))}
      {ROWS.map((r,i)=>(
        <line key={'rl'+i} x1={left-26} y1={cy(i)} x2={right+26} y2={cy(i)}
          stroke={i%4===0?lineMaj:line} strokeWidth={i%4===0?1.4:1} strokeDasharray={i%4===0?'none':'2 7'} />
      ))}

      {/* pile / footing dots at intersections */}
      {piles.map(([x,y],k)=>(
        <rect key={'p'+k} x={x-4} y={y-4} width="8" height="8" rx="1.5"
          fill="none" stroke="rgba(150,170,205,0.20)" strokeWidth="1" />
      ))}

      {/* column grid bubbles — top + left edges */}
      {COLS.map((c,i)=>(
        <g key={'cb'+i}>
          <circle cx={cx(i)} cy={top-46} r="13" fill="rgba(12,17,26,0.7)" stroke={lineMaj} strokeWidth="1.2" />
          <text x={cx(i)} y={top-46} fill={lbl} fontSize="14" fontFamily="'JetBrains Mono',monospace"
            textAnchor="middle" dominantBaseline="central">{c}</text>
        </g>
      ))}
      {ROWS.map((r,i)=>(
        <g key={'rb'+i}>
          <circle cx={left-48} cy={cy(i)} r="12" fill="rgba(12,17,26,0.7)" stroke={lineMaj} strokeWidth="1.2" />
          <text x={left-48} y={cy(i)} fill={lbl} fontSize="12" fontFamily="'JetBrains Mono',monospace"
            textAnchor="middle" dominantBaseline="central">{r}</text>
        </g>
      ))}

      {/* quiet north arrow + scale, lower-right */}
      <g opacity="0.5" transform={`translate(${right-30},${bot-6})`}>
        <line x1="0" y1="0" x2="0" y2="-34" stroke={lbl} strokeWidth="1.4" />
        <path d="M0 -40 L-5 -28 L0 -32 L5 -28 Z" fill={lbl} />
        <text x="0" y="14" fill={lbl} fontSize="12" fontFamily="'JetBrains Mono',monospace" textAnchor="middle">N</text>
      </g>
      <g opacity="0.45" transform={`translate(${left-4},${bot+44})`}>
        <line x1="0" y1="0" x2="120" y2="0" stroke={lbl} strokeWidth="1.4" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke={lbl} strokeWidth="1.4" />
        <line x1="120" y1="-4" x2="120" y2="4" stroke={lbl} strokeWidth="1.4" />
        <text x="60" y="16" fill={lbl} fontSize="11" fontFamily="'JetBrains Mono',monospace" textAnchor="middle">20'-0"</text>
      </g>
    </svg>
  );
});
window.Blueprint = Blueprint;
window.BP_W = BP_W; window.BP_H = BP_H;
