/*
 * Konstanta sistem: kode akun (COA), cara bayar, alasan pelepasan, nama bulan, dan daftar koleksi database.
 */
const AK={KAS:'1-110',LKP:'1-140',ALT:'1-150',AKM:'1-151',UTANG:'2-110',MODAL:'3-110',BSUSUT:'6-110',BLKP:'6-120',LABA:'7-110',RUGI:'8-110'};
const AKN={'1-110':'Kas','1-140':'Perlengkapan','1-150':'Peralatan','1-151':'Akumulasi Penyusutan Peralatan','2-110':'Utang Usaha','3-110':'Modal Pemilik','6-110':'Biaya Penyusutan Peralatan','6-120':'Biaya Perlengkapan','7-110':'Laba Pelepasan Aset','8-110':'Rugi Pelepasan Aset'};
const NORM={'1-151':'K','2-110':'K','3-110':'K','7-110':'K'};
const LAWAN={tunai:AK.KAS,kredit:AK.UTANG,investasi:AK.MODAL};
const CARA={tunai:'Tunai',kredit:'Kredit',investasi:'Investasi'};
const ALASAN={dijual:'Dijual',dibuang:'Dibuang / rusak',hilang:'Hilang'};
const BLN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const COLS=['supplier','peralatan','perlengkapan','kategori','akun','pembelian','aset','opname','pelepasan','jurnal','periode'];
