/*
 * Semua aksi tombol (data-act), binding input form, dan hook perubahan field.
 */
function needDb(){if(!S.db)throw new Error('Database belum tersedia.')}
const ACT={
  role:d=>{S.role=d.v;try{localStorage.setItem('sia-role',d.v)}catch(e){}S.ui.beli=null;S.ui.prs=null;S.ui.mForm=null;S.ui.tolak=null;S.ui.balik=null;S.ui.lepasTolak=null;S.ui.perBuka=null},
  set:d=>{setPath(S.ui,d.k,d.v===''?null:d.v);if(d.k==='mTab')S.ui.mForm=null},
  'beli-new':d=>{S.ui.beli={id:null,jenis:d.v,tanggal:today(),supplier_id:'',cara_bayar:'tunai',jatuh_tempo:'',keterangan:'',items:[newItem(d.v)]};S.ui.quick=null},
  'beli-edit':d=>{const b=byId('pembelian',d.id);if(!b)return;S.ui.beli={id:b.id,jenis:b.jenis,tanggal:b.tanggal,supplier_id:b.supplier_id||'',cara_bayar:b.cara_bayar,jatuh_tempo:b.jatuh_tempo||'',keterangan:b.keterangan||'',items:clone(b.items).map(it=>{const o={};for(const k in it)o[k]=String(it[k]);return o})};S.ui.quick=null;window.scrollTo(0,0)},
  'beli-cancel':()=>{S.ui.beli=null;S.ui.quick=null},
  'item-add':()=>{S.ui.beli.items.push(newItem(S.ui.beli.jenis))},
  'item-del':d=>{S.ui.beli.items.splice(+d.v,1)},
  'beli-save':async()=>{needDb();await simpanBeli(false)},
  'beli-save-post':async()=>{needDb();await simpanBeli(true)},
  'beli-post':async d=>{needDb();await postingBeli(d.id);toast(`${d.id} diposting.`)},
  'beli-del':async d=>{needDb();if(!isAdmin())throw new Error('Draf pembelian dihapus oleh Admin.');const b=byId('pembelian',d.id);if(!b||b.status!=='draft')throw new Error('Hanya draf yang bisa dihapus.');await S.db.doc('pembelian/'+d.id).delete();toast(`Draf ${d.id} dihapus.`)},
  'balik-open':d=>{S.ui.balik=d.id;S.ui.balikAlasan=''},
  'balik-cancel':()=>{S.ui.balik=null},
  'balik-do':async d=>{needDb();await balikBeli(d.id)},
  'quick-open':d=>{S.ui.quick={type:d.v==='supplier'?'supplier':'barang',nama:'',satuan:'',telepon:'',kategori_id:''}},
  'quick-cancel':()=>{S.ui.quick=null},
  'quick-save':async()=>{needDb();await quickSave()},
  'opn-save':async()=>{needDb();await simpanOpn()},
  'susut-proses':async()=>{needDb();await prosesSusut()},
  'jp-ajukan':async d=>{needDb();await jpAjukan(d.id)},
  'jp-setuju':async d=>{needDb();await jpSetuju(d.id)},
  'jp-tolak-open':d=>{S.ui.tolak=d.id;S.ui.tolakAlasan=''},
  'jp-tolak':async d=>{needDb();await jpTolak(d.id)},
  'lepas-ajukan':async()=>{needDb();await ajukanLepas()},
  'lepas-setuju':async d=>{needDb();await setujuLepas(d.id)},
  'lepas-tolak':async d=>{needDb();if(!isOwner())throw new Error('Hanya Owner yang bisa menolak.');const p=byId('pelepasan',d.id);if(!p||p.status!=='diajukan')throw new Error('Pengajuan ini sudah diputuskan.');const al=S.ui.lepasAlasan.trim();if(!al)throw new Error('Tulis alasan penolakan.');await S.db.doc('pelepasan/'+d.id).update({status:'ditolak',alasan_tolak:al,disetujui_oleh:S.role,disetujui_pada:iso()});S.ui.lepasTolak=null;S.ui.lepasAlasan='';toast(`${d.id} ditolak.`,'warn')},
  'per-kunci':async d=>{needDb();await kunciPer(d.id)},
  'per-buka':async d=>{needDb();await bukaPer(d.id)},
  'prs-new':()=>{const P=sdmP();S.ui.prs={id:null,karyawan_id:S.ui.prsKry||'',tanggal:P===per(today())?today():P+'-01',absensi:'Hadir',jam_masuk:'',jam_keluar:''}},
  'prs-edit':d=>{const p=byId('presensi',d.id);if(!p)return;S.ui.prs={id:p.id,karyawan_id:p.karyawan_id,tanggal:p.tanggal,absensi:p.absensi,jam_masuk:p.jam_masuk||'',jam_keluar:p.jam_keluar||''};window.scrollTo(0,0)},
  'prs-detail':d=>{S.ui.prsKry=d.id;S.ui.prsTab='harian'},
  'prs-save':async()=>{needDb();await prsSave()},
  'prs-del':async d=>{needDb();const p=byId('presensi',d.id);if(!p)return;if(!isHrd())throw new Error('Presensi dikelola oleh HRD.');if(prsLocked(p.karyawan_id,per(p.tanggal)))throw new Error('Presensi ini sudah masuk gaji yang diajukan atau dibayar.');await S.db.doc('presensi/'+d.id).delete();toast('Presensi dihapus.')},
  'slip-satu':async d=>{needDb();if(await simpanSlip(d.id,sdmP()))toast(`Slip ${kryNama(d.id)} disimpan sebagai draf.`)},
  'slip-semua':async()=>{needDb();if(!isHrd())throw new Error('Hitung gaji dijalankan oleh HRD.');const P=sdmP();let n=0;for(const st of S.data.setgaji.filter(x=>x.aktif!==false)){const c=hitungGaji(st.karyawan_id,P);if(c&&c.presensi>0&&await simpanSlip(st.karyawan_id,P))n++}toast(`${n} slip gaji ${fmtPer(P)} disimpan sebagai draf.`)},
  'slip-del':async d=>{needDb();const x=byId('slip',d.id);if(!x||x.status!=='draft')throw new Error('Hanya slip draf yang bisa dihapus.');if(!isHrd())throw new Error('Slip dikelola oleh HRD.');await S.db.doc('slip/'+d.id).delete();if(S.ui.slipId===d.id)S.ui.slipId=null;toast('Slip dihapus.')},
  'pg-ajukan':async()=>{needDb();await pgAjukan()},
  'pg-setuju':async d=>{needDb();await pgSetuju(d.id)},
  'pg-tolak':async d=>{needDb();await pgTolak(d.id)},
  'profil-save':async()=>{needDb();if(!isOwner())throw new Error('Profil usaha diubah oleh Owner.');const p=S.ui.profil||{};if(!(p.nama||'').trim())throw new Error('Isi nama usaha.');await S.db.doc('meta/profil').set({nama:p.nama.trim(),ket:(p.ket||'').trim()});toast('Profil usaha tersimpan.')},
  'm-new':()=>{const t=S.ui.mTab;const v={};MDEF[t].f.forEach(([k,,type])=>v[k]=type==='dk'?'D':type.startsWith('multi:')?[]:'');S.ui.mForm={tab:t,id:null,v}},
  'm-edit':d=>{const t=S.ui.mTab;const x=byId(t,d.id);if(!x)return;const v={};MDEF[t].f.forEach(([k])=>v[k]=Array.isArray(x[k])?x[k].slice():x[k]==null?'':String(x[k]));S.ui.mForm={tab:t,id:d.id,v};window.scrollTo(0,0)},
  'm-save':async()=>{needDb();await mSave()},
  'm-toggle':async d=>{needDb();if(!isOwner())throw new Error('Hanya Owner yang bisa menonaktifkan.');const t=S.ui.mTab;const x=byId(t,d.id);await S.db.doc(t+'/'+d.id).update({aktif:x.aktif===false});toast(`${x.nama} ${x.aktif===false?'diaktifkan':'dinonaktifkan'}.`)}
};
const SYNC=new Set(['prs-new','prs-edit','prs-detail','role','set','beli-new','beli-edit','beli-cancel','item-add','item-del','balik-open','balik-cancel','quick-open','quick-cancel','jp-tolak-open','m-new','m-edit']);
function setPath(o,path,val){const ps=path.split('.');let x=o;for(let i=0;i<ps.length-1;i++){const k=ps[i];if(x[k]==null||typeof x[k]!=='object')x[k]={};x=x[k]}x[ps[ps.length-1]]=val}
function HOOK(path){
  let m=path.match(/^beli\.items\.(\d+)\.barang_id$/);
  if(m&&S.ui.beli.jenis==='peralatan'){const it=S.ui.beli.items[+m[1]];const b=byId('peralatan',it.barang_id);const k=b&&byId('kategori',b.kategori_id);if(k){it.masa_manfaat_bulan=String(k.masa_manfaat_bulan||'');if(k.persen_residu>0&&int(it.harga)>0)it.residu=String(Math.round(int(it.harga)*k.persen_residu/100))}}
  if(path==='opn.P')S.ui.opn.vals={};
  if(path==='lepas.alasan'&&S.ui.lepas.alasan!=='dijual')S.ui.lepas.harga_jual='0';
}
const PV={beli:pvBeli,opn:pvOpn,lepas:pvLepas};
