/*
 * Komponen tampilan yang dipakai ulang: status pill, header halaman, tombol konfirmasi, tabel jurnal, field form.
 */
function pill(st){const m={draft:['Draf','warn'],diajukan:['Diajukan','info'],disetujui:['Disetujui','ok'],ditolak:['Ditolak','bad'],posted:['Terposting','ok'],dibalik:['Dibalik','bad'],aktif:['Aktif','ok'],dilepas:['Dilepas','mut'],batal:['Batal','bad'],terbuka:['Terbuka','info'],terkunci:['Terkunci','mut'],nonaktif:['Nonaktif','mut']}[st]||[st,'mut'];return `<span class="pill ${m[1]}">${m[0]}</span>`}
const head=(t,sub,act)=>`<header class="vh"><div><h1>${t}</h1>${sub?`<p class="sub">${sub}</p>`:''}</div>${act?`<div class="row">${act}</div>`:''}</header>`;
function cbtn(act,id,label,armLabel,cls){const armed=S.ui.confirm===act+':'+(id||'');return `<button type="button" class="btn ${cls||''} ${armed?'arm':''}" data-act="${act}" data-id="${esc(id||'')}" data-confirm>${armed?armLabel:label}</button>`}
function jTable(baris){const b=(baris||[]).filter(x=>x.debit||x.kredit);return `<div class="tw"><table class="t"><thead><tr><th>Akun</th><th class="num">Debit (Rp)</th><th class="num">Kredit (Rp)</th></tr></thead><tbody>${b.map(x=>`<tr><td class="${x.kredit?'ind':''}"><span class="code muted">${esc(x.akun)}</span> ${esc(akunNama(x.akun))}</td><td class="num">${x.debit?rp(x.debit):''}</td><td class="num">${x.kredit?rp(x.kredit):''}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="num">${rp(sum(b,x=>x.debit))}</td><td class="num">${rp(sum(b,x=>x.kredit))}</td></tr></tbody></table></div>`}
const opt=(v,l,sel)=>`<option value="${esc(v)}"${v===sel?' selected':''}>${esc(l)}</option>`;
const perOpts=(list,sel)=>list.slice().reverse().map(p=>opt(p,fmtPer(p)+(isLocked(p)?' (terkunci)':''),sel)).join('');
function fld(label,inner,hint){return `<div class="fld"><label>${label}</label>${inner}${hint?`<div class="hint">${hint}</div>`:''}</div>`}
const inp=(id,bind,val,attrs)=>`<input class="in" id="${id}" data-bind="${bind}" value="${esc(val)}" ${attrs||''}>`;
