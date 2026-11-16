/*
 * Siklus SDM. Use case: Rekap Presensi (input presensi harian dan rekap per periode).
 */
function vPresensi(){
  const P=sdmP();const tab=S.ui.prsTab||'rekap';const f=S.ui.prs;
  const kry=S.data.karyawan.filter(k=>k.aktif!==false).sort((a,b)=>a.kode.localeCompare(b.kode));
  const form=f?`<form class="card stack" aria-label="Form presensi"><div class="row between"><h2>${f.id?'Ubah presensi':'Input presensi'}</h2><span class="small muted">Keterlambatan dihitung otomatis dari jadwal kerja jabatan</span></div><div class="grid">
    ${fld('Karyawan',`<select class="in" id="p-kry" data-bind="prs.karyawan_id">${opt('','Pilih karyawan',f.karyawan_id)}${kry.map(k=>opt(k.id,`${k.kode} · ${k.nama}`,f.karyawan_id)).join('')}</select>`)}
    ${fld('Tanggal',inp('p-tgl','prs.tanggal',f.tanggal,'type="date"'))}
    ${fld('Absensi',`<select class="in" id="p-abs" data-bind="prs.absensi" data-rr>${ABSEN.map(a=>opt(a,a,f.absensi)).join('')}</select>`)}
    ${f.absensi==='Hadir'?fld('Jam masuk',inp('p-jm','prs.jam_masuk',f.jam_masuk,'type="time"'))+fld('Jam keluar',inp('p-jk','prs.jam_keluar',f.jam_keluar,'type="time"')):''}
   </div><div class="row"><button type="button" class="btn pri" data-act="prs-save">Simpan</button><button type="button" class="btn" data-act="set" data-k="prs" data-v="">Batal</button></div></form>`:'';
  let body;
  if(tab==='rekap'){
    const rows=kry.map(k=>({k,r:rekapPrs(k.id,P),tm:jadwalOf(k.id)}));
    body=`<section class="card flush"><div class="ch row between"><h2>Rekap presensi ${fmtPer(P)}</h2><span class="small muted">Angka ini dipakai saat hitung gaji</span></div>${rows.length?`<div class="tw"><table class="t"><thead><tr><th>Karyawan</th><th>Jabatan</th><th class="num">Hari kerja</th><th class="num">Hadir</th><th class="num">Izin</th><th class="num">Sakit</th><th class="num">Cuti</th><th class="num">Alpa</th><th class="num">Terlambat</th><th class="num">Jam kerja</th><th></th></tr></thead><tbody>
      ${rows.map(({k,r,tm})=>`<tr><td>${esc(k.nama)} <span class="code muted">${esc(k.kode)}</span></td><td>${tm?esc(jabNama(tm.jabatan_id)):'<span class="pill warn">Belum di-setting</span>'}</td><td class="num">${tm?tm.hari_kerja:'-'}</td><td class="num">${r.hadir}</td><td class="num">${r.izin}</td><td class="num">${r.sakit}</td><td class="num">${r.cuti}</td><td class="num">${r.alpa?`<span class="pill bad">${r.alpa}</span>`:0}</td><td class="num">${r.telatKali?`${r.telatKali}x · ${r.telatMenit} mnt`:'-'}</td><td class="num">${r.jam.toFixed(2)}</td><td><button type="button" class="btn sm" data-act="prs-detail" data-id="${k.id}">Detail</button></td></tr>`).join('')}
      <tr class="tot"><td colspan="3">Total</td><td class="num">${sum(rows,x=>x.r.hadir)}</td><td class="num">${sum(rows,x=>x.r.izin)}</td><td class="num">${sum(rows,x=>x.r.sakit)}</td><td class="num">${sum(rows,x=>x.r.cuti)}</td><td class="num">${sum(rows,x=>x.r.alpa)}</td><td class="num">${sum(rows,x=>x.r.telatMenit)} mnt</td><td class="num">${sum(rows,x=>x.r.jam).toFixed(2)}</td><td></td></tr></tbody></table></div>`:'<div class="empty">Belum ada karyawan. Tambahkan di Master SDM.</div>'}</section>`;
  }else{
    let rows=S.data.presensi.filter(p=>per(p.tanggal)===P);if(S.ui.prsKry)rows=rows.filter(p=>p.karyawan_id===S.ui.prsKry);
    rows.sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||a.karyawan_id.localeCompare(b.karyawan_id));
    body=`<section class="card flush"><div class="ch row between"><h2>Presensi harian ${fmtPer(P)}</h2><div class="row"><label class="small muted" for="p-f">Karyawan</label><select class="in" id="p-f" style="width:auto" data-bind="prsKry" data-rr>${opt('','Semua karyawan',S.ui.prsKry||'')}${kry.map(k=>opt(k.id,k.nama,S.ui.prsKry||'')).join('')}</select><span class="small muted">${rows.length} catatan</span></div></div>${rows.length?`<div class="tw scroll"><table class="t"><thead><tr><th>Tanggal</th><th>Karyawan</th><th>Absensi</th><th>Masuk</th><th>Keluar</th><th class="num">Terlambat</th><th class="num">Jam kerja</th><th>Jadwal</th><th>Aksi</th></tr></thead><tbody>
      ${rows.map(r=>{const lock=prsLocked(r.karyawan_id,P);return `<tr><td>${fmtTgl(r.tanggal)}</td><td>${esc(kryNama(r.karyawan_id))}</td><td>${absPill(r.absensi)}</td><td>${esc(r.jam_masuk||'-')}</td><td>${esc(r.jam_keluar||'-')}</td><td class="num">${r.terlambat?`<span class="pill warn">${r.terlambat} mnt</span>`:'-'}</td><td class="num">${jamKerjaOf(r)?jamKerjaOf(r).toFixed(2):'-'}</td><td class="code">${esc(r.jadwal_id||'-')}</td><td><div class="row">${isHrd()&&!lock?`<button type="button" class="btn sm" data-act="prs-edit" data-id="${r.id}">Ubah</button>`+cbtn('prs-del',r.id,'Hapus','Yakin hapus?','sm dng'):lock?'<span class="small muted">terkunci</span>':''}</div></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Belum ada presensi pada periode ini.</div>'}</section>`;
  }
  return head('Presensi','Catatan kehadiran harian dan rekapnya per periode. Jam kerja dikurangi istirahat '+ISTIRAHAT+' jam. Presensi terkunci setelah gaji periodenya diajukan.',
    sdmPick()+(isHrd()&&!f?'<button type="button" class="btn pri" data-act="prs-new">+ Input presensi</button>':''))+
   `<div class="stack"><div class="row" role="tablist" aria-label="Tampilan presensi">${[['rekap','Rekap presensi'],['harian','Presensi harian']].map(([v,l])=>`<button type="button" role="tab" aria-selected="${tab===v}" class="btn sm ${tab===v?'on':''}" data-act="set" data-k="prsTab" data-v="${v}">${l}</button>`).join('')}</div>${form}${isHrd()?'':'<p class="note" style="margin:0">Presensi diinput oleh HRD.</p>'}${body}</div>`;
}
async function prsSave(){
  const f=S.ui.prs;if(!isHrd())throw new Error('Presensi diinput oleh HRD.');
  if(!f.karyawan_id)throw new Error('Pilih karyawan.');if(!f.tanggal)throw new Error('Isi tanggal.');
  const P=per(f.tanggal);const tm=jadwalOf(f.karyawan_id);
  if(!tm)throw new Error('Karyawan ini belum punya Setting Gaji, atau jabatannya belum punya jadwal kerja.');
  if(prsLocked(f.karyawan_id,P))throw new Error('Gaji periode ini sudah diajukan atau dibayar, jadi presensinya terkunci.');
  const hadir=f.absensi==='Hadir';
  if(hadir){if(!f.jam_masuk||!f.jam_keluar)throw new Error('Jam masuk dan jam keluar wajib diisi untuk status Hadir.');if(toMin(f.jam_keluar)<=toMin(f.jam_masuk))throw new Error('Jam keluar harus setelah jam masuk.')}
  const id='PRS-'+f.karyawan_id+'-'+f.tanggal.replace(/-/g,'');
  if(id!==f.id&&byId('presensi',id))throw new Error('Presensi karyawan ini pada tanggal tersebut sudah ada.');
  if(f.id&&f.id!==id){const old=byId('presensi',f.id);if(old&&prsLocked(old.karyawan_id,per(old.tanggal)))throw new Error('Presensi lama sudah terkunci.');await S.db.doc('presensi/'+f.id).delete()}
  await S.db.doc('presensi/'+id).set({karyawan_id:f.karyawan_id,tanggal:f.tanggal,absensi:f.absensi,jam_masuk:hadir?f.jam_masuk:'',jam_keluar:hadir?f.jam_keluar:'',terlambat:hadir?Math.max(0,toMin(f.jam_masuk)-toMin(tm.jam_masuk)):0,jadwal_id:tm.id,dibuat_oleh:S.role});
  S.ui.prs=null;toast('Presensi tersimpan.');
}
