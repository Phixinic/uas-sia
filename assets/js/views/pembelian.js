/*
 * Siklus konversi. Use case: Kelola (CRUD) Pembelian Peralatan & Perlengkapan.
 * include: Insert tabel transaksi, Hitung Penyusutan (jadwal dibuat saat posting)
 * extend : Kelola Master Supplier / Peralatan / Perlengkapan (tambah cepat dari form)
 */
const newItem=j=>j==='peralatan'?{barang_id:'',qty:'1',harga:'',residu:'0',garansi_bulan:'',masa_manfaat_bulan:'',dasar_n:'garansi'}:{barang_id:'',qty:'1',harga:''};
function vBeli(jenis){
  const L=jenis==='peralatan'?'Peralatan':'Perlengkapan';
  const list=S.data.pembelian.filter(b=>b.jenis===jenis).sort((a,b)=>(b.tanggal+b.no).localeCompare(a.tanggal+a.no));
  const act=isAdmin()&&!(S.ui.beli&&S.ui.beli.jenis===jenis)?`<button type="button" class="btn pri" data-act="beli-new" data-v="${jenis}">+ Pembelian baru</button>`:'';
  const sub=jenis==='peralatan'?'Draf bisa diubah atau dihapus. Saat diposting, sistem membuat jurnal umum, kartu aset per unit, dan jadwal penyusutan. Pembelian yang sudah diposting hanya bisa dibalik oleh Owner.':'Saat diposting, saldo perlengkapan bertambah dan jurnal umum dibuat. Pemakaian dihitung lewat input nilai sisa di akhir periode.';
  const rows=list.map(b=>{
    const items=(b.items||[]).map(it=>`${esc((byId(jenis,it.barang_id)||{}).nama||it.barang_id)} × ${it.qty}`).join('<br>');
    let acts='';
    if(b.status==='draft'){if(isAdmin())acts+=`<button type="button" class="btn sm" data-act="beli-edit" data-id="${b.id}">Ubah</button>`+cbtn('beli-del',b.id,'Hapus','Yakin hapus?','sm dng');if(!isHrd())acts+=cbtn('beli-post',b.id,'Posting','Klik lagi untuk posting','sm pri')}
    else if(b.status==='posted'){acts+=`<span class="small muted code">${esc(b.jurnal_id||'')}</span>`;if(isOwner()&&S.ui.balik!==b.id)acts+=`<button type="button" class="btn sm dng" data-act="balik-open" data-id="${b.id}">Balik</button>`}
    else if(b.status==='dibalik')acts+=`<span class="small muted">${esc(b.alasan_balik||'')}</span>`;
    let extra='';
    if(S.ui.balik===b.id)extra=`<tr><td colspan="8"><div class="stack" style="gap:8px"><div class="fld"><label for="balik-alasan">Alasan membalik ${esc(b.no)}</label><textarea class="in" id="balik-alasan" data-bind="balikAlasan">${esc(S.ui.balikAlasan)}</textarea><div class="hint">Jurnal asli tetap ada. Sistem membuat jurnal pembalik bertanggal hari ini${jenis==='peralatan'?' dan membatalkan kartu asetnya':''}.</div></div><div class="row"><button type="button" class="btn dng" data-act="balik-do" data-id="${b.id}">Balik pembelian</button><button type="button" class="btn" data-act="balik-cancel">Batal</button></div></div></td></tr>`;
    return `<tr><td class="code">${esc(b.no)}</td><td>${fmtTgl(b.tanggal)}</td><td>${esc(supNama(b.supplier_id))}</td><td>${items}</td><td>${CARA[b.cara_bayar]||''}${b.cara_bayar==='kredit'&&b.jatuh_tempo?`<div class="small muted">jatuh tempo ${fmtTgl(b.jatuh_tempo)}</div>`:''}</td><td class="num">${rp(b.total)}</td><td>${pill(b.status)}</td><td><div class="row">${acts}</div></td></tr>${extra}`;
  }).join('');
  return head(`Pembelian ${L}`,sub,act)+`<div class="stack">${S.ui.beli&&S.ui.beli.jenis===jenis?formBeli():''}
   ${isOwner()?'<p class="note" style="margin:0">Sebagai Owner kamu bisa melihat, memposting draf, dan membalik pembelian yang sudah diposting. Draf dibuat oleh Admin.</p>':''}
   <section class="card flush"><div class="ch"><h2>Daftar pembelian ${L.toLowerCase()}</h2></div>${list.length?`<div class="tw"><table class="t"><thead><tr><th>No.</th><th>Tanggal</th><th>Supplier</th><th>Barang</th><th>Bayar</th><th class="num">Total (Rp)</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty">Belum ada pembelian ${L.toLowerCase()}.${isAdmin()?' Tekan "+ Pembelian baru" untuk mencatat yang pertama.':''}</div>`}</section></div>`;
}
function formBeli(){
  const f=S.ui.beli,j=f.jenis;const q=S.ui.quick;
  const sups=S.data.supplier.filter(s=>s.aktif!==false||s.id===f.supplier_id).sort((a,b)=>a.kode.localeCompare(b.kode));
  const brg=S.data[j].filter(s=>s.aktif!==false||f.items.some(it=>it.barang_id===s.id)).sort((a,b)=>a.kode.localeCompare(b.kode));
  const quick=q?`<fieldset class="item" style="margin:0"><legend class="small" style="font-weight:700">${q.type==='supplier'?'Supplier baru':j==='peralatan'?'Peralatan baru':'Perlengkapan baru'} <span class="muted">(extend: master langsung dari form, isi pembelian tetap tersimpan)</span></legend><div class="grid">
     ${fld('<span>Nama</span>',inp('q-nama','quick.nama',q.nama))}
     ${q.type==='supplier'?fld('Telepon',inp('q-telp','quick.telepon',q.telepon)):fld('Satuan',inp('q-sat','quick.satuan',q.satuan,'placeholder="unit / liter / pak"'))}
     ${q.type!=='supplier'&&j==='peralatan'?fld('Kategori aset',`<select class="in" id="q-kat" data-bind="quick.kategori_id">${opt('','Pilih kategori','')}${S.data.kategori.filter(k=>k.aktif!==false).map(k=>opt(k.id,k.nama,q.kategori_id)).join('')}</select>`):''}
     </div><div class="row" style="margin-top:10px"><button type="button" class="btn pri sm" data-act="quick-save">Simpan ke master</button><button type="button" class="btn sm" data-act="quick-cancel">Batal</button></div></fieldset>`:'';
  const items=f.items.map((it,i)=>{
    const b=byId(j,it.barang_id);const kat=b&&byId('kategori',b.kategori_id);
    const sel=`<select class="in" id="b-i${i}-brg" data-bind="beli.items.${i}.barang_id" data-rr>${opt('',`Pilih ${j}`,'')}${brg.map(x=>opt(x.id,`${x.kode} · ${x.nama}`,it.barang_id)).join('')}</select>`;
    const top=`<div class="row between"><b class="small">Baris ${i+1}</b>${f.items.length>1?`<button type="button" class="lnk" data-act="item-del" data-v="${i}">Hapus baris</button>`:''}</div>`;
    if(j==='perlengkapan')return `<div class="item stack" style="gap:10px">${top}<div class="grid">${fld('Perlengkapan',sel+`<button type="button" class="lnk" data-act="quick-open" data-v="barang">+ Perlengkapan belum ada</button>`)}${fld('Jumlah',inp(`b-i${i}-qty`,`beli.items.${i}.qty`,it.qty,'type="number" min="1" step="1"'))}${fld('Harga satuan (Rp)',inp(`b-i${i}-hrg`,`beli.items.${i}.harga`,it.harga,'type="number" min="0" step="1"'))}</div></div>`;
    return `<div class="item stack" style="gap:10px">${top}<div class="grid">
      ${fld('Peralatan',sel+`<button type="button" class="lnk" data-act="quick-open" data-v="barang">+ Peralatan belum ada</button>`,kat?`Kategori ${esc(kat.nama)}: masa manfaat ${kat.masa_manfaat_bulan} bln, residu ${kat.persen_residu||0}%`:'')}
      ${fld('Jumlah unit',inp(`b-i${i}-qty`,`beli.items.${i}.qty`,it.qty,'type="number" min="1" step="1"'),'Tiap unit menjadi satu kartu aset')}
      ${fld('Harga per unit (Rp)',inp(`b-i${i}-hrg`,`beli.items.${i}.harga`,it.harga,'type="number" min="0" step="1"'))}
      ${fld('Nilai residu per unit (Rp)',inp(`b-i${i}-res`,`beli.items.${i}.residu`,it.residu,'type="number" min="0" step="1"'))}
      ${fld('Garansi (bulan)',inp(`b-i${i}-gar`,`beli.items.${i}.garansi_bulan`,it.garansi_bulan,'type="number" min="0" step="1"'))}
      ${fld('Masa manfaat (bulan)',inp(`b-i${i}-mm`,`beli.items.${i}.masa_manfaat_bulan`,it.masa_manfaat_bulan,'type="number" min="0" step="1"'))}
      ${fld('Dasar jumlah periode (n)',`<select class="in" id="b-i${i}-dn" data-bind="beli.items.${i}.dasar_n">${opt('garansi','Garansi (sesuai papan dosen)',it.dasar_n)}${opt('masa_manfaat','Masa manfaat (saran PRD)',it.dasar_n)}</select>`)}
    </div></div>`;
  }).join('');
  return `<form class="card stack" data-form="beli" aria-label="Form pembelian">
    <div class="row between"><h2>${f.id?'Ubah draf '+esc(f.id):'Pembelian '+j+' baru'}</h2><span class="small muted">Use case: Kelola (CRUD) Pembelian ${j==='peralatan'?'Peralatan':'Perlengkapan'}</span></div>
    <div class="grid">
      ${fld('No. pembelian',`<input class="in" id="b-no" value="${esc(f.id||'Dibuat otomatis')}" readonly>`)}
      ${fld('Tanggal',inp('b-tgl','beli.tanggal',f.tanggal,'type="date"'),isLocked(per(f.tanggal))?'<span class="err">Periode ini terkunci</span>':'')}
      ${fld('Cara bayar',`<select class="in" id="b-cara" data-bind="beli.cara_bayar" data-rr>${Object.keys(CARA).map(k=>opt(k,CARA[k],f.cara_bayar)).join('')}</select>`)}
      ${f.cara_bayar==='kredit'?fld('Jatuh tempo utang',inp('b-jt','beli.jatuh_tempo',f.jatuh_tempo,'type="date"')):''}
      ${fld('Supplier',`<select class="in" id="b-sup" data-bind="beli.supplier_id">${opt('',f.cara_bayar==='investasi'?'Tanpa supplier (setoran pemilik)':'Pilih supplier','')}${sups.map(s=>opt(s.id,`${s.kode} · ${s.nama}`,f.supplier_id)).join('')}</select><button type="button" class="lnk" data-act="quick-open" data-v="supplier">+ Supplier belum ada</button>`)}
      ${fld('Keterangan',inp('b-ket','beli.keterangan',f.keterangan,'placeholder="opsional"'))}
    </div>
    ${f.cara_bayar==='investasi'?'<p class="note" style="margin:0">Investasi: barang disetor pemilik, jadi lawan jurnalnya Modal Pemilik.</p>':''}
    ${quick}
    <div class="stack" style="gap:10px">${items}<div><button type="button" class="btn sm" data-act="item-add">+ Tambah baris barang</button></div></div>
    <div id="pv-beli" class="stack" style="gap:12px">${pvBeli()}</div>
    <div class="row"><button type="button" class="btn" data-act="beli-save">Simpan draf</button>${cbtn('beli-save-post','','Simpan &amp; posting','Klik lagi untuk posting','pri')}<button type="button" class="btn" data-act="beli-cancel">Batal</button></div>
  </form>`;
}
function pvBeli(){
  const f=S.ui.beli;if(!f)return '';let total=0;const parts=[];
  f.items.forEach((it,i)=>{const q=int(it.qty),h=int(it.harga);total+=q*h;
    if(f.jenis==='peralatan'){const nm=(byId('peralatan',it.barang_id)||{}).nama||`Baris ${i+1}`;
      if(!h){parts.push(`<li class="muted">${esc(nm)}: isi harga dulu</li>`);return}
      try{const n=itemN(it);const r=hitungJadwal(h,int(it.residu),n,per(f.tanggal||today()));
        parts.push(`<li><b>${esc(nm)}</b>: n = ${n} bulan dari ${it.dasar_n==='garansi'?'garansi':'masa manfaat'}. ${n===1?`Satu periode Rp${rp(r.last)}`:`Periode 1–${n-1} Rp${rp(r.d)}/bulan, periode ${n} Rp${rp(r.last)}`}${r.pengaman?' (pengaman: pembulatan ke bawah)':''}. Nilai buku akhir Rp${rp(int(it.residu))}.</li>`)}
      catch(e){parts.push(`<li class="err"><b>${esc(nm)}</b>: ${esc(e.message)}</li>`)}}});
  const akunD=f.jenis==='peralatan'?AK.ALT:AK.LKP;
  return `<div class="row between"><span class="muted">Total pembelian</span><b style="font-size:20px" class="num">Rp${rp(total)}</b></div>
   ${f.jenis==='peralatan'?`<div class="note" style="color:var(--fg)"><h3>Hitung penyusutan (include, dihitung saat Save)</h3><ul class="pvl">${parts.join('')||'<li class="muted">Pilih peralatan dan isi harga.</li>'}</ul></div>`:''}
   <div><h3>Jurnal umum saat diposting</h3>${jTable([{akun:akunD,debit:total,kredit:0},{akun:LAWAN[f.cara_bayar],debit:0,kredit:total}])}</div>`;
}
function validasiBeli(f){
  if(!f.tanggal)return 'Isi tanggal pembelian.';
  if(f.cara_bayar!=='investasi'&&!f.supplier_id)return 'Pilih supplier, atau pilih cara bayar Investasi untuk setoran pemilik.';
  if(f.cara_bayar==='kredit'&&(!f.jatuh_tempo||f.jatuh_tempo<f.tanggal))return 'Isi jatuh tempo utang, minimal sama dengan tanggal pembelian.';
  for(let i=0;i<f.items.length;i++){const it=f.items[i];
    if(!it.barang_id)return `Baris ${i+1}: pilih barang.`;
    if(int(it.qty)<1)return `Baris ${i+1}: jumlah minimal 1.`;
    if(int(it.harga)<=0)return `Baris ${i+1}: harga harus lebih dari 0.`;
    if(f.jenis==='peralatan'){if(it.dasar_n==='garansi'&&int(it.garansi_bulan)<1)return `Baris ${i+1}: dasar n adalah garansi, jadi isi garansi minimal 1 bulan.`;
      if(it.dasar_n!=='garansi'&&int(it.masa_manfaat_bulan)<1)return `Baris ${i+1}: isi masa manfaat minimal 1 bulan.`;
      try{hitungJadwal(int(it.harga),int(it.residu),itemN(it),per(f.tanggal))}catch(e){return `Baris ${i+1}: ${e.message}`}}}
  return '';
}
async function simpanBeli(post){
  const f=S.ui.beli;const err=validasiBeli(f);if(err)throw new Error(err);
  const items=f.items.map(it=>f.jenis==='peralatan'?{barang_id:it.barang_id,qty:int(it.qty),harga:int(it.harga),residu:int(it.residu),garansi_bulan:int(it.garansi_bulan),masa_manfaat_bulan:int(it.masa_manfaat_bulan),dasar_n:it.dasar_n}:{barang_id:it.barang_id,qty:int(it.qty),harga:int(it.harga)});
  const total=sum(items,it=>it.qty*it.harga);
  const id=f.id||await nomor(f.jenis==='peralatan'?'BP':'BL',f.tanggal);
  if(f.id){const s=await S.db.doc('pembelian/'+id).get();if(s.exists&&s.data().status!=='draft')throw new Error('Pembelian ini sudah diposting, jadi tidak bisa diubah.')}
  await S.db.doc('pembelian/'+id).set({no:id,jenis:f.jenis,tanggal:f.tanggal,supplier_id:f.supplier_id||'',cara_bayar:f.cara_bayar,jatuh_tempo:f.cara_bayar==='kredit'?f.jatuh_tempo:'',keterangan:f.keterangan||'',items,total,status:'draft',jurnal_id:null,dibuat_oleh:S.role,diubah_pada:iso()});
  S.ui.beli=null;S.ui.quick=null;
  if(post){await postingBeli(id);toast(`${id} diposting.`)}else toast(`Draf ${id} tersimpan.`);
}
async function postingBeli(id){
  const snap=await S.db.doc('pembelian/'+id).get();if(!snap.exists)throw new Error('Pembelian tidak ditemukan.');
  const b=snap.data();if(b.status!=='draft')throw new Error(`${id} sudah diposting.`);
  if(isLocked(per(b.tanggal)))throw new Error(`Periode ${fmtPer(per(b.tanggal))} sudah dikunci.`);
  const asets=[];const debit={};
  for(const it of b.items){
    if(b.jenis==='peralatan'){const brg=byId('peralatan',it.barang_id)||{};const kat=byId('kategori',brg.kategori_id)||{};
      const n=itemN(it);const r=hitungJadwal(it.harga,it.residu,n,per(b.tanggal));
      const ak={aset:kat.akun_aset||AK.ALT,akm:kat.akun_akumulasi||AK.AKM,beban:kat.akun_beban||AK.BSUSUT};
      debit[ak.aset]=(debit[ak.aset]||0)+it.qty*it.harga;
      for(let u=0;u<it.qty;u++)asets.push({nama:brg.nama||it.barang_id,barang_id:it.barang_id,kategori_id:brg.kategori_id||'',nilai_perolehan:it.harga,residu:it.residu,garansi_bulan:it.garansi_bulan,garansi_sampai:it.garansi_bulan?addMonthsDate(b.tanggal,it.garansi_bulan):'',masa_manfaat_bulan:it.masa_manfaat_bulan,dasar_n:it.dasar_n,n,d:r.d,terakhir:r.last,pengaman:r.pengaman,akun_aset:ak.aset,akun_akm:ak.akm,akun_beban:ak.beban,jadwal:r.rows});
    }else debit[AK.LKP]=(debit[AK.LKP]||0)+it.qty*it.harga;
  }
  const baris=Object.keys(debit).map(k=>({akun:k,debit:debit[k],kredit:0})).concat([{akun:LAWAN[b.cara_bayar],debit:0,kredit:b.total}]);
  const jid=await buatJurnal({tanggal:b.tanggal,jenis:'umum',status:'disetujui',keterangan:`Pembelian ${b.jenis} ${b.no}, ${supNama(b.supplier_id)} (${CARA[b.cara_bayar]})`,baris,sumber_tipe:'pembelian',sumber_id:id});
  const ids=[];
  for(const a of asets){const kode=await nomor('AST',null,4);ids.push(kode);await S.db.doc('aset/'+kode).set(Object.assign({kode,pembelian_id:id,tgl_perolehan:b.tanggal,bulan_mulai:per(b.tanggal),status:'aktif'},a))}
  await S.db.doc('pembelian/'+id).update({status:'posted',jurnal_id:jid,aset_ids:ids,diposting_oleh:S.role,diposting_pada:iso()});
}
async function balikBeli(id){
  const b=byId('pembelian',id);if(!b||b.status!=='posted')throw new Error('Hanya pembelian terposting yang bisa dibalik.');
  const alasan=S.ui.balikAlasan.trim();if(!alasan)throw new Error('Tulis alasan membalik pembelian.');
  if(b.jenis==='peralatan'){for(const aid of b.aset_ids||[]){const a=byId('aset',aid);if(!a)continue;if(a.status!=='aktif'||(a.jadwal||[]).some(r=>r.jurnal_id))throw new Error(`${aid} sudah punya penyusutan yang dijurnal atau sudah dilepas. Gunakan Pelepasan Peralatan.`)}}
  else if(S.data.opname.some(o=>o.status!=='ditolak'&&o.periode>=per(b.tanggal)))throw new Error('Nilai sisa perlengkapan untuk periode ini atau sesudahnya sudah diinput, jadi pembelian tidak bisa dibalik.');
  const asli=byId('jurnal',b.jurnal_id);if(!asli)throw new Error('Jurnal asli tidak ditemukan.');
  const jid=await buatJurnal({tanggal:today(),jenis:'pembalik',status:'disetujui',keterangan:`Pembalik ${b.jurnal_id} (pembelian ${b.no}): ${alasan}`,baris:asli.baris.map(x=>({akun:x.akun,debit:x.kredit,kredit:x.debit})),sumber_tipe:'pembelian',sumber_id:id,pembalik_dari:b.jurnal_id});
  for(const aid of b.aset_ids||[])await S.db.doc('aset/'+aid).update({status:'batal',jadwal:[]});
  await S.db.doc('pembelian/'+id).update({status:'dibalik',alasan_balik:alasan,jurnal_pembalik:jid,dibalik_oleh:S.role,dibalik_pada:iso()});
  S.ui.balik=null;S.ui.balikAlasan='';toast(`${id} dibalik dengan ${jid}.`);
}
