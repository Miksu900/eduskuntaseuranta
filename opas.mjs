// opas.mjs - /opas/: ilmainen opas "Oma datasivu ilman koodaustaitoa, vain puhelimella".
// Ilmainen osa: kokonaiskuva + moduulit 1-2. Moduulit 3-6 kuvataan, ohjeet ovat PDF:ssä.

const TITLE = "Oma datasivu ilman koodaustaitoa, vain puhelimella";

const CSS = `<style>.opas h2{margin-top:34px}.opas h3{margin-top:22px}.opas ol,.opas ul{padding-left:22px;line-height:1.6}.opas li{margin:6px 0}.chk{list-style:none;padding-left:0!important}.chk li{padding-left:2px}.lock{background:var(--surface);border-radius:14px;padding:14px 16px;margin:14px 0}.lock b{display:block;margin-bottom:4px}.mods{counter-reset:m;list-style:none;padding-left:0!important}.mods li{background:var(--surface);border-radius:14px;padding:12px 14px;margin:10px 0}.mods li b{display:block}</style>`;

export function opasPages({ shell, esc }) {
  const body = CSS + `<div class="opas">
<h1>${esc(TITLE)}</h1>
<p>Tämä opas näyttää, miten teet oman datasivun, joka päivittyy itsestään. Tarvitset vain puhelimen. Esimerkkiprojektina on yksi pieni sivu: <b>pörssisähkön hinta nyt</b>.</p>
<p>Tässä ei rakenneta mitään jättimäistä. Tarkoitus on, että ymmärrät koko ketjun yhdellä pienellä esimerkillä: mistä data tulee, miten se päätyy sivulle ja miten sivu pysyy ajan tasalla ilman, että teet mitään käsin.</p>

<h2>Mitä saat valmiiksi</h2>
<ul>
<li>oma verkkosivu, jolla on oma osoite</li>
<li>sivu, joka näyttää oikeaa, avointa dataa</li>
<li>sivu, joka päivittyy automaattisesti useita kertoja päivässä</li>
<li>maksuton pohja: sivun pitäminen verkossa ei maksa mitään</li>
</ul>

<h2>Opas on kuusi lyhyttä osaa</h2>
<ol class="mods">
<li><b>1. Mitä tarvitset</b>Ilmainen. Luet tässä.</li>
<li><b>2. Idea ja yksi datalähde</b>Ilmainen. Luet tässä.</li>
<li><b>3. Sivu verkkoon</b>Ensimmäinen sivu verkkoon omalla osoitteella: ilmainen, luet tässä. Automaattinen julkaisu on PDF-oppaassa.</li>
<li><b>4. Data sivulle</b>Datan tuonti sivulle ja sen näyttäminen selkeästi. PDF-oppaassa.</li>
<li><b>5. Päivitys automaattiseksi</b>Sivu päivittyy itsestään, ilman että avaat mitään. PDF-oppaassa.</li>
<li><b>6. Mihin tämä kasvaa ja miten datasta tulee asiakkaita</b>Miten pieni sivu muuttuu isommaksi, ja miten sillä ansaitaan. PDF-oppaassa.</li>
</ol>

<h2>Osa 1. Mitä tarvitset</h2>
<p><b>Tavoite:</b> sinulla on kaikki valmiina ennen kuin aloitat.</p>
<ul class="chk">
<li>☐ puhelin, jossa on nettiselain</li>
<li>☐ sähköpostiosoite</li>
<li>☐ ilmainen GitHub-tili</li>
<li>☐ noin tunti aikaa per osa, ei tarvitse tehdä kaikkea yhdessä illassa</li>
</ul>
<p>Rahaa et tarvitse. Koodaustaitoa et tarvitse.</p>
<h3>GitHub-tilin teko</h3>
<p>GitHub on paikka, jossa sivusi tiedostot säilytetään ja josta sivu julkaistaan. Se on ilmainen.</p>
<ol>
<li>Avaa puhelimen selaimella <b>github.com</b>.</li>
<li>Paina <b>Sign up</b>.</li>
<li>Anna sähköpostiosoite, keksi salasana ja käyttäjänimi. Käyttäjänimi tulee näkyviin sivusi osoitteeseen, joten valitse sellainen, jonka kehtaat näyttää muille.</li>
<li>Vahvista sähköpostisi. GitHub lähettää koodin tai linkin.</li>
<li>Kirjaudu sisään ja tarkista, että näet GitHubin etusivun.</li>
</ol>
<div class="note"><b>Vinkki:</b> kirjoita salasana ylös turvalliseen paikkaan. Älä kerro sitä kenellekään, älä myöskään keskusteluissa tai kommenteissa.</div>
<p><b>Tarkistuslista:</b></p>
<ul class="chk">
<li>☐ Pääsen kirjautumaan GitHubiin puhelimella</li>
<li>☐ Tiedän käyttäjänimeni</li>
<li>☐ Salasana on tallessa</li>
</ul>

<h2>Osa 2. Idea ja yksi datalähde</h2>
<p><b>Tavoite:</b> valitset aiheen ja löydät datan, jota voit käyttää.</p>
<h3>Hyvä idea on kysymys, jonka ihmiset oikeasti esittävät</h3>
<p>Älä aloita "mitä dataa on?" vaan "mitä ihmiset haluavat tietää?" Esimerkiksi:</p>
<ul>
<li>Paljonko sähkö maksaa nyt?</li>
<li>Paljonko Kela maksaa minun kunnassani?</li>
<li>Mihin valtion raha menee?</li>
</ul>
<p>Hyvässä ideassa kysymykseen vastaus muuttuu ajan myötä, joten ihmiset palaavat sivulle uudelleen.</p>

<h3>Neljä testiä datalähteelle</h3>
<p>Ennen kuin rakennat mitään, tarkista nämä:</p>
<ol>
<li><b>Avoin:</b> data aukeaa ilman kirjautumista.</li>
<li><b>Koneluettava:</b> sille on osoite, josta saa tiedoston (yleensä JSON tai CSV), ei vain sivu, jota luetaan silmillä.</li>
<li><b>Päivittyy:</b> lähde saa uutta dataa säännöllisesti.</li>
<li><b>Lupa:</b> lähteen ehdot sallivat käytön. Katso sivulta "käyttöehdot" tai "lisenssi". Moni julkinen aineisto on CC BY 4.0 -lisenssillä, jolloin lähde pitää mainita.</li>
</ol>
<h3>Mistä dataa löytyy</h3>
<ul>
<li><a href="https://www.avoindata.fi/" rel="noopener">avoindata.fi</a>: suomalaisten viranomaisten avoimia aineistoja</li>
<li><a href="https://pxdata.stat.fi/" rel="noopener">Tilastokeskus</a>: tilastoja</li>
<li><a href="https://data.fingrid.fi/" rel="noopener">Fingrid</a>: sähköjärjestelmän dataa</li>
</ul>

<h3>Esimerkki: pörssisähkön hinta</h3>
<p>Esimerkkiprojektimme data tulee osoitteesta:</p>
<p><code>https://api.porssisahko.net/v1/latest-prices.json</code></p>
<ol>
<li>Kopioi osoite ja avaa se puhelimen selaimessa.</li>
<li>Näet pitkän listan. Se näyttää sekavalta, mutta jokainen rivi on yksi hintajakso.</li>
<li>Kustakin jaksosta näet alkamisajan, päättymisajan ja hinnan.</li>
</ol>
<p>Se on koko dataa. Seuraavissa osissa tämä lista muutetaan siistiksi sivuksi.</p>
<div class="note"><b>Tarkista aina yksikkö:</b> lue lähteen oma kuvaus siitä, onko hinta sentteinä vai euroina ja sisältääkö se arvonlisäveron. Älä arvaa, koska väärä yksikkö tekee koko sivusta virheellisen.</div>
<p><b>Tarkistuslista:</b></p>
<ul class="chk">
<li>☐ Minulla on yksi selkeä kysymys, johon sivu vastaa</li>
<li>☐ Näen datan puhelimen selaimessa</li>
<li>☐ Tiedän, onko lähteen käyttö sallittu ja pitääkö lähde mainita</li>
<li>☐ Tiedän datan yksikön</li>
</ul>

<h2>Osa 3. Ensimmäinen sivu verkkoon</h2>
<p><b>Tavoite:</b> sinulla on oma sivu, joka näkyy internetissä omalla osoitteella. Tämä vie noin kymmenen minuuttia.</p>
<p>Alla näet, millainen esimerkkisivu on valmiina. Luvut ovat esimerkkejä, ja omalla sivullasi on oikea data.</p>
<div class="lock" aria-label="Esimerkkikuva valmiista sivusta"><b>Esimerkki: Pörssisähkön hinta nyt</b><div style="font-size:34px;font-weight:800;margin:6px 0">4,2 c/kWh</div><div class="meta">Normaali hinta</div><div style="margin-top:10px;font-size:14px"><div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="width:70px;color:var(--mute)">klo 21</span><i style="display:block;height:10px;width:20%;border-radius:5px;background:#3b82f6"></i><b style="margin-left:auto">1,3</b></div><div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="width:70px;color:var(--mute)">klo 22</span><i style="display:block;height:10px;width:38%;border-radius:5px;background:#3b82f6"></i><b style="margin-left:auto">3,1</b></div><div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="width:70px;color:var(--mute)">klo 23</span><i style="display:block;height:10px;width:60%;border-radius:5px;background:#3b82f6"></i><b style="margin-left:auto">6,0</b></div></div></div>
<h3>1. Tee repositorio</h3>
<ol>
<li>Kirjaudu GitHubiin ja paina oikeassa yläkulmassa <b>+</b>-merkkiä, sitten <b>New repository</b>.</li>
<li>Nimeksi <code>oma-datasivu</code>.</li>
<li>Valitse <b>Public</b> (julkinen). Julkisen repositorion sivu on ilmainen.</li>
<li>Rastita <b>Add a README file</b> ja paina <b>Create repository</b>.</li>
</ol>
<h3>2. Tee ensimmäinen sivu</h3>
<ol>
<li>Paina <b>Add file</b>, sitten <b>Create new file</b>.</li>
<li>Tiedoston nimeksi <code>index.html</code>.</li>
<li>Liitä kenttään tämä koodi:</li>
</ol>
<pre><code>&lt;!doctype html&gt;
&lt;html lang="fi"&gt;
&lt;head&gt;
&lt;meta charset="utf-8"&gt;
&lt;meta name="viewport" content="width=device-width,initial-scale=1"&gt;
&lt;title&gt;Oma datasivu&lt;/title&gt;
&lt;/head&gt;
&lt;body style="font:20px system-ui;padding:24px"&gt;
&lt;h1&gt;Moi, tämä on minun sivuni&lt;/h1&gt;
&lt;p&gt;Tämä sivu on nyt verkossa.&lt;/p&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
<ol start="4"><li>Paina <b>Commit changes</b> ja vielä kerran <b>Commit changes</b>.</li></ol>
<h3>3. Julkaise</h3>
<ol>
<li>Avaa repositoriossa <b>Settings</b> (jos et näe sitä, avaa ensin ylävalikko).</li>
<li>Paina vasemmasta valikosta <b>Pages</b>.</li>
<li>Kohdassa <b>Build and deployment</b> valitse <b>Source</b>-kohtaan <b>Deploy from a branch</b>. Valitse haaraksi <b>main</b> ja kansioksi <b>/ (root)</b>, ja paina <b>Save</b>.</li>
<li>Odota 1–3 minuuttia. Sivusi osoite on <code>https://KÄYTTÄJÄNIMI.github.io/oma-datasivu/</code> (vaihda KÄYTTÄJÄNIMI omaksesi). Se näkyy myös Pages-asetuksissa.</li>
</ol>
<p><b>Tarkistuslista:</b></p>
<ul class="chk">
<li>☐ Repositorio on julkinen</li>
<li>☐ Sivu aukeaa omalla osoitteellani puhelimessa</li>
</ul>
<div class="note"><b>Mitä tästä puuttuu?</b> Sivulla ei ole vielä dataa, eikä se päivity itsestään. PDF-oppaassa vaihdat julkaisun automaatioon, tuot sivulle oikean pörssisähkön hinnan ja saat sivun päivittymään kolmen tunnin välein ilman, että teet mitään.</div>

<h2>Seuraavaksi: osat 4–6 (PDF)</h2>
<div class="lock"><b>Täysi opas PDF:nä</b>Osissa 3–6 viimeistelet julkaisun automaatioksi, tuot datan sivulle, teet päivityksestä automaattisen ja pohdit, miten pienestä sivusta kasvaa tuote. PDF sisältää valmiit kopioitavat koodit, tarkistuslistat ja koko esimerkin askel askeleelta, myös viimeisen osan, joka säästää sinulta suurimman osan työstä.</div>
<p>PDF ei ole vielä myynnissä. Kerro, jos se kiinnostaa, niin tiedän, kannattaako se viimeistellä.</p>
<form class="kiinnostus" id="kiinnostus" style="border:1px solid #2a3f66;border-radius:12px;padding:16px;margin:16px 0">
<label style="display:block;margin-bottom:10px"><input type="checkbox" id="kk" required> Haluan täyden oppaan PDF:nä ja ilmoitan siitä sähköpostilla</label>
<fieldset style="border:0;padding:0;margin:0 0 12px"><legend style="margin-bottom:6px">Mikä hinta tuntuisi kohtuulliselta?</legend>
<label style="margin-right:14px;white-space:nowrap"><input type="radio" name="h" value="alle 10 €"> alle 10 €</label>
<label style="margin-right:14px;white-space:nowrap"><input type="radio" name="h" value="10–20 €"> 10–20 €</label>
<label style="margin-right:14px;white-space:nowrap"><input type="radio" name="h" value="20–30 €"> 20–30 €</label>
<label style="white-space:nowrap"><input type="radio" name="h" value="yli 30 €"> yli 30 €</label></fieldset>
<button type="submit" class="btn on">Ilmoita kiinnostus</button>
<p style="font-size:14px;margin:10px 0 0;opacity:.85">Painike avaa sähköpostisi valmiilla viestillä. Viesti lähtee vasta, kun painat siellä Lähetä. Käytän osoitettasi vain ilmoittaakseni oppaasta.</p>
</form>
<script>document.getElementById("kiinnostus").addEventListener("submit",function(e){e.preventDefault();var h=(document.querySelector('input[name=h]:checked')||{}).value||"en vastannut";location.href="mailto:miika@eduskuntaseuranta.fi?subject="+encodeURIComponent("Kiinnostaa täysi opas")+"&body="+encodeURIComponent("Haluan tiedon, kun täysi opas on valmis.\\nKohtuullinen hinta: "+h+"\\n");});</script>
</div>`;
  return [{ path: "/opas/", html: shell({ title: TITLE + " | Eduskuntaseuranta", desc: "Ilmainen opas: tee oma datasivu, joka päivittyy itsestään, pelkällä puhelimella.", path: "/opas/", body }) }];
}
