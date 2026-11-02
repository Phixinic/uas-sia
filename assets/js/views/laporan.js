/*
 * Use case: Melihat Jurnal Umum, Melihat Buku Besar, dan Neraca Saldo.
 */
function allPer(){const s=new Set([per(today())]);S.data.jurnal.forEach(j=>s.add(j.periode));S.data.pembelian.forEach(b=>s.add(per(b.tanggal)));S.data.periode.forEach(p=>s.add(p.id));return [...s].filter(Boolean).sort()}
function vJU(){
  const P=S.ui.juP;const list=S.data.jurnal.filter(j=>j.status==='disetujui'&&(j.jenis==='umum'||j.jenis==='pembalik')&&(P==='semua'||j.periode===P)).sort((a,b)=>(a.tanggal+a.no).localeCompare(b.tanggal+b.no));
  const rows=list.flatMap(j=>{const b=j.baris.filter(x=>x.debit||x.kredit);return b.map((x,i)=>`<tr>${i===0?`<td rowspan="${b.length+1}">${fmtTgl(j.tanggal)}</td><td rowspan="${b.length+1}" class="code">${esc(j.no)}${j.jenis==='pembalik'?'<div><span class="pill bad">pembalik</span></div>':''}</td>`:''}<td class="${x.kredit?'ind':''}"><span class="code muted">${esc(x.akun)}</span> ${esc(akunNama(x.akun))}</td><td class="num">${x.debit?rp(x.debit):''}</td><td class="num">${x.kredit?rp(x.kredit):''}</td></tr>`).concat([`<tr><td colspan="3" class="small muted" style="padding-top:2px">${esc(j.keterangan)}</td></tr>`])});
  const tD=sum(list,j=>sum(j.baris,b=>b.debit)),tK=sum(list,j=>sum(j.baris,b=>b.kredit));
  return head('Jurnal Umum','Dibuat otomatis saat pembelian diposting, saat pelepasan disetujui, dan saat pembelian dibalik.',
   `<div class="fld"><label for="ju-p">Periode</label><select class="in" id="ju-p" data-bind="juP" data-rr>${opt('semua','Semua periode',P)}${perOpts(allPer(),P)}</select></div>`)+
  `<section class="card flush">${list.length?`<div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>No. jurnal</th><th>Akun &amp; keterangan</th><th class="num">Debit (Rp)</th><th class="num">Kredit (Rp)</th></tr></thead><tbody>${rows.join('')}<tr class="tot"><td colspan="3">Total ${tD===tK?'<span class="pill ok">seimbang</span>':'<span class="pill bad">tidak seimbang</span>'}</td><td class="num">${rp(tD)}</td><td class="num">${rp(tK)}</td></tr></tbody></table></div>`:'<div class="empty">Belum ada jurnal umum pada periode ini.</div>'}</section>`;
}
function vBB(){
  const ps=allPer();const P=S.ui.bbP||(S.ui.bbP=per(today()));const k=S.ui.bbAkun;const nrm=normalOf(k);
  const m0=mutasi(k,null,addMonths(P,-1));let s=nrm==='D'?m0.d-m0.c:m0.c-m0.d;const awal=s;
  const rows=[];S.data.jurnal.filter(j=>j.status==='disetujui'&&j.periode===P).sort((a,b)=>(a.tanggal+a.no).localeCompare(b.tanggal+b.no)).forEach(j=>j.baris.forEach(b=>{if(b.akun!==k)return;s+=nrm==='D'?b.debit-b.kredit:b.kredit-b.debit;rows.push(`<tr><td>${fmtTgl(j.tanggal)}</td><td>${esc(j.keterangan)}</td><td class="code">${esc(j.no)}</td><td class="num">${b.debit?rp(b.debit):''}</td><td class="num">${b.kredit?rp(b.kredit):''}</td><td class="num">${rp(s)}</td></tr>`)}));
  return head('Buku Besar','Saldo berjalan per akun, hanya dari jurnal yang sudah disetujui. Buku besar tidak disimpan sebagai tabel, tetapi dihitung dari baris jurnal.',
   `<div class="fld"><label for="bb-a">Akun</label><select class="in" id="bb-a" data-bind="bbAkun" data-rr>${akunList().map(x=>opt(x,`${x} · ${akunNama(x)}`,k)).join('')}</select></div><div class="fld"><label for="bb-p">Periode</label><select class="in" id="bb-p" data-bind="bbP" data-rr>${perOpts(ps,P)}</select></div>`)+
  `<section class="card flush"><div class="ch row between"><h2>${esc(k)} · ${esc(akunNama(k))}</h2><span class="small muted">Saldo normal ${nrm==='D'?'debit':'kredit'}</span></div><div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Ref.</th><th class="num">Debit (Rp)</th><th class="num">Kredit (Rp)</th><th class="num">Saldo (Rp)</th></tr></thead><tbody>
   <tr><td>${'01/'+P.slice(5,7)+'/'+P.slice(0,4)}</td><td><b>Saldo awal</b></td><td></td><td></td><td></td><td class="num"><b>${rp(awal)}</b></td></tr>
   ${rows.join('')||'<tr><td colspan="6" class="muted" style="text-align:center">Tidak ada mutasi pada periode ini.</td></tr>'}
   <tr class="tot"><td>${fmtTgl(lastDay(P))}</td><td>Saldo akhir</td><td></td><td></td><td></td><td class="num">${rp(s)}</td></tr></tbody></table></div></section>`;
}
function vNS(){
  const ps=allPer();const P=S.ui.nsP||(S.ui.nsP=per(today()));const n=neraca(P);
  return head('Neraca Saldo','Saldo semua akun sampai akhir periode, dari jurnal yang disetujui. Total debit harus sama dengan total kredit.',
   `<div class="fld"><label for="ns-p">Sampai periode</label><select class="in" id="ns-p" data-bind="nsP" data-rr>${perOpts(ps,P)}</select></div>`)+
  `<section class="card flush">${n.rows.length?`<div class="tw"><table class="t"><thead><tr><th>Kode</th><th>Akun</th><th class="num">Debit (Rp)</th><th class="num">Kredit (Rp)</th></tr></thead><tbody>${n.rows.map(r=>`<tr><td class="code">${esc(r.k)}</td><td>${esc(akunNama(r.k))}</td><td class="num">${r.d?rp(r.d):''}</td><td class="num">${r.c?rp(r.c):''}</td></tr>`).join('')}<tr class="tot"><td colspan="2">Total ${n.d===n.c?'<span class="pill ok">seimbang</span>':'<span class="pill bad">selisih '+rp(n.d-n.c)+'</span>'}</td><td class="num">${rp(n.d)}</td><td class="num">${rp(n.c)}</td></tr></tbody></table></div>`:'<div class="empty">Belum ada saldo sampai periode ini.</div>'}</section>`;
}
