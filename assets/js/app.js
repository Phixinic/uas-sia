/*
 * Titik masuk aplikasi: render halaman, event handler, routing hash, dan koneksi database.
 */
const VIEWS={dashboard:vDashboard,'beli-peralatan':()=>vBeli('peralatan'),'beli-perlengkapan':()=>vBeli('perlengkapan'),'nilai-sisa':vSisa,pelepasan:vLepas,penyusutan:vSusut,aset:vAset,'jurnal-penyesuaian':vJP,'jurnal-umum':vJU,'buku-besar':vBB,'neraca-saldo':vNS,'data-master':()=>vMaster('konv'),'master-sdm':()=>vMaster('sdm'),presensi:vPresensi,'hitung-gaji':vGaji,'distribusi-gaji':vDistribusi,'tutup-periode':vPeriode};
let rq=0;function render(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;doRender()})}
function doRender(){
  const ae=document.activeElement;const fid=ae&&ae.id;let ss=null;try{ss=ae.selectionStart}catch(e){}
  document.getElementById('nav').innerHTML=navHtml();document.getElementById('rolebar').innerHTML=roleHtml();
  {const pf=profil();document.getElementById('brand').innerHTML=`<b>${esc(pf.nama||'Laundry Sukses Mandiri')}</b><span>${esc(pf.ket||'SIA Konversi & SDM')}</span>`}
  let html='';try{html=(VIEWS[S.view]||vDashboard)()}catch(e){console.error(e);html=`<div class="alert bad">Halaman gagal ditampilkan: ${esc(e.message)}</div>`}
  document.getElementById('main').innerHTML=(S.dbState==='none'?'<div class="alert warn" style="margin-bottom:16px">Database tidak tersedia di tampilan ini, jadi data tidak bisa dimuat atau disimpan. Buka halaman ini langsung dari claude.ai.</div>':'')+html;
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement){el.focus({preventScroll:true});if(ss!=null)try{el.setSelectionRange(ss,ss)}catch(e){}}}
}
function toast(msg,kind){const t=document.getElementById('toast');t.innerHTML=`<div class="tst ${kind||'ok'}">${esc(msg)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.innerHTML=''},4500)}
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el)return;e.preventDefault();
  const act=el.dataset.act,fn=ACT[act];if(!fn)return;
  if(el.dataset.confirm!==undefined){const key=act+':'+(el.dataset.id||'');if(S.ui.confirm!==key){S.ui.confirm=key;render();clearTimeout(ACT._ct);ACT._ct=setTimeout(()=>{S.ui.confirm=null;render()},5000);return}S.ui.confirm=null}
  if(SYNC.has(act)){fn(el.dataset,el);render();return}
  if(S.busy)return;S.busy=true;document.body.classList.add('busy');
  try{await fn(el.dataset,el)}catch(err){console.error(err);toast(err.message||'Terjadi kesalahan. Coba lagi.','bad')}finally{S.busy=false;document.body.classList.remove('busy');render()}
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('tr[data-act]')){e.preventDefault();e.target.click()}});
function onBind(e){const el=e.target;if(!el.dataset||!el.dataset.bind)return;
  if(el.dataset.multi!==undefined){if(e.type!=='change')return;let x=S.ui;for(const k of el.dataset.bind.split('.'))x=x==null?x:x[k];const cur=(Array.isArray(x)?x:[]).filter(v=>v!==el.value);if(el.checked)cur.push(el.value);setPath(S.ui,el.dataset.bind,cur);return}
  setPath(S.ui,el.dataset.bind,el.value);HOOK(el.dataset.bind);
  if(el.dataset.rr!==undefined){if(e.type==='change')render();return}
  const root=el.dataset.bind.split('.')[0];const pv=document.getElementById('pv-'+root);if(pv&&PV[root])pv.innerHTML=PV[root]()}
document.addEventListener('input',onBind);document.addEventListener('change',onBind);
document.addEventListener('submit',e=>e.preventDefault());
function route(){const h=location.hash.slice(1);S.view=VALID.has(h)?h:'dashboard';S.ui.confirm=null;render();window.scrollTo(0,0)}
window.addEventListener('hashchange',route);
route();
ACT['reset-local']=async()=>{LocalDB.reset();S.ui.beli=null;S.ui.mForm=null;toast('Data contoh dimuat ulang.')};
(async()=>{
  const {db,mode}=await connectDb();
  S.db=db;S.dbMode=mode;S.dbState='ok';render();
  COLS.forEach(c=>{db.collection(c).onSnapshot(snap=>{S.data[c]=snap.docs.map(d=>Object.assign({id:d.id},d.data()));S.loaded.add(c);render()},err=>{console.error(c,err);if(!err||err.code!=='revoked')toast('Gagal memuat data '+c+'. Muat ulang halaman.','bad')})});
})();
