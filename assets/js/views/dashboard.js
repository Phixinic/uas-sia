/*
 * Halaman Dashboard: ringkasan nilai buku, penyusutan, saldo perlengkapan, dan daftar pekerjaan.
 */
function vDashboard(){
  const P=per(today());const aktif=S.data.aset.filter(a=>a.status==='aktif');
  const perol=sum(aktif,a=>a.nilai_perolehan),akm=sum(aktif,a=>akmOk(a));
  const susutP=sum(aktif,a=>((a.jadwal||[]).find(r=>r.periode===P)||{beban:0}).beban);
  const lkp=saldo(AK.LKP,null);
  const wait=S.data.jurnal.filter(j=>j.status==='diajukan').length+S.data.pelepasan.filter(p=>p.status==='diajukan').length;
  const todos=[];
  const draftB=S.data.pembelian.filter(b=>b.status==='draft');
  if(draftB.length)todos.push([`${draftB.length} pembelian masih draf`,'Posting supaya masuk jurnal umum dan kartu aset.',draftB[0].jenis==='peralatan'?'#beli-peralatan':'#beli-perlengkapan']);
  const unp=[...new Set(aktif.flatMap(a=>(a.jadwal||[]).filter(r=>r.periode<P&&!r.jurnal_id).map(r=>r.periode)))].sort();
  if(unp.length)todos.push([`Penyusutan ${fmtPer(unp[0])} belum diproses`,unp.length>1?`Ada ${unp.length} periode yang belum diproses.`:'Admin memproses lalu mengajukan jurnalnya.','#penyusutan']);
  const jd=S.data.jurnal.filter(j=>j.status==='draft');if(jd.length)todos.push([`${jd.length} jurnal penyesuaian masih draf`,'Admin perlu mengajukannya ke Owner.','#jurnal-penyesuaian']);
  const ja=S.data.jurnal.filter(j=>j.status==='diajukan');if(ja.length)todos.push([`${ja.length} jurnal penyesuaian menunggu persetujuan`,'Owner menyetujui atau menolak dengan alasan.','#jurnal-penyesuaian']);
  const la=S.data.pelepasan.filter(p=>p.status==='diajukan');if(la.length)todos.push([`${la.length} pengajuan pelepasan peralatan`,'Menunggu keputusan Owner.','#pelepasan']);
  const gar=aktif.filter(a=>a.garansi_sampai&&a.garansi_sampai>=today()&&a.garansi_sampai<=addDays(today(),30));
  gar.forEach(a=>todos.push([`Garansi ${a.nama} habis ${fmtTgl(a.garansi_sampai)}`,`${a.kode}: cek kondisi sebelum garansi berakhir.`,'#aset']));
  const recent=S.data.jurnal.slice().sort((a,b)=>(b.dibuat_pada||'').localeCompare(a.dibuat_pada||'')).slice(0,6);
  return head('Dashboard',`Periode berjalan ${fmtPer(P)} · ${pill(perStatus(P))}`)+
  `<div class="stack"><div class="tiles">
    <div class="card tile"><div class="lb">Nilai buku peralatan</div><div class="v">Rp${rp(perol-akm)}</div><div class="s">${aktif.length} unit aktif · perolehan Rp${rp(perol)}</div></div>
    <div class="card tile"><div class="lb">Penyusutan ${fmtPer(P)}</div><div class="v">Rp${rp(susutP)}</div><div class="s">Dari jadwal kartu aset</div></div>
    <div class="card tile"><div class="lb">Saldo perlengkapan</div><div class="v">Rp${rp(lkp)}</div><div class="s">Menurut buku besar</div></div>
    <div class="card tile"><div class="lb">Menunggu persetujuan</div><div class="v">${wait}</div><div class="s">Jurnal dan pelepasan</div></div>
  </div>
  <section class="card"><h2>Perlu tindakan</h2>${todos.length?todos.map(t=>`<div class="todo"><div><b>${esc(t[0])}</b><div class="small muted">${esc(t[1])}</div></div><a class="btn sm" href="${t[2]}">Buka</a></div>`).join(''):`<p class="muted small" style="margin:8px 0 0">Tidak ada pekerjaan yang tertunda.</p>`}</section>
  <section class="card flush"><div class="ch"><h2>Jurnal terbaru</h2></div>${recent.length?`<div class="tw"><table class="t"><thead><tr><th>No.</th><th>Tanggal</th><th>Keterangan</th><th>Jenis</th><th class="num">Jumlah (Rp)</th><th>Status</th></tr></thead><tbody>${recent.map(j=>`<tr><td class="code">${esc(j.no)}</td><td>${fmtTgl(j.tanggal)}</td><td>${esc(j.keterangan)}</td><td>${esc(j.jenis)}</td><td class="num">${rp(sum(j.baris||[],b=>b.debit))}</td><td>${pill(j.status)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada jurnal. Mulai dari Pembelian Peralatan atau Pembelian Perlengkapan.</div>'}</section>
  <p class="small muted">Data awal adalah contoh untuk demo. Semua perubahan tersimpan di database dan terlihat oleh semua orang yang membuka halaman ini.</p></div>`;
}
