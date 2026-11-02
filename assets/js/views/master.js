/*
 * Use case: Kelola Master Supplier, Peralatan, Perlengkapan, Kategori Aset, dan Bagan Akun.
 */
const TIPE=['Aset','Kontra aset','Liabilitas','Ekuitas','Pendapatan','Beban'];
const MDEF={
  supplier:{label:'Supplier',prefix:'SUP',f:[['nama','Nama supplier','text',1],['alamat','Alamat','text'],['telepon','Telepon','text'],['email','Email','email'],['npwp','NPWP','text']]},
  peralatan:{label:'Peralatan',prefix:'ALT',f:[['nama','Nama peralatan','text',1],['satuan','Satuan','text',1],['kategori_id','Kategori aset','kategori',1]]},
  perlengkapan:{label:'Perlengkapan',prefix:'LKP',f:[['nama','Nama perlengkapan','text',1],['satuan','Satuan','text',1]]},
  kategori:{label:'Kategori aset',prefix:'KAT',owner:1,f:[['nama','Nama kategori','text',1],['masa_manfaat_bulan','Masa manfaat (bulan)','number',1],['persen_residu','Residu (%)','number'],['akun_aset','Akun aset','akun',1],['akun_akumulasi','Akun akumulasi','akun',1],['akun_beban','Akun biaya','akun',1]]},
  akun:{label:'Bagan akun',owner:1,f:[['kode','Kode akun','text',1],['nama','Nama akun','text',1],['tipe','Tipe','tipe',1],['saldo_normal','Saldo normal','dk',1]]}};
