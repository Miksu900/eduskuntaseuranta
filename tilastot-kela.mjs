import { tilastotPages as vanha } from "./tilastot-vanha.mjs";

const VIR = String.raw`<script>(function(){
var A="https://avoindata.suomi.fi/data/api/3/action/",root=document.getElementById("vir");
var SRC=[{k:"kela",n:"Kela",re:/kansaneläke|^kela$|kela/i,q:"Kela"},{k:"tulli",n:"Tulli",re:/^tulli|tullihallitus/i,q:"Tulli"},{k:"syke",n:"SYKE",re:/ympäristökeskus|syke/i,q:"SYKE"}];
var orgs=null,start=0,N=12,cur=null,tot=0;
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function tr(o){if(!o)return"";if(typeof o==="string"){if(o.charAt(0)==="{"){try{o=JSON.parse(o)}catch(x){return o}}else return o}return o.fi||o.en||o.sv||""}
function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("Palvelu vastasi "+r.status);return r.json()})}
var h='<div class="tb">';SRC.forEach(function(x){h+='<button data-k="'+x.k+'">'+x.n+'</button>'});
root.innerHTML=h+'</div><input type="search" id="vq" placeholder="Rajaa aineistoja, esim. eläke, vienti, vesi"><div id="vs" class="meta">Valitse virasto.</div><div id="vo"></div><div class="tb"><button id="vm" style="display:none">Näytä lisää</button></div><div id="vp"></div>';
var vq=document.getElementById("vq"),vs=document.getElementById("vs"),vo=document.getElementById("vo"),vm=document.getElementById("vm"),vp=document.getElementById("vp"),tm=null;
function findOrg(x){if(x.org!==undefined)return Promise.resolve(x.org);return j(A+"organization_list?all_fields=true&limit=1000").then(function(r){var best=null;(r.result||[]).forEach(function(o){var t=tr(o.title_translated)||o.title||o.display_name||"";if(!best&&x.re.test(t)&&!/oy$|ry$/i.test(t))best=o.name});x.org=best;return best}).catch(function(){x.org=null;return null})}
function go(more){if(!cur)return;if(!more){start=0;vo.textContent="";vp.textContent=""}vs.textContent="Haetaan…";
findOrg(cur).then(function(org){var q=vq.value.trim();var u=A+"package_search?rows="+N+"&start="+start+"&q="+encodeURIComponent(q||(org?"*:*":cur.q))+(org?"&fq="+encodeURIComponent("organization:"+org):"");return j(u)}).then(function(d){var R=d.result;R.results.forEach(function(p){vo.appendChild(card(p))});start+=R.results.length;tot=R.count;vs.textContent=cur.n+": "+R.count+" aineistoa"+(start<R.count?", näytetään "+start:"");vm.style.display=start<R.count?"":"none"}).catch(function(x){vs.textContent="Haku epäonnistui: "+x.message})}
function card(p){var d=document.createElement("div");d.className="card";var t=tr(p.title_translated)||p.title||p.name;var n=(tr(p.notes_translated)||p.notes||"").replace(/\s+/g," ").slice(0,200);
var h='<b>'+e(t)+'</b>'+(n?'<br><span class="meta">'+e(n)+(n.length>=200?"…":"")+'</span>':"")+'<div class="tb">';
var csv=[],oth={};(p.resources||[]).forEach(function(r){var f=(r.format||"").toUpperCase();if(!r.url||!/^https?:/.test(r.url))return;if(f==="CSV"&&/\.csv|\/download\//i.test(r.url))csv.push(r);else if(!oth[f||"tiedosto"])oth[f||"tiedosto"]=r.url});
csv.slice(0,4).forEach(function(r,i){h+='<button data-c="'+i+'">Katso CSV'+(csv.length>1?" "+(i+1):"")+'</button>'});h+='</div>';
var ks=Object.keys(oth).slice(0,5);if(ks.length)h+=ks.map(function(k){return'<a href="'+e(oth[k])+'" rel="noopener">'+e(k)+'</a>'}).join(" · ")+'<br>';
h+='<a href="https://avoindata.suomi.fi/data/fi/dataset/'+encodeURIComponent(p.name)+'" rel="noopener">Avaa avoindata.fi:ssä</a>';d.innerHTML=h;
d.querySelectorAll("button[data-c]").forEach(function(b){b.onclick=function(){csvView(csv[Number(b.getAttribute("data-c"))],t)}});return d}
function parse(t){var del=(t.split("\n")[0].split(";").length>t.split("\n")[0].split(",").length)?";":",";var rows=[],row=[],f="",q=false,i,c;if(t.charCodeAt(0)===65279)t=t.slice(1);
for(i=0;i<t.length;i++){c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===del){row.push(f);f=""}else if(c==="\n"){row.push(f);rows.push(row);row=[];f=""}else if(c!=="\r")f+=c}
if(f||row.length){row.push(f);rows.push(row)}return rows}
function num(s){var v=String(s).replace(/\s/g,"").replace(",",".");return v!==""&&!isNaN(v)?Number(v):null}
var knm=null;function kn(){if(knm)return Promise.resolve(knm);return j("https://sotkanet.fi/rest/1.1/regions").then(function(r){var m={};r.forEach(function(g){if(g.category==="KUNTA"&&g.code){var n=parseInt(g.code,10);if(!isNaN(n))m[n]=(g.title&&(g.title.fi||g.title.en))||g.code}});knm=m;return m})}
function csvView(r,t){vp.innerHTML='<h3>'+e(t)+'</h3><p class="meta">Ladataan CSV-tiedostoa…</p>';vp.scrollIntoView({behavior:"smooth"});
fetch(r.url).then(function(x){if(!x.ok)throw new Error("Palvelu vastasi "+x.status);return x.arrayBuffer()}).then(function(b){var txt;try{txt=new TextDecoder("utf-8",{fatal:true}).decode(b)}catch(x){txt=new TextDecoder("windows-1252").decode(b)}
var rows=parse(txt).filter(function(z){return z.length>1||(z[0]||"")!==""});if(rows.length<2)throw new Error("Tiedosto oli tyhjä");var hd=rows[0],body=rows.slice(1),sc=-1,asc=false;
vp.innerHTML='<h3>'+e(t)+'</h3><p class="meta">'+body.length+' riviä, '+hd.length+' saraketta. Napauta otsikkoa lajitellaksesi. <a href="'+e(r.url)+'" rel="noopener">Lataa alkuperäinen</a></p><input type="search" id="cf" placeholder="Hae riveiltä"><div style="overflow-x:auto;max-height:70vh"><table><thead><tr id="ch"></tr></thead><tbody id="cb"></tbody></table></div><p class="meta" id="cn"></p>';
var fmt=hd.map(function(x){return !/nro|vuosi|kuukausi|koodi|tunnus|aika|\bid\b|alue|kunta|maa|pvm|date|year|month|code/i.test(x)});var ch=document.getElementById("ch"),cb=document.getElementById("cb"),cf=document.getElementById("cf"),cn=document.getElementById("cn");
hd.forEach(function(x,i){var th=document.createElement("th");th.textContent=x;th.style.cursor="pointer";th.onclick=function(){if(sc===i)asc=!asc;else{sc=i;asc=false}body.sort(function(a,b){var p=num(a[i]),q=num(b[i]);var c=(p!==null&&q!==null)?p-q:String(a[i]).localeCompare(String(b[i]),"fi");return asc?c:-c});dr()};ch.appendChild(th)});
function dr(){var q=cf.value.toLowerCase().trim();cb.textContent="";var n=0,m=0;body.forEach(function(z){if(q&&z.join(" ").toLowerCase().indexOf(q)<0)return;m++;if(n>=300)return;n++;var tr2=document.createElement("tr");z.forEach(function(c,ci){var td=document.createElement("td");var v=num(c);td.textContent=v!==null&&fmt[ci]&&String(c).length<16&&!/^0\d/.test(c)?new Intl.NumberFormat("fi-FI",{maximumFractionDigits:3}).format(v):c;if(v!==null)td.className="n";tr2.appendChild(td)});cb.appendChild(tr2)});cn.textContent=m+" riviä"+(m>300?", näytetään 300. Hae tai lajittele tarkentaaksesi.":"")}
cf.oninput=dr;dr();var ki=hd.indexOf("kunta_nro");if(ki>=0)kn().then(function(m){body.forEach(function(z){var k=parseInt(z[ki],10);if(m[k])z[ki]=m[k]+" ("+z[ki]+")"});dr()}).catch(function(){})}).catch(function(x){vp.innerHTML='<h3>'+e(t)+'</h3><p>Tiedostoa ei voitu näyttää tässä ('+e(x.message)+'). <a href="'+e(r.url)+'" rel="noopener">Lataa se suoraan</a>.</p>'})}
root.querySelectorAll("button[data-k]").forEach(function(b){b.onclick=function(){cur=SRC.filter(function(x){return x.k===b.getAttribute("data-k")})[0];vq.value="";go(false)}});
vq.oninput=function(){clearTimeout(tm);tm=setTimeout(function(){go(false)},400)};vm.onclick=function(){go(true)}})()</script>`;


