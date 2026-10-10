// Kirjautuminen sähköpostilinkillä (Supabase Auth REST) ja kommentit. Ei supabase-js-kirjastoa.
export const ACCT_JS = `<script>(function(){try{var n=localStorage.getItem("es_nick"),a=document.getElementById("acct");if(a&&n){a.textContent=n;a.href="/kirjaudu/"}}catch(e){}})()</script>`;

function esJs(SB, KEY) {
  return `var ES=(function(SB,KEY){
var K="es_sess";
function load(){try{return JSON.parse(localStorage.getItem(K))}catch(e){return null}}
function save(s){try{if(s)localStorage.setItem(K,JSON.stringify(s));else localStorage.removeItem(K)}catch(e){}}
function now(){return Math.floor(Date.now()/1000)}
function claims(t){try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))}catch(e){return {}}}
function hdr(t){return {apikey:KEY,Authorization:"Bearer "+(t||KEY),"Content-Type":"application/json"}}
function hashSession(){var h=location.hash;if(h.indexOf("access_token=")<0)return null;var p=new URLSearchParams(h.slice(1)),at=p.get("access_token");if(!at)return null;
 var s={access_token:at,refresh_token:p.get("refresh_token"),expires_at:+p.get("expires_at")||now()+(+p.get("expires_in")||3600)};
 try{history.replaceState(null,"",location.pathname)}catch(e){}return s}
function session(){
 var s=hashSession();if(s)save(s);else s=load();
 if(!s||!s.access_token)return Promise.resolve(null);
 function out(x){var c=claims(x.access_token);return {token:x.access_token,uid:c.sub,email:c.email||""}}
 if(s.expires_at-60>now())return Promise.resolve(out(s));
 if(!s.refresh_token){save(null);return Promise.resolve(null)}
 return fetch(SB+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:hdr(),body:JSON.stringify({refresh_token:s.refresh_token})}).then(function(r){return r.json().then(function(d){
  if(!r.ok||!d.access_token){save(null);return null}
  var n={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:now()+(d.expires_in||3600)};save(n);return out(n)})}).catch(function(){return null})}
function rest(method,path,tok,body,extra){
 var h=hdr(tok);if(extra)for(var k in extra)h[k]=extra[k];
 return fetch(SB+"/rest/v1/"+path,{method:method,headers:h,body:body?JSON.stringify(body):undefined}).then(function(r){
  return r.text().then(function(t){var d=null;try{d=t?JSON.parse(t):null}catch(e){}return {ok:r.ok,status:r.status,data:d}})})}
function otp(email,redirect){
 return fetch(SB+"/auth/v1/otp?redirect_to="+encodeURIComponent(redirect),{method:"POST",headers:hdr(),body:JSON.stringify({email:email,create_user:true})}).then(function(r){
  return r.text().then(function(t){var d={};try{d=JSON.parse(t)}catch(e){}return {ok:r.ok,data:d}})})}
function hashError(){var h=location.hash;if(h.indexOf("error")<0)return "";var p=new URLSearchParams(h.slice(1));return p.get("error_description")||p.get("error")||""}
return {session:session,rest:rest,otp:otp,signOut:function(){save(null)},hashError:hashError};
})(${JSON.stringify(SB)},${JSON.stringify(KEY)});`;
}