const canM=t=>MDEF[t].owner?isOwner():true;
function mField(t,[k,l,type,req]){const id='m-'+k;const v=S.ui.mForm.v[k]??'';const lab=l+(req?' *':'');
  if(type==='kategori')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih kategori',v)}${S.data.kategori.filter(x=>x.aktif!==false||x.id===v).map(x=>opt(x.id,x.nama,v)).join('')}</select>`);
  if(type==='akun')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih akun',v)}${S.data.akun.slice().sort((a,b)=>a.kode.localeCompare(b.kode)).map(x=>opt(x.kode,`${x.kode} · ${x.nama}`,v)).join('')}</select>`);
  if(type==='tipe')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('','Pilih tipe',v)}${TIPE.map(x=>opt(x,x,v)).join('')}</select>`);
  if(type==='dk')return fld(lab,`<select class="in" id="${id}" data-bind="mForm.v.${k}">${opt('D','Debit',v)}${opt('K','Kredit',v)}</select>`);
  return fld(lab,inp(id,'mForm.v.'+k,v,(type==='number'?'type="number" min="0" step="1"':`type="${type}"`)+(t==='akun'&&k==='kode'&&S.ui.mForm.id?' readonly':'')));
}
function vMaster(){
  const t=S.ui.mTab;const D=MDEF[t];const list=S.data[t].slice().sort((a,b)=>(a.kode||'').localeCompare(b.kode||''));
  const cols={supplier:[['Alamat',x=>esc(x.alamat)],['Telepon',x=>esc(x.telepon)],['NPWP',x=>esc(x.npwp)]],peralatan:[['Satuan',x=>esc(x.satuan)],['Kategori',x=>esc((byId('kategori',x.kategori_id)||{}).nama||'-')]],perlengkapan:[['Satuan',x=>esc(x.satuan)],['Saldo buku (Rp)',x=>rp(saldoBukuLkp(x.id,per(today()))),1]],kategori:[['Masa manfaat',x=>x.masa_manfaat_bulan+' bln'],['Residu',x=>(x.persen_residu||0)+'%'],['Akun',x=>`<span class="code small">${esc(x.akun_aset)} / ${esc(x.akun_akumulasi)} / ${esc(x.akun_beban)}</span>`]],akun:[['Tipe',x=>esc(x.tipe)],['Normal',x=>x.saldo_normal==='K'?'Kredit':'Debit'],['Saldo (Rp)',x=>rp(saldo(x.kode,null)),1]]}[t];
  const form=S.ui.mForm&&S.ui.mForm.tab===t?`<form class="card stack" aria-label="Form ${D.label}"><h2>${S.ui.mForm.id?'Ubah '+esc(S.ui.mForm.id):D.label+' baru'}</h2><div class="grid">${D.f.map(x=>mField(t,x)).join('')}</div><div class="row"><button type="button" class="btn pri" data-act="m-save">Simpan</button><button type="button" class="btn" data-act="set" data-k="mForm" data-v="">Batal</button></div></form>`:'';
  return head('Data Master',`Data master tidak pernah dihapus, hanya dinonaktifkan, supaya transaksi lama tetap terbaca. ${t==='kategori'||t==='akun'?'Kategori dan bagan akun dikelola Owner.':'Admin dan Owner bisa menambah dan mengubah. Menonaktifkan hanya Owner.'}`,
    canM(t)&&!form?`<button type="button" class="btn pri" data-act="m-new">+ ${D.label} baru</button>`:'')+
  `<div class="stack"><div class="row" role="tablist" aria-label="Jenis master">${Object.keys(MDEF).map(k=>`<button type="button" role="tab" aria-selected="${k===t}" class="btn sm ${k===t?'on':''}" data-act="set" data-k="mTab" data-v="${k}">${MDEF[k].label}</button>`).join('')}</div>${form}
   <section class="card flush">${list.length?`<div class="tw"><table class="t"><thead><tr><th>Kode</th><th>Nama</th>${cols.map(c=>`<th class="${c[2]?'num':''}">${c[0]}</th>`).join('')}<th>Status</th><th>Aksi</th></tr></thead><tbody>${list.map(x=>`<tr><td class="code">${esc(x.kode)}</td><td>${esc(x.nama)}</td>${cols.map(c=>`<td class="${c[2]?'num':''}">${c[1](x)}</td>`).join('')}<td>${pill(x.aktif===false?'nonaktif':'aktif')}</td><td><div class="row">${canM(t)?`<button type="button" class="btn sm" data-act="m-edit" data-id="${x.id}">Ubah</button>`:''}${isOwner()?`<button type="button" class="btn sm" data-act="m-toggle" data-id="${x.id}">${x.aktif===false?'Aktifkan':'Nonaktifkan'}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">Belum ada data ${D.label.toLowerCase()}.</div>`}</section></div>`;
}
async function mSave(){
  const t=S.ui.mForm.tab,id=S.ui.mForm.id,v=S.ui.mForm.v,D=MDEF[t];if(!canM(t))throw new Error('Peran ini tidak boleh mengubah data ini.');
  const doc={};for(const [k,l,type,req] of D.f){let val=v[k]??'';if(type==='number')val=filled(val)?int(val):0;else val=String(val).trim();if(req&&(type==='number'?!(val>0):!val))throw new Error(`${l} wajib diisi.`);doc[k]=val}
  if(t==='kategori'&&(doc.persen_residu<0||doc.persen_residu>=100))throw new Error('Residu harus 0 sampai di bawah 100%.');
  if(t==='supplier'&&doc.npwp&&S.data.supplier.some(s=>s.npwp===doc.npwp&&s.id!==id))throw new Error('NPWP sudah dipakai supplier lain.');
  if(t==='akun'){if(!/^[0-9A-Za-z.\-]{1,20}$/.test(doc.kode))throw new Error('Kode akun hanya boleh huruf, angka, titik, dan tanda minus.');if(!id&&S.data.akun.some(a=>a.kode===doc.kode))throw new Error('Kode akun sudah ada.')}
  if(id)await S.db.doc(t+'/'+id).update(doc);
  else{const nid=t==='akun'?doc.kode:await nomor(D.prefix);await S.db.doc(t+'/'+nid).set(Object.assign({kode:nid,aktif:true},doc))}
  S.ui.mForm=null;toast(`${D.label} tersimpan.`);
}
async function quickSave(){
  const q=S.ui.quick,f=S.ui.beli;const nama=(q.nama||'').trim();if(!nama)throw new Error('Isi nama.');
  if(q.type==='supplier'){const nid=await nomor('SUP');await S.db.doc('supplier/'+nid).set({kode:nid,nama,telepon:(q.telepon||'').trim(),alamat:'',email:'',npwp:'',aktif:true});f.supplier_id=nid}
  else{const t=f.jenis;if(!(q.satuan||'').trim())throw new Error('Isi satuan.');if(t==='peralatan'&&!q.kategori_id)throw new Error('Pilih kategori aset.');
    const nid=await nomor(t==='peralatan'?'ALT':'LKP');const d={kode:nid,nama,satuan:q.satuan.trim(),aktif:true};if(t==='peralatan')d.kategori_id=q.kategori_id;await S.db.doc(t+'/'+nid).set(d);
    const it=f.items.find(x=>!x.barang_id)||f.items[f.items.length-1];it.barang_id=nid;if(t==='peralatan'){const k=byId('kategori',q.kategori_id);if(k&&!it.masa_manfaat_bulan)it.masa_manfaat_bulan=String(k.masa_manfaat_bulan||'')}}
  S.ui.quick=null;toast(`${nama} ditambahkan ke master.`);
}
