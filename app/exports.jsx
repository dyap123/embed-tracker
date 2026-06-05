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
  // ---- CSV helpers ----
  function esc(v){ v=(v==null?'':String(v)); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
  function csvOf(rows){ if(!rows.length) return ''; const k=Object.keys(rows[0]); return [k.join(','), ...rows.map(r=>k.map(x=>esc(r[x])).join(','))].join('\n'); }
  function csvAOA(head, body){ return [head.map(esc).join(','), ...body.map(r=>r.map(esc).join(','))].join('\n'); }
  function download(name, text, mime){ const b=new Blob([text],{type:mime||'text/plain'}); const u=URL.createObjectURL(b);
    const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),1500); }

  // ---- shared derivations ----
  function embedRows(embeds){
    return embeds.slice().sort((a,b)=>String(a.mark).localeCompare(String(b.mark),undefined,{numeric:true}))
      .map(e=>({
        Mark:e.mark||'', Type:e.typeLabel||(e.hasKnife?'Knife plate':'Anchor rod'),
        'Knife Plate':e.hasKnife?'Yes':'No', Grid:e.grid||'',
        Sequence:e.sequence||'', Phase:e.phase||'', Area:e.area||'',
        Installed:e.installed?'Yes':'No', 'Installed On':e.installedAt||'',
        RFI:e.rfi?e.rfi.number:'', 'RFI Status':e.rfi?e.rfi.status:'',
      }));
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
  function exportEmbeds(embeds, kind){
    const rows=embedRows(embeds), dates=byDate(embeds), sum=summary(embeds), mtx=seqMatrix(embeds), seqSum=seqSummaryRows(embeds);
    const fname=`EmbedYap_LACC_${stamp()}`;

    if (kind==='csv'){
      const parts = [
        'EmbedYap — LACC Embed Install Report,'+stamp(), '',
        'OVERALL', csvOf(sum), '',
        'INSTALL SUMMARY BY SEQUENCE', seqSum?csvOf(seqSum):'(none)', '',
      ];
      if(mtx){ parts.push('EMBED COUNT BY MARK x SEQUENCE', csvAOA(mtx.head, [...mtx.body, mtx.totalRow]), ''); }
      parts.push('ALL EMBEDS', csvOf(rows));
      download(fname+'.csv', parts.join('\n'), 'text/csv');
      return fname+'.csv';
    }

    if (kind==='xlsx'){
      if(!haveXLSX()) { alert('Excel library not loaded'); return; }
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sum), 'Summary');
      if(seqSum) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(seqSum), 'By Sequence');
      if(mtx) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([mtx.head, ...mtx.body, mtx.totalRow]), 'Mark x Sequence');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Embeds');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dates.length?dates:[{Date:'—',Installed:0,Cumulative:0}]), 'By Date');
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
  function exportInventory(rows, kind, seqs){
    const fname=`EmbedYap_Inventory_${stamp()}`;
    const SQ = seqs || [];
    const data=rows.map(r=>{ const sc={}; SQ.forEach(s=>{ const c=(r.seq&&r.seq[s])||{pinned:0,inst:0}; sc[(window.seqLabel?window.seqLabel(s):'Seq '+s)]=c.pinned; });
      return { Mark:r.id, Description:r.desc||'', Qty:r.qty, Placed:r.pinned, Installed:r.inst, Remaining:r.remaining, 'Complete %':r.pct+'%',
        ...sc, '# Bolts':r.bolts!=null?r.bolts:'', Plate:r.plate||'', 'Length (in)':r.len!=null?r.len:'', Supplier:r.supplier||'' }; });

    if (kind==='csv'){ download(fname+'.csv', csvOf(data.length?data:[{Mark:'—'}]), 'text/csv'); return fname+'.csv'; }
    if (kind==='xlsx'){
      if(!haveXLSX()) { alert('Excel library not loaded'); return; }
      const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length?data:[{Mark:'—'}]), 'Inventory');
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

  Object.assign(window, { exportEmbeds, exportInventory });
})();
