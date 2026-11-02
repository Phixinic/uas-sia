/*
 * Fungsi bantu umum: format rupiah, tanggal, periode (YYYY-MM), escape HTML.
 */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp=n=>{n=Math.round(n||0);return (n<0?'−':'')+Math.abs(n).toLocaleString('id-ID')};
const int=v=>{const n=parseInt(String(v??'').replace(/[^\d-]/g,''),10);return Number.isFinite(n)?n:0};
const filled=v=>String(v??'').trim()!=='';
const pad=(n,k)=>String(n).padStart(k,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1,2)+'-'+pad(d.getDate(),2)};
const per=t=>String(t||'').slice(0,7);
const addMonths=(ym,k)=>{let y=+ym.slice(0,4),m=+ym.slice(5,7)+k;y+=Math.floor((m-1)/12);m=((m-1)%12+12)%12+1;return y+'-'+pad(m,2)};
const lastDay=ym=>ym+'-'+pad(new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate(),2);
const addDays=(t,k)=>{const d=new Date(t+'T00:00:00');d.setDate(d.getDate()+k);return d.getFullYear()+'-'+pad(d.getMonth()+1,2)+'-'+pad(d.getDate(),2)};
const addMonthsDate=(t,k)=>{const d=new Date(t+'T00:00:00');d.setMonth(d.getMonth()+k);return d.getFullYear()+'-'+pad(d.getMonth()+1,2)+'-'+pad(d.getDate(),2)};
const fmtPer=ym=>ym?BLN[+ym.slice(5,7)-1]+' '+ym.slice(0,4):'-';
const fmtTgl=t=>t?t.slice(8,10)+'/'+t.slice(5,7)+'/'+t.slice(0,4):'-';
const months=(a,b)=>{const r=[];if(!a||!b||a>b)return [b||a].filter(Boolean);let x=a;while(x<=b&&r.length<120){r.push(x);x=addMonths(x,1)}return r};
const sum=(arr,f)=>arr.reduce((s,x)=>s+(f?f(x):x),0);
const clone=o=>JSON.parse(JSON.stringify(o));
const iso=()=>new Date().toISOString();
