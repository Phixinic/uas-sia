/*
 * Data master kedua siklus (konversi dan SDM), bagan akun, dan profil usaha.
 */
const TIPE=['Aset','Kontra aset','Liabilitas','Ekuitas','Pendapatan','Beban'];
const MDEF={
  supplier:{label:'Supplier',prefix:'SUP',f:[['nama','Nama supplier','text',1],['alamat','Alamat','text'],['telepon','Telepon','text'],['email','Email','email'],['npwp','NPWP','text']]},
  peralatan:{label:'Peralatan',prefix:'ALT',f:[['nama','Nama peralatan','text',1],['satuan','Satuan','text',1],['kategori_id','Kategori aset','kategori',1]]},
  perlengkapan:{label:'Perlengkapan',prefix:'LKP',f:[['nama','Nama perlengkapan','text',1],['satuan','Satuan','text',1]]},
  kategori:{label:'Kategori aset',prefix:'KAT',owner:1,f:[['nama','Nama kategori','text',1],['masa_manfaat_bulan','Masa manfaat (bulan)','number',1],['persen_residu','Residu (%)','number'],['akun_aset','Akun aset','akun',1],['akun_akumulasi','Akun akumulasi','akun',1],['akun_beban','Akun biaya','akun',1]]},
  akun:{label:'Bagan akun',owner:1,f:[['kode','Kode akun','text',1],['nama','Nama akun','text',1],['tipe','Tipe','tipe',1],['saldo_normal','Saldo normal','dk',1]]},
  karyawan:{label:'Karyawan',prefix:'KRY',grp:'sdm',f:[['nama','Nama','text',1],['status_ptkp','Status PTKP','opts:TK/0|TK/1|TK/2|TK/3|K/0|K/1|K/2|K/3',1],['bank','Bank','opts:BCA|Mandiri|BRI|BNI|BSI',1],['no_rek','No. rekening','text',1]]},
  jabatan:{label:'Jabatan',prefix:'JBT',grp:'sdm',f:[['nama','Nama jabatan','text',1],['tunj_jabatan','Tunjangan jabatan (Rp)','number'],['tunj_keluarga','Tunj. istri/anak (Rp)','number'],['akun_beban','Akun biaya gaji','akun',1]]},
  golongan:{label:'Gaji pokok',prefix:'GP',grp:'sdm',f:[['nama','Golongan','text',1],['jumlah','Gaji pokok (Rp)','number',1]]},
  tunjangan:{label:'Tunjangan',prefix:'TNJ',grp:'sdm',f:[['nama','Nama tunjangan','text',1],['nominal','Nominal per bulan (Rp)','number',1]]},
  jadwal:{label:'Jadwal kerja',prefix:'TM',grp:'sdm',nameOf:x=>jabNama(x.jabatan_id),f:[['jabatan_id','Jabatan','fk:jabatan',1],['jam_masuk','Jam masuk','time',1],['jam_keluar','Jam keluar','time',1],['hari_kerja','Hari kerja per bulan','number',1]],validate:(d,id)=>S.data.jadwal.some(t=>t.jabatan_id===d.jabatan_id&&t.id!==id)?'Jabatan ini sudah punya jadwal kerja.':toMin(d.jam_keluar)<=toMin(d.jam_masuk)?'Jam keluar harus setelah jam masuk.':''},
  setgaji:{label:'Setting gaji',prefix:'SET',grp:'sdm',nameOf:x=>kryNama(x.karyawan_id),f:[['karyawan_id','Karyawan','fk:karyawan',1],['jabatan_id','Jabatan','fk:jabatan',1],['golongan_id','Gaji pokok','fk:golongan',1],['tunjangan_ids','Tunjangan','multi:tunjangan']],validate:(d,id)=>S.data.setgaji.some(x=>x.karyawan_id===d.karyawan_id&&x.id!==id)?'Karyawan ini sudah punya setting gaji. Ubah data yang ada.':''}};