export function authPages({ shell, esc, SB, KEY }) {
  const css = `<style>.af label{display:block;margin:14px 0 4px;font-size:14px}.af input,.af textarea{width:100%;box-sizing:border-box;font:inherit;color:#fff;background:#1b1b1b;border:1px solid #333;border-radius:10px;padding:10px}.af textarea{min-height:90px}.af button{margin-top:14px;background:#2a5db0}#am{margin:12px 0;color:#9ad}#am.err{color:#f99}.af small{color:#999}</style>`;
  const body = `<h1>Kirjaudu</h1>
<p>Kirjautuminen tapahtuu sähköpostilinkillä. Salasanaa ei tarvita. Kirjautuneena voit kommentoida ja kirjoittaa oman vieraskynäsi.</p>
<div id="lo" class="af" style="display:none">
<form id="lf"><label for="em">Sähköpostiosoite</label><input id="em" type="email" required autocomplete="email" placeholder="nimi@example.com"><button type="submit">Lähetä kirjautumislinkki</button></form>
<p class="note">Saat viestin, jossa on linkki. Linkin painaminen kirjaa sinut sisään. Tarkista tarvittaessa roskaposti. Sähköpostiosoitettasi ei näytetä muille.</p>
</div>
<div id="li" class="af" style="display:none">
<p>Kirjautunut: <b id="who"></b></p>
<form id="pf">
<label for="nm">Nimimerkki (osoitteeseen, 3–30 merkkiä: a–z, 0–9 ja viiva)</label><input id="nm" required maxlength="30" pattern="[a-z0-9\\-]{3,30}" placeholder="esim. matti-m">
<label for="dn">Näytettävä nimi</label><input id="dn" required minlength="2" maxlength="60" placeholder="Oma nimi suositeltu">
<small>Suosittelen oikeaa nimeä, koska se tekee keskustelusta luotettavampaa. Nimimerkki on sallittu.</small>
<label for="ku">Esittely (vapaaehtoinen)</label><textarea id="ku" maxlength="500"></textarea>
<button type="submit">Tallenna profiili</button>
</form>
<p><button id="out" type="button">Kirjaudu ulos</button></p>
</div>
<p id="am">Ladataan...</p>
<p class="note">Kirjautuminen tallentaa sähköpostiosoitteesi ja profiilitietosi Supabase-palveluun (EU). Voit pyytää tietojesi poistamista osoitteella miika@eduskuntaseuranta.fi.</p>
<script>${esJs(SB, KEY)}
(function(){
var $=function(i){return document.getElementById(i)},am=$("am"),cur=null,have=false;
function msg(t,e){am.textContent=t;am.className=e?"err":""}
function show(s){
 cur=s;$("lo").style.display=s?"none":"block";$("li").style.display=s?"block":"none";
 if(!s){try{localStorage.removeItem("es_nick")}catch(e){}return}
 $("who").textContent=s.email;
 ES.rest("GET","profiilit?select=*&id=eq."+s.uid,s.token).then(function(r){
  var p=r.ok&&r.data&&r.data[0];have=!!p;
  if(p){$("nm").value=p.nimimerkki;$("dn").value=p.nayttonimi;$("ku").value=p.kuvaus||"";try{localStorage.setItem("es_nick",p.nayttonimi)}catch(e){}}
  else msg("Valitse nimimerkki ja näytettävä nimi, niin profiilisi on valmis.")})}
$("lf").addEventListener("submit",function(e){e.preventDefault();var b=e.target.querySelector("button");b.disabled=true;msg("Lähetetään...");
 ES.otp($("em").value.trim(),location.origin+"/kirjaudu/").then(function(r){b.disabled=false;
  if(!r.ok){msg("Lähetys epäonnistui: "+((r.data&&(r.data.msg||r.data.error_description||r.data.message))||"yritä myöhemmin"),1)}else msg("Linkki lähetetty. Avaa sähköpostisi ja paina linkkiä.")})});
$("nm").addEventListener("input",function(){this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,"")});
$("pf").addEventListener("submit",function(e){e.preventDefault();if(!cur){msg("Kirjaudu ensin sisään.",1);return}msg("Tallennetaan...");
 var row={nimimerkki:$("nm").value.trim().toLowerCase(),nayttonimi:$("dn").value.trim(),kuvaus:$("ku").value.trim()||null};
 var q=have?ES.rest("PATCH","profiilit?id=eq."+cur.uid,cur.token,row,{Prefer:"return=minimal"}):ES.rest("POST","profiilit",cur.token,Object.assign({id:cur.uid},row),{Prefer:"return=minimal"});
 q.then(function(r){
  if(!r.ok){msg(r.data&&r.data.code==="23505"?"Nimimerkki on jo käytössä. Valitse toinen.":"Tallennus epäonnistui: "+((r.data&&r.data.message)||r.status),1)}
  else{have=true;try{localStorage.setItem("es_nick",$("dn").value.trim())}catch(e){}msg("Profiili tallennettu.")}})});
$("out").onclick=function(){ES.signOut();show(null);msg("Kirjauduit ulos.")};
var he=ES.hashError();
ES.session().then(function(s){show(s);if(he&&!s)msg("Kirjautumislinkki on vanhentunut tai jo käytetty. Pyydä uusi linkki.",1);else if(!am.textContent||am.textContent==="Ladataan...")msg("")});
})();</script>`;
  return [{ path: "/kirjaudu/", html: shell({ title: "Kirjaudu | Eduskuntaseuranta", desc: "Kirjaudu sähköpostilinkillä ja luo oma profiili.", path: "/kirjaudu/", head: css, body }) }];
}

// Kommenttiosio: näytetään äänestys-, edustaja-, viikkokatsaus-, blogi- ja vieraskynäsivuilla.
export function commentsWanted(path) {
  return /^\/(aanestys|edustaja|viikko|blogi|vieraskyna)\/[^/]+\/$/.test(path) && path !== "/vieraskyna/kirjoita/";
}

