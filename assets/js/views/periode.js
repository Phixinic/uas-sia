/*
 * Tutup periode: daftar periksa, kunci, dan buka kunci dengan alasan.
 */
function cekPeriode(P){
  const draftB=S.data.pembelian.filter(b=>b.status==='draft'&&per(b.tanggal)===P).length;
  const unproc=sum(S.data.aset.filter(a=>a.status==='aktif'),a=>(a.jadwal||[]).filter(r=>r.periode<=P&&!r.jurnal_id).length);
  const pendJ=S.data.jurnal.filter(j=>j.periode===P&&(j.status==='draft'||j.status==='diajukan')).length;
  const pendL=S.data.pelepasan.filter(p=>p.status==='diajukan'&&per(p.tanggal)===P).length;
  const needOp=S.data.pembelian.some(b=>b.jenis==='perlengkapan'&&b.status==='posted'&&per(b.tanggal)<=P);const op=S.data.opname.some(o=>o.periode===P&&o.status!=='ditolak');
  const ns=neraca(P);
  return [['Semua pembelian periode ini sudah diposting',draftB===0,draftB?draftB+' draf':''],['Penyusutan sudah diproses sampai periode ini',unproc===0,unproc?unproc+' baris belum':''],['Nilai sisa perlengkapan sudah diinput',!needOp||op,''],['Jurnal penyesuaian sudah diputuskan',pendJ===0,pendJ?pendJ+' menunggu':''],['Pengajuan pelepasan sudah diputuskan',pendL===0,pendL?pendL+' menunggu':''],['Neraca saldo seimbang',ns.d===ns.c,'']];
}
function vPeriode(){
  const ps=allPer().slice().reverse();
  return head('Tutup Periode','Periode yang dikunci menolak jurnal baru bertanggal di dalamnya. Owner mengunci setelah semua pemeriksaan lulus, dan bisa membuka lagi dengan alasan.')+
  `<div class="stack">${ps.map(P=>{const st=perStatus(P);const doc=byId('periode',P)||{};const c=cekPeriode(P);const ok=c.every(x=>x[1]);
    let act='';if(isOwner()){if(st==='terbuka')act=ok?cbtn('per-kunci',P,'Kunci periode','Klik lagi untuk mengunci','pri sm'):'<span class="small muted">Lengkapi pemeriksaan dulu</span>';else if(S.ui.perBuka!==P)act=`<button type="button" class="btn sm" data-act="set" data-k="perBuka" data-v="${P}">Buka kunci</button>`}
    const buka=S.ui.perBuka===P?`<div class="stack" style="gap:8px"><div class="fld"><label for="pb-al">Alasan membuka kunci ${fmtPer(P)}</label><textarea class="in" id="pb-al" data-bind="perAlasan">${esc(S.ui.perAlasan)}</textarea></div><div class="row"><button type="button" class="btn" data-act="per-buka" data-id="${P}">Buka kunci</button><button type="button" class="btn" data-act="set" data-k="perBuka" data-v="">Batal</button></div></div>`:'';
    return `<section class="card stack" style="gap:10px"><div class="row between"><div class="row"><h2>${fmtPer(P)}</h2>${pill(st)}</div><div class="row">${act}</div></div>
     ${st==='terbuka'?`<ul class="chk">${c.map(x=>`<li><span class="ic ${x[1]?'y':'n'}" aria-hidden="true">${x[1]?'✓':'✗'}</span><span>${x[0]}${x[2]?` <span class="muted">(${esc(x[2])})</span>`:''}<span style="position:absolute;left:-9999px">${x[1]?'lulus':'belum'}</span></span></li>`).join('')}</ul>`:`<p class="small muted" style="margin:0">Dikunci ${ROLE[doc.dikunci_oleh]||''} ${doc.dikunci_pada?fmtTgl(doc.dikunci_pada.slice(0,10)):''}.</p>`}
     ${(doc.riwayat||[]).length?`<details><summary>Riwayat (${doc.riwayat.length})</summary><ul class="pvl">${doc.riwayat.map(r=>`<li>${fmtTgl(r.waktu.slice(0,10))}: ${r.aksi==='kunci'?'dikunci':'dibuka'} oleh ${ROLE[r.oleh]||r.oleh}${r.alasan?` (${esc(r.alasan)})`:''}</li>`).join('')}</ul></details>`:''}${buka}</section>`}).join('')}</div>`;
}
async function kunciPer(P){if(!isOwner())throw new Error('Hanya Owner yang bisa mengunci periode.');if(!cekPeriode(P).every(x=>x[1]))throw new Error('Pemeriksaan belum lengkap.');const doc=byId('periode',P)||{};
  await S.db.doc('periode/'+P).set({status:'terkunci',dikunci_oleh:S.role,dikunci_pada:iso(),riwayat:(doc.riwayat||[]).concat([{aksi:'kunci',oleh:S.role,waktu:iso()}])});toast(`${fmtPer(P)} dikunci.`)}
async function bukaPer(P){if(!isOwner())throw new Error('Hanya Owner yang bisa membuka kunci.');const al=S.ui.perAlasan.trim();if(!al)throw new Error('Tulis alasan membuka kunci.');const doc=byId('periode',P)||{};
  await S.db.doc('periode/'+P).set({status:'terbuka',dikunci_oleh:null,dikunci_pada:null,riwayat:(doc.riwayat||[]).concat([{aksi:'buka',oleh:S.role,waktu:iso(),alasan:al}])});S.ui.perBuka=null;S.ui.perAlasan='';toast(`${fmtPer(P)} dibuka.`)}
