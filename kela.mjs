const JS = String.raw`<script>(function(){
var B="https://raw.githubusercontent.com/Miksu900/eduskuntaseuranta/main/data/kela/";
var root=document.getElementById("kh"),IDX=null,cache={},curId=null,yr=null,popM=null,popY=null;
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function j(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("Tietoa ei löytynyt ("+r.status+")");return r.json()})}
function nf(n,d){return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:d||0}).format(n)}
function eu(n){return nf(n)+" €"}
function milj(n){return Math.abs(n)>=1e6?nf(n/1e6,1)+" milj. €":eu(n)}
function get(id){if(cache[id])return Promise.resolve(cache[id]);return j(B+"k/"+id+".json").then(function(d){cache[id]=d;return d})}
root.innerHTML='<input type="search" id="kq" placeholder="Kirjoita kunnan nimi, esim. Ylivieska" autocomplete="off"><div id="kl"></div><div id="kr"><p class="meta">Ladataan kuntalistaa…</p></div>';
var kq=document.getElementById("kq"),kl=document.getElementById("kl"),kr=document.getElementById("kr");
var names=[];
j(B+"index.json").then(function(x){IDX=x;names=Object.keys(x.kunnat).map(function(id){return{id:id,n:x.kunnat[id]}}).filter(function(k){return !/^Kunta \d+$/.test(k.n)}).sort(function(a,b){return a.n.localeCompare(b.n,"fi")});
kr.innerHTML='<p class="meta">Kelan avoin data, '+nf(x.rows)+' riviä, '+x.files+' tiedostoa, vuodet '+x.years[0]+'–'+x.years[1]+'. Kirjoita kunnan nimi.</p>';
var h=(location.hash||"").replace("#","");if(h&&x.kunnat[h])pick(h)}).catch(function(x){kr.innerHTML="<p>Tietoa ei voitu ladata: "+e(x.message)+"</p>"});
kq.oninput=function(){var q=kq.value.trim().toLowerCase();kl.textContent="";if(!q)return;
var all=[{id:"all",n:"Koko maa"}].concat(names).filter(function(k){return k.n.toLowerCase().indexOf(q)>=0}).slice(0,10);
all.forEach(function(k){var a=document.createElement("a");a.className="nd";a.textContent=k.n;a.onclick=function(){kl.textContent="";kq.value=k.n;pick(k.id)};kl.appendChild(a)});
if(!all.length)kl.innerHTML='<p class="meta">Ei osumia.</p>'};
function popFor(y){
if(popM&&popY!==null)return Promise.resolve(popM);
return j("https://sotkanet.fi/rest/1.1/regions").then(function(rg){var idc={};rg.forEach(function(g){if(g.category==="KUNTA"&&g.code){var n=parseInt(g.code,10);if(!isNaN(n))idc[g.id]=n}});
var ys=[y,y-1,y-2,y-3],i=0;
function t(){if(i>=ys.length)return{};var yy=ys[i++];return j("https://sotkanet.fi/rest/1.1/json?indicator=127&years="+yy+"&genders=total").then(function(d){var m={};d.forEach(function(r){var c=idc[r.region];if(c&&r.value!=null)m[c]=Number(r.value)});if(Object.keys(m).length>100){popY=yy;return m}return t()}).catch(function(){return t()})}
return t()}).then(function(m){popM=m;if(popY===null)popY=0;return m}).catch(function(){popM={};popY=0;return popM})}
function pick(id){curId=id;yr=null;history.replaceState(null,"","#"+id);kr.innerHTML='<p class="meta">Haetaan…</p>';
Promise.all([get(id),id==="all"?Promise.resolve(null):get("all")]).then(function(a){render(id,a[0],a[1])}).catch(function(x){kr.innerHTML="<p>Haku epäonnistui: "+e(x.message)+"</p>"})}
function defYear(rows){var a={},b={};rows.forEach(function(r){a[r[1]]=(a[r[1]]||0)+1;if(r[5]>=12)b[r[1]]=(b[r[1]]||0)+1});var k=Object.keys(a).map(Number).sort(function(x,y){return y-x});for(var i=0;i<k.length;i++){if((b[k[i]]||0)/a[k[i]]>=0.5)return k[i]}return k[0]||0}
function render(id,d,nat){
var rows=d.r;if(yr===null)yr=defYear(rows);
var years={};rows.forEach(function(r){years[r[1]]=1});var ylist=Object.keys(years).map(Number).sort(function(a,b){return b-a});
var natMap={};if(nat)nat.r.forEach(function(r){natMap[r[0]+"|"+r[1]+"|"+r[2]]=r[3]});
var showPop=id!=="all"&&parseInt(id,10)>0;
var h='<h2>'+e(d.n)+'</h2><div class="tb"><select id="ky">'+ylist.map(function(y){return'<option value="'+y+'"'+(y===yr?" selected":"")+'>'+y+'</option>'}).join("")+'</select><button id="kc">Lataa CSV</button><button id="ks">Kopioi linkki</button></div><div id="kt"></div><div id="kg"></div>';
kr.innerHTML=h;
document.getElementById("ky").onchange=function(){yr=Number(this.value);table()};
document.getElementById("kc").onclick=function(){csv(d)};
document.getElementById("ks").onclick=function(){var u=location.origin+location.pathname+"#"+id;if(navigator.clipboard)navigator.clipboard.writeText(u);this.textContent="Linkki kopioitu"};
if(showPop)popFor(yr).then(function(m){pops=m;table()});else{pops={};table()}
var pops={};
function table(){
var kt=document.getElementById("kt"),sel=rows.filter(function(r){return r[1]===yr});
var p=showPop&&pops[parseInt(id,10)];
var byDs={};sel.forEach(function(r){(byDs[r[0]]=byDs[r[0]]||[]).push(r)});
var order=Object.keys(byDs).sort(function(a,b){var ma=0,mb=0;byDs[a].forEach(function(r){if(r[3]>ma)ma=r[3]});byDs[b].forEach(function(r){if(r[3]>mb)mb=r[3]});return mb-ma});
var out='<p class="meta">'+(sel.length?sel.length+' riviä vuodelta '+yr+'. ':'')+(p?'Asukasluku '+nf(p)+' (THL, '+popY+'). ':'')+'Napauta riviä nähdäksesi kehityksen vuosittain.</p>';
if(!sel.length)out='<p>Tälle vuodelle ei ole tietoja.</p>';
order.forEach(function(ds,di){var rr=byDs[ds].slice().sort(function(a,b){return b[3]-a[3]});
out+='<details'+(di<3?" open":"")+'><summary><b>'+e(IDX.datasets[ds])+'</b></summary><div style="overflow-x:auto"><table><thead><tr><th>Etuus</th><th class="n">Maksettu</th>'+(p?'<th class="n">€ / asukas</th>':'')+'<th class="n">Saajia</th>'+(nat?'<th class="n">Osuus maasta</th>':'')+'</tr></thead><tbody>';
rr.forEach(function(r){var lab=IDX.labels[r[2]]||IDX.datasets[ds];var ns=natMap[r[0]+"|"+r[1]+"|"+r[2]];
out+='<tr data-d="'+r[0]+'" data-l="'+r[2]+'" style="cursor:pointer"><td>'+e(lab)+(r[5]<12?' <span class="meta">('+r[5]+' kk)</span>':'')+'</td><td class="n">'+eu(r[3])+'</td>'+(p?'<td class="n">'+nf(r[3]/p,2)+' €</td>':'')+'<td class="n">'+(r[4]?nf(r[4]):'–')+'</td>'+(nat?'<td class="n">'+(ns>0?nf(100*r[3]/ns,2)+' %':'–')+'</td>':'')+'</tr>'});
out+='</tbody></table></div></details>'});
out+='<p class="meta">Lähde: Kelan avoin data (avoindata.fi), laskettu yhteen kunnittain ja vuosittain. Rivit voivat sisältää toisiaan, esimerkiksi &quot;yhteensä&quot;-rivi ja sen alarivit, joten älä laske taulukoiden rivejä itse yhteen. Ylhäällä oleva summa on laskettu vain Kelan etuusryhmistä. Kesken olevan vuoden luvut kattavat vain sulkeissa mainitut kuukaudet. Saajamäärä on kuukausikeskiarvo, jos tieto on kuukausitasolla. Tämä ei ole Kelan virallinen julkaisu.</p>';
var KD=IDX.datasets.indexOf("Kelan etuuksien saajat ja maksetut etuudet"),tot=0,cnt=0,mo=0;sel.forEach(function(r){if(r[0]===KD){tot+=r[3];cnt++;if(r[5]>mo)mo=r[5]}});
if(cnt)out='<div class="note"><b>Kela maksoi: '+e(d.n)+', '+yr+', yhteensä noin '+milj(tot)+'</b>'+(p?' ('+nf(tot/p)+' € asukasta kohden)':'')+'<br><span class="meta">Summa on laskettu Kelan etuusryhmien maksetuista euroista ('+cnt+' ryhmää, tilasto &quot;Kelan etuuksien saajat ja maksetut etuudet&quot;)'+(mo<12?'. Luku kattaa vain '+mo+' kuukautta.':'.')+'</span></div>'+out;
kt.innerHTML=out;
kt.querySelectorAll("tr[data-d]").forEach(function(tr){tr.onclick=function(){trend(Number(tr.getAttribute("data-d")),Number(tr.getAttribute("data-l")))}})}
function trend(ds,l){var s=rows.filter(function(r){return r[0]===ds&&r[2]===l}).sort(function(a,b){return a[1]-b[1]});var kg=document.getElementById("kg");
if(s.length<2){kg.innerHTML='<p class="meta">Ei riittävästi vuosia kehityksen näyttämiseen.</p>';return}
var W=340,H=170,P=30,mx=0,mn=1e300;s.forEach(function(r){if(r[3]>mx)mx=r[3];if(r[3]<mn)mn=r[3]});if(mn>0)mn=0;if(mx===mn)mx=mn+1;
var pts=s.map(function(r,i){return(P+i*(W-2*P)/(s.length-1)).toFixed(1)+","+(H-P-(r[3]-mn)*(H-2*P)/(mx-mn)).toFixed(1)}).join(" ");
var lb=s.length>1?'<text x="'+P+'" y="'+(H-8)+'" font-size="10" fill="currentColor">'+s[0][1]+'</text><text x="'+(W-P)+'" y="'+(H-8)+'" font-size="10" text-anchor="end" fill="currentColor">'+s[s.length-1][1]+'</text>':"";
kg.innerHTML='<h3>'+e(IDX.labels[l]||IDX.datasets[ds])+'</h3><p class="meta">'+e(IDX.datasets[ds])+'. Maksettu euroa vuodessa. Korkein '+eu(mx)+(s[s.length-1][5]<12?'. Viimeisen vuoden luku on keskeneräinen.':'.')+'</p><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:10px"><polyline fill="none" stroke="currentColor" stroke-width="2" points="'+pts+'"/>'+lb+'<text x="'+P+'" y="12" font-size="10" fill="currentColor">'+milj(mx)+'</text></svg>';kg.scrollIntoView({behavior:"smooth"})}
}
function csv(d){var L=["Tietosarja;Etuus;Vuosi;Maksettu euroa;Saajia;Kuukausia"];
d.r.forEach(function(r){L.push([IDX.datasets[r[0]],IDX.labels[r[2]],r[1],r[3],r[4],r[5]].map(function(v){return'"'+String(v).replace(/"/g,'""')+'"'}).join(";"))});
var b=new Blob(["\ufeff"+L.join("\n")],{type:"text/csv;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="kela-"+d.n.toLowerCase().replace(/[^a-zåäö0-9]+/g,"-")+".csv";document.body.appendChild(a);a.click();a.remove()}
})()</script>`;

