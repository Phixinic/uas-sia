/*
 * Kartu aset per unit: rumus dengan angka asli dan jadwal penyusutan lengkap.
 */
function vAset(){
  const f=S.ui.asetFilter;const list=S.data.aset.filter(a=>f==='semua'||a.status===f).sort((a,b)=>a.kode.localeCompare(b.kode));
  const sel=S.ui.asetId&&byId('aset',S.ui.asetId);
  let det='';
  if(sel){const a=sel,akm=akmOk(a);const v=a.nilai_perolehan-a.residu;const n=a.n;
    det=`<section class="card stack"><div class="row between"><div><h2>${esc(a.kode)} · ${esc(a.nama)}</h2><div class="small muted">Dari ${esc(a.pembelian_id)} · diperoleh ${fmtTgl(a.tgl_perolehan)} · ${pill(a.status)}</div></div><button type="button" class="btn sm" data-act="set" data-k="asetId" data-v="">Tutup</button></div>
     <div class="grid">
       <div><div class="small muted">Nilai perolehan (b)</div><b>Rp${rp(a.nilai_perolehan)}</b></div>
       <div><div class="small muted">Nilai residu (S)</div><b>Rp${rp(a.residu)}</b></div>
       <div><div class="small muted">Garansi</div><b>${a.garansi_bulan||0} bln</b>${a.garansi_sampai?`<div class="small muted">sampai ${fmtTgl(a.garansi_sampai)}</div>`:''}</div>
       <div><div class="small muted">Masa manfaat</div><b>${a.masa_manfaat_bulan||0} bln</b></div>
       <div><div class="small muted">Akumulasi disetujui</div><b>Rp${rp(akm)}</b></div>
       <div><div class="small muted">Nilai buku</div><b>Rp${rp(a.nilai_perolehan-akm)}</b></div>
     </div>
     ${a.status==='batal'?'<p class="note" style="margin:0">Aset ini batal karena pembeliannya dibalik.</p>':`<div><h3>Rumus penyusutan (n dari ${a.dasar_n==='garansi'?'garansi':'masa manfaat'})</h3><div class="rumus">b − S = ${rp(a.nilai_perolehan)} − ${rp(a.residu)} = ${rp(v)}
Rumus 1, periode 1 s.d. ${Math.max(n-1,0)}:  d = round((b − S) ÷ n) = round(${rp(v)} ÷ ${n}) = Rp${rp(a.d)}${a.pengaman?'  (pengaman: dibulatkan ke bawah)':''}
Rumus 2, periode ${n}:  (b − S) − (n − 1) × d = ${rp(v)} − ${n-1} × ${rp(a.d)} = Rp${rp(a.terakhir)}
Total = ${n-1} × ${rp(a.d)} + ${rp(a.terakhir)} = ${rp((n-1)*a.d+a.terakhir)}  →  nilai buku akhir Rp${rp(a.residu)}</div></div>`}
     ${(a.jadwal||[]).length?`<div><h3>Jadwal penyusutan (${a.jadwal.length} periode)</h3><div class="tw scroll"><table class="t"><thead><tr><th>Ke</th><th>Periode</th><th class="num">Beban (Rp)</th><th class="num">Akumulasi (Rp)</th><th class="num">Nilai buku (Rp)</th><th>Jurnal</th></tr></thead><tbody>${a.jadwal.map(r=>`<tr><td>${r.p}</td><td>${fmtPer(r.periode)}</td><td class="num">${rp(r.beban)}</td><td class="num">${rp(r.akumulasi)}</td><td class="num">${rp(r.nilai_buku)}</td><td>${r.jurnal_id?`<span class="code small">${esc(r.jurnal_id)}</span> ${pill(jSt(r.jurnal_id))}`:'<span class="small muted">belum</span>'}</td></tr>`).join('')}</tbody></table></div></div>`:''}
    </section>`}
  return head('Kartu Aset','Satu kartu untuk setiap unit peralatan. Klik baris untuk melihat rumus dan jadwal lengkapnya.',
    `<div class="row" role="group" aria-label="Filter status">${[['aktif','Aktif'],['dilepas','Dilepas'],['batal','Batal'],['semua','Semua']].map(([v,l])=>`<button type="button" class="btn sm ${f===v?'on':''}" aria-pressed="${f===v}" data-act="set" data-k="asetFilter" data-v="${v}">${l}</button>`).join('')}</div>`)+
  `<div class="stack">${det}<section class="card flush">${list.length?`<div class="tw"><table class="t"><thead><tr><th>Kode</th><th>Peralatan</th><th>Diperoleh</th><th class="num">Perolehan (Rp)</th><th>n</th><th class="num">d (Rp)</th><th class="num">Periode n (Rp)</th><th class="num">Nilai buku (Rp)</th><th>Status</th></tr></thead><tbody>${list.map(a=>`<tr class="click ${S.ui.asetId===a.id?'sel':''}" data-act="set" data-k="asetId" data-v="${a.id}" tabindex="0"><td class="code">${esc(a.kode)}</td><td>${esc(a.nama)}</td><td>${fmtTgl(a.tgl_perolehan)}</td><td class="num">${rp(a.nilai_perolehan)}</td><td>${a.n} <span class="small muted">${a.dasar_n==='garansi'?'garansi':'manfaat'}</span></td><td class="num">${rp(a.d)}</td><td class="num">${rp(a.terakhir)}</td><td class="num">${rp(a.nilai_perolehan-akmOk(a))}</td><td>${pill(a.status)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada kartu aset. Kartu dibuat saat pembelian peralatan diposting.</div>'}</section></div>`;
}
