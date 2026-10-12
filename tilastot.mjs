// Tilastot: avoimen datan selain (Tilastokeskus, Traficom, THL Sotkanet). Kaikki haetaan selaimessa suoraan lähteestä.
const CSS = String.raw`<style>.tl a.nd{display:block;padding:10px 12px;margin:6px 0;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);text-decoration:none;cursor:pointer}.tl .tb{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.tl button,.tl select,.tl input[type=search]{font-size:16px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)}.tl input[type=search]{width:100%;box-sizing:border-box;margin:8px 0}.tl select{max-width:100%;width:100%;margin:2px 0 10px}.tl table{width:100%;border-collapse:collapse;font-size:14px}.tl td,.tl th{padding:6px;border-bottom:1px solid var(--line);text-align:left}.tl td.n,.tl th.n{text-align:right}.tl label{display:block;font-weight:600;margin-top:8px}.tl .tabs button{flex:1}.tl .tabs button.on{border-color:var(--accent,#888);font-weight:700}</style>`;

const PX = String.raw`<script>(function(){
var SRC={stat:{n:"Tilastokeskus",u:"https://statfin.stat.fi/PXWeb/api/v1/fi/StatFin/"},traf:{n:"Traficom",u:"https://trafi2.stat.fi/PXWeb/api/v1/fi/TraFi/"}};
var root=document.getElementById("pxr"),cur=null,path=[],list=[];
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function nf(v){return typeof v==="number"?new Intl.NumberFormat("fi-FI",{maximumFractionDigits:2}).format(v):(v==null?"–":String(v))}
function j(u,o){return fetch(u,o).then(function(r){if(!r.ok)throw new Error("Palvelu vastasi "+r.status);return r.json()})}
function head(){var h='<div class="tb">';Object.keys(SRC).forEach(function(k){h+='<button data-s="'+k+'" class="'+(cur===k?"on":"")+'">'+SRC[k].n+'</button>'});return h+'</div>'}
function crumbs(){var h='<div class="meta">'+e(SRC[cur].n);path.forEach(function(p){h+=" › "+e(p.t)});return h+'</div><div class="tb"><button id="up">← Takaisin</button></div>'}
function bindHead(){root.querySelectorAll("button[data-s]").forEach(function(b){b.onclick=function(){cur=b.getAttribute("data-s");path=[];browse()}})}
function url(){return SRC[cur].u+path.map(function(p){return encodeURIComponent(p.id)}).join("/")}
function browse(){root.innerHTML=head()+(cur?crumbs()+'<div class="meta">Ladataan…</div>':'<p class="meta">Valitse lähde.</p>');bindHead();if(!cur)return;
var up=document.getElementById("up");up.onclick=function(){if(path.length){path.pop();browse()}else{cur=null;browse()}};
j(url()).then(function(l){list=l;showList()}).catch(function(x){root.insertAdjacentHTML("beforeend",'<p>Haku epäonnistui: '+e(x.message)+'</p>')})}
function showList(){var box=document.createElement("div");box.innerHTML='<input type="search" id="fl" placeholder="Suodata listaa">'+'<div id="ls"></div>';var old=root.querySelector(".meta:last-child");if(old&&old.textContent==="Ladataan…")old.remove();root.appendChild(box);
var ls=box.querySelector("#ls");function draw(){var q=box.querySelector("#fl").value.toLowerCase().trim();ls.innerHTML="";var n=0;list.forEach(function(x){if(q&&(x.text||"").toLowerCase().indexOf(q)<0)return;if(n++>300)return;var a=document.createElement("a");a.className="nd";a.textContent=(x.type==="t"?"📊 ":"📁 ")+x.text+(x.updated?" (päivitetty "+x.updated.slice(0,10)+")":"");a.onclick=function(){path.push({id:x.id,t:x.text});if(x.type==="t")table();else browse()};ls.appendChild(a)});if(!n)ls.textContent="Ei osumia."}
box.querySelector("#fl").oninput=draw;draw()}
function table(){root.innerHTML=head()+crumbs()+'<div class="meta">Ladataan taulukkoa…</div>';bindHead();document.getElementById("up").onclick=function(){path.pop();browse()};
j(url()).then(function(m){form(m)}).catch(function(x){root.insertAdjacentHTML("beforeend",'<p>Taulukon haku epäonnistui: '+e(x.message)+'</p>')})}
function pick(v){var t=v.valueTexts.map(function(s){return s.toLowerCase()});var pr=["yhteensä","koko maa","kaikki yhteensä","total","ssä"];for(var p=0;p<pr.length;p++){for(var i=0;i<t.length;i++){if(t[i].indexOf(pr[p])===0||t[i]===pr[p])return[i]}}return[0]}
function form(m){var vars=m.variables||[];var h=head()+crumbs()+'<h2>'+e(m.title||path[path.length-1].t)+'</h2><p class="meta">Valitse rajaukset ja paina Näytä. Aikasarjasta oletuksena viimeiset arvot.</p><div id="fv"></div><div class="tb"><button id="go">Näytä</button></div><div id="out"></div>';root.innerHTML=h;bindHead();document.getElementById("up").onclick=function(){path.pop();browse()};
var fv=document.getElementById("fv");vars.forEach(function(v,vi){var isT=v.time||/^(vuosi|kuukausi|aika|tiedot|vuosineljännes|neljännes)$/i.test(v.text);var lab=document.createElement("label");lab.textContent=v.text;fv.appendChild(lab);var s=document.createElement("select");s.id="v"+vi;var opts=[];
if(v.time){opts.push(["last12","Viimeiset 12"],["last5","Viimeiset 5"],["last1","Uusin"],["all","Kaikki"])}else{if(v.values.length>1)opts.push(["all","Kaikki ("+v.values.length+")"])}
opts.forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=o[1];s.appendChild(op)});
v.values.forEach(function(val,i){if(v.time&&i<v.values.length-60)return;var op=document.createElement("option");op.value="i"+i;op.textContent=v.valueTexts[i];s.appendChild(op)});
if(!v.time){var d=pick(v)[0];s.value="i"+d}else s.value="last12";fv.appendChild(s)});
document.getElementById("go").onclick=function(){run(m)}}
function sel(v,vi){var s=document.getElementById("v"+vi).value,n=v.values.length;if(s==="all")return v.values.slice(0,400);if(s==="last12")return v.values.slice(Math.max(0,n-12));if(s==="last5")return v.values.slice(Math.max(0,n-5));if(s==="last1")return v.values.slice(n-1);return[v.values[Number(s.slice(1))]]}
function run(m){var out=document.getElementById("out");out.innerHTML='<p class="meta">Haetaan…</p>';var q=m.variables.map(function(v,vi){return{code:v.code,selection:{filter:"item",values:sel(v,vi)}}});
j(url(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,response:{format:"json-stat2"}})}).then(function(d){render(out,d,m)}).catch(function(x){out.innerHTML='<p>Haku epäonnistui: '+e(x.message)+' Kokeile pienempää rajausta.</p>'})}
function render(out,d,m){var ids=d.id,size=d.size,dims=ids.map(function(id){var c=d.dimension[id].category,idx=c.index,lab=c.label||{},keys=Array.isArray(idx)?idx:Object.keys(idx).sort(function(a,b){return idx[a]-idx[b]});return{id:id,name:d.dimension[id].label,keys:keys.map(function(k){return lab[k]||k})}});
var total=d.value.length,rows=[],i;var many=[];dims.forEach(function(x,k){if(x.keys.length>1)many.push(k)});
var strides=[];var s=1;for(i=ids.length-1;i>=0;i--){strides[i]=s;s*=size[i]}
var cap=Math.min(total,1000);var h='<p class="meta">'+total+' arvoa'+(total>cap?', näytetään '+cap:'')+'. Lähde: '+e(SRC[cur].n)+'.</p>';
if(many.length===1&&total>1){var k=many[0],vals=[];for(i=0;i<total;i++)vals.push(d.value[i]);h+=chart(dims[k].keys,vals)}
h+='<div style="overflow-x:auto"><table><thead><tr>';many.forEach(function(k){h+='<th>'+e(dims[k].name)+'</th>'});if(!many.length)h+='<th>Tieto</th>';h+='<th class="n">Arvo</th></tr></thead><tbody>';
for(i=0;i<cap;i++){h+='<tr>';if(many.length){many.forEach(function(k){var ix=Math.floor(i/strides[k])%size[k];h+='<td>'+e(dims[k].keys[ix])+'</td>'})}else h+='<td>'+e(m.title||"")+'</td>';h+='<td class="n">'+nf(d.value[i])+'</td></tr>'}
h+='</tbody></table></div>';var fixed=dims.filter(function(x){return x.keys.length===1}).map(function(x){return e(x.name)+': '+e(x.keys[0])});if(fixed.length)h+='<p class="meta">Rajaukset: '+fixed.join(' · ')+'</p>';out.innerHTML=h}
function chart(labels,vals){var n=vals.length,W=320,H=140,P=24,mx=-1e300,mn=1e300;vals.forEach(function(v){if(typeof v==="number"){if(v>mx)mx=v;if(v<mn)mn=v}});if(mx===mn){mx=mn+1}if(mn>0)mn=Math.min(mn,0)>0?0:mn;
var pts=vals.map(function(v,i){var x=P+(n>1?i*(W-2*P)/(n-1):0),y=typeof v==="number"?H-P-(v-mn)*(H-2*P)/(mx-mn):null;return[x,y]}).filter(function(p){return p[1]!==null});
return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:520px;background:var(--surface);border:1px solid var(--line);border-radius:10px"><polyline fill="none" stroke="currentColor" stroke-width="2" points="'+pts.map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1)}).join(" ")+'"/><text x="'+P+'" y="12" font-size="10" fill="currentColor">'+nf(mx)+'</text><text x="'+P+'" y="'+(H-6)+'" font-size="10" fill="currentColor">'+e(labels[0])+'</text><text x="'+(W-P)+'" y="'+(H-6)+'" font-size="10" text-anchor="end" fill="currentColor">'+e(labels[n-1])+'</text></svg>'}
browse()})()</script>`;

