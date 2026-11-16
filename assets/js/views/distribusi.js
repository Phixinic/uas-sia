/*
 * Siklus SDM. Use case: Distribusi beban gaji (diajukan HRD, disetujui Owner, lalu dijurnal).
 */
function barisGaji(slips){const g={};slips.forEach(s=>{const a=s.akun_beban||AK.BGA;g[a]=(g[a]||0)+s.bruto});
  return Object.keys(g).sort().map(k=>({akun:k,debit:g[k],kredit:0})).concat([{akun:AK.UPPH,debit:0,kredit:sum(slips,s=>s.pph21)},{akun:AK.KAS,debit:0,kredit:sum(slips,s=>s.thp)}])}
function vDistribusi(){
  const P=sdmP();const slips=S.data.slip.filter(s=>s.periode===P);const draft=slips.filter(s=>s.status==='draft');const paid=slips.filter(s=>s.status==='dibayar').sort((a,b)=>a.karyawan_id.localeCompare(b.karyawan_id));
  const pgs=S.data.penggajian.filter(g=>g.periode===P).sort((a,b)=>b.id.localeCompare(a.id));const kas=saldo(AK.KAS,null);
  const pgRows=pgs.map(g=>{let acts='';if(g.status==='diajukan'&&isOwner()&&S.ui.pgTolak!==g.id)acts=cbtn('pg-setuju',g.id,'Setujui &amp; bayar','Klik lagi untuk menyetujui','sm pri')+`<button type="button" class="btn sm dng" data-act="set" data-k="pgTolak" data-v="${g.id}">Tolak</button>`;
    const tol=S.ui.pgTolak===g.id?`<tr><td colspan="7"><div class="stack" style="gap:8px"><div class="fld"><label for="pg-al">Alasan penolakan</label><textarea class="in" id="pg-al" data-bind="pgAlasan">${esc(S.ui.pgAlasan)}</textarea></div><div class="row"><button type="button" class="btn dng" data-act="pg-tolak" data-id="${g.id}">Tolak pengajuan</button><button type="button" class="btn" data-act="set" data-k="pgTolak" data-v="">Batal</button></div></div></td></tr>`:'';
    return `<tr><td class="code">${esc(g.id)}</td><td class="num">${g.jumlah}</td><td class="num">${rp(g.total_bruto)}</td><td class="num">${rp(g.total_pph)}</td><td class="num">${rp(g.total_thp)}</td><td><div class="row">${pill(g.status)}${g.jurnal_id?`<span class="code small">${esc(g.jurnal_id)}</span>`:''}${g.alasan_tolak?`<span class="small muted">${esc(g.alasan_tolak)}</span>`:''}</div></td><td><div class="row">${acts}</div></td></tr>${tol}`}).join('');
  return head('Distribusi Gaji','Slip draf satu periode diajukan HRD sekaligus. Setelah Owner menyetujui, sistem membuat satu jurnal umum (biaya gaji pada utang PPh 21 dan kas), dan setiap slip tercatat di tabel pengeluaran.',sdmPick())+
  `<div class="stack">
   <section class="card stack"><div class="row between"><h2>Slip draf ${fmtPer(P)}</h2><span class="small muted">Saldo kas saat ini Rp${rp(kas)}</span></div>
     ${draft.length?`<div class="grid"><div><div class="small muted">Jumlah slip</div><b>${draft.length}</b></div><div><div class="small muted">Total bruto (biaya)</div><b>Rp${rp(sum(draft,s=>s.bruto))}</b></div><div><div class="small muted">PPh 21 (utang)</div><b>Rp${rp(sum(draft,s=>s.pph21))}</b></div><div><div class="small muted">THP (kas keluar)</div><b>Rp${rp(sum(draft,s=>s.thp))}</b></div></div>
       <div><h3>Jurnal yang akan dibuat saat disetujui</h3>${jTable(barisGaji(draft))}</div>
       ${isHrd()?`<div>${cbtn('pg-ajukan','','Ajukan ke Owner','Klik lagi untuk mengajukan','pri')}</div>`:'<p class="small muted" style="margin:0">Pengajuan dilakukan oleh HRD.</p>'}`
      :'<p class="small muted" style="margin:0">Tidak ada slip draf pada periode ini. Slip dibuat di menu Hitung Gaji.</p>'}</section>
   <section class="card flush"><div class="ch"><h2>Pengajuan penggajian</h2></div>${pgs.length?`<div class="tw"><table class="t"><thead><tr><th>No.</th><th class="num">Slip</th><th class="num">Bruto (Rp)</th><th class="num">PPh 21 (Rp)</th><th class="num">THP (Rp)</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${pgRows}</tbody></table></div>`:'<div class="empty">Belum ada pengajuan pada periode ini.</div>'}</section>
   <section class="card flush"><div class="ch row between"><h2>Tabel pengeluaran gaji</h2><span class="small muted">Satu baris per slip yang sudah dibayar</span></div>${paid.length?`<div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Ref</th><th>Slip</th><th>Akun biaya</th><th>Keterangan</th><th class="num">Bruto (Rp)</th><th class="num">Dibayar (Rp)</th></tr></thead><tbody>${paid.map(s=>`<tr><td>${fmtTgl(lastDay(s.periode))}</td><td class="code">${esc(s.ref||'')}</td><td class="code">${esc(s.id)}</td><td>${esc(akunNama(s.akun_beban))}</td><td>Gaji ${fmtPer(s.periode)} a.n. ${esc(kryNama(s.karyawan_id))}</td><td class="num">${rp(s.bruto)}</td><td class="num">${rp(s.thp)}</td></tr>`).join('')}<tr class="tot"><td colspan="5">Total</td><td class="num">${rp(sum(paid,s=>s.bruto))}</td><td class="num">${rp(sum(paid,s=>s.thp))}</td></tr></tbody></table></div>`:'<div class="empty">Belum ada gaji yang dibayar pada periode ini.</div>'}</section></div>`;
}
async function pgAjukan(){
  if(!isHrd())throw new Error('Pengajuan dilakukan oleh HRD.');const P=sdmP();if(isLocked(P))throw new Error(`Periode ${fmtPer(P)} sudah dikunci.`);
  const draft=S.data.slip.filter(s=>s.periode===P&&s.status==='draft');if(!draft.length)throw new Error('Tidak ada slip draf pada periode ini.');
  const no=await nomor('PAY',lastDay(P));
  await S.db.doc('penggajian/'+no).set({no,periode:P,slip_ids:draft.map(s=>s.id),jumlah:draft.length,total_bruto:sum(draft,s=>s.bruto),total_pph:sum(draft,s=>s.pph21),total_thp:sum(draft,s=>s.thp),status:'diajukan',dibuat_oleh:S.role,dibuat_pada:iso(),jurnal_id:null,alasan_tolak:null});
  for(const s of draft)await S.db.doc('slip/'+s.id).update({status:'diajukan',ref:no});
  toast(`${no} diajukan ke Owner.`);
}
async function pgSetuju(id){
  if(!isOwner())throw new Error('Hanya Owner yang bisa menyetujui.');const g=byId('penggajian',id);if(!g||g.status!=='diajukan')throw new Error('Pengajuan ini sudah diputuskan.');
  const slips=g.slip_ids.map(i=>byId('slip',i)).filter(s=>s&&s.status==='diajukan');if(!slips.length)throw new Error('Slip pengajuan ini tidak ditemukan.');
  const thp=sum(slips,s=>s.thp);const kas=saldo(AK.KAS,null);if(kas<thp)throw new Error(`Saldo kas Rp${rp(kas)} tidak cukup untuk membayar gaji Rp${rp(thp)}.`);
  const jid=await buatJurnal({tanggal:lastDay(g.periode),jenis:'umum',status:'disetujui',dibuat_oleh:g.dibuat_oleh,keterangan:`Penggajian ${fmtPer(g.periode)} (${slips.length} karyawan), ${id}`,baris:barisGaji(slips),sumber_tipe:'penggajian',sumber_id:id,rincian:slips.map(s=>({label:kryNama(s.karyawan_id),info:jabNama(s.jabatan_id),nilai:s.thp}))});
  for(const s of slips)await S.db.doc('slip/'+s.id).update({status:'dibayar',jurnal_id:jid});
  await S.db.doc('penggajian/'+id).update({status:'disetujui',jurnal_id:jid,disetujui_oleh:S.role,disetujui_pada:iso()});
  toast(`${id} disetujui. Jurnal ${jid} dibuat dan gaji dibayar.`);
}
async function pgTolak(id){
  if(!isOwner())throw new Error('Hanya Owner yang bisa menolak.');const g=byId('penggajian',id);if(!g||g.status!=='diajukan')throw new Error('Pengajuan ini sudah diputuskan.');
  const al=(S.ui.pgAlasan||'').trim();if(!al)throw new Error('Tulis alasan penolakan.');
  for(const i of g.slip_ids){const s=byId('slip',i);if(s&&s.status==='diajukan')await S.db.doc('slip/'+i).update({status:'draft',ref:null})}
  await S.db.doc('penggajian/'+id).update({status:'ditolak',alasan_tolak:al,disetujui_oleh:S.role,disetujui_pada:iso()});
  S.ui.pgTolak=null;S.ui.pgAlasan='';toast(`${id} ditolak. Slip kembali menjadi draf.`,'warn');
}
