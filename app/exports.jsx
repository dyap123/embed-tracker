/* EmbedYap — report exports: CSV + PDF (jsPDF + autotable), plus xlsx.
   Reports cover: embed count by sequence, installed by sequence, and overall.
   Exposed on window so Dashboard / Inventory can call them from buttons. */
(function(){
  const stamp = ()=> new Date().toISOString().slice(0,10);
  const BRAND = [30,58,107];
  function haveXLSX(){ return !!window.XLSX; }
  function jsPDFctor(){ return window.jspdf && window.jspdf.jsPDF; }
  function autoTable(doc, opts){
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === 'function') return window.jspdf.autoTable(doc, opts);
    throw new Error('autotable plugin missing');
  }

  // ---- lazy-load the heavy export libs only when an export actually runs ----
  // SheetJS (~1MB) + jsPDF/autotable (~0.4MB) are no longer in index.html; they
  // load on the first XLSX/PDF export, so a normal page view never pays for them.
  const LIB = {
    xlsx:      'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
    jspdf:     'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  };
  const _loading = {};
  function loadScript(url){
    if (_loading[url]) return _loading[url];
    return _loading[url] = new Promise((resolve, reject)=>{
      const s = document.createElement('script'); s.src = url; s.async = true;
      s.onload = ()=> resolve();
      s.onerror = ()=>{ delete _loading[url]; reject(new Error('Failed to load '+url)); };
      document.head.appendChild(s);
    });
  }
  async function ensureXLSX(){ if(!window.XLSX){ try{ await loadScript(LIB.xlsx); }catch(e){} } return haveXLSX(); }
  async function ensurePDF(){
    if(!jsPDFctor()){ try{ await loadScript(LIB.jspdf); }catch(e){} }
    try{ await loadScript(LIB.autotable); }catch(e){}        // attaches autoTable to the jsPDF prototype
    return !!jsPDFctor();
  }
  // show a wait cursor while a first-time lib download is in flight
  async function withBusy(p){ const b=document.body&&document.body.style; const prev=b?b.cursor:''; if(b)b.cursor='progress';
    try{ return await p; } finally{ if(b)b.cursor=prev||''; } }
  // ---- CSV helpers ----
  function esc(v){ v=(v==null?'':String(v)); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
  function csvOf(rows){ if(!rows.length) return ''; const k=Object.keys(rows[0]); return [k.join(','), ...rows.map(r=>k.map(x=>esc(r[x])).join(','))].join('\n'); }
  function csvAOA(head, body){ return [head.map(esc).join(','), ...body.map(r=>r.map(esc).join(','))].join('\n'); }
  function download(name, text, mime){ const b=new Blob([text],{type:mime||'text/plain'}); const u=URL.createObjectURL(b);
    const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),1500); }

  // ---- styled-xlsx helpers (Webcor green headers, borders, formulas) ----
  const WEBCOR='6CB33F', BAND='E8F4E0', INK='1B2433', LINE='D6DCE4';
  function thinB(){ const s={ style:'thin', color:{rgb:LINE} }; return { top:s,bottom:s,left:s,right:s }; }
  function hdrStyle(){ return { fill:{ patternType:'solid', fgColor:{rgb:WEBCOR} }, font:{ bold:true, color:{rgb:'FFFFFF'}, sz:11 }, alignment:{ horizontal:'center', vertical:'center', wrapText:true }, border:thinB() }; }
  function bodyStyle(){ return { border:thinB(), font:{ sz:10.5, color:{rgb:INK} }, alignment:{ vertical:'center' } }; }
  function bandStyle(){ return { fill:{ patternType:'solid', fgColor:{rgb:BAND} }, font:{ bold:true, sz:11, color:{rgb:'2E6B1F'} }, border:thinB() }; }
  // build a styled worksheet from array-of-arrays. opts: {headerRows, widths, bands:[rowIdx], formulas:[{r,c,f,z}], boldRows:[rowIdx]}
  function styledWS(aoa, opts={}){
    const headerRows = opts.headerRows==null?1:opts.headerRows;
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const rng = XLSX.utils.decode_range(ws['!ref']);
    const bandSet = new Set(opts.bands||[]); const boldSet = new Set(opts.boldRows||[]);
    for(let r=rng.s.r;r<=rng.e.r;r++) for(let c=rng.s.c;c<=rng.e.c;c++){
      const addr=XLSX.utils.encode_cell({r,c}); let cell=ws[addr]; if(!cell) cell=ws[addr]={ t:'s', v:'' };
      if(r<headerRows) cell.s=hdrStyle();
      else if(bandSet.has(r)) cell.s=bandStyle();
      else { cell.s=bodyStyle(); if(boldSet.has(r)) cell.s={ ...cell.s, font:{ ...cell.s.font, bold:true } }; }
    }
    (opts.formulas||[]).forEach(({r,c,f,z})=>{ const a=XLSX.utils.encode_cell({r,c}); const prev=ws[a]&&ws[a].s; ws[a]={ t:'n', f, ...(z?{z}:{}), s:prev||bodyStyle() }; });
    if(opts.widths) ws['!cols']=opts.widths.map(w=>({ wch:w }));
    ws['!views']=[{ state:'frozen', ySplit:headerRows, xSplit:0, topLeftCell:XLSX.utils.encode_cell({ r:headerRows, c:0 }) }];
    return ws;
  }
  const colL=(c)=>XLSX.utils.encode_col(c);   // 0->A

  // ---- shared derivations ----
  function deliveryOf(e){ const ds = window.deliveryState ? window.deliveryState(e) : (e.installed?'delivered':(e.delivery||'none'));
    return (window.DELIVERY && window.DELIVERY[ds]) ? window.DELIVERY[ds].label : ds; }
  function stubDeliveryOf(e){ if(!e.hasStub) return '';
    const ss = window.stubDeliveryState ? window.stubDeliveryState(e) : (e.stubDelivery||'none');
    return (window.DELIVERY && window.DELIVERY[ss]) ? window.DELIVERY[ss].label : ss; }
  function embedRows(embeds){
    return embeds.slice().sort((a,b)=>String(a.mark).localeCompare(String(b.mark),undefined,{numeric:true}))
      .map(e=>({
        Mark:e.mark||'', Type:e.typeLabel||(e.hasKnife?'Knife plate':'Anchor rod'),
        'Knife Plate':e.hasKnife?'Yes':'No', 'Stub Column':e.hasStub?'Yes':'No', 'Stub Type':e.stubType||'', Grid:e.grid||'',
        Sequence:e.sequence||'', Phase:e.phase||'', Area:e.area||'',
        Delivery:deliveryOf(e), Received:(window.receivedAt?window.receivedAt(e):e.deliveredAt)||'', 'Received By':e.deliveredBy||'',
        'SC Delivery':stubDeliveryOf(e), 'SC Received':e.hasStub?(e.stubDeliveredAt||''):'',
        Installed:e.installed?'Yes':'No', 'Installed On':e.installedAt||'', 'Installed By':e.installedBy||'',
        RFI:e.rfi?e.rfi.number:'', 'RFI Status':e.rfi?e.rfi.status:'',
      }));
  }
  // delivery COUNT by sequence + delivered + on-the-way + not-delivered + %
  function delivSummaryRows(embeds){
    const ds = window.deliverySummary ? window.deliverySummary(embeds) : null; if(!ds) return null;
    const SL=window.seqLabel||(s=>'Seq '+s);
    const rows = ds.rows.map(r=>({ Sequence:SL(r.seq), Placed:r.placed, Delivered:r.delivered, 'On the way':r.transit, 'Not delivered':r.none, 'Delivered %':r.pct+'%' }));
    rows.push({ Sequence:'TOTAL', Placed:ds.total.placed, Delivered:ds.total.delivered, 'On the way':ds.total.transit, 'Not delivered':ds.total.none, 'Delivered %':ds.total.pct+'%' });
    return rows;
  }
  function byDate(embeds){
    const m={}; embeds.forEach(e=>{ if(e.installed&&e.installedAt) m[e.installedAt]=(m[e.installedAt]||0)+1; });
    const days=Object.keys(m).sort(); let cum=0;
    return days.map(d=>({ Date:d, Installed:m[d], Cumulative:(cum+=m[d]) }));
  }
  function seqMatrix(embeds){
    if(!window.embedsBySequence) return null;
    const { seqs, marks, seqTotals } = window.embedsBySequence(embeds);
    const SL=window.seqLabel||(s=>'Seq '+s); const head = ['Mark', ...seqs.map(SL), 'Total', 'Installed'];
    const body = marks.map(m=> [m.mark, ...seqs.map(s=> (m.seq[s]||{}).pinned||0), m.total, m.inst]);
    const totalRow = ['TOTAL', ...seqs.map(s=> seqTotals[s].pinned), marks.reduce((a,m)=>a+m.total,0), marks.reduce((a,m)=>a+m.inst,0)];
    return { head, body, totalRow };
  }
  // embed COUNT by sequence + INSTALLED + remaining + %
  function seqSummaryRows(embeds){
    const ss = window.seqSummary ? window.seqSummary(embeds) : null; if(!ss) return null;
    const SL=window.seqLabel||(s=>'Seq '+s); const rows = ss.rows.map(r=>({ Sequence:SL(r.seq), Placed:r.placed, Installed:r.installed, Remaining:r.remaining, 'Complete %':r.pct+'%' }));
    rows.push({ Sequence:'TOTAL', Placed:ss.total.placed, Installed:ss.total.installed, Remaining:ss.total.remaining, 'Complete %':ss.total.pct+'%' });
    return rows;
  }
  function summary(embeds){
    const pinned=embeds.length, inst=embeds.filter(e=>e.installed).length;
    const open=embeds.filter(e=>e.rfi&&e.rfi.status==='Open').length;
    return [
      { Metric:'Placed (on plan)', Value:pinned },
      { Metric:'Installed (cast & set)', Value:inst },
      { Metric:'Remaining', Value:pinned-inst },
      { Metric:'Complete %', Value:(pinned?Math.round(inst/pinned*100):0)+'%' },
      { Metric:'Open RFIs', Value:open },
    ];
  }

  // ================= Embeds / Dashboard report =================
  async function exportEmbeds(embeds, kind){
    if (kind==='xlsx'){ if(!(await withBusy(ensureXLSX()))){ alert('Excel library failed to load (offline?)'); return; } }
    else if (kind!=='csv'){ if(!(await withBusy(ensurePDF()))){ alert('PDF library failed to load (offline?)'); return; } }
    const rows=embedRows(embeds), dates=byDate(embeds), sum=summary(embeds), mtx=seqMatrix(embeds), seqSum=seqSummaryRows(embeds), delivSum=delivSummaryRows(embeds);
    const fname=`EmbedYap_LACC_${stamp()}`;

    if (kind==='csv'){
      const parts = [
        'EmbedYap — LACC Embed Install Report,'+stamp(), '',
        'OVERALL', csvOf(sum), '',
        'INSTALL SUMMARY BY SEQUENCE', seqSum?csvOf(seqSum):'(none)', '',
        'DELIVERY SUMMARY BY SEQUENCE', delivSum?csvOf(delivSum):'(none)', '',
      ];
      if(mtx){ parts.push('EMBED COUNT BY MARK x SEQUENCE', csvAOA(mtx.head, [...mtx.body, mtx.totalRow]), ''); }
      parts.push('ALL EMBEDS', csvOf(rows));
      download(fname+'.csv', parts.join('\n'), 'text/csv');
      return fname+'.csv';
    }

    if (kind==='xlsx'){
      if(!haveXLSX()) { alert('Excel library not loaded'); return; }
      const wb=XLSX.utils.book_new();
      const AREAS=window.AREAS||['A','B','C','D']; const SL=window.seqLabel||(s=>'Seq '+s);
      const dS=window.deliveryState||(e=>e.installed?'delivered':(e.delivery||'none'));
      const tot=embeds.length, instN=embeds.filter(e=>e.installed).length, delivN=embeds.filter(e=>dS(e)==='delivered').length, openR=embeds.filter(e=>e.rfi&&e.rfi.status==='Open').length;

      // Summary (formula-driven Remaining / % Complete)
      const sumAOA=[['Metric','Value'],['Total embeds',tot],['Delivered',delivN],['Installed',instN],['Remaining',''],['% Complete',''],['Open RFIs',openR]];
      XLSX.utils.book_append_sheet(wb, styledWS(sumAOA,{ widths:[20,14], formulas:[{r:4,c:1,f:'B2-B4'},{r:5,c:1,f:'B4/B2',z:'0%'}] }), 'Summary');

      // Install by Sequence
      if(seqSum){ const body=seqSum.map(r=>[r.Sequence,r.Placed,r.Installed,'','']); const fm=[];
        body.forEach((_,i)=>{ const R=i+2; fm.push({r:i+1,c:3,f:`B${R}-C${R}`}); fm.push({r:i+1,c:4,f:`IF(B${R}=0,0,C${R}/B${R})`,z:'0%'}); });
        XLSX.utils.book_append_sheet(wb, styledWS([['Sequence','Placed','Installed','Remaining','% Complete'],...body],{ widths:[16,12,12,12,14], formulas:fm, boldRows:[body.length] }), 'Install by Sequence'); }
      // Delivery by Sequence
      if(delivSum){ const body=delivSum.map(r=>[r.Sequence,r.Placed,r.Delivered,r['On the way'],r['Not delivered'],'']); const fm=[];
        body.forEach((_,i)=>{ const R=i+2; fm.push({r:i+1,c:5,f:`IF(B${R}=0,0,C${R}/B${R})`,z:'0%'}); });
        XLSX.utils.book_append_sheet(wb, styledWS([['Sequence','Placed','Delivered','On the way','Not delivered','% Delivered'],...body],{ widths:[16,12,12,12,14,14], formulas:fm, boldRows:[body.length] }), 'Delivery by Sequence'); }

      // Schedule by Sequence — grouped with green section bands
      if(window.embedsBySequence){ const { seqs, marks } = window.embedsBySequence(embeds);
        const aoa=[['Mark','Description','Qty','Installed','Status']]; const bands=[];
        seqs.forEach(s=>{ const ms=marks.filter(m=>(m.seq[s]||{}).pinned>0); if(!ms.length) return;
          bands.push(aoa.length); aoa.push(['SEQUENCE '+SL(s),'','','','']);
          ms.forEach(m=>{ const c=m.seq[s]||{pinned:0,inst:0}; aoa.push([m.mark, m.desc||'Anchor rod', c.pinned, c.inst, c.pinned>0&&c.inst>=c.pinned?'Complete':(c.inst>0?'In progress':'Planned')]); }); });
        XLSX.utils.book_append_sheet(wb, styledWS(aoa,{ widths:[12,28,8,10,14], bands }), 'Schedule by Sequence'); }

      // Area Rollup
      const areaAOA=[['Area','Total','Installed','Remaining','% Complete']];
      AREAS.forEach(a=>{ const list=embeds.filter(e=>e.area===a); areaAOA.push([a, list.length, list.filter(e=>e.installed).length, '', '']); });
      const afm=[]; AREAS.forEach((_,i)=>{ const R=i+2; afm.push({r:i+1,c:3,f:`B${R}-C${R}`}); afm.push({r:i+1,c:4,f:`IF(B${R}=0,0,C${R}/B${R})`,z:'0%'}); });
      XLSX.utils.book_append_sheet(wb, styledWS(areaAOA,{ widths:[10,12,12,12,14], formulas:afm }), 'Area Rollup');

      // Detailed Tracker (per pin, TRUE/FALSE)
      const detHead=['Mark','Type','Area','Sequence','Delivered','Installed','Status','Received','Installed On','Installed By','RFI'];
      const detBody=embeds.slice().sort((a,b)=>String(a.mark).localeCompare(String(b.mark),undefined,{numeric:true})).map(e=>[
        e.mark||'', e.typeLabel||'Anchor rod', e.area||'', SL(e.sequence||''), dS(e)==='delivered', !!e.installed,
        e.installed?'Installed':(dS(e)==='delivered'?'Delivered':dS(e)==='transit'?'On the way':'Not delivered'),
        (window.receivedAt?window.receivedAt(e):e.deliveredAt)||'', e.installedAt||'', e.installedBy||'', e.rfi?e.rfi.number:'' ]);
      XLSX.utils.book_append_sheet(wb, styledWS([detHead,...detBody],{ widths:[10,15,7,12,11,11,13,13,13,16,9] }), 'Detailed Tracker');

      // Install Log
      const ilBody=embeds.filter(e=>e.installed).sort((a,b)=>(a.installedAt||'').localeCompare(b.installedAt||'')).map(e=>[e.area||'',e.mark||'',e.grid||'',true,e.installedAt||'',e.installedBy||'']);
      XLSX.utils.book_append_sheet(wb, styledWS([['Area','Mark','Grid','Installed','Date Installed','Installed By'],...(ilBody.length?ilBody:[['','','',false,'','']])],{ widths:[8,10,10,11,15,16] }), 'Install Log');

      XLSX.writeFile(wb, fname+'.xlsx');
      return fname+'.xlsx';
    }

    // ---- PDF ----
    const JsPDF=jsPDFctor(); if(!JsPDF){ alert('PDF library not loaded'); return; }
    const doc=new JsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(16); doc.text('EmbedYap — LACC Embed Install Report', 40, 40);
    doc.setFontSize(10); doc.setTextColor(120); doc.text('LA Convention Center · A101 · '+stamp(), 40, 58); doc.setTextColor(0);
    doc.setFontSize(10); doc.text(summary(embeds).map(r=>`${r.Metric}: ${r.Value}`).join('      '), 40, 78);

    // headline: install summary by sequence (count + installed + %)
    if (seqSum){
      doc.setFontSize(12); doc.text('Install summary by sequence', 40, 102);
      autoTable(doc, { startY:110, head:[['Sequence','Placed','Installed','Remaining','Complete %']],
        body:seqSum.map(r=>[r.Sequence,r.Placed,r.Installed,r.Remaining,r['Complete %']]),
        styles:{ fontSize:10, cellPadding:5 }, headStyles:{ fillColor:BRAND, textColor:255 }, alternateRowStyles:{ fillColor:[244,246,250] },
        didParseCell:(d)=>{ if(d.row.index===seqSum.length-1){ d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=[226,232,243]; } },
        margin:{ left:40 }, tableWidth:360 });
    }
    // delivery summary by sequence — placed alongside the install summary
    if (delivSum){
      const sx = 420;
      doc.setFontSize(12); doc.text('Delivery summary by sequence', sx, 102);
      autoTable(doc, { startY:110, head:[['Sequence','Placed','Delivered','On the way','Not deliv.','Delivered %']],
        body:delivSum.map(r=>[r.Sequence,r.Placed,r.Delivered,r['On the way'],r['Not delivered'],r['Delivered %']]),
        styles:{ fontSize:9.5, cellPadding:5 }, headStyles:{ fillColor:BRAND, textColor:255 }, alternateRowStyles:{ fillColor:[244,246,250] },
        didParseCell:(d)=>{ if(d.row.index===delivSum.length-1){ d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=[226,232,243]; } },
        margin:{ left:sx }, tableWidth:372 });
    }
    if (mtx){
      let y=(doc.lastAutoTable?doc.lastAutoTable.finalY:120)+24;
      doc.setFontSize(12); doc.text('Embed count by mark × sequence', 40, y);
      autoTable(doc, { startY:y+8, head:[mtx.head], body:[...mtx.body, mtx.totalRow],
        styles:{ fontSize:8, cellPadding:3 }, headStyles:{ fillColor:BRAND, textColor:255 }, alternateRowStyles:{ fillColor:[244,246,250] },
        didParseCell:(d)=>{ if(d.row.index===mtx.body.length){ d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=[226,232,243]; } }, margin:{ left:40, right:40 } });
    }
    doc.addPage();
    doc.setFontSize(12); doc.text('All embeds', 40, 40);
    autoTable(doc, { startY:48, head:[Object.keys(rows[0]||{Mark:''})], body:rows.map(r=>Object.values(r)),
      styles:{ fontSize:8, cellPadding:3 }, headStyles:{ fillColor:BRAND, textColor:255 }, alternateRowStyles:{ fillColor:[244,246,250] }, margin:{ left:40, right:40 } });
    if (dates.length){
      let y=(doc.lastAutoTable?doc.lastAutoTable.finalY:100)+24; if(y>500){ doc.addPage(); y=40; }
      doc.setFontSize(12); doc.text('Installs by date', 40, y);
      autoTable(doc, { startY:y+8, head:[['Date','Installed','Cumulative']], body:dates.map(d=>[d.Date,d.Installed,d.Cumulative]),
        styles:{ fontSize:9 }, headStyles:{ fillColor:BRAND, textColor:255 }, margin:{ left:40 }, tableWidth:260 });
    }
    doc.save(fname+'.pdf');
    return fname+'.pdf';
  }

  // ================= Inventory report =================
  async function exportInventory(rows, kind, seqs){
    if (kind==='xlsx'){ if(!(await withBusy(ensureXLSX()))){ alert('Excel library failed to load (offline?)'); return; } }
    else if (kind!=='csv'){ if(!(await withBusy(ensurePDF()))){ alert('PDF library failed to load (offline?)'); return; } }
    const fname=`EmbedYap_Inventory_${stamp()}`;
    const SQ = seqs || [];
    const data=rows.map(r=>{ const sc={}; SQ.forEach(s=>{ const c=(r.seq&&r.seq[s])||{pinned:0,inst:0}; sc[(window.seqLabel?window.seqLabel(s):'Seq '+s)]=c.pinned; });
      return { Mark:r.id, Description:r.desc||'', Qty:r.qty, Placed:r.pinned,
        Delivered:r.delivered!=null?r.delivered:'', 'On the way':r.transit!=null?r.transit:'', 'Not delivered':r.notDelivered!=null?r.notDelivered:'', Received:r.received!=null?r.received:'', 'Last Received':r.receivedOn||'',
        Installed:r.inst, Remaining:r.remaining, 'Complete %':r.pct+'%',
        ...sc, '# Bolts':r.bolts!=null?r.bolts:'', Plate:r.plate||'', 'Length (in)':r.len!=null?r.len:'', Supplier:r.supplier||'' }; });

    if (kind==='csv'){ download(fname+'.csv', csvOf(data.length?data:[{Mark:'—'}]), 'text/csv'); return fname+'.csv'; }
    if (kind==='xlsx'){
      if(!haveXLSX()) { alert('Excel library not loaded'); return; }
      const wb=XLSX.utils.book_new(); const SL=window.seqLabel||(s=>'Seq '+s);
      const totQty=rows.reduce((a,r)=>a+(+r.qty||0),0), totDeliv=rows.reduce((a,r)=>a+(+r.delivered||0),0), totInst=rows.reduce((a,r)=>a+(+r.inst||0),0);

      // Summary
      XLSX.utils.book_append_sheet(wb, styledWS([['Metric','Value'],['Embed types (marks)',rows.length],['Total qty',totQty],['Delivered',totDeliv],['Installed',totInst],['Remaining',''],['% Complete','']],
        { widths:[22,14], formulas:[{r:5,c:1,f:'B3-B5'},{r:6,c:1,f:'IF(B3=0,0,B5/B3)',z:'0%'}] }), 'Summary');

      // Inventory (per mark, Remaining + % as formulas, TOTAL row with SUM)
      const invBody=rows.map(r=>[r.id, r.desc||'', +r.qty||0, +r.delivered||0, +r.inst||0, '', '', +r.received||0, r.supplier||'']);
      const ifm=[]; invBody.forEach((_,i)=>{ const R=i+2; ifm.push({r:i+1,c:5,f:`C${R}-E${R}`}); ifm.push({r:i+1,c:6,f:`IF(C${R}=0,0,E${R}/C${R})`,z:'0%'}); });
      const dataEnd=invBody.length; invBody.push(['TOTAL','','','','','','','','']); const tRow=dataEnd+1;
      [2,3,4,5,7].forEach(c=> ifm.push({ r:tRow, c, f:`SUM(${colL(c)}2:${colL(c)}${dataEnd+1})` }));
      XLSX.utils.book_append_sheet(wb, styledWS([['Mark','Description','Qty','Delivered','Installed','Remaining','% Complete','Received','Supplier'],...invBody],
        { widths:[10,26,8,11,11,11,12,11,16], formulas:ifm, boldRows:[tRow] }), 'Inventory');

      // Receiving Log (flatten each mark's receipts)
      const recs=[]; rows.forEach(r=> (r.receipts||[]).forEach(rc=> recs.push([rc.date||'', r.id, r.desc||'Anchor rod', +rc.qty||0, rc.by||''])));
      recs.sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
      XLSX.utils.book_append_sheet(wb, styledWS([['Date Received','Mark','Type','Qty','Logged By'],...(recs.length?recs:[['','','',0,'']])],{ widths:[14,10,24,8,16] }), 'Receiving Log');

      // By Sequence (mark × sequence placed counts)
      const seqBody=rows.map(r=>[r.id, ...SQ.map(s=>((r.seq&&r.seq[s])||{}).pinned||0), (r.pinned!=null?r.pinned:0)]);
      XLSX.utils.book_append_sheet(wb, styledWS([['Mark',...SQ.map(SL),'Total'],...seqBody],{ widths:[10,...SQ.map(()=>10),10] }), 'By Sequence');

      XLSX.writeFile(wb, fname+'.xlsx'); return fname+'.xlsx';
    }
    const JsPDF=jsPDFctor(); if(!JsPDF){ alert('PDF library not loaded'); return; }
    const doc=new JsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(16); doc.text('EmbedYap — Inventory by Type', 40, 40);
    doc.setFontSize(10); doc.setTextColor(120); doc.text('LA Convention Center · A101 · '+stamp(), 40, 58); doc.setTextColor(0);
    const totals=rows.reduce((a,r)=>({qty:a.qty+(+r.qty||0),pin:a.pin+(+r.pinned||0),inst:a.inst+(+r.inst||0)}),{qty:0,pin:0,inst:0});
    doc.setFontSize(10); doc.text(`Marks: ${rows.length}     Qty: ${totals.qty}     Placed: ${totals.pin}     Installed: ${totals.inst}`, 40, 78);
    autoTable(doc, { startY:92, head:[Object.keys(data[0]||{Mark:''})], body:data.map(r=>Object.values(r)),
      styles:{ fontSize:8.5, cellPadding:3 }, headStyles:{ fillColor:BRAND, textColor:255 }, alternateRowStyles:{ fillColor:[244,246,250] }, margin:{ left:40, right:40 } });
    doc.save(fname+'.pdf'); return fname+'.pdf';
  }

  /* ── 11x17 DELIVERY LIST ─────────────────────────────────────────────────────
   *
   * What is NOT on site yet, on one sheet, for the guys.
   *
   * Printed from the BROWSER rather than built with jsPDF: it costs no library download,
   * the text stays vector-crisp at 11x17 on a plotter, and "Save as PDF" is already in the
   * print dialog if a file is what you wanted. An @page rule sets the real sheet size, so it
   * comes out of the tray at scale instead of a shrunk-to-fit Letter.
   *
   * PORTRAIT 11 wide x 17 tall on purpose. This is a list — rows are the scarce resource, and
   * the tall sheet takes about 45 of them. Landscape would buy column width the data does not
   * need and cost a third of the lines.
   *
   * Grouped by SEQUENCE and ordered by needed-by date, because that is the order the material
   * is actually wanted in; a mark that is late for Seq 1 is a different problem from the same
   * mark being short for Seq 4. Within a group, NOT DELIVERED sorts above ON THE WAY — the
   * first is a phone call to the supplier, the second is just waiting.
   *
   * Rendered into a hidden IFRAME, not a popup: window.open is what blockers eat, and a
   * blocked print looks exactly like a broken button.
   */
  function printDeliveryList(rows, meta){
    meta = meta || {};
    const esc = (v)=> String(v==null?'':v).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const N = (v)=> v==null?0:v;
    const totals = rows.reduce((a,r)=>({
      marks: a.marks+1,
      bTot:a.bTot+N(r.bTot), bDel:a.bDel+N(r.bDel),
      sTot:a.sTot+N(r.sTot), sDel:a.sDel+N(r.sDel),
      out:a.out+N(r.outstanding),
      stubShort: a.stubShort + (r.state==='stub-short'?1:0),
    }), {marks:0,bTot:0,bDel:0,sTot:0,sDel:0,out:0,stubShort:0});

    /* n / N, with the shortfall doing the shouting.
     *
     * A bare "9" cannot be read without knowing the total, and a bare fraction reads the same
     * whether it is 19/20 or 1/20. So the count is stated as delivered-of-total and the gap is
     * called out beside it only when there IS one — nothing to notice means nothing printed. */
    const qty = (del, tot, tr)=>{
      if (!tot) return '<span class="ok">—</span>';
      const short = tot - del;
      return `<span class="${short?'short':'done'}">${del}<span class="of">/${tot}</span></span>`
        + (short ? `<span class="pill none">${short} short</span>` : '')
        + (tr ? `<span class="pill tr">${tr} on way</span>` : '');
    };
    /* "Anchor rod" is the model's word; the field says ANCHOR BOLT, and this sheet is for the
       field. Only that one type is renamed — a knife plate is not an anchor bolt and calling
       it one on a delivery sheet would get the wrong thing ordered. */
    const desc = (d)=> !d ? 'Anchor bolt' : String(d).replace(/anchor\s*rod/ig, 'Anchor bolt');
    const HEAD_FULL = `<header>
        <div class="top">
          <div class="grow">
            <h1>Embed delivery — quick reference</h1>
            <div class="sub">${esc(meta.project||'LA Convention Center · A101')} &nbsp;·&nbsp; ${esc(meta.scope||'Whole job')} &nbsp;·&nbsp; printed ${esc(meta.date||stamp())}</div>
          </div>
          <div class="kpis">
            <span class="g">Bolts on site <b class="g">${totals.bDel}</b> / ${totals.bTot}</span>
            <span class="g">Stub col. <b class="g">${totals.sDel}</b> / ${totals.sTot}</span>
            <span class="r">Still to come <b class="r">${totals.out}</b></span>
            ${totals.stubShort?`<span style="color:#8A3E00">Stub col. short <b style="color:#8A3E00">${totals.stubShort}</b></span>`:''}
            <span>Marks <b>${totals.marks}</b></span>
          </div>
        </div>
        <div class="legend">
          <span><span class="badge s-ok">ON SITE</span> nothing outstanding</span>
          <span><span class="badge s-stub">BOLTS IN · STUB COL. SHORT</span> looks done, is not</span>
          <span><span class="badge s-part">PART DELIVERED</span></span>
          <span><span class="badge s-none">NOT DELIVERED</span></span>
          <span style="color:#8a93a4">&mdash; = none of that item at this mark</span>
        </div>
      </header>`;
    /* Continuation sheets carry a slim header rather than none: a poster that has come off
       the wall has to say what it is and which part it is, without spending the inch that
       the KPIs and the legend cost. */
    const HEAD_SLIM = (n,of)=>`<header class="slim"><div class="top"><div class="grow">
      <h1>Embed delivery — quick reference <span class="cont">continued · sheet ${n} of ${of}</span></h1>
      <div class="sub">${esc(meta.project||'LA Convention Center · A101')} &nbsp;·&nbsp; ${esc(meta.scope||'Whole job')} &nbsp;·&nbsp; printed ${esc(meta.date||stamp())}</div>
    </div></div></header>`;
    const FOOTER = `<footer>
      <div class="sig">Received by<div class="line"></div></div>
      <div class="sig">Date<div class="line"></div></div>
      <div class="sig">Notes / short shipments<div class="line"></div></div>
    </footer>`;
    const STATUS = {
      'on-site':    { cls:'s-ok',   text:'ON SITE' },
      'stub-short': { cls:'s-stub', text:'BOLTS IN · STUB COL. SHORT' },
      'partial':    { cls:'s-part', text:'PART DELIVERED' },
      'none':       { cls:'s-none', text:'NOT DELIVERED' },
    };

    /* TWO COLUMNS PER SHEET, and the rows are paginated by hand.
     *
     * Landscape 17x11 is the poster shape asked for, but turning the sheet on its side costs
     * six inches of HEIGHT — a single wide table drops from ~50 rows a page to ~28, so the
     * job would run to three pages and a poster you have to shuffle is not a poster.
     *
     * Splitting each sheet into two columns puts the rows back: ~31 per column, ~62 per sheet,
     * with room left over to make the type bigger rather than smaller. Reading order is down
     * the left, then down the right, which is how a printed list is read.
     *
     * Paginated in JS rather than left to the browser: CSS column-count refuses to break a
     * table cleanly, and letting the page break fall where it likes puts a header row at the
     * bottom of a column. Chunking explicitly means every column starts with a header and no
     * row is ever split. */
    const PER_COL = 24;   // measured against a 75-mark job: 24 keeps each sheet to one page
    const PER_PAGE = PER_COL * 2;
    const tr = (r)=>{ const st = STATUS[r.state] || STATUS.none; return `<tr class="${st.cls}">
      <td class="ck"><span class="box"></span></td>
      <td class="mk">${esc(r.mark)}</td>
      <td class="ds">${esc(desc(r.desc))}</td>
      <td class="ar">${esc(r.areas)}</td>
      <td class="q">${qty(r.bDel, r.bTot, r.bTr)}</td>
      <td class="q">${qty(r.sDel, r.sTot, r.sTr)}</td>
      <td class="stat"><span class="badge ${st.cls}">${st.text}</span></td></tr>`; };
    const THEAD = `<thead><tr>
      <th class="ck">&#10003;</th><th class="mk">MARK</th><th class="ds">DESCRIPTION</th><th class="ar">AREA</th>
      <th class="q">BOLTS</th><th class="q">STUB COL.</th><th class="stat">STATUS</th>
    </tr></thead>`;
    const column = (list)=> list.length ? `<table>${THEAD}<tbody>${list.map(tr).join('')}</tbody></table>` : '<div></div>';
    const pages = [];
    for (let i=0; i<rows.length; i+=PER_PAGE) pages.push(rows.slice(i, i+PER_PAGE));
    const sheets = pages.map((p, idx)=>`<div class="sheet${idx?' brk':''}">
      ${idx===0 ? HEAD_FULL : HEAD_SLIM(idx+1, pages.length)}
      <div class="cols"><div class="col">${column(p.slice(0, PER_COL))}</div><div class="col">${column(p.slice(PER_COL))}</div></div>
      ${idx===pages.length-1 ? FOOTER : ''}
      <div class="pg">${idx+1} / ${pages.length}</div></div>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(meta.title||'Embed delivery reference')}</title><style>
      /* LANDSCAPE 17 x 11 — the poster shape */
      @page { size: 17in 11in; margin: 0.38in 0.4in 0.34in; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; color:#0b0e13; font-size:11pt; }
      header { border-bottom:3px solid #1E3A6B; padding-bottom:7px; margin-bottom:9px; }
      h1 { margin:0; font-size:26pt; letter-spacing:-.015em; }
      .sub { margin-top:2px; font-size:11pt; color:#41495a; }
      .top { display:flex; align-items:flex-end; gap:26px; }
      .top .grow { flex:1; }
      .kpis { display:flex; gap:22px; font-size:11pt; align-items:baseline; white-space:nowrap; }
      .kpis b { font-size:17pt; }
      .kpis .r { color:#B0341F; } .kpis .g { color:#2f7d52; }
      header.slim { padding-bottom:5px; margin-bottom:7px; }
      header.slim h1 { font-size:17pt; }
      .cont { font-size:10pt; font-weight:400; color:#41495a; }
      .legend { margin-top:6px; font-size:9.5pt; color:#41495a; display:flex; gap:13px; flex-wrap:wrap; align-items:center; }
      .cols { display:flex; gap:20px; align-items:flex-start; }
      .col { flex:1 1 0; min-width:0; }
      .sheet.brk { break-before:page; padding-top:8px; }
      table { width:100%; border-collapse:collapse; }
      th { text-align:left; font-size:8.5pt; letter-spacing:.06em; text-transform:uppercase;
           color:#41495a; border-bottom:1.4px solid #46506a; padding:3px 4px; }
      td { padding:4px; border-bottom:1px solid #d9dee7; vertical-align:middle; }
      tr { break-inside:avoid; }
      /* bigger than the portrait sheet — this is meant to be read off a wall */
      .ck { width:22px; } .mk { width:76px; font-weight:700; font-size:15pt; font-family:ui-monospace,Menlo,monospace; }
      .ds { font-size:10.5pt; } .ar { width:44px; font-size:9.5pt; color:#41495a; }
      .q  { width:96px; white-space:nowrap; font-family:ui-monospace,Menlo,monospace; }
      .q .of { color:#8a93a4; font-size:9pt; }
      .q .done  { color:#2f7d52; font-weight:700; font-size:13.5pt; }
      .q .short { color:#B0341F; font-weight:700; font-size:13.5pt; }
      .ok { color:#9aa3b4; }
      .stat { width:150px; }
      .box { display:inline-block; width:13px; height:13px; border:1.6px solid #46506a; border-radius:2px; }
      .pill { display:inline-block; padding:0 5px; border-radius:9px; font-size:8pt; font-weight:700; margin-left:3px; white-space:nowrap; }
      .pill.none { background:#fbe3de; color:#B0341F; } .pill.tr { background:#fdf0d3; color:#8A6100; }
      .badge { display:inline-block; padding:2px 7px; border-radius:4px; font-size:9pt; font-weight:700; white-space:nowrap; }
      .badge.s-ok   { background:#e2f2e8; color:#2f7d52; }
      .badge.s-part { background:#fdf0d3; color:#8A6100; }
      .badge.s-none { background:#fbe3de; color:#B0341F; }
      /* bolts in, stub column still out — the one that looks finished from the deck and is not */
      .badge.s-stub { background:#8A3E00; color:#fff; }
      tr.s-stub td  { background:#fff2e0; }
      tr.s-stub .mk { color:#8A3E00; }
      tbody tr.s-ok td { color:#5a6273; }
      footer { margin-top:11px; padding-top:8px; border-top:1px solid #9aa3b4; font-size:10pt; color:#41495a; display:flex; gap:40px; }
      .sig { flex:1; } .sig .line { margin-top:19px; border-bottom:1px solid #46506a; }
      .pg { position:fixed; right:0.4in; bottom:0.12in; font-size:8.5pt; color:#8a93a4; }
      .none-left { padding:26px; text-align:center; color:#41495a; font-size:14pt; }
    </style></head><body>
      ${rows.length ? sheets : '<div class="none-left">Nothing in this scope. Check the delivery switches and the search box.</div>'}
    </body></html>`;

    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden','true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open(); d.write(html); d.close();
    const go = ()=>{ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ alert('Could not open the print dialog: '+e.message); }
      // Safari fires print() synchronously; give the dialog a beat before pulling the frame.
      setTimeout(()=>{ try{ document.body.removeChild(f); }catch(_){} }, 60000); };
    if (d.readyState === 'complete') setTimeout(go, 80); else f.onload = ()=> setTimeout(go, 80);
    return totals;
  }

  Object.assign(window, { exportEmbeds, exportInventory, printDeliveryList });
})();