const SOT = String.raw`<script>(function(){
var A="https://sotkanet.fi/rest/1.1/",root=document.getElementById("sor"),inds=null,regs=null;
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function nf(v){return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:2}).format(v)}
function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("Palvelu vastasi "+r.status);return r.json()})}
root.innerHTML='<input type="search" id="si" placeholder="Hae mittaria, esim. alkoholi, toimeentulotuki, työttömyys"><div id="sl" class="meta">Kirjoita hakusana. Mittarit ladataan ensimmäisellä haulla.</div><div id="so"></div>';
var si=document.getElementById("si"),sl=document.getElementById("sl"),so=document.getElementById("so");
function load(){if(inds)return Promise.resolve();sl.textContent="Ladataan mittareita…";return Promise.all([j(A+"indicators"),j(A+"regions")]).then(function(r){inds=r[0].map(function(x){return{id:x.id,t:(x.title&&(x.title.fi||x.title.en))||"",l:((x.title&&(x.title.fi||x.title.en))||"").toLowerCase()}});regs={};r[1].forEach(function(g){if(g.category==="KUNTA")regs[g.id]=(g.title&&g.title.fi)||g.code})})}
si.oninput=function(){load().then(function(){var q=si.value.toLowerCase().trim().split(/\s+/).filter(Boolean);so.innerHTML="";if(!q.length){sl.textContent="Kirjoita hakusana.";return}var n=0,t=0;inds.forEach(function(x){for(var k=0;k<q.length;k++)if(x.l.indexOf(q[k])<0)return;t++;if(n>=40)return;n++;var a=document.createElement("a");a.className="nd";a.textContent=x.t;a.onclick=function(){show(x)};so.appendChild(a)});sl.textContent=t+" mittaria"+(t>40?", näytetään 40. Tarkenna hakua.":"")}).catch(function(x){sl.textContent="Lataus epäonnistui: "+x.message})};
function show(x){so.innerHTML='<p class="meta">Haetaan…</p>';var ys=[];for(var y=2025;y>=2018;y--)ys.push("years="+y);
j(A+"json?indicator="+x.id+"&"+ys.join("&")+"&genders=total").then(function(d){var by={},best=0;d.forEach(function(r){if(!regs[r.region]||r.value==null)return;if(r.year>best)best=r.year});d.forEach(function(r){if(r.year===best&&regs[r.region]&&r.value!=null)by[r.region]=r.value});var rows=Object.keys(by).map(function(k){return{n:regs[k],v:by[k]}}).sort(function(a,b){return b.v-a.v});
if(!rows.length){so.innerHTML='<h2>'+e(x.t)+'</h2><p>Kuntatason lukuja ei löytynyt tälle mittarille vuosilta 2018–2025.</p><div class="tb"><button id="bk">← Takaisin</button></div>';document.getElementById("bk").onclick=si.oninput;return}
var h='<h2>'+e(x.t)+'</h2><p class="meta">Vuosi '+best+', '+rows.length+' kuntaa. Lähde: THL Sotkanet. Mittarin tarkka määritelmä on Sotkanetissä.</p><div class="tb"><button id="bk">← Takaisin hakuun</button></div><input type="search" id="kf" placeholder="Hae kuntaa"><div style="overflow-x:auto"><table><thead><tr><th>Kunta</th><th class="n">Arvo</th></tr></thead><tbody id="kb"></tbody></table></div><p><a href="https://sotkanet.fi/sotkanet/fi/taulukko?indicator='+x.id+'" rel="noopener">Avaa Sotkanetissä</a></p>';so.innerHTML=h;document.getElementById("bk").onclick=si.oninput;
var kb=document.getElementById("kb"),kf=document.getElementById("kf");function dr(){var q=kf.value.toLowerCase().trim();kb.innerHTML="";var c=0;rows.forEach(function(r,i){if(q&&r.n.toLowerCase().indexOf(q)<0)return;if(c++>400)return;kb.insertAdjacentHTML("beforeend","<tr><td>"+(i+1)+". "+e(r.n)+"</td><td class='n'>"+nf(r.v)+"</td></tr>")})}kf.oninput=dr;dr()}).catch(function(x){so.innerHTML="<p>Haku epäonnistui: "+e(x.message)+"</p>"})}
})()</script>`;