export function kelaPages({ shell, esc }) {
  const body = `<h1>Kela kunnassasi</h1><p>Kirjoita kunnan nimi ja näet, paljonko Kela on maksanut siellä etuuksia ja eläkkeitä, vuosi vuodelta. Tiedot ovat Kelan avointa dataa, joka on laskettu yhteen kunnittain: yli 160 miljoonaa riviä, 29 tietosarjaa.</p>
<style>#kh input[type=search]{width:100%;font-size:16px;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);box-sizing:border-box}#kh select,#kh .tb button{font-size:16px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer}#kh .tb{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#kh a.nd{display:block;padding:10px 4px;cursor:pointer;border-bottom:1px solid var(--line)}#kh summary{padding:10px 0;cursor:pointer}#kh table{width:100%;border-collapse:collapse}#kh td,#kh th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left}#kh .n{text-align:right;white-space:nowrap}</style>
<div id="kh"></div>${JS}
<div class="note"><b>Tarvitsetko tämän datan omaan käyttöösi?</b><br>Toimittajille, järjestöille, kunnille ja yrityksille teemme räätälöityjä raportteja ja kuntavertailuja. Ota yhteyttä: <a href="mailto:miika@eduskuntaseuranta.fi">miika@eduskuntaseuranta.fi</a></div>`;
  return [{ path: "/kela/", html: shell({ title: "Kela kunnassasi | Eduskuntaseuranta", desc: "Paljonko Kela maksaa sinun kunnassasi? Etuudet ja eläkkeet kunnittain ja vuosittain Kelan avoimesta datasta.", path: "/kela/", body }) }];
}