export function commentsBlock({ path, SB, KEY }) {
  const css = `<style>#kom{margin-top:32px;border-top:1px solid #2a2a2a;padding-top:8px}.kc{background:#1b1b1b;border-radius:12px;padding:12px 14px;margin:10px 0}.kc .kh{font-size:13px;color:#999;margin-bottom:4px}.kc .kt{white-space:pre-wrap;overflow-wrap:anywhere}.kc button{background:none;color:#999;padding:2px 0;margin-right:14px;font-size:13px;border-radius:0}#kf textarea{width:100%;box-sizing:border-box;font:inherit;color:#fff;background:#1b1b1b;border:1px solid #333;border-radius:10px;padding:10px;min-height:90px}#kf button{margin-top:8px;background:#2a5db0}#km{margin:8px 0;color:#9ad}#km.err{color:#f99}</style>`;
  return `${css}<section id="kom"><h2>Keskustelu</h2>
<div id="kf"></div><p id="km"></p><div id="kl"><p class="note">Ladataan kommentteja...</p></div>
<p class="note">Kommentit julkaistaan heti, eikä niitä tarkisteta etukäteen. Kommentoija vastaa itse kirjoituksestaan. Jos kommentti rikkoo lakia (esimerkiksi uhkailu, kunnianloukkaus tai vihapuhe), paina Ilmianna. Kun kolme lukijaa on ilmiantanut kommentin, se piilotetaan automaattisesti, ja poistan selvästi laittoman sisällön viipymättä. Voit myös kirjoittaa osoitteeseen miika@eduskuntaseuranta.fi.</p></section>
<script>${esJs(SB, KEY)}
(function(){
var PATH=${JSON.stringify(path)};
var $=function(i){return document.getElementById(i)},km=$("km"),cur=null,hasProf=false;
function msg(t,e){km.textContent=t;km.className=e?"err":""}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x)e.textContent=x;return e}
function list(){
 ES.rest("GET","kommentit?select=id,teksti,luotu,profiili_id,profiilit(nayttonimi)&sivu=eq."+encodeURIComponent(PATH)+"&order=luotu.asc",cur&&cur.token).then(function(r){
  var box=$("kl");box.textContent="";
  if(!r.ok){box.appendChild(el("p","note","Kommentteja ei voitu ladata."));return}
  if(!r.data.length){box.appendChild(el("p","note","Ei vielä kommentteja. Kirjoita ensimmäinen."));return}
  r.data.forEach(function(k){
   var c=el("div","kc"),h=el("div","kh",(k.profiilit?k.profiilit.nayttonimi:"Käyttäjä")+" · "+new Date(k.luotu).toLocaleString("fi-FI",{dateStyle:"short",timeStyle:"short"}));
   c.appendChild(h);c.appendChild(el("div","kt",k.teksti));
   var b=el("button","","Ilmianna");b.type="button";b.onclick=function(){report(k.id)};c.appendChild(b);
   if(cur&&cur.uid===k.profiili_id){var d=el("button","","Poista");d.type="button";d.onclick=function(){del(k.id)};c.appendChild(d)}
   box.appendChild(c)})})}
function report(id){
 if(!cur){msg("Kirjaudu sisään ilmiantaaksesi kommentin.",1);return}
 if(!confirm("Ilmiannetaanko kommentti lainvastaisena?"))return;
 ES.rest("POST","ilmiannot",cur.token,{kommentti_id:id,ilmoittaja:cur.uid},{Prefer:"return=minimal"}).then(function(r){
  if(!r.ok){msg(r.data&&r.data.code==="23505"?"Olet jo ilmiantanut tämän kommentin.":"Ilmianto epäonnistui.",1)}else{msg("Kiitos ilmiannosta.");list()}})}
function del(id){if(!confirm("Poistetaanko kommentti?"))return;ES.rest("DELETE","kommentit?id=eq."+id,cur.token).then(function(){list()})}
function form(){
 var f=$("kf");f.textContent="";
 if(!cur){var p=el("p");var a=el("a","","Kirjaudu sisään");a.href="/kirjaudu/";p.appendChild(a);p.appendChild(document.createTextNode(" kommentoidaksesi. Kirjautuminen tapahtuu sähköpostilinkillä, salasanaa ei tarvita."));f.appendChild(p);return}
 if(!hasProf){var p2=el("p");var a2=el("a","","Luo ensin profiili");a2.href="/kirjaudu/";p2.appendChild(a2);p2.appendChild(document.createTextNode(" (nimimerkki ja näytettävä nimi), niin voit kommentoida."));f.appendChild(p2);return}
 var ta=el("textarea");ta.maxLength=2000;ta.placeholder="Kirjoita kommentti (2–2000 merkkiä)";
 var b=el("button","","Lähetä kommentti");b.type="button";
 b.onclick=function(){var t=ta.value.trim();if(t.length<2){msg("Kommentti on liian lyhyt.",1);return}
  b.disabled=true;msg("Lähetetään...");
  ES.rest("POST","kommentit",cur.token,{sivu:PATH,profiili_id:cur.uid,teksti:t},{Prefer:"return=minimal"}).then(function(r){
   b.disabled=false;if(!r.ok){msg(r.data&&r.data.message&&r.data.message.indexOf("tunnissa")>-1?"Liian monta kommenttia tunnissa. Yritä myöhemmin.":"Lähetys epäonnistui.",1)}else{ta.value="";msg("");list()}})};
 f.appendChild(ta);f.appendChild(b)}
form();list();
ES.session().then(function(s){cur=s;
 if(!cur){form();return}
 ES.rest("GET","profiilit?select=id&id=eq."+cur.uid,cur.token).then(function(r){hasProf=!!(r.ok&&r.data&&r.data.length);form();list()})});
})();</script>`;
}