const HYD = String.raw`<script>(function(){
var B="https://rajapinnat.ymparisto.fi/api/Hydrologiarajapinta/1.1/odata/",root=document.getElementById("hyd");
var M=[{t:"Vedenkorkeus (cm)",e:"Vedenkorkeus"},{t:"Virtaama (m³/s)",e:"Virtaama"},{t:"Veden lämpötila (°C)",e:"LampoPintavesi"}];
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("Palvelu vastasi "+r.status);return r.json()})}
root.innerHTML='<input type="search" id="hq" placeholder="Hae paikkaa tai kuntaa, esim. Oulu, Kemijoki, Tornio"><div id="hs" class="meta">Kirjoita paikan tai kunnan nimi.</div><div id="hl"></div><div id="hd"></div>';
var hq=document.getElementById("hq"),hs=document.getElementById("hs"),hl=document.getElementById("hl"),hd=document.getElementById("hd"),tm=null;
function srch(q){var l=q.toLowerCase().replace(/'/g,"''");var fs=["contains(tolower(Nimi),'"+l+"') or contains(tolower(KuntaNimi),'"+l+"')","substringof('"+l+"',Nimi) or substringof('"+l+"',KuntaNimi)"];
function t(i){return j(B+"Paikka?$top=30&$filter="+encodeURIComponent(fs[i])).catch(function(x){if(i+1<fs.length)return t(i+1);throw x})}return t(0)}
hq.oninput=function(){clearTimeout(tm);tm=setTimeout(function(){var q=hq.value.trim();hd.textContent="";if(q.length<2){hl.textContent="";hs.textContent="Kirjoita paikan tai kunnan nimi.";return}hs.textContent="Haetaan…";
srch(q).then(function(d){var v=d.value||[];hl.textContent="";hs.textContent=v.length?v.length+" paikkaa"+(v.length>=30?" (näytetään 30, tarkenna hakua)":""):"Ei osumia.";v.forEach(function(p){var a=document.createElement("a");a.className="nd";a.textContent=(p.Nimi||"")+" – "+(p.KuntaNimi||"");a.onclick=function(){pick(p)};hl.appendChild(a)})}).catch(function(x){hs.textContent="Haku epäonnistui: "+x.message})},400)};
function pick(p){hd.innerHTML='<h3>'+e(p.Nimi)+'</h3><p class="meta">'+e(p.KuntaNimi)+'. Valitse mittaus. Kaikilla paikoilla ei ole kaikkia mittauksia.</p><div class="tb" id="hb"></div><div id="ho"></div>';hd.scrollIntoView({behavior:"smooth"});
M.forEach(function(m){var b=document.createElement("button");b.textContent=m.t;b.onclick=function(){show(p,m)};document.getElementById("hb").appendChild(b)})}
function chart(v){var n=v.length,W=320,H=140,P=24,mx=-1e300,mn=1e300;v.forEach(function(x){if(x>mx)mx=x;if(x<mn)mn=x});if(mx===mn)mx=mn+1;var pts=v.map(function(x,i){return(P+(n>1?i*(W-2*P)/(n-1):0)).toFixed(1)+","+(H-P-(x-mn)*(H-2*P)/(mx-mn)).toFixed(1)}).join(" ");
return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:520px;background:var(--surface);border:1px solid var(--line);border-radius:10px"><polyline fill="none" stroke="currentColor" stroke-width="2" points="'+pts+'"/><text x="'+P+'" y="12" font-size="10" fill="currentColor">'+mx+'</text><text x="'+P+'" y="'+(H-6)+'" font-size="10" fill="currentColor">'+mn+'</text></svg>'}
function show(p,m){var ho=document.getElementById("ho");ho.innerHTML='<p class="meta">Haetaan…</p>';
j(B+m.e+"?$top=60&$filter="+encodeURIComponent("Paikka_Id eq "+p.Paikka_Id)+"&$orderby="+encodeURIComponent("Aika desc")).then(function(d){var v=(d.value||[]).filter(function(r){return r.Arvo!=null&&!isNaN(Number(r.Arvo))});if(!v.length){ho.innerHTML="<p>Tälle paikalle ei löytynyt tätä mittausta.</p>";return}
var h='<h4>'+e(m.t)+'</h4><p class="meta">Viimeisimmät '+v.length+' mittausta. Uusin: <b>'+e(Number(v[0].Arvo))+'</b> ('+e(String(v[0].Aika).slice(0,10))+'). Lähde: SYKE Hydrologia.</p>'+chart(v.slice().reverse().map(function(r){return Number(r.Arvo)}))+'<div style="overflow-x:auto;max-height:50vh"><table><thead><tr><th>Päivä</th><th class="n">Arvo</th></tr></thead><tbody>';
v.forEach(function(r){h+='<tr><td>'+e(String(r.Aika).slice(0,10))+'</td><td class="n">'+e(Number(r.Arvo))+'</td></tr>'});ho.innerHTML=h+'</tbody></table></div>'}).catch(function(x){ho.innerHTML="<p>Haku epäonnistui: "+e(x.message)+"</p>"})}
})()</script>`;

