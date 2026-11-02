/*
 * Rumus penyusutan dua tahap (sesuai papan dosen).
 * Periode 1..n-1 : d = round((b - S) / n)
 * Periode n      : (b - S) - (n - 1) x d   -> nilai buku akhir tepat = residu
 */
function hitungJadwal(b,S0,n,mulai){
  b=Math.round(b);S0=Math.round(S0||0);n=Math.round(n);
  if(!(b>0))throw new Error('Harga beli harus lebih dari 0.');
  if(!(n>=1))throw new Error('Jumlah periode (n) minimal 1 bulan.');
  if(S0<0||S0>=b)throw new Error('Nilai residu harus 0 atau lebih, dan lebih kecil dari harga beli.');
  const v=b-S0;
  let d=Math.floor((2*v+n)/(2*n));      // rumus 1: round half up dengan bilangan bulat
  let last=v-(n-1)*d;                   // rumus 2: periode n mengambil seluruh sisa
  let pengaman=false;
  if(last<0){d=Math.floor(v/n);last=v-(n-1)*d;pengaman=true}
  const rows=[];let tot=0;
  for(let p=1;p<=n;p++){const s=p<n?d:last;tot+=s;rows.push({p,periode:addMonths(mulai,p-1),beban:s,akumulasi:tot,nilai_buku:b-tot,jurnal_id:null})}
  if(tot!==v)throw new Error('Total penyusutan tidak sama dengan nilai yang dapat disusutkan.');
  return {v,d,last,pengaman,rows};
}
const itemN=it=>it.dasar_n==='garansi'?int(it.garansi_bulan):int(it.masa_manfaat_bulan);
