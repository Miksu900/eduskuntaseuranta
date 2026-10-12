// Valtion talous: budjettitalouden toteuma pääluokittain ja momenteittain (Valtiokonttori, avoin data, CC BY 4.0).
import { readdirSync, readFileSync, existsSync } from "node:fs";
const DIR = "data/valtiontalous";

export function loadVt() {
  if (!existsSync(DIR)) return null;
  const years = {};
  for (const f of readdirSync(DIR)) {
    if (!/^\d{4}\.json$/.test(f)) continue;
    try { const d = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")); if (d && d.v === 1 && d.rows) years[d.year] = d; } catch {}
  }
  return Object.keys(years).length ? years : null;
}

const CSS = String.raw`<style>.vt select,.vt input[type=search],.vt button{font-size:16px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)}.vt input[type=search]{width:100%;box-sizing:border-box;margin:8px 0}.vt select{max-width:100%}.vt table{width:100%;border-collapse:collapse;font-size:14px}.vt td,.vt th{padding:7px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.vt td.n,.vt th.n{text-align:right;white-space:nowrap}.vt tr.cl{cursor:pointer}.vt .vb{height:6px;border-radius:3px;background:#2a5db0;margin-top:5px}.vt .big{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.vt .big div{flex:1;min-width:140px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface)}.vt .big b{display:block;font-size:22px}</style>`;

const JS = String.raw`<script>(function(){
var IDX=null,Y=null,cur=null,root=document.getElementById("vtr");
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function eur(v){var a=Math.abs(v);if(a>=1e9)return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:2}).format(v/1e9)+" mrd €";if(a>=1e6)return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:1}).format(v/1e6)+" milj. €";return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:0}).format(v)+" €"}
function nm(s){s=String(s||"");return s.charAt(0)+s.slice(1).toLowerCase()}
function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("Lataus epäonnistui ("+r.status+")");return r.json()})}
function boot(){root.innerHTML='<p class="meta">Ladataan…</p>';j("/data/vt/index.json").then(function(i){IDX=i;var yrs=i.years.slice().sort(function(a,b){return b-a});var full=yrs.filter(function(y){return i.months[y]===12})[0]||yrs[0];draw(full)}).catch(function(x){root.innerHTML="<p>"+e(x.message)+"</p>"})}
function draw(y){cur=y;var yrs=IDX.years.slice().sort(function(a,b){return b-a});var h='<label>Vuosi <select id="vy">';yrs.forEach(function(v){h+='<option value="'+v+'"'+(v===y?" selected":"")+'>'+v+(IDX.months[v]<12?" ("+IDX.months[v]+" kk)":"")+'</option>'});h+='</select></label><div id="vo"><p class="meta">Ladataan…</p></div>';root.innerHTML=h;document.getElementById("vy").onchange=function(){draw(Number(this.value))};
j("/data/vt/"+y+".json").then(function(d){Y=d;over()}).catch(function(x){document.getElementById("vo").innerHTML="<p>"+e(x.message)+"</p>"})}
function sums(){var s={};Y.rows.forEach(function(r){s[r[2]]=(s[r[2]]||0)+r[3]});return s}
function over(){var s=sums(),pl=Y.paaluokat,o=document.getElementById("vo"),menot=0,tulot=0,keys=Object.keys(s).sort();keys.forEach(function(k){var n=Number(k);if(n>=21&&n<=36)menot+=s[k]});tulot=-(s["11"]||0);
var part=IDX.months[cur]<12?'<p class="meta">Vuosi on kesken: luvut ovat '+IDX.months[cur]+' kuukaudelta.</p>':"";
var h=part+'<div class="big"><div><b>'+eur(menot)+'</b>Menot yhteensä (pääluokat 21–36)</div><div><b>'+eur(tulot)+'</b>Verot ja veronluonteiset tulot</div><div><b>'+eur(s["36"]||0)+'</b>Valtionvelan korot</div></div>';
h+='<h3>Mihin rahaa käytettiin, pääluokittain</h3><p class="meta">Paina riviä, niin näet momentit ja kehityksen vuosien yli.</p><div style="overflow-x:auto"><table><thead><tr><th>Pääluokka</th><th class="n">Menot</th></tr></thead><tbody>';
var list=keys.filter(function(k){var n=Number(k);return n>=21&&n<=36&&s[k]>0}).sort(function(a,b){return s[b]-s[a]});var mx=list.length?s[list[0]]:1;
list.forEach(function(k){h+='<tr class="cl" data-k="'+k+'"><td>'+k+'. '+e(nm(pl[k]||k))+'<div class="vb" style="width:'+Math.max(2,Math.round(100*s[k]/mx))+'%"></div></td><td class="n">'+eur(s[k])+'</td></tr>'});
h+='</tbody></table></div><h3>Tulot</h3><div style="overflow-x:auto"><table><tbody>';
["11","12","13","15"].forEach(function(k){if(s[k]!=null)h+='<tr class="cl" data-k="'+k+'"><td>'+k+'. '+e(nm(pl[k]||k))+'</td><td class="n">'+eur(-s[k])+'</td></tr>'});
h+='</tbody></table></div><p class="meta">Tulopuolen pääluokka 15 (lainat) kuvaa valtion nettolainanottoa. Tulot näytetään positiivisina lukuina.</p><h3>Hae momenttia</h3><input type="search" id="vq" placeholder="Esim. eläkkeet, puolustus, maksut Euroopan unionille"><div id="vs"></div>';
o.innerHTML=h;o.querySelectorAll("tr.cl").forEach(function(t){t.onclick=function(){detail(t.getAttribute("data-k"))}});
var q=document.getElementById("vq"),vs=document.getElementById("vs");q.oninput=function(){var w=q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);vs.innerHTML="";if(!w.length)return;var out=[],n=0;Y.rows.forEach(function(r){var t=(r[1]+" "+r[0]).toLowerCase();for(var i=0;i<w.length;i++)if(t.indexOf(w[i])<0)return;n++;if(out.length<60)out.push(r)});out.sort(function(a,b){return Math.abs(b[3])-Math.abs(a[3])});vs.innerHTML='<p class="meta">'+n+' osumaa'+(n>60?", näytetään 60 suurinta":"")+'</p>'+tbl(out)}}
function tbl(rows){var h='<div style="overflow-x:auto"><table><thead><tr><th>Momentti</th><th class="n">Euroa</th></tr></thead><tbody>';rows.forEach(function(r){h+='<tr><td>'+e(r[0])+' '+e(nm(r[1]))+'</td><td class="n">'+eur(Math.abs(r[3]))+'</td></tr>'});return h+'</tbody></table></div>'}
function trend(k){var pts=[];IDX.years.slice().sort(function(a,b){return a-b}).forEach(function(y){var v=IDX.pl[k]&&IDX.pl[k].v[y];if(v!=null&&IDX.months[y]===12)pts.push([y,Math.abs(v)])});if(pts.length<2)return"";var W=320,H=140,P=26,mx=0;pts.forEach(function(p){if(p[1]>mx)mx=p[1]});if(!mx)return"";
var xs=function(i){return P+i*(W-2*P)/(pts.length-1)},ys=function(v){return H-P-v*(H-2*P)/mx};
return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:520px;background:var(--surface);border:1px solid var(--line);border-radius:10px"><polyline fill="none" stroke="currentColor" stroke-width="2" points="'+pts.map(function(p,i){return xs(i).toFixed(1)+","+ys(p[1]).toFixed(1)}).join(" ")+'"/><text x="'+P+'" y="12" font-size="10" fill="currentColor">'+e(eur(mx))+'</text><text x="'+P+'" y="'+(H-6)+'" font-size="10" fill="currentColor">'+pts[0][0]+'</text><text x="'+(W-P)+'" y="'+(H-6)+'" font-size="10" text-anchor="end" fill="currentColor">'+pts[pts.length-1][0]+'</text></svg><p class="meta">Vuosittainen kehitys käyvin hinnoin (ei inflaatiokorjattu), vain täydet vuodet.</p>'}
function detail(k){var o=document.getElementById("vo"),rows=Y.rows.filter(function(r){return r[2]===k}).sort(function(a,b){return Math.abs(b[3])-Math.abs(a[3])});var tot=rows.reduce(function(p,r){return p+r[3]},0);
var h='<div><button id="vb">← Takaisin</button></div><h3>'+k+'. '+e(nm(Y.paaluokat[k]||k))+' '+cur+'</h3><div class="big"><div><b>'+eur(Math.abs(tot))+'</b>Yhteensä</div><div><b>'+rows.length+'</b>Momenttia</div></div>'+trend(k)+'<h3>Suurimmat momentit</h3><div id="vm">'+tbl(rows.slice(0,40))+'</div>'+(rows.length>40?'<div><button id="va">Näytä kaikki ('+rows.length+')</button></div>':"");
o.innerHTML=h;document.getElementById("vb").onclick=over;var a=document.getElementById("va");if(a)a.onclick=function(){document.getElementById("vm").innerHTML=tbl(rows);a.remove()}}
boot()})()</script>`;

export function vtPages({ shell, esc, data }) {
  const ys = Object.keys(data).map(Number).sort((a, b) => a - b);
  const files = [], idx = { years: ys, months: {}, pl: {} };
  for (const y of ys) {
    const d = data[y]; idx.months[y] = d.months.length;
    const rows = d.rows.map(r => [r[0], r[1], r[2], r[3].reduce((p, c) => p + c, 0)]).filter(r => r[3] !== 0);
    files.push({ path: `/data/vt/${y}.json`, content: JSON.stringify({ y, months: d.months.length, paaluokat: d.paaluokat, rows }) });
    const s = {}; for (const r of rows) s[r[2]] = (s[r[2]] || 0) + r[3];
    for (const k of Object.keys(s)) { const e = (idx.pl[k] ||= { n: d.paaluokat[k] || k, v: {} }); e.v[y] = s[k]; }
  }
  files.push({ path: "/data/vt/index.json", content: JSON.stringify(idx) });
  const first = ys[0], last = ys[ys.length - 1];
  const body = `<h1>Valtion talous</h1><p>Mihin valtion rahat menevät ja mistä ne tulevat? Tässä on valtion talousarviotalouden toteuma pääluokittain ja momenteittain vuosilta ${first}–${last}. Valitse vuosi, paina pääluokkaa ja näet sen suurimmat menoerät sekä kehityksen vuosien yli.</p>
<div class="note"><b>Mistä tiedot ovat</b><br>Valtiokonttorin avoin Valtion talous -rajapinta (tutkihallintoa.fi), lisenssi CC BY 4.0. Luvut ovat talousarviokirjanpidon kuukausittaisista tapahtumista laskettuja vuosisummia (nettokertymä kyseiseltä vuodelta). Kesken olevan vuoden luvut kattavat vain jo kirjatut kuukaudet. Euromäärät ovat käypiä hintoja. Tämä ei ole virallinen lähde, ja tarkat luvut ja määritelmät ovat Valtiokonttorissa.</div>
<div class="vt">${CSS}<div id="vtr"></div>${JS}</div>
<p><a href="/tilastot/">Muut tilastot</a> · <a href="/budjetti/">Budjetti</a></p>`;
  return { pages: [{ path: "/valtion-talous/", html: shell({ title: "Valtion talous | Eduskuntaseuranta", desc: "Valtion talousarviotalouden toteuma pääluokittain ja momenteittain vuosilta 1998–2026: menot, verotulot ja kehitys vuosien yli.", path: "/valtion-talous/", body }) }], files };
}

const AJS = String.raw`<script>(function(){
var IDX=null,Y=null,root=document.getElementById("var");
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function eur(v){var a=Math.abs(v);if(a>=1e9)return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:2}).format(v/1e9)+" mrd €";if(a>=1e6)return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:1}).format(v/1e6)+" milj. €";return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:0}).format(v)+" €"}
function nm(s){s=String(s||"");return s.charAt(0)+s.slice(1).toLowerCase()}
function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("Lataus epäonnistui ("+r.status+")");return r.json()})}
function isAv(r){var p=String(r[0]).split(".").filter(Boolean);var n=Number(p[2]);var pl=Number(r[2]);return p.length===3&&n>=50&&n<=69&&pl>=21&&pl<=35&&r[3]>0}
function tbl(rows){var h='<div style="overflow-x:auto"><table><thead><tr><th>Momentti</th><th class="n">Euroa</th></tr></thead><tbody>';rows.forEach(function(r){h+='<tr><td>'+e(r[0])+' '+e(nm(r[1]))+'</td><td class="n">'+eur(r[3])+'</td></tr>'});return h+'</tbody></table></div>'}
function boot(){root.innerHTML='<p class="meta">Ladataan…</p>';j("/data/vt/index.json").then(function(i){IDX=i;var yrs=i.years.slice().sort(function(a,b){return b-a});var full=yrs.filter(function(y){return i.months[y]===12})[0]||yrs[0];draw(full)}).catch(function(x){root.innerHTML="<p>"+e(x.message)+"</p>"})}
function draw(y){var yrs=IDX.years.slice().sort(function(a,b){return b-a});var h='<label>Vuosi <select id="vy">';yrs.forEach(function(v){h+='<option value="'+v+'"'+(v===y?" selected":"")+'>'+v+(IDX.months[v]<12?" ("+IDX.months[v]+" kk)":"")+'</option>'});h+='</select></label><div id="vo"><p class="meta">Ladataan…</p></div>';root.innerHTML=h;document.getElementById("vy").onchange=function(){draw(Number(this.value))};
j("/data/vt/"+y+".json").then(function(d){Y=d;show(y)}).catch(function(x){document.getElementById("vo").innerHTML="<p>"+e(x.message)+"</p>"})}
function show(y){var rows=Y.rows.filter(isAv).sort(function(a,b){return b[3]-a[3]}),tot=0,by={};rows.forEach(function(r){tot+=r[3];by[r[2]]=(by[r[2]]||0)+r[3]});
var keys=Object.keys(by).sort(function(a,b){return by[b]-by[a]}),mx=keys.length?by[keys[0]]:1;
var part=IDX.months[y]<12?'<p class="meta">Vuosi on kesken: luvut ovat '+IDX.months[y]+' kuukaudelta.</p>':"";
var h=part+'<div class="big"><div><b>'+eur(tot)+'</b>Avustuksia, tukia ja valtionosuuksia</div><div><b>'+rows.length+'</b>Momenttia</div></div><h3>Hallinnonaloittain</h3><div style="overflow-x:auto"><table><tbody>';
keys.forEach(function(k){h+='<tr><td>'+k+'. '+e(nm(Y.paaluokat[k]||k))+'<div class="vb" style="width:'+Math.max(2,Math.round(100*by[k]/mx))+'%"></div></td><td class="n">'+eur(by[k])+'</td></tr>'});
h+='</tbody></table></div><h3>Suurimmat erät</h3>'+tbl(rows.slice(0,50))+'<h3>Hae avustusta</h3><input type="search" id="vq" placeholder="Esim. yhdistys, kunta, maatalous, urheilu, kulttuuri"><div id="vs"></div>';
document.getElementById("vo").innerHTML=h;var q=document.getElementById("vq"),vs=document.getElementById("vs");
q.oninput=function(){var w=q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);vs.innerHTML="";if(!w.length)return;var out=[],n=0;rows.forEach(function(r){var t=(r[1]+" "+r[0]).toLowerCase();for(var i=0;i<w.length;i++)if(t.indexOf(w[i])<0)return;n++;if(out.length<60)out.push(r)});vs.innerHTML='<p class="meta">'+n+' osumaa'+(n>60?", näytetään 60 suurinta":"")+'</p>'+tbl(out)}}
boot()})()</script>`;

export function avustusPage({ shell }) {
  const body = `<h1>Valtionavustukset</h1><p>Valtio jakaa budjetista rahaa avustuksina, tukina ja valtionosuuksina. Tässä näet, mihin tarkoituksiin rahaa on budjetissa käytetty, hallinnonaloittain ja momenteittain vuosilta 1998 alkaen. Valitse vuosi ja hae esimerkiksi yhdistyksiä, kuntia, urheilua tai maataloutta.</p>
<div class="note"><b>Mitä luvut kertovat – ja mitä eivät</b><br>Luvut ovat valtion talousarvion siirtomenomomentteja (momenttinumeron lopussa 50–69), jotka sisältävät avustukset, tuet ja valtionosuudet, myös lakisääteiset kuten asumistuen. Ne kertovat, mihin tarkoitukseen rahaa on käytetty, mutta eivät sitä, kuka yksittäisen avustuksen sai. Lähde on Valtiokonttorin Valtion talous -rajapinta (CC BY 4.0). Tämä ei ole virallinen lähde.</div>
<p>Yksittäisten avustuspäätösten saajat löytyvät Valtiokonttorin omasta palvelusta: <a href="https://www.tutkiavustuksia.fi/" rel="noopener">Tutkiavustuksia.fi</a>. Tietoja ei voi ladata koneellisesti, joten niitä ei näytetä tällä sivustolla.</p>
<div class="vt">${CSS}<div id="var"></div>${AJS}</div>
<p><a href="/valtion-talous/">Koko valtion talous</a> · <a href="/tilastot/">Tilastot</a></p>`;
  return { path: "/valtionavustukset/", html: shell({ title: "Valtionavustukset | Eduskuntaseuranta", desc: "Valtion avustukset, tuet ja valtionosuudet hallinnonaloittain ja momenteittain vuosilta 1998 alkaen.", path: "/valtionavustukset/", body }) };
}
