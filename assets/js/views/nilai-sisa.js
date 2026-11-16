/*
 * Siklus konversi. Use case: Input Nilai Sisa (Saldo Akhir) Perlengkapan -> jurnal penyesuaian biaya perlengkapan.
 */
function defaultOpnP(){const cur=per(today());const first=S.data.pembelian.filter(b=>b.jenis==='perlengkapan'&&b.status==='posted').map(b=>per(b.tanggal)).sort()[0];if(!first)return cur;for(const p of months(first,cur))if(!S.data.opname.some(o=>o.periode===p&&o.status!=='ditolak'))return p;return cur}
function opnRows(P){return S.data.perlengkapan.map(b=>({b,sb:saldoBukuLkp(b.id,P)})).filter(x=>x.sb>0).sort((a,b)=>a.b.kode.localeCompare(b.b.kode))}
function vSisa(){
  const cur=per(today());const P=S.ui.opn.P||(S.ui.opn.P=defaultOpnP());
  const first=S.data.pembelian.filter(b=>b.jenis==='perlengkapan').map(b=>per(b.tanggal)).sort()[0]||cur;
  const exist=S.data.opname.find(o=>o.periode===P&&o.status!=='ditolak');
  const rej=S.data.opname.find(o=>o.periode===P&&o.status==='ditolak');
  let body='';
  if(exist){body=`<section class="card stack"><div class="row between"><h2>Nilai sisa ${fmtPer(P)} sudah diinput</h2><span>${exist.jurnal_id?`<span class="code">${esc(exist.jurnal_id)}</span> ${pill(jSt(exist.jurnal_id))}`:''}</span></div>
     <div class="tw"><table class="t"><thead><tr><th>Perlengkapan</th><th class="num">Saldo buku</th><th class="num">Nilai sisa</th><th class="num">Biaya</th></tr></thead><tbody>${exist.rows.map(r=>`<tr><td>${esc(r.nama)}</td><td class="num">${rp(r.saldo_buku)}</td><td class="num">${rp(r.nilai_sisa)}</td><td class="num">${rp(r.beban)}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="num">${rp(sum(exist.rows,r=>r.saldo_buku))}</td><td class="num">${rp(sum(exist.rows,r=>r.nilai_sisa))}</td><td class="num">${rp(exist.total_beban)}</td></tr></tbody></table></div>
     <p class="small muted" style="margin:0">Diinput oleh ${ROLE[exist.dibuat_oleh]||exist.dibuat_oleh}. Kalau jurnalnya ditolak Owner, form ini terbuka lagi untuk diinput ulang.</p></section>`}
  else{const rows=opnRows(P);
    if(!rows.length)body=`<div class="card empty">Tidak ada saldo perlengkapan sampai ${fmtPer(P)}. Posting pembelian perlengkapan dulu.</div>`;
    else body=`${rej?`<div class="alert bad">Input sebelumnya ditolak: ${esc((byId('jurnal',rej.jurnal_id)||{}).alasan_tolak||'')}. Silakan input ulang.</div>`:''}
     <section class="card flush"><div class="ch row between"><h2>Hitung fisik ${fmtPer(P)}</h2><span class="small muted">Use case: Input Nilai Sisa (Saldo Akhir) Perlengkapan</span></div><div class="tw"><table class="t"><thead><tr><th>Kode</th><th>Perlengkapan</th><th class="num">Saldo buku (Rp)</th><th style="min-width:170px">Nilai sisa hasil hitung (Rp)</th></tr></thead><tbody>
     ${rows.map(({b,sb})=>`<tr><td class="code">${esc(b.kode)}</td><td>${esc(b.nama)} <span class="small muted">(${esc(b.satuan)})</span></td><td class="num">${rp(sb)}</td><td>${isAdmin()?`<label class="small muted" for="o-${b.id}" style="position:absolute;left:-9999px">Nilai sisa ${esc(b.nama)}</label><input class="in num" id="o-${b.id}" type="number" min="0" step="1" data-bind="opn.vals.${b.id}" value="${esc(S.ui.opn.vals[b.id]??'')}" placeholder="0">`:'<span class="muted small">Diisi Admin</span>'}</td></tr>`).join('')}
     </tbody></table></div></section>
     <section class="card stack" id="pv-opn">${pvOpn()}</section>
     ${isAdmin()?`<div>${cbtn('opn-save','','Simpan nilai sisa','Klik lagi untuk menyimpan','pri')}</div>`:''}`}
  const hist=S.data.opname.slice().sort((a,b)=>b.periode.localeCompare(a.periode));
  return head('Nilai Sisa Perlengkapan','Biaya perlengkapan = saldo buku − nilai sisa hasil hitung fisik. Sistem membuat jurnal penyesuaian berstatus draf, lalu Admin mengajukannya ke Owner.',
    `<div class="fld"><label for="opn-p">Periode</label><select class="in" id="opn-p" data-bind="opn.P" data-rr>${perOpts(months(first<cur?first:cur,cur),P)}</select></div>`)+
   `<div class="stack">${body}${hist.length?`<section class="card flush"><div class="ch"><h2>Riwayat input</h2></div><div class="tw"><table class="t"><thead><tr><th>Periode</th><th class="num">Biaya (Rp)</th><th>Jurnal</th><th>Status</th></tr></thead><tbody>${hist.map(o=>`<tr><td>${fmtPer(o.periode)}</td><td class="num">${rp(o.total_beban)}</td><td class="code">${esc(o.jurnal_id||'-')}</td><td>${o.status==='ditolak'?pill('ditolak'):o.jurnal_id?pill(jSt(o.jurnal_id)):pill('disetujui')}</td></tr>`).join('')}</tbody></table></div></section>`:''}</div>`;
}
function pvOpn(){
  const P=S.ui.opn.P;const rows=opnRows(P);let tot=0;const warn=[];const errs=[];
  const lines=rows.map(({b,sb})=>{const v=S.ui.opn.vals[b.id];if(!filled(v)){warn.push(b.nama);return ''}const s=int(v);if(s<0||s>sb)errs.push(`${b.nama}: nilai sisa harus 0 sampai Rp${rp(sb)}`);const beban=sb-s;tot+=beban;return `<tr><td>${esc(b.nama)}</td><td class="num">${rp(beban)}</td></tr>`}).join('');
  return `<h3>Biaya perlengkapan ${fmtPer(P)}</h3>
   ${warn.length?`<div class="alert warn">Belum dihitung: ${warn.map(esc).join(', ')}. Semua perlengkapan wajib diisi sebelum disimpan.</div>`:''}
   ${errs.length?`<div class="alert bad">${errs.map(esc).join('<br>')}</div>`:''}
   ${lines?`<div class="tw"><table class="t"><tbody>${lines}<tr class="tot"><td>Total biaya</td><td class="num">Rp${rp(tot)}</td></tr></tbody></table></div>`:''}
   <h3 style="margin-top:6px">Jurnal penyesuaian (draf)</h3>${jTable([{akun:AK.BLKP,debit:tot,kredit:0},{akun:AK.LKP,debit:0,kredit:tot}])}`;
}
async function simpanOpn(){
  const P=S.ui.opn.P;if(isLocked(P))throw new Error(`Periode ${fmtPer(P)} sudah dikunci.`);
  if(S.data.opname.some(o=>o.periode===P&&o.status!=='ditolak'))throw new Error('Nilai sisa periode ini sudah diinput.');
  const rows=[];for(const {b,sb} of opnRows(P)){const v=S.ui.opn.vals[b.id];if(!filled(v))throw new Error(`${b.nama} belum dihitung.`);const s=int(v);if(s<0||s>sb)throw new Error(`${b.nama}: nilai sisa harus 0 sampai Rp${rp(sb)}.`);rows.push({barang_id:b.id,nama:b.nama,saldo_buku:sb,nilai_sisa:s,beban:sb-s})}
  if(!rows.length)throw new Error('Tidak ada perlengkapan untuk dihitung.');
  const tot=sum(rows,r=>r.beban);let jid=null;
  if(tot>0)jid=await buatJurnal({tanggal:lastDay(P),jenis:'penyesuaian',status:'draft',keterangan:`Biaya perlengkapan ${fmtPer(P)} (dari input nilai sisa)`,baris:[{akun:AK.BLKP,debit:tot,kredit:0},{akun:AK.LKP,debit:0,kredit:tot}],sumber_tipe:'opname',sumber_id:'OPN-'+P,rincian:rows.map(r=>({label:r.nama,info:`saldo ${rp(r.saldo_buku)} − sisa ${rp(r.nilai_sisa)}`,nilai:r.beban}))});
  await S.db.doc('opname/OPN-'+P).set({periode:P,rows,total_beban:tot,jurnal_id:jid,status:'aktif',dibuat_oleh:S.role,dibuat_pada:iso()});
  S.ui.opn.vals={};toast(jid?`Tersimpan. Jurnal ${jid} dibuat sebagai draf.`:'Tersimpan. Tidak ada biaya perlengkapan bulan ini.');
}
