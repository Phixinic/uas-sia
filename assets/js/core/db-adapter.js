/*
 * Adapter database. Di claude.ai memakai database bawaan (window.claude.use("db")).
 * Di luar itu memakai localStorage browser, diisi data contoh dari data/seed.js.
 */
const LocalDB=(function(){
  const KEY='sia-laundry-db-v1';
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
  // sinkron antar tab browser
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;data=read();Object.keys(subs).forEach(emit)});
  function reset(){data=clone(window.SEED||{});save();Object.keys(subs).forEach(emit)}
  return {doc,collection,reset};
})();

async function connectDb(){
  if(window.claude&&typeof window.claude.use==='function'){try{const d=await window.claude.use('db');if(d)return {db:d,mode:'claude'}}catch(e){}}
  return {db:LocalDB,mode:'local'};
}
