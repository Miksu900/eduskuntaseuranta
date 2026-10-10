// Kirjautuminen sähköpostilinkillä (Supabase Auth) ja oma profiili.
export const ACCT_JS = `<script>(function(){try{var n=localStorage.getItem("es_nick"),a=document.getElementById("acct");if(a&&n){a.textContent=n;a.href="/kirjaudu/"}}catch(e){}})()</script>`;

export function authPages({ shell, esc, SB, KEY }) {
  const css = `<style>.af label{display:block;margin:14px 0 4px;font-size:14px}.af input,.af textarea{width:100%;box-sizing:border-box;font:inherit;color:#fff;background:#1b1b1b;border:1px solid #333;border-radius:10px;padding:10px}.af textarea{min-height:90px}.af button{margin-top:14px;background:#2a5db0}.af .hp{position:absolute;left:-9999px}#am{margin:12px 0;color:#9ad}#am.err{color:#f99}.af small{color:#999}</style>`;
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
<p id="am"></p>
<p class="note">Kirjautuminen tallentaa sähköpostiosoitteesi ja profiilitietosi Supabase-palveluun (EU). Voit pyytää tietojesi poistamista osoitteella miika@eduskuntaseuranta.fi.</p>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js"></script>
<script>(function(){
var sb=supabase.createClient(${JSON.stringify(SB)},${JSON.stringify(KEY)});
var $=function(i){return document.getElementById(i)},am=$("am");
function msg(t,e){am.textContent=t;am.className=e?"err":""}
var cur=null,have=false;
function show(s){
 cur=s;
 $("lo").style.display=s?"none":"block";$("li").style.display=s?"block":"none";
 if(!s){try{localStorage.removeItem("es_nick")}catch(e){}return}
 $("who").textContent=s.user.email;
 sb.from("profiilit").select("*").eq("id",s.user.id).maybeSingle().then(function(r){
  var p=r.data;have=!!p;if(p){$("nm").value=p.nimimerkki;$("dn").value=p.nayttonimi;$("ku").value=p.kuvaus||"";try{localStorage.setItem("es_nick",p.nayttonimi)}catch(e){}}
  else msg("Valitse nimimerkki ja näytettävä nimi, niin profiilisi on valmis.")
 });
}
$("lf").addEventListener("submit",function(e){e.preventDefault();var b=e.target.querySelector("button");b.disabled=true;msg("Lähetetään...");
 sb.auth.signInWithOtp({email:$("em").value.trim(),options:{emailRedirectTo:location.origin+"/kirjaudu/"}}).then(function(r){
  b.disabled=false;if(r.error){msg("Lähetys epäonnistui: "+r.error.message,1)}else msg("Linkki lähetetty. Avaa sähköpostisi ja paina linkkiä.")})});
$("nm").addEventListener("input",function(){this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,"")});
$("pf").addEventListener("submit",function(e){e.preventDefault();if(!cur){msg("Kirjaudu ensin sisään.",1);return}msg("Tallennetaan...");
 var t=setTimeout(function(){msg("Tallennus kestää liian kauan. Lataa sivu uudelleen ja yritä uudelleen.",1)},15000);
 var row={nimimerkki:$("nm").value.trim().toLowerCase(),nayttonimi:$("dn").value.trim(),kuvaus:$("ku").value.trim()||null};
 var q=have?sb.from("profiilit").update(row).eq("id",cur.user.id):sb.from("profiilit").insert(Object.assign({id:cur.user.id},row));
 q.then(function(r){
  clearTimeout(t);
  if(r.error){msg(r.error.code==="23505"?"Nimimerkki on jo käytössä. Valitse toinen.":"Tallennus epäonnistui: "+r.error.message,1)}
  else{have=true;try{localStorage.setItem("es_nick",$("dn").value.trim())}catch(e){}msg("Profiili tallennettu.")}})});
$("out").onclick=function(){sb.auth.signOut().then(function(){show(null);msg("Kirjauduit ulos.")})};
sb.auth.getSession().then(function(x){show(x.data.session)});
sb.auth.onAuthStateChange(function(ev,s){if(ev==="SIGNED_IN")setTimeout(function(){show(s)},0)});
})();</script>`;
  return [{ path: "/kirjaudu/", html: shell({ title: "Kirjaudu | Eduskuntaseuranta", desc: "Kirjaudu sähköpostilinkillä ja luo oma profiili.", path: "/kirjaudu/", head: css, body }) }];
}
