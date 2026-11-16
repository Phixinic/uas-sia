/*
 * Siklus konversi. Use case: Hapus Peralatan (dijual / dibuang / hilang), diajukan Admin dan disetujui Owner.
 */
function hitLepas(a,harga){const akm=akmOk(a);const nb=a.nilai_perolehan-akm;return {akm,nb,lr:harga-nb}}
function barisLepas(a,h){const {akm,lr}=hitLepas(a,h);return [{akun:a.akun_akm||AK.AKM,debit:akm,kredit:0},{akun:AK.KAS,debit:h,kredit:0},{akun:AK.RUGI,debit:lr<0?-lr:0,kredit:0},{akun:a.akun_aset||AK.ALT,debit:0,kredit:a.nilai_perolehan},{akun:AK.LABA,debit:0,kredit:lr>0?lr:0}]}
function vLepas(){
  if(!S.ui.lepas)S.ui.lepas={aset_id:'',tanggal:today(),alasan:'dijual',harga_jual:''};
  const f=S.ui.lepas;const aktif=S.data.aset.filter(a=>a.status==='aktif').sort((a,b)=>a.kode.localeCompare(b.kode));
  const list=S.data.pelepasan.slice().sort((a,b)=>(b.dibuat_pada||'').localeCompare(a.dibuat_pada||''));
  const form=isAdmin()?`<form class="card stack" aria-label="Ajukan pelepasan"><div class="row between"><h2>Ajukan pelepasan</h2><span class="small muted">Use case: Hapus Peralatan</span></div><div class="grid">
    ${fld('Peralatan',`<select class="in" id="l-aset" data-bind="lepas.aset_id" data-rr>${opt('','Pilih aset aktif','')}${aktif.map(a=>opt(a.id,`${a.kode} · ${a.nama}`,f.aset_id)).join('')}</select>`)}
    ${fld('Tanggal',inp('l-tgl','lepas.tanggal',f.tanggal,'type="date"'))}
    ${fld('Alasan',`<select class="in" id="l-al" data-bind="lepas.alasan" data-rr>${Object.keys(ALASAN).map(k=>opt(k,ALASAN[k],f.alasan)).join('')}</select>`)}
    ${f.alasan==='dijual'?fld('Harga jual (Rp)',inp('l-hj','lepas.harga_jual',f.harga_jual,'type="number" min="0" step="1"')):''}
   </div><div id="pv-lepas" class="stack" style="gap:10px">${pvLepas()}</div><div>${cbtn('lepas-ajukan','','Ajukan ke Owner','Klik lagi untuk mengajukan','pri')}</div></form>`:'<p class="note" style="margin:0">Pelepasan diajukan oleh Admin, lalu Owner menyetujui atau menolaknya.</p>';
  const rows=list.map(p=>{let acts='';if(p.status==='diajukan'&&isOwner()&&S.ui.lepasTolak!==p.id)acts=cbtn('lepas-setuju',p.id,'Setujui','Klik lagi untuk menyetujui','sm pri')+`<button type="button" class="btn sm dng" data-act="set" data-k="lepasTolak" data-v="${p.id}">Tolak</button>`;
    const tol=S.ui.lepasTolak===p.id?`<tr><td colspan="8"><div class="stack" style="gap:8px"><div class="fld"><label for="lt-al">Alasan penolakan</label><textarea class="in" id="lt-al" data-bind="lepasAlasan">${esc(S.ui.lepasAlasan)}</textarea></div><div class="row"><button type="button" class="btn dng" data-act="lepas-tolak" data-id="${p.id}">Tolak pengajuan</button><button type="button" class="btn" data-act="set" data-k="lepasTolak" data-v="">Batal</button></div></div></td></tr>`:'';
    return `<tr><td class="code">${esc(p.id)}</td><td>${esc(p.aset_kode)} ${esc(p.nama)}</td><td>${fmtTgl(p.tanggal)}</td><td>${ALASAN[p.alasan]||p.alasan}</td><td class="num">${rp(p.harga_jual)}</td><td class="num">${rp(p.nilai_buku)}</td><td class="num">${p.laba_rugi<0?'Rugi '+rp(-p.laba_rugi):p.laba_rugi>0?'Laba '+rp(p.laba_rugi):'0'}</td><td><div class="row">${pill(p.status)}${p.jurnal_id?`<span class="code small">${esc(p.jurnal_id)}</span>`:''}${p.alasan_tolak?`<span class="small muted">${esc(p.alasan_tolak)}</span>`:''}${acts}</div></td></tr>${tol}`}).join('');
  return head('Pelepasan Peralatan','Untuk peralatan yang dijual, dibuang, atau hilang. Nilai buku memakai penyusutan yang sudah disetujui. Setelah disetujui Owner, jadwal sisanya dibatalkan dan jurnal pelepasan dibuat.')+
   `<div class="stack">${form}<section class="card flush"><div class="ch"><h2>Daftar pengajuan</h2></div>${list.length?`<div class="tw"><table class="t"><thead><tr><th>No.</th><th>Aset</th><th>Tanggal</th><th>Alasan</th><th class="num">Harga jual</th><th class="num">Nilai buku</th><th class="num">Laba/rugi</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Belum ada pengajuan pelepasan.</div>'}</section></div>`;
}
function pvLepas(){
  const f=S.ui.lepas;const a=f&&byId('aset',f.aset_id);if(!a)return '<p class="small muted" style="margin:0">Pilih peralatan untuk melihat nilai buku dan jurnalnya.</p>';
  const h=f.alasan==='dijual'?int(f.harga_jual):0;const {akm,nb,lr}=hitLepas(a,h);const pend=pendingRows(a);
  return `${pend.length?`<div class="alert warn">${pend.length} baris penyusutan aset ini belum disetujui (${esc(pend.map(r=>r.jurnal_id).join(', '))}). Tunggu disetujui atau ditolak dulu.</div>`:''}
   <div class="grid"><div><div class="small muted">Perolehan</div><b>Rp${rp(a.nilai_perolehan)}</b></div><div><div class="small muted">Akumulasi disetujui</div><b>Rp${rp(akm)}</b></div><div><div class="small muted">Nilai buku</div><b>Rp${rp(nb)}</b></div><div><div class="small muted">${lr<0?'Rugi':lr>0?'Laba':'Laba/rugi'}</div><b class="${lr<0?'err':''}">Rp${rp(Math.abs(lr))}</b></div></div>
   <div><h3>Jurnal pelepasan (dibuat saat disetujui)</h3>${jTable(barisLepas(a,h))}</div>`;
}
async function ajukanLepas(){
  if(!isAdmin())throw new Error('Pelepasan diajukan oleh Admin.');
  const f=S.ui.lepas;const a=byId('aset',f.aset_id);if(!a)throw new Error('Pilih peralatan.');if(a.status!=='aktif')throw new Error('Aset ini tidak aktif.');
  if(!f.tanggal||f.tanggal<a.tgl_perolehan)throw new Error('Tanggal pelepasan tidak boleh sebelum tanggal perolehan.');
  if(f.alasan==='dijual'&&!filled(f.harga_jual))throw new Error('Isi harga jual.');
  if(S.data.pelepasan.some(p=>p.aset_id===a.id&&p.status==='diajukan'))throw new Error('Aset ini sudah punya pengajuan yang menunggu keputusan.');
  if(pendingRows(a).length)throw new Error('Masih ada penyusutan aset ini yang belum disetujui.');
  const h=f.alasan==='dijual'?int(f.harga_jual):0;const {akm,nb,lr}=hitLepas(a,h);
  const id=await nomor('PLP',f.tanggal);
  await S.db.doc('pelepasan/'+id).set({aset_id:a.id,aset_kode:a.kode,nama:a.nama,tanggal:f.tanggal,alasan:f.alasan,harga_jual:h,nilai_perolehan:a.nilai_perolehan,akumulasi:akm,nilai_buku:nb,laba_rugi:lr,status:'diajukan',dibuat_oleh:S.role,dibuat_pada:iso(),jurnal_id:null,alasan_tolak:null});
  S.ui.lepas=null;toast(`${id} diajukan ke Owner.`);
}
async function setujuLepas(id){
  if(!isOwner())throw new Error('Hanya Owner yang bisa menyetujui.');
  const p=byId('pelepasan',id);if(!p||p.status!=='diajukan')throw new Error('Pengajuan ini sudah diputuskan.');const a=byId('aset',p.aset_id);if(!a||a.status!=='aktif')throw new Error('Aset ini sudah tidak aktif.');
  if(pendingRows(a).length)throw new Error('Masih ada penyusutan aset ini yang belum disetujui.');
  const {akm,nb,lr}=hitLepas(a,p.harga_jual);
  const jid=await buatJurnal({tanggal:p.tanggal,jenis:'umum',status:'disetujui',dibuat_oleh:p.dibuat_oleh,keterangan:`Pelepasan ${a.kode} ${a.nama} (${(ALASAN[p.alasan]||p.alasan).toLowerCase()})`,baris:barisLepas(a,p.harga_jual),sumber_tipe:'pelepasan',sumber_id:id});
  await S.db.doc('aset/'+a.id).update({status:'dilepas',tanggal_lepas:p.tanggal,jadwal:(a.jadwal||[]).filter(r=>r.jurnal_id)});
  await S.db.doc('pelepasan/'+id).update({status:'disetujui',jurnal_id:jid,akumulasi:akm,nilai_buku:nb,laba_rugi:lr,disetujui_oleh:S.role,disetujui_pada:iso()});
  toast(`${id} disetujui. Jurnal ${jid} dibuat.`);
}
