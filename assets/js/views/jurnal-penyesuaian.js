/*
 * Use case: Melihat & Memvalidasi Jurnal Penyesuaian (draf -> diajukan Admin -> disetujui/ditolak Owner).
 */
function jCard(j){
  let acts='';
  if(j.status==='draft'&&isAdmin())acts=`<button type="button" class="btn sm pri" data-act="jp-ajukan" data-id="${j.id}">Ajukan ke Owner</button>`;
  if(j.status==='diajukan'&&isOwner()){acts=j.dibuat_oleh==='owner'?'<span class="small muted">Pembuat tidak boleh menyetujui jurnalnya sendiri</span>':cbtn('jp-setuju',j.id,'Setujui','Klik lagi untuk menyetujui','sm pri')+(S.ui.tolak===j.id?'':`<button type="button" class="btn sm dng" data-act="jp-tolak-open" data-id="${j.id}">Tolak</button>`)}
  const rin=j.rincian&&j.rincian.length?`<details><summary>Rincian (${j.rincian.length})</summary><div class="tw"><table class="t"><tbody>${j.rincian.map(r=>`<tr><td>${esc(r.label)}</td><td class="small muted">${esc(r.info||'')}</td><td class="num">${rp(r.nilai)}</td></tr>`).join('')}</tbody></table></div></details>`:'';
  const meta=[`Dibuat ${ROLE[j.dibuat_oleh]||j.dibuat_oleh}`];if(j.diajukan_pada&&j.status!=='disetujui')meta.push('diajukan '+fmtTgl(j.diajukan_pada.slice(0,10)));if(j.disetujui_oleh)meta.push(`${j.status==='ditolak'?'ditolak':'disetujui'} ${ROLE[j.disetujui_oleh]||''} ${j.disetujui_pada?fmtTgl(j.disetujui_pada.slice(0,10)):''}`);
  const tolak=S.ui.tolak===j.id?`<div class="stack" style="gap:8px"><div class="fld"><label for="tolak-alasan">Alasan penolakan (wajib)</label><textarea class="in" id="tolak-alasan" data-bind="tolakAlasan">${esc(S.ui.tolakAlasan)}</textarea></div><div class="row"><button type="button" class="btn dng" data-act="jp-tolak" data-id="${j.id}">Tolak jurnal</button><button type="button" class="btn" data-act="set" data-k="tolak" data-v="">Batal</button></div></div>`:'';
  return `<article class="card stack" style="gap:10px"><div class="row between"><div class="row"><b class="code">${esc(j.no)}</b><span class="small muted">${fmtTgl(j.tanggal)}</span>${pill(j.status)}</div><div class="row">${acts}</div></div>
   <div>${esc(j.keterangan)}</div>${jTable(j.baris)}${rin}
   ${j.status==='ditolak'&&j.alasan_tolak?`<div class="alert bad"><b>Alasan ditolak:</b> ${esc(j.alasan_tolak)}. Sumbernya sudah dibuka lagi, jadi Admin bisa memproses ulang.</div>`:''}
   <div class="small muted">${meta.join(' · ')}</div>${tolak}</article>`;
}
function vJP(){
  const f=S.ui.jpFilter;const all=S.data.jurnal.filter(j=>j.jenis==='penyesuaian');
  const list=all.filter(j=>f==='semua'||j.status===f).sort((a,b)=>(b.tanggal+b.no).localeCompare(a.tanggal+a.no));
  const tabs=[['draft','Draf'],['diajukan','Diajukan'],['disetujui','Disetujui'],['ditolak','Ditolak'],['semua','Semua']];
  return head('Jurnal Penyesuaian',`Admin mengajukan, Owner menyetujui atau menolak dengan alasan. Hanya jurnal yang disetujui masuk buku besar. ${isOwner()?'Kamu masuk sebagai Owner.':'Kamu masuk sebagai Admin.'}`)+
   `<div class="stack"><div class="row" role="group" aria-label="Filter status">${tabs.map(([v,l])=>`<button type="button" class="btn sm ${f===v?'on':''}" aria-pressed="${f===v}" data-act="set" data-k="jpFilter" data-v="${v}">${l} (${v==='semua'?all.length:all.filter(j=>j.status===v).length})</button>`).join('')}</div>
   ${list.length?list.map(jCard).join(''):`<div class="card empty">Tidak ada jurnal penyesuaian dengan status ini. Jurnal dibuat dari Proses Penyusutan dan Nilai Sisa Perlengkapan.</div>`}</div>`;
}
async function jpAjukan(id){const j=byId('jurnal',id);if(!j||j.status!=='draft')throw new Error('Jurnal ini bukan draf.');await S.db.doc('jurnal/'+id).update({status:'diajukan',diajukan_pada:iso()});toast(`${id} diajukan ke Owner.`)}
async function jpSetuju(id){const j=byId('jurnal',id);if(!j||j.status!=='diajukan')throw new Error('Jurnal ini belum diajukan.');if(!isOwner())throw new Error('Hanya Owner yang bisa menyetujui.');if(j.dibuat_oleh===S.role)throw new Error('Pembuat tidak boleh menyetujui jurnalnya sendiri.');if(isLocked(j.periode))throw new Error('Periode jurnal ini sudah dikunci.');
  await S.db.doc('jurnal/'+id).update({status:'disetujui',disetujui_oleh:S.role,disetujui_pada:iso()});toast(`${id} disetujui dan masuk buku besar.`)}
async function jpTolak(id){const j=byId('jurnal',id);if(!j||j.status!=='diajukan')throw new Error('Jurnal ini belum diajukan.');const al=S.ui.tolakAlasan.trim();if(!al)throw new Error('Tulis alasan penolakan.');
  await S.db.doc('jurnal/'+id).update({status:'ditolak',alasan_tolak:al,disetujui_oleh:S.role,disetujui_pada:iso()});
  if(j.sumber_tipe==='penyusutan'){for(const a of S.data.aset){if(!(a.jadwal||[]).some(r=>r.jurnal_id===id))continue;await S.db.doc('aset/'+a.id).update({jadwal:a.jadwal.map(r=>r.jurnal_id===id?Object.assign({},r,{jurnal_id:null}):r)})}}
  if(j.sumber_tipe==='opname'&&j.sumber_id)await S.db.doc('opname/'+j.sumber_id).update({status:'ditolak'});
  S.ui.tolak=null;S.ui.tolakAlasan='';toast(`${id} ditolak.`,'warn')}
