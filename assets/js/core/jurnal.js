/*
 * Penomoran dokumen otomatis dan pembuatan jurnal (dengan validasi seimbang & periode terkunci).
 */
async function nomor(prefix,tanggal,width){
  const year=tanggal?tanggal.slice(0,4):'';const key=prefix+year;const ref=S.db.doc('meta/counters');
  const snap=await ref.get();const cur=(snap.exists&&snap.data()[key])||0;const n=cur+1;
  if(snap.exists)await ref.update({[key]:n});else await ref.set({[key]:n});
  return year?`${prefix}-${year}-${pad(n,4)}`:`${prefix}-${pad(n,width||2)}`;
}
async function buatJurnal(o){
  if(isLocked(per(o.tanggal)))throw new Error(`Periode ${fmtPer(per(o.tanggal))} sudah dikunci. Minta Owner membuka kunci dulu.`);
  const baris=o.baris.filter(b=>(b.debit||0)>0||(b.kredit||0)>0).map(b=>({akun:b.akun,debit:b.debit||0,kredit:b.kredit||0}));
  for(const b of baris)if(b.debit>0&&b.kredit>0)throw new Error('Satu baris jurnal hanya boleh berisi debit atau kredit.');
  const tD=sum(baris,b=>b.debit),tK=sum(baris,b=>b.kredit);
  if(baris.length<2||tD!==tK||tD<=0)throw new Error('Jurnal tidak seimbang, jadi tidak disimpan.');
  const pref={umum:'JU',penyesuaian:'JP',pembalik:'JB'}[o.jenis];
  const no=await nomor(pref,o.tanggal);
  await S.db.doc('jurnal/'+no).set({no,tanggal:o.tanggal,periode:per(o.tanggal),jenis:o.jenis,keterangan:o.keterangan,baris,
    sumber_tipe:o.sumber_tipe||null,sumber_id:o.sumber_id||null,rincian:o.rincian||null,pembalik_dari:o.pembalik_dari||null,
    status:o.status,dibuat_oleh:o.dibuat_oleh||S.role,dibuat_pada:iso(),
    diajukan_pada:o.status==='disetujui'?iso():null,disetujui_oleh:o.status==='disetujui'?S.role:null,disetujui_pada:o.status==='disetujui'?iso():null,alasan_tolak:null});
  return no;
}
