/*
 * State aplikasi (data dari database + state form/UI), peran pengguna, dan helper baca data.
 */
const S={db:null,dbState:'loading',loaded:new Set(),data:{},role:'admin',view:'dashboard',busy:false,
  ui:{beli:null,quick:null,confirm:null,balik:null,balikAlasan:'',susutPer:null,opn:{P:null,vals:{}},jpFilter:'diajukan',tolak:null,tolakAlasan:'',
      lepas:null,lepasTolak:null,lepasAlasan:'',asetId:null,asetFilter:'aktif',juP:'semua',bbAkun:'1-150',bbP:null,nsP:null,mTab:'supplier',mForm:null,perBuka:null,perAlasan:''}};
COLS.forEach(c=>S.data[c]=[]);
try{const r=localStorage.getItem('sia-role');if(r==='owner'||r==='admin'||r==='hrd')S.role=r}catch(e){}

const byId=(c,id)=>S.data[c].find(x=>x.id===id);
const akunNama=k=>(S.data.akun.find(a=>a.kode===k)||{}).nama||AKN[k]||k;
const normalOf=k=>(S.data.akun.find(a=>a.kode===k)||{}).saldo_normal||NORM[k]||'D';
const jSt=id=>{const j=S.data.jurnal.find(x=>x.id===id);return j?j.status:null};
const akmOk=a=>sum((a.jadwal||[]).filter(r=>r.jurnal_id&&jSt(r.jurnal_id)==='disetujui'),r=>r.beban);
const pendingRows=a=>(a.jadwal||[]).filter(r=>r.jurnal_id&&jSt(r.jurnal_id)!=='disetujui');
const perStatus=ym=>(S.data.periode.find(p=>p.id===ym)||{}).status||'terbuka';
const isLocked=ym=>perStatus(ym)==='terkunci';
const supNama=id=>id?((byId('supplier',id)||{}).nama||id):'Setoran pemilik';
const isOwner=()=>S.role==='owner',isAdmin=()=>S.role==='admin';
const ROLE={admin:'Admin',hrd:'HRD',owner:'Owner'};
const isHrd=()=>S.role==='hrd';