const canM=t=>MDEF[t].owner?isOwner():MDEF[t].grp==='sdm'?(isHrd()||isOwner()):(isAdmin()||isOwner());
function mField(t,[k,l,type,req]){const id='m-'+k;const v=S.ui.mForm.v[k]??'';const lab=l+(req?' *':'');
  if(type==='kategori')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih kategori',v)}${S.data.kategori.filter(x=>x.aktif!==false||x.id===v).map(x=>opt(x.id,x.nama,v)).join('')}</select>`);
  if(type==='akun')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih akun',v)}${S.data.akun.slice().sort((a,b)=>a.kode.localeCompare(b.kode)).map(x=>opt(x.kode,`${x.kode} · ${x.nama}`,v)).join('')}</select>`);
  if(type==='tipe')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih tipe',v)}${TIPE.map(x=>opt(x,x,v)).join('')}</select>`);
  if(type==='dk')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('D','Debit',v)}${opt('K','Kredit',v)}</select>`);
  if(type.startsWith('fk:')){const c=type.slice(3);return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih',v)}${S.data[c].filter(x=>x.aktif!==false||x.id===v).sort((a,b)=>a.kode.localeCompare(b.kode)).map(x=>opt(x.id,`${x.kode} · ${x.nama}${c==='golongan'?' (Rp'+rp(x.jumlah)+')':''}`,v)).join('')}</select>`)}
  if(type.startsWith('opts:'))return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih',v)}${type.slice(5).split('|').map(x=>opt(x,x,v)).join('')}</select>`);
  if(type.startsWith('multi:')){const c=type.slice(6);const cur=Array.isArray(v)?v:[];return `<div class="fld"><span class="lb">${lab}</span><div class="checks">${S.data[c].filter(x=>x.aktif!==false).map(x=>`<label><input type="checkbox" id="${id}-${x.id}" data-bind="mForm.v.${k}" data-multi value="${x.id}"${cur.includes(x.id)?' checked':''}> ${esc(x.nama)} (Rp${rp(x.nominal)})</label>`).join('')||'<span class="muted small">Master tunjangan masih kosong</span>'}</div></div>`}
  return fld(lab,inp(id,'mForm.v.'+k,v,(type==='number'?'type="number" min="0" step="1"':`type="${type}"`)+(t==='akun'&&k==='kode'&&S.ui.mForm.id?' readonly':'')));
}
function vMaster(grp){
  const keys=Object.keys(MDEF).filter(k=>(MDEF[k].grp||'konv')===grp);let t=S.ui.mTab;if(!keys.includes(t)){t=S.ui.mTab=keys[0];S.ui.mForm=null}const D=MDEF[t];const list=S.data[t].slice().sort((a,b)=>(a.kode||'').localeCompare(b.kode||''));
  const cols={supplier:[['Alamat',x=>esc(x.alamat)],['Telepon',x=>esc(x.telepon)],['NPWP',x=>esc(x.npwp)]],peralatan:[['Satuan',x=>esc(x.satuan)],['Kategori',x=>esc((byId('kategori',x.kategori_id)||{}).nama||'-')]],perlengkapan:[['Satuan',x=>esc(x.satuan)],['Saldo buku (Rp)',x=>rp(saldoBukuLkp(x.id,per(today()))),1]],kategori:[['Masa manfaat',x=>x.masa_manfaat_bulan+' bln'],['Residu',x=>(x.persen_residu||0)+'%'],['Akun',x=>`<span class="code small">${esc(x.akun_aset)} / ${esc(x.akun_akumulasi)} / ${esc(x.akun_beban)}</span>`]],akun:[['Tipe',x=>esc(x.tipe)],['Normal',x=>x.saldo_normal==='K'?'Kredit':'Debit'],['Saldo (Rp)',x=>rp(saldo(x.kode,null)),1]],
    karyawan:[['PTKP',x=>esc(x.status_ptkp)],['Rekening',x=>esc(x.bank)+' '+esc(x.no_rek)]],
    jabatan:[['Tunj. jabatan (Rp)',x=>rp(x.tunj_jabatan),1],['Tunj. istri/anak (Rp)',x=>rp(x.tunj_keluarga),1],['Akun biaya',x=>`<span class="code small">${esc(x.akun_beban)}</span> ${esc(akunNama(x.akun_beban))}`]],
    golongan:[['Gaji pokok (Rp)',x=>rp(x.jumlah),1]],tunjangan:[['Nominal (Rp)',x=>rp(x.nominal),1]],
    jadwal:[['Jam kerja',x=>esc(x.jam_masuk)+'–'+esc(x.jam_keluar)],['Hari kerja',x=>x.hari_kerja+' hari/bulan']],
    setgaji:[['Jabatan',x=>esc(jabNama(x.jabatan_id))],['Gaji pokok',x=>esc((byId('golongan',x.golongan_id)||{}).nama||'-')],['Tunjangan',x=>(x.tunjangan_ids||[]).map(i=>esc((byId('tunjangan',i)||{}).nama||i)).join(', ')||'-'],['Estimasi bruto (Rp)',x=>{const c=hitungGaji(x.karyawan_id,'0000-00');return c?rp(c.bruto):'-'},1]]}[t];
  const form=S.ui.mForm&&S.ui.mForm.tab===t?`<form class="card stack" aria-label="Form ${D.label}"><h2>${S.ui.mForm.id?'Ubah '+esc(S.ui.mForm.id):D.label+' baru'}</h2><div class="grid">${D.f.map(x=>mField(t,x)).join('')}</div><div class="row"><button type="button" class="btn pri" data-act="m-save">Simpan</button><button type="button" class="btn" data-act="set" data-k="mForm" data-v="">Batal</button></div></form>`:'';
  return head(grp==='sdm'?'Master SDM':'Master Konversi',`Data master tidak pernah dihapus, hanya dinonaktifkan, supaya transaksi lama tetap terbaca. ${t==='kategori'||t==='akun'?'Kategori dan bagan akun dikelola Owner, dan dipakai bersama oleh siklus konversi dan SDM.':(grp==='sdm'?'HRD':'Admin')+' dan Owner bisa menambah dan mengubah. Menonaktifkan hanya Owner.'}`,
    canM(t)&&!form?`<button type="button" class="btn pri" data-act="m-new">+ ${D.label} baru</button>`:'')+
  `<div class="stack"><div class="row" role="tablist" aria-label="Jenis master">${keys.map(k=>`<button type="button" role="tab" aria-selected="${k===t}" class="btn sm ${k===t?'on':''}" data-act="set" data-k="mTab" data-v="${k}">${MDEF[k].label}</button>`).join('')}</div>${form}
   <section class="card flush">${list.length?(tbl=>grp==='sdm'?lip('mst-'+t,'Daftar '+D.label.toLowerCase(),tbl,list.length+' data'):tbl)(`<div class="tw"><table class="t"><thead><tr><th>Kode</th><th>Nama</th>${cols.map(c=>`<th class="${c[2]?'num':''}">${c[0]}</th>`).join('')}<th>Status</th><th>Aksi</th></tr></thead><tbody>${list.map(x=>`<tr><td class="code">${esc(x.kode)}</td><td>${esc(D.nameOf?D.nameOf(x):x.nama)}</td>${cols.map(c=>`<td class="${c[2]?'num':''}">${c[1](x)}</td>`).join('')}<td>${pill(x.aktif===false?'nonaktif':'aktif')}</td><td><div class="row">${canM(t)?`<button type="button" class="btn sm" data-act="m-edit" data-id="${x.id}">Ubah</button>`:''}${isOwner()?`<button type="button" class="btn sm" data-act="m-toggle" data-id="${x.id}">${x.aktif===false?'Aktifkan':'Nonaktifkan'}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`):`<div class="empty">Belum ada data ${D.label.toLowerCase()}.</div>`}</section>${grp==='konv'?profilCard():''}</div>`;
}
async function mSave(){
  const t=S.ui.mForm.tab,id=S.ui.mForm.id,v=S.ui.mForm.v,D=MDEF[t];if(!canM(t))throw new Error('Peran ini tidak boleh mengubah data ini.');
  const doc={};for(const [k,l,type,req] of D.f){let val=v[k]??'';if(type.startsWith('multi:')){doc[k]=Array.isArray(val)?val.slice():[];continue}if(type==='number')val=filled(val)?int(val):0;else val=String(val).trim();if(req&&(type==='number'?!(val>0):!val))throw new Error(`${l} wajib diisi.`);doc[k]=val}
  if(D.validate){const er=D.validate(doc,id);if(er)throw new Error(er)}
  if(t==='kategori'&&(doc.persen_residu<0||doc.persen_residu>=100))throw new Error('Residu harus 0 sampai di bawah 100%.');
  if(t==='supplier'&&doc.npwp&&S.data.supplier.some(s=>s.npwp===doc.npwp&&s.id!==id))throw new Error('NPWP sudah dipakai supplier lain.');
  if(t==='akun'){if(!/^[0-9A-Za-z.\-]{1,20}$/.test(doc.kode))throw new Error('Kode akun hanya boleh huruf, angka, titik, dan tanda minus.');if(!id&&S.data.akun.some(a=>a.kode===doc.kode))throw new Error('Kode akun sudah ada.')}
  if(id)await S.db.doc(t+'/'+id).update(doc);
  else{const nid=t==='akun'?doc.kode:await nomor(D.prefix);await S.db.doc(t+'/'+nid).set(Object.assign({kode:nid,aktif:true},doc))}
  S.ui.mForm=null;toast(`${D.label} tersimpan.`);
}
async function quickSave(){
  if(!isAdmin())throw new Error('Master dari form pembelian ditambah oleh Admin.');
  const q=S.ui.quick,f=S.ui.beli;const nama=(q.nama||'').trim();if(!nama)throw new Error('Isi nama.');
  if(q.type==='supplier'){const nid=await nomor('SUP');await S.db.doc('supplier/'+nid).set({kode:nid,nama,telepon:(q.telepon||'').trim(),alamat:'',email:'',npwp:'',aktif:true});f.supplier_id=nid}
  else{const t=f.jenis;if(!(q.satuan||'').trim())throw new Error('Isi satuan.');if(t==='peralatan'&&!q.kategori_id)throw new Error('Pilih kategori aset.');
    const nid=await nomor(t==='peralatan'?'ALT':'LKP');const d={kode:nid,nama,satuan:q.satuan.trim(),aktif:true};if(t==='peralatan')d.kategori_id=q.kategori_id;await S.db.doc(t+'/'+nid).set(d);
    const it=f.items.find(x=>!x.barang_id)||f.items[f.items.length-1];it.barang_id=nid;if(t==='peralatan'){const k=byId('kategori',q.kategori_id);if(k&&!it.masa_manfaat_bulan)it.masa_manfaat_bulan=String(k.masa_manfaat_bulan||'')}}
  S.ui.quick=null;toast(`${nama} ditambahkan ke master.`);
}


function profilCard(){
  if(!isOwner())return '';if(!S.ui.profil&&S.loaded.has('meta'))S.ui.profil={nama:profil().nama||"D'Production",ket:profil().ket||'SIA Konversi & SDM'};
  const p=S.ui.profil||{nama:'',ket:''};
  return `<form class="card stack" aria-label="Profil usaha"><div><h2>Profil usaha (studi kasus)</h2><p class="small muted" style="margin:4px 0 0">Nama ini tampil di sidebar. Kalau studi kasusnya berganti, ubah di sini lalu sesuaikan data master.</p></div><div class="grid">${fld('Nama usaha',inp('pf-nama','profil.nama',p.nama))}${fld('Keterangan singkat',inp('pf-ket','profil.ket',p.ket))}</div><div><button type="button" class="btn pri" data-act="profil-save">Simpan profil</button></div></form>`;
}