const EUS = String.raw`<script>(function(){
var B="https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/";
var P=[
{t:"Työttömyysaste (%)",ds:"une_rt_m",p:["sex=T&age=TOTAL&unit=PC_ACT&s_adj=SA"],d:1},
{t:"Inflaatio, vuosimuutos (%)",ds:"prc_hicp_minr",p:["unit=RCH_A&coicop18=TOTAL","unit=RCH_A&coicop18=CP00","unit=RCH_A&coicop18=TOT"],d:1},
{t:"Julkinen velka (% BKT:sta)",ds:"gov_10dd_edpt1",p:["na_item=GD&unit=PC_GDP&sector=S13"],d:1},
{t:"Julkisen talouden ali-/ylijäämä (% BKT:sta)",ds:"gov_10dd_edpt1",p:["na_item=B9&unit=PC_GDP&sector=S13"],d:1},
{t:"BKT asukasta kohti (euroa)",ds:"nama_10_pc",p:["na_item=B1GQ&unit=CP_EUR_HAB"],d:0},
{t:"Väkiluku",ds:"demo_pjan",p:["age=TOTAL&sex=T&unit=NR"],d:0}];
var root=document.getElementById("eur");
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function nf(v,d){return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:d}).format(v)}
var h='<div class="tb">';P.forEach(function(x,i){h+='<button data-i="'+i+'">'+e(x.t)+'</button>'});root.innerHTML=h+'</div><div id="eo"></div>';
var eo=document.getElementById("eo");
function get(x,k){var u=B+x.ds+"?"+x.p[k]+"&lang=EN&format=JSON&lastTimePeriod=3";return fetch(u).then(function(r){if(!r.ok){if(k+1<x.p.length)return get(x,k+1);throw new Error("Palvelu vastasi "+r.status)}return r.json()})}
function show(x){eo.innerHTML='<p class="meta">Haetaan…</p>';get(x,0).then(function(d){var ids=d.id,size=d.size,gi=ids.indexOf("geo"),ti=ids.indexOf("time");if(gi<0||ti<0)throw new Error("Odottamaton rakenne");
function dim(id){var c=d.dimension[id].category,ix=c.index,lab=c.label||{},keys=Array.isArray(ix)?ix:Object.keys(ix).sort(function(a,b){return ix[a]-ix[b]});return{keys:keys,lab:lab}}
var G=dim("geo"),T=dim("time"),st=[],s=1,i;for(i=ids.length-1;i>=0;i--){st[i]=s;s*=size[i]}
var vals=d.value,keys=Array.isArray(vals)?vals.map(function(_,i){return i}):Object.keys(vals),best={};
keys.forEach(function(k){var v=vals[k];if(v==null)return;var n=Number(k),g=Math.floor(n/st[gi])%size[gi],t=Math.floor(n/st[ti])%size[ti],gk=G.keys[g];if(!best[gk]||t>best[gk].t)best[gk]={t:t,v:v}});
var rows=Object.keys(best).map(function(g){return{c:g,n:G.lab[g]||g,v:best[g].v,p:T.keys[best[g].t]}}).filter(function(r){return !/^(EU|EA|EEA)/.test(r.c)||r.c==="EU27_2020"||r.c==="EA20"});
rows.sort(function(a,b){return b.v-a.v});var fi=-1;rows.forEach(function(r,i){if(r.c==="FI")fi=i});
var o='<h3>'+e(x.t)+'</h3><p class="meta">Uusin saatavilla oleva luku maittain. '+(fi>=0?'Suomi on sijalla <b>'+(fi+1)+' / '+rows.length+'</b> (suurimmasta pienimpään). ':'')+'Lähde: Eurostat ('+e(x.ds)+'). Maiden nimet englanniksi.</p><div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Maa</th><th class="n">Arvo</th><th>Kausi</th></tr></thead><tbody>';
rows.forEach(function(r,i){var b=r.c==="FI";o+='<tr'+(b?' style="font-weight:700;background:rgba(80,140,255,.15)"':'')+'><td>'+(i+1)+'</td><td>'+e(r.n)+'</td><td class="n">'+nf(r.v,x.d)+'</td><td>'+e(r.p)+'</td></tr>'});
eo.innerHTML=o+'</tbody></table></div>'}).catch(function(err){eo.innerHTML="<p>Haku epäonnistui: "+e(err.message)+"</p>"})}
root.querySelectorAll("button").forEach(function(b){b.onclick=function(){show(P[Number(b.getAttribute("data-i"))])}})})()</script>`;

