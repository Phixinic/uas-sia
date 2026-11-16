/*
 * Adapter database dengan tiga mode: claude.ai, Supabase, atau localStorage.
 * Ketiganya punya antarmuka yang sama: db.doc(path) dan db.collection(nama).
 */
/* ---------- Mode 1: localStorage (tanpa server) ---------- */
const LocalDB=(function(){
  const KEY='sia-laundry-db-v2';
  const subs={};
  let data=read();
  function read(){try{const s=localStorage.getItem(KEY);if(s)return JSON.parse(s)}catch(e){}return clone(window.SEED||{})}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){console.warn('Gagal menyimpan ke localStorage',e)}}
  function snapDoc(id,obj){const o=obj?clone(obj):undefined;return {id,exists:!!obj,data:()=>o?clone(o):undefined}}
  function snapCol(col){const c=data[col]||{};const docs=Object.keys(c).sort().map(id=>snapDoc(id,c[id]));return {docs,size:docs.length,empty:!docs.length}}
  function emit(col){(subs[col]||[]).forEach(fn=>fn(snapCol(col)))}
  const later=f=>setTimeout(f,0);
  function split(path){const p=path.split('/');if(p.length!==2)throw new TypeError('Path dokumen harus berbentuk koleksi/id: '+path);return p}
  function doc(path){const [col,id]=split(path);return {id,path,
    get:async()=>snapDoc(id,(data[col]||{})[id]),
    set:async v=>{(data[col]=data[col]||{})[id]=clone(v);save();later(()=>emit(col))},
    update:async v=>{const cur=(data[col]||{})[id];if(!cur)throw {code:'invalid_argument',message:'Dokumen '+path+' tidak ada'};data[col][id]=Object.assign({},cur,clone(v));save();later(()=>emit(col))},
    delete:async()=>{if(data[col])delete data[col][id];save();later(()=>emit(col))}}}
  function collection(col){return {path:col,
    doc:id=>doc(col+'/'+(id||Math.random().toString(36).slice(2,12))),
    get:async()=>snapCol(col),
    onSnapshot(next){(subs[col]=subs[col]||[]).push(next);later(()=>next(snapCol(col)));return ()=>{subs[col]=(subs[col]||[]).filter(f=>f!==next)}}}}
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;data=read();Object.keys(subs).forEach(emit)});
  function reset(){data=clone(window.SEED||{});save();Object.keys(subs).forEach(emit)}
  return {doc,collection,reset};
})();

/* ---------- Mode 2: Supabase (database bersama) ----------
   Satu tabel `docs` (col, id, data jsonb). Setiap koleksi aplikasi = nilai kolom `col`.
   Perubahan dari pengguna lain masuk lewat Supabase Realtime. */
function SupaDB(client){
  const cache={},subs={};
  const snapDoc=(id,obj)=>{const o=obj?clone(obj):undefined;return {id,exists:!!obj,data:()=>o?clone(o):undefined}};
  const snapCol=col=>{const c=cache[col]||{};const docs=Object.keys(c).sort().map(id=>snapDoc(id,c[id]));return {docs,size:docs.length,empty:!docs.length}};
  const emit=col=>(subs[col]||[]).forEach(fn=>fn(snapCol(col)));
  const fail=(error,apa)=>{if(error){console.error(apa,error);throw new Error('Gagal '+apa+' ke database. Periksa koneksi lalu coba lagi.')}};
  async function loadAll(){
    let from=0,total=0;
    for(;;){const {data,error}=await client.from('docs').select('col,id,data').order('col').order('id').range(from,from+999);fail(error,'memuat data');
      data.forEach(r=>{(cache[r.col]=cache[r.col]||{})[r.id]=r.data});total+=data.length;if(data.length<1000)break;from+=1000}
    if(!total&&window.SEED){ // database masih kosong: isi data contoh sekali
      const rows=[];for(const col in window.SEED)for(const id in window.SEED[col]){rows.push({col,id,data:window.SEED[col][id]});(cache[col]=cache[col]||{})[id]=clone(window.SEED[col][id])}
      for(let i=0;i<rows.length;i+=200){const {error}=await client.from('docs').upsert(rows.slice(i,i+200));fail(error,'mengisi data contoh')}
    }
  }
  const ready=loadAll();
  client.channel('docs-changes').on('postgres_changes',{event:'*',schema:'public',table:'docs'},p=>{
    if(p.eventType==='DELETE'){const o=p.old||{};if(o.col&&cache[o.col]){delete cache[o.col][o.id];emit(o.col)}}
    else{const n=p.new;(cache[n.col]=cache[n.col]||{})[n.id]=n.data;emit(n.col)}
  }).subscribe();
  function split(path){const p=path.split('/');if(p.length!==2)throw new TypeError('Path dokumen harus berbentuk koleksi/id: '+path);return p}
  async function put(col,id,v){(cache[col]=cache[col]||{})[id]=clone(v);emit(col);const {error}=await client.from('docs').upsert({col,id,data:v,updated_at:new Date().toISOString()});fail(error,'menyimpan')}
  function doc(path){const [col,id]=split(path);return {id,path,
    get:async()=>{await ready;const {data,error}=await client.from('docs').select('data').eq('col',col).eq('id',id).maybeSingle();fail(error,'membaca');if(data)(cache[col]=cache[col]||{})[id]=data.data;return snapDoc(id,data?data.data:undefined)},
    set:async v=>{await ready;await put(col,id,v)},
    update:async v=>{await ready;const cur=(cache[col]||{})[id];if(!cur)throw new Error('Dokumen '+path+' tidak ada.');await put(col,id,Object.assign({},cur,clone(v)))},
    delete:async()=>{await ready;if(cache[col])delete cache[col][id];emit(col);const {error}=await client.from('docs').delete().eq('col',col).eq('id',id);fail(error,'menghapus')}}}
  function collection(col){return {path:col,
    doc:id=>doc(col+'/'+(id||Math.random().toString(36).slice(2,12))),
    get:async()=>{await ready;return snapCol(col)},
    onSnapshot(next,onErr){(subs[col]=subs[col]||[]).push(next);ready.then(()=>next(snapCol(col)),e=>onErr&&onErr(e));return ()=>{subs[col]=(subs[col]||[]).filter(f=>f!==next)}}}}
  return {doc,collection};
}

/* ---------- Pilih mode: claude.ai → Supabase → localStorage ---------- */
async function connectDb(){
  if(window.claude&&typeof window.claude.use==='function'){try{const d=await window.claude.use('db');if(d)return {db:d,mode:'claude'}}catch(e){}}
  const cfg=window.SUPABASE_CONFIG;
  if(cfg&&cfg.url&&cfg.key&&window.supabase&&window.supabase.createClient){
    try{return {db:SupaDB(window.supabase.createClient(cfg.url,cfg.key)),mode:'supabase'}}catch(e){console.error('Supabase gagal dimuat, memakai localStorage',e)}
  }
  return {db:LocalDB,mode:'local'};
}
