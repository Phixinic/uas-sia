/*
 * Siklus konversi. Proses penyusutan bulanan -> satu jurnal penyesuaian per periode.
 */
function defaultSusutP(){const cur=per(today());const all=S.data.aset.filter(a=>a.status==='aktif').flatMap(a=>(a.jadwal||[]).filter(r=>!r.jurnal_id&&r.periode<=cur).map(r=>r.periode)).sort();return all[0]||cur}
function vSusut(){
  const cur=per(today());const P=S.ui.susutPer||(S.ui.susutPer=defaultSusutP());
  const first=S.data.aset.map(a=>a.bulan_mulai).filter(Boolean).sort()[0]||cur;
  const aktif=S.data.aset.filter(a=>a.status==='aktif').sort((a,b)=>a.kode.localeCompare(b.kode));
  const list=aktif.map(a=>({a,r:(a.jadwal||[]).find(r=>r.periode===P)})).filter(x=>x.r);
  const belum=list.filter(x=>!x.r.jurnal_id);
  const earlier=[...new Set(aktif.flatMap(a=>(a.jadwal||[]).filter(r=>r.periode<P&&!r.jurnal_id).map(r=>r.periode)))].sort();
  const grp={};belum.forEach(({a,r})=>{const k=a.akun_beban+'|'+a.akun_akm;grp[k]=(grp[k]||0)+r.beban});
  const baris=Object.keys(grp).flatMap(k=>{const [b,m]=k.split('|');return [{akun:b,debit:grp[k],kredit:0},{akun:m,debit:0,kredit:grp[k]}]});
  const hist=S.data.jurnal.filter(j=>j.sumber_tipe==='penyusutan').sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  return head('Proses Penyusutan','Saat pembelian diposting, sistem hanya membuat jadwal. Beban tiap bulan baru dijurnal di sini, satu jurnal penyesuaian per periode dengan rincian per aset.',
    `<div class="fld"><label for="sp-p">Periode</label><select class="in" id="sp-p" data-bind="susutPer" data-rr>${perOpts(months(first<cur?first:cur,cur),P)}</select></div>`)+
  `<div class="stack">
   ${earlier.length?`<div class="alert warn">Periode ${fmtPer(earlier[0])} belum diproses. Proses periode paling lama dulu supaya urutan jadwal tetap benar.</div>`:''}
   ${isLocked(P)?`<div class="alert bad">Periode ${fmtPer(P)} terkunci.</div>`:''}
   <section class="card flush"><div class="ch row between"><h2>Pratinjau ${fmtPer(P)}</h2><span class="small muted">${list.length} aset · ${belum.length} belum diproses</span></div>
   ${list.length?`<div class="tw"><table class="t"><thead><tr><th>Aset</th><th>Periode ke</th><th class="num">Beban (Rp)</th><th class="num">Akumulasi (Rp)</th><th class="num">Nilai buku (Rp)</th><th>Status</th></tr></thead><tbody>${list.map(({a,r})=>`<tr><td><span class="code">${esc(a.kode)}</span> ${esc(a.nama)}</td><td>${r.p} dari ${a.n}${r.p===a.n&&a.n>1?' <span class="pill info">sisa (rumus 2)</span>':''}</td><td class="num">${rp(r.beban)}</td><td class="num">${rp(r.akumulasi)}</td><td class="num">${rp(r.nilai_buku)}</td><td>${r.jurnal_id?`<span class="code small">${esc(r.jurnal_id)}</span> ${pill(jSt(r.jurnal_id))}`:pill('draft').replace('Draf','Belum diproses')}</td></tr>`).join('')}<tr class="tot"><td colspan="2">Total belum diproses</td><td class="num">${rp(sum(belum,x=>x.r.beban))}</td><td colspan="3"></td></tr></tbody></table></div>`:`<div class="empty">Tidak ada aset aktif yang disusutkan pada ${fmtPer(P)}.</div>`}</section>
   ${belum.length?`<section class="card stack"><h3>Jurnal penyesuaian yang akan dibuat (draf)</h3>${jTable(baris)}${isAdmin()?`<div>${cbtn('susut-proses','','Buat jurnal penyusutan','Klik lagi untuk memproses','pri')}</div>`:'<p class="small muted" style="margin:0">Proses penyusutan dijalankan oleh Admin.</p>'}</section>`:''}
   ${hist.length?`<section class="card flush"><div class="ch"><h2>Riwayat proses</h2></div><div class="tw"><table class="t"><thead><tr><th>Jurnal</th><th>Periode</th><th class="num">Total (Rp)</th><th>Status</th></tr></thead><tbody>${hist.map(j=>`<tr><td class="code">${esc(j.no)}</td><td>${fmtPer(j.periode)}</td><td class="num">${rp(sum(j.baris,b=>b.debit))}</td><td>${pill(j.status)}</td></tr>`).join('')}</tbody></table></div></section>`:''}
  </div>`;
}
async function prosesSusut(){
  if(!isAdmin())throw new Error('Proses penyusutan dijalankan oleh Admin.');
  const P=S.ui.susutPer;if(isLocked(P))throw new Error(`Periode ${fmtPer(P)} sudah dikunci.`);
  const aktif=S.data.aset.filter(a=>a.status==='aktif');
  if(aktif.some(a=>(a.jadwal||[]).some(r=>r.periode<P&&!r.jurnal_id)))throw new Error('Masih ada periode sebelumnya yang belum diproses.');
  const list=aktif.map(a=>({a,r:(a.jadwal||[]).find(r=>r.periode===P&&!r.jurnal_id)})).filter(x=>x.r);
  if(!list.length)throw new Error(`Penyusutan ${fmtPer(P)} sudah diproses atau tidak ada.`);
  const grp={};list.forEach(({a,r})=>{const k=a.akun_beban+'|'+a.akun_akm;grp[k]=(grp[k]||0)+r.beban});
  const baris=Object.keys(grp).flatMap(k=>{const [b,m]=k.split('|');return [{akun:b,debit:grp[k],kredit:0},{akun:m,debit:0,kredit:grp[k]}]});
  const jid=await buatJurnal({tanggal:lastDay(P),jenis:'penyesuaian',status:'draft',keterangan:`Penyusutan peralatan ${fmtPer(P)}`,baris,sumber_tipe:'penyusutan',sumber_id:P,
    rincian:list.map(({a,r})=>({label:`${a.kode} ${a.nama}`,info:`periode ${r.p} dari ${a.n}${r.p===a.n&&a.n>1?' (sisa)':''}`,nilai:r.beban}))});
  for(const {a} of list){const jad=a.jadwal.map(r=>r.periode===P&&!r.jurnal_id?Object.assign({},r,{jurnal_id:jid}):r);await S.db.doc('aset/'+a.id).update({jadwal:jad})}
  toast(`Jurnal ${jid} dibuat sebagai draf. Ajukan ke Owner di menu Jurnal Penyesuaian.`);
}