const AVO = String.raw`<script>(function(){
var A="https://avoindata.suomi.fi/data/api/3/action/package_search",root=document.getElementById("avo"),q="",start=0,N=15;
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function tr(o){if(!o)return"";if(typeof o==="string"){if(o.charAt(0)==="{"){try{o=JSON.parse(o)}catch(x){return o}}else return o}return o.fi||o.en||o.sv||""}
root.innerHTML='<input type="search" id="aq" placeholder="Hae aineistoa, esim. Kela, Tulli, vesi, liikenne, budjetti"><div id="as" class="meta">Kirjoita hakusana.</div><div id="ao"></div><div class="tb"><button id="am" style="display:none">Näytä lisää</button></div>';
var aq=document.getElementById("aq"),as=document.getElementById("as"),ao=document.getElementById("ao"),am=document.getElementById("am"),tm=null;
function card(p){var d=document.createElement("div");d.className="card";var t=tr(p.title_translated)||p.title||p.name;var o=p.organization?(tr(p.organization.title_translated)||p.organization.title):"";var n=(tr(p.notes_translated)||p.notes||"").replace(/\s+/g," ").slice(0,220);
var h='<b>'+e(t)+'</b><br><span class="meta">'+e(o)+'</span>'+(n?'<br><span class="meta">'+e(n)+(n.length>=220?"…":"")+'</span>':"");
var fm={};(p.resources||[]).forEach(function(r){var f=(r.format||"").toUpperCase()||"tiedosto";if(!fm[f]&&r.url&&/^https?:/.test(r.url))fm[f]=r.url});
var ks=Object.keys(fm).slice(0,6);if(ks.length){h+='<br>'+ks.map(function(k){return'<a href="'+e(fm[k])+'" rel="noopener">'+e(k)+'</a>'}).join(" · ")}
h+='<br><a href="https://avoindata.suomi.fi/data/fi/dataset/'+encodeURIComponent(p.name)+'" rel="noopener">Avaa avoindata.fi:ssä</a>';d.innerHTML=h;return d}
function go(more){if(!more){start=0;ao.textContent=""}as.textContent="Haetaan…";fetch(A+"?q="+encodeURIComponent(q)+"&rows="+N+"&start="+start).then(function(r){if(!r.ok)throw new Error("Palvelu vastasi "+r.status);return r.json()}).then(function(j){var R=j.result;R.results.forEach(function(p){ao.appendChild(card(p))});start+=R.results.length;as.textContent=R.count+" aineistoa"+(start<R.count?", näytetään "+start:"");am.style.display=start<R.count?"":"none"}).catch(function(x){as.textContent="Haku epäonnistui: "+x.message})}
aq.oninput=function(){clearTimeout(tm);tm=setTimeout(function(){q=aq.value.trim();if(!q){ao.textContent="";as.textContent="Kirjoita hakusana.";am.style.display="none";return}go(false)},400)};am.onclick=function(){go(true)}})()</script>`;

