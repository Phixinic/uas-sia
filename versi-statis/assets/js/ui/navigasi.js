/*
 * Menu samping, badge pemberitahuan, dan pemilih peran (Admin / HRD / Owner).
 */
const NAV=[
  ['Ringkasan',[['dashboard','Dashboard']]],
  ['Siklus konversi',[['beli-peralatan','Pembelian Peralatan'],['beli-perlengkapan','Pembelian Perlengkapan'],['nilai-sisa','Nilai Sisa Perlengkapan'],['pelepasan','Pelepasan Peralatan'],['penyusutan','Proses Penyusutan'],['aset','Kartu Aset']]],
  ['Siklus SDM',[['presensi','Presensi'],['hitung-gaji','Hitung Gaji'],['distribusi-gaji','Distribusi Gaji']]],
  ['Jurnal & laporan',[['jurnal-penyesuaian','Jurnal Penyesuaian'],['jurnal-umum','Jurnal Umum'],['buku-besar','Buku Besar'],['neraca-saldo','Neraca Saldo']]],
  ['Pengaturan',[['data-master','Master Konversi'],['master-sdm','Master SDM'],['tutup-periode','Tutup Periode']]]];
const VALID=new Set(NAV.flatMap(g=>g[1].map(x=>x[0])));
function badge(id){
  if(id==='jurnal-penyesuaian'){const n=S.data.jurnal.filter(j=>j.jenis==='penyesuaian'&&(isOwner()?j.status==='diajukan':j.status==='draft')).length;return n}
  if(id==='distribusi-gaji')return isOwner()?S.data.penggajian.filter(g=>g.status==='diajukan').length:isHrd()?(S.data.slip.some(x=>x.status==='draft')?'!':0):0;
  if(id==='pelepasan'&&isOwner())return S.data.pelepasan.filter(p=>p.status==='diajukan').length;
  if(id==='penyusutan'&&isAdmin()){const P=per(today());return S.data.aset.some(a=>a.status==='aktif'&&(a.jadwal||[]).some(r=>r.periode<P&&!r.jurnal_id))?'!':0}
  return 0;
}
/* Grup menu bisa dilipat. Pilihan pengguna disimpan di localStorage; tanpa pilihan, hanya grup yang berisi halaman aktif yang terbuka. */
const NAVKEY='sia-nav-open';
const navPref=(()=>{try{return JSON.parse(localStorage.getItem(NAVKEY))||{}}catch(e){return {}}})();
let navLast=null;
function navSimpan(){try{localStorage.setItem(NAVKEY,JSON.stringify(navPref))}catch(e){}}
function navHtml(){
  const aktif=(NAV.find(g=>g[1].some(x=>x[0]===S.view))||[])[0];
  if(navLast!==S.view){navLast=S.view;if(aktif&&navPref[aktif]===false){delete navPref[aktif];navSimpan()}}
  return NAV.map(([g,items],i)=>{
    const open=navPref[g]!==undefined?navPref[g]:g===aktif;
    const tunda=open?0:items.reduce((n,[id])=>{const b=badge(id);return n+(b==='!'?1:+b||0)},0);
    return `<div class="ng${open?'':' cl'}"><button type="button" class="grp" id="ngb-${i}" data-ng="${esc(g)}" aria-expanded="${open}" aria-controls="ng-${i}"><span>${g}</span>${tunda?`<span class="bdg">${tunda}</span>`:''}<span class="car" aria-hidden="true"></span></button><div class="nl" id="ng-${i}">${items.map(([id,l])=>{const b=badge(id);return `<a href="#${id}" class="${S.view===id?'on':''}"${S.view===id?' aria-current="page"':''}><span>${l}</span>${b?`<span class="bdg">${b}</span>`:''}</a>`}).join('')}</div></div>`}).join('')}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ng]');if(!b)return;
  const g=b.dataset.ng;navPref[g]=b.getAttribute('aria-expanded')!=='true';navSimpan();render();
});
function roleHtml(){
  const load=S.dbState==='ok'&&S.loaded.size<COLS.length?'<span class="small muted">Memuat data…</span>':'';
  return `<div class="role"><span>Masuk sebagai</span><div class="seg" role="group" aria-label="Peran">${['admin','hrd','owner'].map(r=>`<button type="button" class="${S.role===r?'on':''}" aria-pressed="${S.role===r}" data-act="role" data-v="${r}">${ROLE[r]}</button>`).join('')}</div><span class="small">Peran demo, di sistem nyata ditentukan oleh login.</span></div>${load}${modeNote()}`;
}


function modeNote(){
  if(S.dbMode==='local')return `<span class="small muted">Data tersimpan di browser ini. ${cbtn('reset-local','','Reset data contoh','Klik lagi untuk menghapus semua data','sm')}</span>`;
  if(S.dbMode==='supabase')return '<span class="small muted">Tersambung ke database Supabase</span>';
  return '';
}
