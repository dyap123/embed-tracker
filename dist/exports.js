/* EmbedYap — report exports: CSV + PDF (jsPDF + autotable), plus xlsx.
   Reports cover: embed count by sequence, installed by sequence, and overall.
   Exposed on window so Dashboard / Inventory can call them from buttons. */
(function () {
  const stamp = () => new Date().toISOString().slice(0, 10);
  const BRAND = [30, 58, 107];
  function haveXLSX() {
    return !!window.XLSX;
  }
  function jsPDFctor() {
    return window.jspdf && window.jspdf.jsPDF;
  }
  function autoTable(doc, opts) {
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === 'function') return window.jspdf.autoTable(doc, opts);
    throw new Error('autotable plugin missing');
  }
  // ---- CSV helpers ----
  function esc(v) {
    v = v == null ? '' : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function csvOf(rows) {
    if (!rows.length) return '';
    const k = Object.keys(rows[0]);
    return [k.join(','), ...rows.map(r => k.map(x => esc(r[x])).join(','))].join('\n');
  }
  function csvAOA(head, body) {
    return [head.map(esc).join(','), ...body.map(r => r.map(esc).join(','))].join('\n');
  }
  function download(name, text, mime) {
    const b = new Blob([text], {
      type: mime || 'text/plain'
    });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1500);
  }

  // ---- styled-xlsx helpers (Webcor green headers, borders, formulas) ----
  const WEBCOR = '6CB33F',
    BAND = 'E8F4E0',
    INK = '1B2433',
    LINE = 'D6DCE4';
  function thinB() {
    const s = {
      style: 'thin',
      color: {
        rgb: LINE
      }
    };
    return {
      top: s,
      bottom: s,
      left: s,
      right: s
    };
  }
  function hdrStyle() {
    return {
      fill: {
        patternType: 'solid',
        fgColor: {
          rgb: WEBCOR
        }
      },
      font: {
        bold: true,
        color: {
          rgb: 'FFFFFF'
        },
        sz: 11
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
        wrapText: true
      },
      border: thinB()
    };
  }
  function bodyStyle() {
    return {
      border: thinB(),
      font: {
        sz: 10.5,
        color: {
          rgb: INK
        }
      },
      alignment: {
        vertical: 'center'
      }
    };
  }
  function bandStyle() {
    return {
      fill: {
        patternType: 'solid',
        fgColor: {
          rgb: BAND
        }
      },
      font: {
        bold: true,
        sz: 11,
        color: {
          rgb: '2E6B1F'
        }
      },
      border: thinB()
    };
  }
  // build a styled worksheet from array-of-arrays. opts: {headerRows, widths, bands:[rowIdx], formulas:[{r,c,f,z}], boldRows:[rowIdx]}
  function styledWS(aoa, opts = {}) {
    const headerRows = opts.headerRows == null ? 1 : opts.headerRows;
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const rng = XLSX.utils.decode_range(ws['!ref']);
    const bandSet = new Set(opts.bands || []);
    const boldSet = new Set(opts.boldRows || []);
    for (let r = rng.s.r; r <= rng.e.r; r++) for (let c = rng.s.c; c <= rng.e.c; c++) {
      const addr = XLSX.utils.encode_cell({
        r,
        c
      });
      let cell = ws[addr];
      if (!cell) cell = ws[addr] = {
        t: 's',
        v: ''
      };
      if (r < headerRows) cell.s = hdrStyle();else if (bandSet.has(r)) cell.s = bandStyle();else {
        cell.s = bodyStyle();
        if (boldSet.has(r)) cell.s = {
          ...cell.s,
          font: {
            ...cell.s.font,
            bold: true
          }
        };
      }
    }
    (opts.formulas || []).forEach(({
      r,
      c,
      f,
      z
    }) => {
      const a = XLSX.utils.encode_cell({
        r,
        c
      });
      const prev = ws[a] && ws[a].s;
      ws[a] = {
        t: 'n',
        f,
        ...(z ? {
          z
        } : {}),
        s: prev || bodyStyle()
      };
    });
    if (opts.widths) ws['!cols'] = opts.widths.map(w => ({
      wch: w
    }));
    ws['!views'] = [{
      state: 'frozen',
      ySplit: headerRows,
      xSplit: 0,
      topLeftCell: XLSX.utils.encode_cell({
        r: headerRows,
        c: 0
      })
    }];
    return ws;
  }
  const colL = c => XLSX.utils.encode_col(c); // 0->A

  // ---- shared derivations ----
  function deliveryOf(e) {
    const ds = window.deliveryState ? window.deliveryState(e) : e.installed ? 'delivered' : e.delivery || 'none';
    return window.DELIVERY && window.DELIVERY[ds] ? window.DELIVERY[ds].label : ds;
  }
  function embedRows(embeds) {
    return embeds.slice().sort((a, b) => String(a.mark).localeCompare(String(b.mark), undefined, {
      numeric: true
    })).map(e => ({
      Mark: e.mark || '',
      Type: e.typeLabel || (e.hasKnife ? 'Knife plate' : 'Anchor rod'),
      'Knife Plate': e.hasKnife ? 'Yes' : 'No',
      'Stub Column': e.hasStub ? 'Yes' : 'No',
      Grid: e.grid || '',
      Sequence: e.sequence || '',
      Phase: e.phase || '',
      Area: e.area || '',
      Delivery: deliveryOf(e),
      Received: (window.receivedAt ? window.receivedAt(e) : e.deliveredAt) || '',
      'Received By': e.deliveredBy || '',
      Installed: e.installed ? 'Yes' : 'No',
      'Installed On': e.installedAt || '',
      'Installed By': e.installedBy || '',
      RFI: e.rfi ? e.rfi.number : '',
      'RFI Status': e.rfi ? e.rfi.status : ''
    }));
  }
  // delivery COUNT by sequence + delivered + on-the-way + not-delivered + %
  function delivSummaryRows(embeds) {
    const ds = window.deliverySummary ? window.deliverySummary(embeds) : null;
    if (!ds) return null;
    const SL = window.seqLabel || (s => 'Seq ' + s);
    const rows = ds.rows.map(r => ({
      Sequence: SL(r.seq),
      Placed: r.placed,
      Delivered: r.delivered,
      'On the way': r.transit,
      'Not delivered': r.none,
      'Delivered %': r.pct + '%'
    }));
    rows.push({
      Sequence: 'TOTAL',
      Placed: ds.total.placed,
      Delivered: ds.total.delivered,
      'On the way': ds.total.transit,
      'Not delivered': ds.total.none,
      'Delivered %': ds.total.pct + '%'
    });
    return rows;
  }
  function byDate(embeds) {
    const m = {};
    embeds.forEach(e => {
      if (e.installed && e.installedAt) m[e.installedAt] = (m[e.installedAt] || 0) + 1;
    });
    const days = Object.keys(m).sort();
    let cum = 0;
    return days.map(d => ({
      Date: d,
      Installed: m[d],
      Cumulative: cum += m[d]
    }));
  }
  function seqMatrix(embeds) {
    if (!window.embedsBySequence) return null;
    const {
      seqs,
      marks,
      seqTotals
    } = window.embedsBySequence(embeds);
    const SL = window.seqLabel || (s => 'Seq ' + s);
    const head = ['Mark', ...seqs.map(SL), 'Total', 'Installed'];
    const body = marks.map(m => [m.mark, ...seqs.map(s => (m.seq[s] || {}).pinned || 0), m.total, m.inst]);
    const totalRow = ['TOTAL', ...seqs.map(s => seqTotals[s].pinned), marks.reduce((a, m) => a + m.total, 0), marks.reduce((a, m) => a + m.inst, 0)];
    return {
      head,
      body,
      totalRow
    };
  }
  // embed COUNT by sequence + INSTALLED + remaining + %
  function seqSummaryRows(embeds) {
    const ss = window.seqSummary ? window.seqSummary(embeds) : null;
    if (!ss) return null;
    const SL = window.seqLabel || (s => 'Seq ' + s);
    const rows = ss.rows.map(r => ({
      Sequence: SL(r.seq),
      Placed: r.placed,
      Installed: r.installed,
      Remaining: r.remaining,
      'Complete %': r.pct + '%'
    }));
    rows.push({
      Sequence: 'TOTAL',
      Placed: ss.total.placed,
      Installed: ss.total.installed,
      Remaining: ss.total.remaining,
      'Complete %': ss.total.pct + '%'
    });
    return rows;
  }
  function summary(embeds) {
    const pinned = embeds.length,
      inst = embeds.filter(e => e.installed).length;
    const open = embeds.filter(e => e.rfi && e.rfi.status === 'Open').length;
    return [{
      Metric: 'Placed (on plan)',
      Value: pinned
    }, {
      Metric: 'Installed (cast & set)',
      Value: inst
    }, {
      Metric: 'Remaining',
      Value: pinned - inst
    }, {
      Metric: 'Complete %',
      Value: (pinned ? Math.round(inst / pinned * 100) : 0) + '%'
    }, {
      Metric: 'Open RFIs',
      Value: open
    }];
  }

  // ================= Embeds / Dashboard report =================
  function exportEmbeds(embeds, kind) {
    const rows = embedRows(embeds),
      dates = byDate(embeds),
      sum = summary(embeds),
      mtx = seqMatrix(embeds),
      seqSum = seqSummaryRows(embeds),
      delivSum = delivSummaryRows(embeds);
    const fname = `EmbedYap_LACC_${stamp()}`;
    if (kind === 'csv') {
      const parts = ['EmbedYap — LACC Embed Install Report,' + stamp(), '', 'OVERALL', csvOf(sum), '', 'INSTALL SUMMARY BY SEQUENCE', seqSum ? csvOf(seqSum) : '(none)', '', 'DELIVERY SUMMARY BY SEQUENCE', delivSum ? csvOf(delivSum) : '(none)', ''];
      if (mtx) {
        parts.push('EMBED COUNT BY MARK x SEQUENCE', csvAOA(mtx.head, [...mtx.body, mtx.totalRow]), '');
      }
      parts.push('ALL EMBEDS', csvOf(rows));
      download(fname + '.csv', parts.join('\n'), 'text/csv');
      return fname + '.csv';
    }
    if (kind === 'xlsx') {
      if (!haveXLSX()) {
        alert('Excel library not loaded');
        return;
      }
      const wb = XLSX.utils.book_new();
      const AREAS = window.AREAS || ['A', 'B', 'C', 'D'];
      const SL = window.seqLabel || (s => 'Seq ' + s);
      const dS = window.deliveryState || (e => e.installed ? 'delivered' : e.delivery || 'none');
      const tot = embeds.length,
        instN = embeds.filter(e => e.installed).length,
        delivN = embeds.filter(e => dS(e) === 'delivered').length,
        openR = embeds.filter(e => e.rfi && e.rfi.status === 'Open').length;

      // Summary (formula-driven Remaining / % Complete)
      const sumAOA = [['Metric', 'Value'], ['Total embeds', tot], ['Delivered', delivN], ['Installed', instN], ['Remaining', ''], ['% Complete', ''], ['Open RFIs', openR]];
      XLSX.utils.book_append_sheet(wb, styledWS(sumAOA, {
        widths: [20, 14],
        formulas: [{
          r: 4,
          c: 1,
          f: 'B2-B4'
        }, {
          r: 5,
          c: 1,
          f: 'B4/B2',
          z: '0%'
        }]
      }), 'Summary');

      // Install by Sequence
      if (seqSum) {
        const body = seqSum.map(r => [r.Sequence, r.Placed, r.Installed, '', '']);
        const fm = [];
        body.forEach((_, i) => {
          const R = i + 2;
          fm.push({
            r: i + 1,
            c: 3,
            f: `B${R}-C${R}`
          });
          fm.push({
            r: i + 1,
            c: 4,
            f: `IF(B${R}=0,0,C${R}/B${R})`,
            z: '0%'
          });
        });
        XLSX.utils.book_append_sheet(wb, styledWS([['Sequence', 'Placed', 'Installed', 'Remaining', '% Complete'], ...body], {
          widths: [16, 12, 12, 12, 14],
          formulas: fm,
          boldRows: [body.length]
        }), 'Install by Sequence');
      }
      // Delivery by Sequence
      if (delivSum) {
        const body = delivSum.map(r => [r.Sequence, r.Placed, r.Delivered, r['On the way'], r['Not delivered'], '']);
        const fm = [];
        body.forEach((_, i) => {
          const R = i + 2;
          fm.push({
            r: i + 1,
            c: 5,
            f: `IF(B${R}=0,0,C${R}/B${R})`,
            z: '0%'
          });
        });
        XLSX.utils.book_append_sheet(wb, styledWS([['Sequence', 'Placed', 'Delivered', 'On the way', 'Not delivered', '% Delivered'], ...body], {
          widths: [16, 12, 12, 12, 14, 14],
          formulas: fm,
          boldRows: [body.length]
        }), 'Delivery by Sequence');
      }

      // Schedule by Sequence — grouped with green section bands
      if (window.embedsBySequence) {
        const {
          seqs,
          marks
        } = window.embedsBySequence(embeds);
        const aoa = [['Mark', 'Description', 'Qty', 'Installed', 'Status']];
        const bands = [];
        seqs.forEach(s => {
          const ms = marks.filter(m => (m.seq[s] || {}).pinned > 0);
          if (!ms.length) return;
          bands.push(aoa.length);
          aoa.push(['SEQUENCE ' + SL(s), '', '', '', '']);
          ms.forEach(m => {
            const c = m.seq[s] || {
              pinned: 0,
              inst: 0
            };
            aoa.push([m.mark, m.desc || 'Anchor rod', c.pinned, c.inst, c.pinned > 0 && c.inst >= c.pinned ? 'Complete' : c.inst > 0 ? 'In progress' : 'Planned']);
          });
        });
        XLSX.utils.book_append_sheet(wb, styledWS(aoa, {
          widths: [12, 28, 8, 10, 14],
          bands
        }), 'Schedule by Sequence');
      }

      // Area Rollup
      const areaAOA = [['Area', 'Total', 'Installed', 'Remaining', '% Complete']];
      AREAS.forEach(a => {
        const list = embeds.filter(e => e.area === a);
        areaAOA.push([a, list.length, list.filter(e => e.installed).length, '', '']);
      });
      const afm = [];
      AREAS.forEach((_, i) => {
        const R = i + 2;
        afm.push({
          r: i + 1,
          c: 3,
          f: `B${R}-C${R}`
        });
        afm.push({
          r: i + 1,
          c: 4,
          f: `IF(B${R}=0,0,C${R}/B${R})`,
          z: '0%'
        });
      });
      XLSX.utils.book_append_sheet(wb, styledWS(areaAOA, {
        widths: [10, 12, 12, 12, 14],
        formulas: afm
      }), 'Area Rollup');

      // Detailed Tracker (per pin, TRUE/FALSE)
      const detHead = ['Mark', 'Type', 'Area', 'Sequence', 'Delivered', 'Installed', 'Status', 'Received', 'Installed On', 'Installed By', 'RFI'];
      const detBody = embeds.slice().sort((a, b) => String(a.mark).localeCompare(String(b.mark), undefined, {
        numeric: true
      })).map(e => [e.mark || '', e.typeLabel || 'Anchor rod', e.area || '', SL(e.sequence || ''), dS(e) === 'delivered', !!e.installed, e.installed ? 'Installed' : dS(e) === 'delivered' ? 'Delivered' : dS(e) === 'transit' ? 'On the way' : 'Not delivered', (window.receivedAt ? window.receivedAt(e) : e.deliveredAt) || '', e.installedAt || '', e.installedBy || '', e.rfi ? e.rfi.number : '']);
      XLSX.utils.book_append_sheet(wb, styledWS([detHead, ...detBody], {
        widths: [10, 15, 7, 12, 11, 11, 13, 13, 13, 16, 9]
      }), 'Detailed Tracker');

      // Install Log
      const ilBody = embeds.filter(e => e.installed).sort((a, b) => (a.installedAt || '').localeCompare(b.installedAt || '')).map(e => [e.area || '', e.mark || '', e.grid || '', true, e.installedAt || '', e.installedBy || '']);
      XLSX.utils.book_append_sheet(wb, styledWS([['Area', 'Mark', 'Grid', 'Installed', 'Date Installed', 'Installed By'], ...(ilBody.length ? ilBody : [['', '', '', false, '', '']])], {
        widths: [8, 10, 10, 11, 15, 16]
      }), 'Install Log');
      XLSX.writeFile(wb, fname + '.xlsx');
      return fname + '.xlsx';
    }

    // ---- PDF ----
    const JsPDF = jsPDFctor();
    if (!JsPDF) {
      alert('PDF library not loaded');
      return;
    }
    const doc = new JsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    doc.setFontSize(16);
    doc.text('EmbedYap — LACC Embed Install Report', 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('LA Convention Center · A101 · ' + stamp(), 40, 58);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(summary(embeds).map(r => `${r.Metric}: ${r.Value}`).join('      '), 40, 78);

    // headline: install summary by sequence (count + installed + %)
    if (seqSum) {
      doc.setFontSize(12);
      doc.text('Install summary by sequence', 40, 102);
      autoTable(doc, {
        startY: 110,
        head: [['Sequence', 'Placed', 'Installed', 'Remaining', 'Complete %']],
        body: seqSum.map(r => [r.Sequence, r.Placed, r.Installed, r.Remaining, r['Complete %']]),
        styles: {
          fontSize: 10,
          cellPadding: 5
        },
        headStyles: {
          fillColor: BRAND,
          textColor: 255
        },
        alternateRowStyles: {
          fillColor: [244, 246, 250]
        },
        didParseCell: d => {
          if (d.row.index === seqSum.length - 1) {
            d.cell.styles.fontStyle = 'bold';
            d.cell.styles.fillColor = [226, 232, 243];
          }
        },
        margin: {
          left: 40
        },
        tableWidth: 360
      });
    }
    // delivery summary by sequence — placed alongside the install summary
    if (delivSum) {
      const sx = 420;
      doc.setFontSize(12);
      doc.text('Delivery summary by sequence', sx, 102);
      autoTable(doc, {
        startY: 110,
        head: [['Sequence', 'Placed', 'Delivered', 'On the way', 'Not deliv.', 'Delivered %']],
        body: delivSum.map(r => [r.Sequence, r.Placed, r.Delivered, r['On the way'], r['Not delivered'], r['Delivered %']]),
        styles: {
          fontSize: 9.5,
          cellPadding: 5
        },
        headStyles: {
          fillColor: BRAND,
          textColor: 255
        },
        alternateRowStyles: {
          fillColor: [244, 246, 250]
        },
        didParseCell: d => {
          if (d.row.index === delivSum.length - 1) {
            d.cell.styles.fontStyle = 'bold';
            d.cell.styles.fillColor = [226, 232, 243];
          }
        },
        margin: {
          left: sx
        },
        tableWidth: 372
      });
    }
    if (mtx) {
      let y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 24;
      doc.setFontSize(12);
      doc.text('Embed count by mark × sequence', 40, y);
      autoTable(doc, {
        startY: y + 8,
        head: [mtx.head],
        body: [...mtx.body, mtx.totalRow],
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        headStyles: {
          fillColor: BRAND,
          textColor: 255
        },
        alternateRowStyles: {
          fillColor: [244, 246, 250]
        },
        didParseCell: d => {
          if (d.row.index === mtx.body.length) {
            d.cell.styles.fontStyle = 'bold';
            d.cell.styles.fillColor = [226, 232, 243];
          }
        },
        margin: {
          left: 40,
          right: 40
        }
      });
    }
    doc.addPage();
    doc.setFontSize(12);
    doc.text('All embeds', 40, 40);
    autoTable(doc, {
      startY: 48,
      head: [Object.keys(rows[0] || {
        Mark: ''
      })],
      body: rows.map(r => Object.values(r)),
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: BRAND,
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [244, 246, 250]
      },
      margin: {
        left: 40,
        right: 40
      }
    });
    if (dates.length) {
      let y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 100) + 24;
      if (y > 500) {
        doc.addPage();
        y = 40;
      }
      doc.setFontSize(12);
      doc.text('Installs by date', 40, y);
      autoTable(doc, {
        startY: y + 8,
        head: [['Date', 'Installed', 'Cumulative']],
        body: dates.map(d => [d.Date, d.Installed, d.Cumulative]),
        styles: {
          fontSize: 9
        },
        headStyles: {
          fillColor: BRAND,
          textColor: 255
        },
        margin: {
          left: 40
        },
        tableWidth: 260
      });
    }
    doc.save(fname + '.pdf');
    return fname + '.pdf';
  }

  // ================= Inventory report =================
  function exportInventory(rows, kind, seqs) {
    const fname = `EmbedYap_Inventory_${stamp()}`;
    const SQ = seqs || [];
    const data = rows.map(r => {
      const sc = {};
      SQ.forEach(s => {
        const c = r.seq && r.seq[s] || {
          pinned: 0,
          inst: 0
        };
        sc[window.seqLabel ? window.seqLabel(s) : 'Seq ' + s] = c.pinned;
      });
      return {
        Mark: r.id,
        Description: r.desc || '',
        Qty: r.qty,
        Placed: r.pinned,
        Delivered: r.delivered != null ? r.delivered : '',
        'On the way': r.transit != null ? r.transit : '',
        'Not delivered': r.notDelivered != null ? r.notDelivered : '',
        Received: r.received != null ? r.received : '',
        'Last Received': r.receivedOn || '',
        Installed: r.inst,
        Remaining: r.remaining,
        'Complete %': r.pct + '%',
        ...sc,
        '# Bolts': r.bolts != null ? r.bolts : '',
        Plate: r.plate || '',
        'Length (in)': r.len != null ? r.len : '',
        Supplier: r.supplier || ''
      };
    });
    if (kind === 'csv') {
      download(fname + '.csv', csvOf(data.length ? data : [{
        Mark: '—'
      }]), 'text/csv');
      return fname + '.csv';
    }
    if (kind === 'xlsx') {
      if (!haveXLSX()) {
        alert('Excel library not loaded');
        return;
      }
      const wb = XLSX.utils.book_new();
      const SL = window.seqLabel || (s => 'Seq ' + s);
      const totQty = rows.reduce((a, r) => a + (+r.qty || 0), 0),
        totDeliv = rows.reduce((a, r) => a + (+r.delivered || 0), 0),
        totInst = rows.reduce((a, r) => a + (+r.inst || 0), 0);

      // Summary
      XLSX.utils.book_append_sheet(wb, styledWS([['Metric', 'Value'], ['Embed types (marks)', rows.length], ['Total qty', totQty], ['Delivered', totDeliv], ['Installed', totInst], ['Remaining', ''], ['% Complete', '']], {
        widths: [22, 14],
        formulas: [{
          r: 5,
          c: 1,
          f: 'B3-B5'
        }, {
          r: 6,
          c: 1,
          f: 'IF(B3=0,0,B5/B3)',
          z: '0%'
        }]
      }), 'Summary');

      // Inventory (per mark, Remaining + % as formulas, TOTAL row with SUM)
      const invBody = rows.map(r => [r.id, r.desc || '', +r.qty || 0, +r.delivered || 0, +r.inst || 0, '', '', +r.received || 0, r.supplier || '']);
      const ifm = [];
      invBody.forEach((_, i) => {
        const R = i + 2;
        ifm.push({
          r: i + 1,
          c: 5,
          f: `C${R}-E${R}`
        });
        ifm.push({
          r: i + 1,
          c: 6,
          f: `IF(C${R}=0,0,E${R}/C${R})`,
          z: '0%'
        });
      });
      const dataEnd = invBody.length;
      invBody.push(['TOTAL', '', '', '', '', '', '', '', '']);
      const tRow = dataEnd + 1;
      [2, 3, 4, 5, 7].forEach(c => ifm.push({
        r: tRow,
        c,
        f: `SUM(${colL(c)}2:${colL(c)}${dataEnd + 1})`
      }));
      XLSX.utils.book_append_sheet(wb, styledWS([['Mark', 'Description', 'Qty', 'Delivered', 'Installed', 'Remaining', '% Complete', 'Received', 'Supplier'], ...invBody], {
        widths: [10, 26, 8, 11, 11, 11, 12, 11, 16],
        formulas: ifm,
        boldRows: [tRow]
      }), 'Inventory');

      // Receiving Log (flatten each mark's receipts)
      const recs = [];
      rows.forEach(r => (r.receipts || []).forEach(rc => recs.push([rc.date || '', r.id, r.desc || 'Anchor rod', +rc.qty || 0, rc.by || ''])));
      recs.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
      XLSX.utils.book_append_sheet(wb, styledWS([['Date Received', 'Mark', 'Type', 'Qty', 'Logged By'], ...(recs.length ? recs : [['', '', '', 0, '']])], {
        widths: [14, 10, 24, 8, 16]
      }), 'Receiving Log');

      // By Sequence (mark × sequence placed counts)
      const seqBody = rows.map(r => [r.id, ...SQ.map(s => (r.seq && r.seq[s] || {}).pinned || 0), r.pinned != null ? r.pinned : 0]);
      XLSX.utils.book_append_sheet(wb, styledWS([['Mark', ...SQ.map(SL), 'Total'], ...seqBody], {
        widths: [10, ...SQ.map(() => 10), 10]
      }), 'By Sequence');
      XLSX.writeFile(wb, fname + '.xlsx');
      return fname + '.xlsx';
    }
    const JsPDF = jsPDFctor();
    if (!JsPDF) {
      alert('PDF library not loaded');
      return;
    }
    const doc = new JsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    doc.setFontSize(16);
    doc.text('EmbedYap — Inventory by Type', 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('LA Convention Center · A101 · ' + stamp(), 40, 58);
    doc.setTextColor(0);
    const totals = rows.reduce((a, r) => ({
      qty: a.qty + (+r.qty || 0),
      pin: a.pin + (+r.pinned || 0),
      inst: a.inst + (+r.inst || 0)
    }), {
      qty: 0,
      pin: 0,
      inst: 0
    });
    doc.setFontSize(10);
    doc.text(`Marks: ${rows.length}     Qty: ${totals.qty}     Placed: ${totals.pin}     Installed: ${totals.inst}`, 40, 78);
    autoTable(doc, {
      startY: 92,
      head: [Object.keys(data[0] || {
        Mark: ''
      })],
      body: data.map(r => Object.values(r)),
      styles: {
        fontSize: 8.5,
        cellPadding: 3
      },
      headStyles: {
        fillColor: BRAND,
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [244, 246, 250]
      },
      margin: {
        left: 40,
        right: 40
      }
    });
    doc.save(fname + '.pdf');
    return fname + '.pdf';
  }
  Object.assign(window, {
    exportEmbeds,
    exportInventory
  });
})();