export function tilastotPages({ shell, esc }) {
  const body = `<h1>Tilastot</h1><p>Suomen virallista tilastodataa yhdessä paikassa. Tiedot haetaan suoraan lähteestä sillä hetkellä, kun avaat taulukon, joten luvut ovat aina ajantasaiset. Valitse lähde, selaa aihealueita ja avaa taulukko. Tilastokeskuksen ja Traficomin taulukoista saat luvut ja kuvaajan, THL:n mittareista kuntien vertailun.</p>
<div class="note"><b>Mistä tiedot ovat</b><br>Tilastokeskus (statfin.stat.fi), Traficom, Terveyden ja hyvinvoinnin laitos (Sotkanet), Eurostat ja avoindata.fi (Digi- ja väestötietovirasto). Luvut näytetään sellaisenaan lähteen avoimesta rajapinnasta. Tämä ei ole virallinen lähde, ja tarkat määritelmät ovat aina lähteessä.</div>
<div class="tl">${CSS}<h2>Tilastokeskus ja Traficom</h2><p class="meta">Väestö, työllisyys, hinnat, talous, liikenne ja paljon muuta.</p><div id="pxr"></div>${PX}
<h2>Terveys ja hyvinvointi kunnittain (THL)</h2><p class="meta">Satoja mittareita: terveys, toimeentulo, koulutus, elinolot. Näet kuntien paremmuusjärjestyksen.</p><div id="sor"></div>${SOT}
<h2>Suomi ja muut EU-maat (Eurostat)</h2><p class="meta">Vertaa Suomea EU-maihin: työttömyys, inflaatio, velka, talous ja väkiluku. Näet Suomen sijoituksen.</p><div id="eur"></div>${EUS}
<h2>Suomen avoin data (avoindata.fi)</h2><p class="meta">Koko Suomen julkisen datan hakemisto: Kelan, Tullin, SYKE:n, ministeriöiden ja kuntien aineistot. Linkit vievät suoraan tiedostoihin ja rajapintoihin.</p><div id="avo"></div>${AVO}</div>`;
  return [{ path: "/tilastot/", html: shell({ title: "Tilastot | Eduskuntaseuranta", desc: "Tilastokeskuksen, Traficomin ja THL:n avointa tilastodataa selattavassa muodossa: väestö, työllisyys, hinnat, terveys ja liikenne.", path: "/tilastot/", body }) }];
}
