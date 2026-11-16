/*
 * Logika siklus SDM: rekap presensi, PPh 21 (disetahunkan), dan hitung gaji.
 */
const PTKP={'TK/0':54e6,'TK/1':58.5e6,'TK/2':63e6,'TK/3':67.5e6,'K/0':58.5e6,'K/1':63e6,'K/2':67.5e6,'K/3':72e6};
const ABSEN=['Hadir','Izin','Sakit','Cuti','Alpa'];
const ISTIRAHAT=1; // jam istirahat yang tidak dihitung sebagai jam kerja
const toMin=t=>{if(!t)return 0;const [h,m]=String(t).split(':').map(Number);return h*60+(m||0)};
const kryNama=id=>(byId('karyawan',id)||{}).nama||id||'-';
const jabNama=id=>(byId('jabatan',id)||{}).nama||id||'-';
const setOf=kid=>S.data.setgaji.find(s=>s.karyawan_id===kid&&s.aktif!==false);
const jadwalOf=kid=>{const s=setOf(kid);return s?S.data.jadwal.find(t=>t.jabatan_id===s.jabatan_id&&t.aktif!==false):null};
const jamKerjaOf=p=>p.absensi==='Hadir'&&p.jam_masuk&&p.jam_keluar?Math.max(0,(toMin(p.jam_keluar)-toMin(p.jam_masuk))/60-ISTIRAHAT):0;
const slipKey=(P,kid)=>'SLP-'+P+'-'+kid;
const slipOf=(P,kid)=>byId('slip',slipKey(P,kid));
const prsLocked=(kid,P)=>{const s=slipOf(P,kid);return !!s&&s.status!=='draft'};
const profil=()=>byId('meta','profil')||{};
function rekapPrs(kid,P){
  const list=S.data.presensi.filter(p=>p.karyawan_id===kid&&per(p.tanggal)===P);const c=s=>list.filter(p=>p.absensi===s).length;
  return {list,hadir:c('Hadir'),izin:c('Izin'),sakit:c('Sakit'),cuti:c('Cuti'),alpa:c('Alpa'),telatKali:list.filter(p=>p.terlambat>0).length,telatMenit:sum(list,p=>p.terlambat||0),jam:Math.round(sum(list,jamKerjaOf)*100)/100};
}
// PPh 21 metode disetahunkan (simulasi untuk tugas, belum memakai tarif efektif/TER)
function hitungPph(bruto,status){
  const setahun=bruto*12;const biaya=Math.min(Math.round(setahun*0.05),6000000);const neto=setahun-biaya;const ptkp=PTKP[status]??PTKP['TK/0'];
  const pkp=Math.max(0,Math.floor((neto-ptkp)/1000)*1000);let sisa=pkp,pajak=0;
  for(const [batas,tarif] of [[60e6,.05],[190e6,.15],[250e6,.25],[4500e6,.30],[Infinity,.35]]){const kena=Math.min(sisa,batas);pajak+=kena*tarif;sisa-=kena;if(sisa<=0)break}
  return {setahun,biaya,neto,ptkp,pkp,pph_setahun:Math.round(pajak),pph21:Math.round(pajak/12)};
}
function hitungGaji(kid,P){
  const st=setOf(kid),k=byId('karyawan',kid);if(!st||!k)return null;
  const jab=byId('jabatan',st.jabatan_id),gp=byId('golongan',st.golongan_id);if(!jab||!gp)return null;
  const tm=jadwalOf(kid);const hk=tm?(+tm.hari_kerja||22):22;const r=rekapPrs(kid,P);
  const tl=(st.tunjangan_ids||[]).map(id=>byId('tunjangan',id)).filter(t=>t&&t.aktif!==false).map(t=>({id:t.id,nama:t.nama,nominal:+t.nominal||0}));
  const tk=String(k.status_ptkp||'').startsWith('K/')?(+jab.tunj_keluarga||0):0;
  const pot=Math.round(gp.jumlah/hk*r.alpa);
  const bruto=gp.jumlah+(+jab.tunj_jabatan||0)+tk+sum(tl,t=>t.nominal)-pot;const pj=hitungPph(bruto,k.status_ptkp);
  return {periode:P,karyawan_id:kid,jabatan_id:jab.id,golongan_id:gp.id,jadwal_id:tm?tm.id:'',akun_beban:jab.akun_beban||AK.BGA,status_ptkp:k.status_ptkp||'TK/0',
    hari_kerja:hk,presensi:r.list.length,hadir:r.hadir,izin:r.izin,sakit:r.sakit,cuti:r.cuti,alpa:r.alpa,jam_kerja:r.jam,terlambat_menit:r.telatMenit,
    gaji_pokok:gp.jumlah,tunj_jabatan:+jab.tunj_jabatan||0,tunj_keluarga:tk,tunj_lain:tl,potongan_absen:pot,bruto,pajak:pj,pph21:pj.pph21,thp:bruto-pj.pph21};
}
function sdmPers(){const cur=per(today());const s=new Set([cur,addMonths(cur,-1)]);S.data.presensi.forEach(p=>s.add(per(p.tanggal)));S.data.slip.forEach(x=>s.add(x.periode));return [...s].sort()}
const sdmP=()=>S.ui.sdmP||(S.ui.sdmP=addMonths(per(today()),-1));
const sdmPick=()=>`<div class="fld"><label for="sdm-p">Periode</label><select class="in" id="sdm-p" data-bind="sdmP" data-rr>${perOpts(sdmPers(),sdmP())}</select></div>`;
const absPill=s=>`<span class="pill ${({Hadir:'ok',Alpa:'bad',Sakit:'warn',Izin:'warn',Cuti:'info'})[s]||'mut'}">${esc(s)}</span>`;
const slipPill=s=>s==='dibayar'?'<span class="pill ok">Dibayar</span>':pill(s);
