/*
 * Siklus SDM. Use case: Hitung Gaji (slip gaji dan rincian PPh 21).
 */
function slipHtml(s){
  const k=byId('karyawan',s.karyawan_id)||{};const pj=s.pajak||{};
  const pend=[['Gaji pokok',s.gaji_pokok],['Tunjangan jabatan',s.tunj_jabatan]];if(s.tunj_keluarga)pend.push(['Tunjangan istri/anak',s.tunj_keluarga]);
  (s.tunj_lain||[]).forEach(t=>pend.push(['Tunjangan '+String(t.nama).toLowerCase(),t.nominal]));
  const pot=[];if(s.potongan_absen)pot.push([`Potongan absen (${s.alpa} hari alpa)`,s.potongan_absen]);pot.push([`PPh 21 (PTKP ${s.status_ptkp})`,s.pph21]);
  return `<section class="card stack"><div class="row between"><div><h2>Slip gaji ${esc(k.nama||s.karyawan_id)} · ${fmtPer(s.periode)}</h2><div class="small muted">${esc(s.id||slipKey(s.periode,s.karyawan_id))} · ${esc(jabNama(s.jabatan_id))} · ${slipPill(s.status||'draft')}${s.ref?' · '+esc(s.ref):''}</div></div><button type="button" class="btn sm" data-act="set" data-k="slipId" data-v="">Tutup</button></div>
   <div class="grid"><div><div class="small muted">Rekening</div><b>${esc(k.bank||'-')} ${esc(k.no_rek||'')}</b></div><div><div class="small muted">Kehadiran</div><b>${s.hadir} dari ${s.hari_kerja} hari</b></div><div><div class="small muted">Izin / sakit / cuti</div><b>${s.izin} / ${s.sakit} / ${s.cuti}</b></div><div><div class="small muted">Jam kerja · terlambat</div><b>${(+s.jam_kerja).toFixed(2)} jam · ${s.terlambat_menit} mnt</b></div></div>
   <div class="tw"><table class="t"><thead><tr><th>Pendapatan</th><th class="num">Jumlah (Rp)</th></tr></thead><tbody>${pend.map(([a,b])=>`<tr><td>${esc(a)}</td><td class="num">${rp(b)}</td></tr>`).join('')}</tbody>
     <thead><tr><th>Potongan</th><th class="num"></th></tr></thead><tbody>${pot.map(([a,b])=>`<tr><td>${esc(a)}</td><td class="num">−${rp(b)}</td></tr>`).join('')}<tr class="tot"><td>Total THP (ditransfer)</td><td class="num">${rp(s.thp)}</td></tr></tbody></table></div>
   ${lip('slip-pph','Perhitungan PPh 21 (disetahunkan)',`<div class="rumus">Bruto setahun      = ${rp(s.bruto)} × 12 = ${rp(pj.setahun)}
Biaya jabatan 5%   = ${rp(pj.biaya)}  (maksimal 6.000.000)
Neto setahun       = ${rp(pj.neto)}
PTKP ${String(s.status_ptkp).padEnd(13)} = ${rp(pj.ptkp)}
PKP (bulat ribuan) = ${rp(pj.pkp)}
PPh 21 setahun     = ${rp(pj.pph_setahun)}  →  per bulan ${rp(s.pph21)}</div>`)}</section>`;
}
function vGaji(){
  const P=sdmP();
  const rows=S.data.setgaji.filter(s=>s.aktif!==false).sort((a,b)=>a.karyawan_id.localeCompare(b.karyawan_id)).map(s=>{const slip=slipOf(P,s.karyawan_id);const c=hitungGaji(s.karyawan_id,P);return {s,slip,c,v:slip&&slip.status!=='draft'?slip:c}});
  const bisa=rows.filter(x=>x.c&&x.c.presensi>0&&(!x.slip||x.slip.status==='draft')).length;
  const sel=S.ui.slipId&&byId('slip',S.ui.slipId);
  const slips=S.data.slip.filter(s=>s.periode===P).sort((a,b)=>a.karyawan_id.localeCompare(b.karyawan_id));
  const tun=v=>v.tunj_jabatan+v.tunj_keluarga+sum(v.tunj_lain||[],t=>t.nominal);
  const ok=rows.filter(x=>x.v);
  return head('Hitung Gaji','Gaji dihitung dari Setting Gaji dan Rekap Presensi. Potongan absen = gaji pokok ÷ hari kerja × jumlah alpa. Hasilnya disimpan sebagai slip berstatus draf, lalu diajukan lewat Distribusi Gaji.',
    sdmPick()+(isHrd()?`<button type="button" class="btn pri" data-act="slip-semua"${bisa?'':' disabled'}>Hitung &amp; simpan semua (${bisa})</button>`:''))+
  `<div class="stack">${isLocked(P)?`<div class="alert bad">Periode ${fmtPer(P)} terkunci.</div>`:''}${sel?slipHtml(sel):''}
   <section class="card flush"><div class="ch row between"><h2>Proses hitung gaji ${fmtPer(P)}</h2><span class="small muted">Use case: Hitung Gaji</span></div>${rows.length?`<div class="sumr"><span>Karyawan <b>${ok.length}</b></span><span>Slip tersimpan <b>${slips.length}</b></span><span>Bruto <b>Rp${rp(sum(ok,x=>x.v.bruto))}</b></span><span>PPh 21 <b>Rp${rp(sum(ok,x=>x.v.pph21))}</b></span><span>THP <b>Rp${rp(sum(ok,x=>x.v.thp))}</b></span></div>${lip('gaji-proses','Rincian gaji per karyawan',`<div class="tw"><table class="t"><thead><tr><th>Karyawan</th><th class="num">Hadir</th><th class="num">Gaji pokok</th><th class="num">Tunjangan</th><th class="num">Pot. absen</th><th class="num">Bruto</th><th class="num">PPh 21</th><th class="num">THP</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
     ${rows.map(({s,slip,c,v})=>!v?`<tr><td colspan="10" class="muted">${esc(kryNama(s.karyawan_id))}: setting gaji belum lengkap</td></tr>`:`<tr><td>${esc(kryNama(s.karyawan_id))}<div class="small muted">${esc(jabNama(v.jabatan_id))}</div></td><td class="num">${v.hadir}/${v.hari_kerja}${v.alpa?` <span class="pill bad">${v.alpa} alpa</span>`:''}</td><td class="num">${rp(v.gaji_pokok)}</td><td class="num">${rp(tun(v))}</td><td class="num">${v.potongan_absen?'−'+rp(v.potongan_absen):'-'}</td><td class="num">${rp(v.bruto)}</td><td class="num">${rp(v.pph21)}</td><td class="num"><b>${rp(v.thp)}</b></td><td>${slip?slipPill(slip.status):'<span class="pill mut">Belum dihitung</span>'}</td><td><div class="row">${isHrd()&&(!slip||slip.status==='draft')?`<button type="button" class="btn sm" data-act="slip-satu" data-id="${s.karyawan_id}"${c&&c.presensi>0?'':' disabled'}>${slip?'Hitung ulang':'Simpan slip'}</button>`:''}${slip?`<button type="button" class="btn sm" data-act="set" data-k="slipId" data-v="${slip.id}">Lihat slip</button>`:''}${slip&&slip.status==='draft'&&isHrd()?cbtn('slip-del',slip.id,'Hapus','Yakin hapus?','sm dng'):''}</div></td></tr>`).join('')}
     <tr class="tot"><td colspan="5">Total (${ok.length} karyawan)</td><td class="num">${rp(sum(ok,x=>x.v.bruto))}</td><td class="num">${rp(sum(ok,x=>x.v.pph21))}</td><td class="num">${rp(sum(ok,x=>x.v.thp))}</td><td colspan="2"></td></tr></tbody></table></div>`,ok.length+' karyawan',1)}`:'<div class="empty">Belum ada Setting Gaji. Tambahkan di Master SDM.</div>'}</section>
   <section class="card flush"><div class="ch"><h2>PPh 21 ${fmtPer(P)}</h2></div>${slips.length?lip('gaji-pph','Rincian PPh 21 per slip',`<div class="tw"><table class="t"><thead><tr><th>Slip</th><th>Karyawan</th><th>PTKP</th><th class="num">Bruto/bln</th><th class="num">Bruto setahun</th><th class="num">Biaya jabatan</th><th class="num">PTKP (Rp)</th><th class="num">PKP</th><th class="num">PPh 21/bln</th></tr></thead><tbody>${slips.map(s=>`<tr><td class="code">${esc(s.id)}</td><td>${esc(kryNama(s.karyawan_id))}</td><td>${esc(s.status_ptkp)}</td><td class="num">${rp(s.bruto)}</td><td class="num">${rp(s.pajak.setahun)}</td><td class="num">${rp(s.pajak.biaya)}</td><td class="num">${rp(s.pajak.ptkp)}</td><td class="num">${rp(s.pajak.pkp)}</td><td class="num"><b>${rp(s.pph21)}</b></td></tr>`).join('')}<tr class="tot"><td colspan="8">Total PPh 21</td><td class="num">${rp(sum(slips,s=>s.pph21))}</td></tr></tbody></table></div><p class="small muted" style="margin:0;padding:10px 18px">Metode disetahunkan: (bruto × 12 − biaya jabatan − PTKP) × tarif progresif ÷ 12. Ini simulasi untuk tugas dan belum memakai tarif efektif (TER).</p>`,slips.length+' slip · Rp'+rp(sum(slips,s=>s.pph21))):'<div class="empty">Belum ada slip pada periode ini. Jalankan hitung gaji dulu.</div>'}</section>
   ${isHrd()?'':'<p class="note" style="margin:0">Hitung gaji dijalankan oleh HRD.</p>'}</div>`;
}
async function simpanSlip(kid,P){
  if(!isHrd())throw new Error('Hitung gaji dijalankan oleh HRD.');if(isLocked(P))throw new Error(`Periode ${fmtPer(P)} sudah dikunci.`);
  const c=hitungGaji(kid,P);if(!c)throw new Error(`Setting gaji ${kryNama(kid)} belum lengkap.`);
  if(!c.presensi)throw new Error(`${kryNama(kid)} belum punya presensi di ${fmtPer(P)}.`);
  const old=slipOf(P,kid);if(old&&old.status!=='draft')return false;
  await S.db.doc('slip/'+slipKey(P,kid)).set(Object.assign({},c,{status:'draft',ref:null,dihitung_pada:iso(),dibuat_oleh:S.role}));return true;
}
