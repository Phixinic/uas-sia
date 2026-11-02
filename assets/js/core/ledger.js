/*
 * Perhitungan buku besar, neraca saldo, dan saldo buku perlengkapan. Hanya jurnal berstatus "disetujui" yang dihitung.
 */
function mutasi(k,fromP,toP){let d=0,c=0;for(const j of S.data.jurnal){if(j.status!=='disetujui')continue;if(fromP&&j.periode<fromP)continue;if(toP&&j.periode>toP)continue;for(const b of j.baris||[])if(b.akun===k){d+=b.debit||0;c+=b.kredit||0}}return {d,c}}
function saldo(k,toP){const m=mutasi(k,null,toP);return normalOf(k)==='D'?m.d-m.c:m.c-m.d}
function akunList(){const set=new Set(S.data.akun.map(a=>a.kode));for(const j of S.data.jurnal)for(const b of j.baris||[])set.add(b.akun);return [...set].sort()}
function neraca(P){const rows=[];let d=0,c=0;for(const k of akunList()){const m=mutasi(k,null,P);const net=m.d-m.c;if(!net)continue;rows.push({k,d:net>0?net:0,c:net<0?-net:0});if(net>0)d+=net;else c+=-net}return {rows,d,c}}
function saldoBukuLkp(bid,P){let s=0;for(const b of S.data.pembelian){if(b.jenis!=='perlengkapan'||b.status!=='posted'||per(b.tanggal)>P)continue;for(const it of b.items||[])if(it.barang_id===bid)s+=it.qty*it.harga}
  for(const o of S.data.opname){if(o.status==='ditolak'||o.periode>=P)continue;for(const r of o.rows||[])if(r.barang_id===bid)s-=r.beban}return s}
