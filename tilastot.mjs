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
var csv=[],oth={};(p.resources||[]).forEach(function(r){var f=(r.format||"").toUpperCase();if(!r.url||!/^https?:/.test(r.url))return;if(f==="CSV")csv.push(r);else if(!oth[f||"tiedosto"])oth[f||"tiedosto"]=r.url});
csv.slice(0,4).forEach(function(r,i){h+='<button data-c="'+i+'">Katso CSV'+(csv.length>1?" "+(i+1):"")+'</button>'});h+='</div>';
var ks=Object.keys(oth).slice(0,5);if(ks.length)h+=ks.map(function(k){return'<a href="'+e(oth[k])+'" rel="noopener">'+e(k)+'</a>'}).join(" · ")+'<br>';
h+='<a href="https://avoindata.suomi.fi/data/fi/dataset/'+encodeURIComponent(p.name)+'" rel="noopener">Avaa avoindata.fi:ssä</a>';d.innerHTML=h;
d.querySelectorAll("button[data-c]").forEach(function(b){b.onclick=function(){csvView(csv[Number(b.getAttribute("data-c"))],t)}});return d}
function parse(t){var del=(t.split("\n")[0].split(";").length>t.split("\n")[0].split(",").length)?";":",";var rows=[],row=[],f="",q=false,i,c;if(t.charCodeAt(0)===65279)t=t.slice(1);
for(i=0;i<t.length;i++){c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===del){row.push(f);f=""}else if(c==="\n"){row.push(f);rows.push(row);row=[];f=""}else if(c!=="\r")f+=c}
if(f||row.length){row.push(f);rows.push(row)}return rows}
function num(s){var v=String(s).replace(/\s/g,"").replace(",",".");return v!==""&&!isNaN(v)?Number(v):null}
function csvView(r,t){vp.innerHTML='<h3>'+e(t)+'</h3><p class="meta">Ladataan CSV-tiedostoa…</p>';vp.scrollIntoView({behavior:"smooth"});
fetch(r.url).then(function(x){if(!x.ok)throw new Error("Palvelu vastasi "+x.status);return x.arrayBuffer()}).then(function(b){var txt;try{txt=new TextDecoder("utf-8",{fatal:true}).decode(b)}catch(x){txt=new TextDecoder("windows-1252").decode(b)}
var rows=parse(txt).filter(function(z){return z.length>1||(z[0]||"")!==""});if(rows.length<2)throw new Error("Tiedosto oli tyhjä");var hd=rows[0],body=rows.slice(1),sc=-1,asc=false;
vp.innerHTML='<h3>'+e(t)+'</h3><p class="meta">'+body.length+' riviä, '+hd.length+' saraketta. Napauta otsikkoa lajitellaksesi. <a href="'+e(r.url)+'" rel="noopener">Lataa alkuperäinen</a></p><input type="search" id="cf" placeholder="Hae riveiltä"><div style="overflow-x:auto;max-height:70vh"><table><thead><tr id="ch"></tr></thead><tbody id="cb"></tbody></table></div><p class="meta" id="cn"></p>';
var ch=document.getElementById("ch"),cb=document.getElementById("cb"),cf=document.getElementById("cf"),cn=document.getElementById("cn");
hd.forEach(function(x,i){var th=document.createElement("th");th.textContent=x;th.style.cursor="pointer";th.onclick=function(){if(sc===i)asc=!asc;else{sc=i;asc=false}body.sort(function(a,b){var p=num(a[i]),q=num(b[i]);var c=(p!==null&&q!==null)?p-q:String(a[i]).localeCompare(String(b[i]),"fi");return asc?c:-c});dr()};ch.appendChild(th)});
function dr(){var q=cf.value.toLowerCase().trim();cb.textContent="";var n=0,m=0;body.forEach(function(z){if(q&&z.join(" ").toLowerCase().indexOf(q)<0)return;m++;if(n>=300)return;n++;var tr2=document.createElement("tr");z.forEach(function(c){var td=document.createElement("td");var v=num(c);td.textContent=v!==null&&String(c).length<16&&!/^0\d/.test(c)?new Intl.NumberFormat("fi-FI",{maximumFractionDigits:3}).format(v):c;if(v!==null)td.className="n";tr2.appendChild(td)});cb.appendChild(tr2)});cn.textContent=m+" riviä"+(m>300?", näytetään 300. Hae tai lajittele tarkentaaksesi.":"")}
cf.oninput=dr;dr()}).catch(function(x){vp.innerHTML='<h3>'+e(t)+'</h3><p>Tiedostoa ei voitu näyttää tässä ('+e(x.message)+'). <a href="'+e(r.url)+'" rel="noopener">Lataa se suoraan</a>.</p>'})}
root.querySelectorAll("button[data-k]").forEach(function(b){b.onclick=function(){cur=SRC.filter(function(x){return x.k===b.getAttribute("data-k")})[0];vq.value="";go(false)}});
vq.oninput=function(){clearTimeout(tm);tm=setTimeout(function(){go(false)},400)};vm.onclick=function(){go(true)}})()</script>`;

export function tilastotPages(args) {
  const pages = vanha(args);
  const osio = `<h2>Kela, Tulli ja SYKE</h2><p class="meta">Etuudet ja eläkkeet (Kela), ulkomaankauppa (Tulli) sekä ympäristö- ja vesitieto (SYKE). Valitse virasto, avaa CSV ja selaa, hae ja lajittele lukuja suoraan sivulla.</p><div id="vir"></div>${VIR}
`;
  for (const p of pages) p.html = p.html.replace("<h2>Suomen avoin data (avoindata.fi)</h2>", osio + "<h2>Suomen avoin data (avoindata.fi)</h2>");
  return pages;
}
