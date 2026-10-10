// Seuranta: kirjautunut käyttäjä voi seurata aihetta tai edustajaa. Hälytykset lähetetään myöhemmin sähköpostilla.
import { esJs } from "./auth.mjs";

const NOTE = "Seuranta tallennetaan tiliisi. Sähköpostihälytysten lähettäminen käynnistyy pian.";

export function followBlock({ tyyppi, kohde, nimi, osoite, SB, KEY }) {
  const j = JSON.stringify;
  return `<div class="fw" style="margin:14px 0"><button type="button" id="fb" style="background:#2a5db0">Seuraa</button> <span class="meta" id="fm"></span></div>
<script>${esJs(SB, KEY)}
(function(){
var T=${j(tyyppi)},K=${j(String(kohde))},N=${j(nimi)},O=${j(osoite)};
var b=document.getElementById("fb"),m=document.getElementById("fm"),cur=null,on=false;
function paint(){b.textContent=!cur?"Kirjaudu ja seuraa":(on?"✓ Seuraat":"Seuraa");b.style.background=on?"#2f7d4f":"#2a5db0";
 m.textContent=on?"${NOTE} Hallitse seurantoja: /seuranta/":"";}
b.onclick=function(){
 if(!cur){location.href="/kirjaudu/";return}
 b.disabled=true;
 var q="seurannat?tyyppi=eq."+T+"&kohde=eq."+encodeURIComponent(K);
 var p=on?ES.rest("DELETE",q,cur.token):ES.rest("POST","seurannat",cur.token,{tyyppi:T,kohde:K,nimi:N,osoite:O},{Prefer:"return=minimal"});
 p.then(function(r){b.disabled=false;
  if(r.ok||(r.data&&r.data.code==="23505")){on=!on;paint()}
  else{m.textContent=(r.data&&r.data.message&&r.data.message.indexOf("50")>-1)?"Seurantoja voi olla enintään 50.":"Tallennus epäonnistui. Yritä uudelleen."}})};
ES.session().then(function(s){cur=s;if(!s){paint();return}
 ES.rest("GET","seurannat?select=id&tyyppi=eq."+T+"&kohde=eq."+encodeURIComponent(K),s.token).then(function(r){on=!!(r.ok&&r.data&&r.data.length);paint()})});
paint();
})();</script>`;
}

export function followPages({ shell, esc, SB, KEY }) {
  const body = `<h1>Seurantani</h1>
<p>Tähän tulevat aiheet ja kansanedustajat, joita seuraat. ${NOTE}</p>
<div id="sl"><p class="note" id="sm">Ladataan...</p></div>
<p class="note">Seuraa aihetta tai edustajaa painamalla "Seuraa" aihe- tai edustajasivulla. Seurantoja voi olla enintään 50. Seurannan voi poistaa milloin tahansa.</p>
<script>${esJs(SB, KEY)}
(function(){
var sm=document.getElementById("sm"),box=document.getElementById("sl");
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x)e.textContent=x;return e}
function draw(rows,s){box.textContent="";
 if(!rows.length){box.appendChild(el("p","note","Et seuraa vielä mitään. Valitse aihe tai edustaja ja paina Seuraa."));var a=el("a","","Selaa aiheita");a.href="/aiheet/";box.appendChild(a);return}
 rows.forEach(function(r){var c=el("div","card");var l=el("a","",r.nimi);l.href=r.osoite;c.appendChild(l);
  c.appendChild(el("div","meta",r.tyyppi==="aihe"?"Aihe":"Kansanedustaja"));
  var d=el("button","","Lopeta seuranta");d.type="button";d.onclick=function(){d.disabled=true;ES.rest("DELETE","seurannat?id=eq."+r.id,s.token).then(load)};c.appendChild(d);box.appendChild(c)})}
var cs=null;
function load(){ES.rest("GET","seurannat?select=id,tyyppi,nimi,osoite&order=luotu.desc",cs.token).then(function(r){
 if(!r.ok){box.textContent="";box.appendChild(el("p","note","Seurantoja ei voitu ladata."));return}draw(r.data,cs)})}
ES.session().then(function(s){cs=s;
 if(!s){box.textContent="";var p=el("p");var a=el("a","","Kirjaudu sisään");a.href="/kirjaudu/";p.appendChild(a);p.appendChild(document.createTextNode(" nähdäksesi seurantasi."));box.appendChild(p);return}
 load()});
})();</script>`;
  return [{ path: "/seuranta/", html: shell({ title: "Seurantani | Eduskuntaseuranta", desc: "Seuraa aiheita ja kansanedustajia.", path: "/seuranta/", body }) }];
}