export function tilastotPages(args) {
  const pages = vanha(args);
  const osio = `<h2>Kela, Tulli ja SYKE</h2><p class="meta">Etuudet ja eläkkeet (Kela), ulkomaankauppa (Tulli) sekä ympäristö- ja vesitieto (SYKE). Valitse virasto, avaa CSV ja selaa, hae ja lajittele lukuja suoraan sivulla.</p><div id="vir"></div>${VIR}
<h3>SYKE: vedenkorkeus, virtaama ja veden lämpötila</h3><p class="meta">Hae joki, järvi tai kunta ja katso uusimmat mittaukset kuvaajana. Lähde: SYKE:n avoin hydrologiarajapinta.</p><div id="hyd"></div>${HYD}
<h3>Tulli: ulkomaankauppa</h3><p class="meta">Tullin ulkomaankauppatilastot ovat Uljas-tilastotietokannassa, jossa voit valita tuotteen, maan ja ajanjakson. <a href="https://tulli.fi/tilastot/uljas-api" rel="noopener">Tullin tilastot ja rajapinta</a> · <a href="https://uljas.tulli.fi/" rel="noopener">Avaa Uljas-tietokanta</a></p>
`;
  for (const p of pages) p.html = p.html.replace("<h2>Suomen avoin data (avoindata.fi)</h2>", osio + "<h2>Suomen avoin data (avoindata.fi)</h2>");
  return pages;
}
