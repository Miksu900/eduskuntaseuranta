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
<li><b>3. Sivu verkkoon</b>Sivu verkkoon ilmaiseksi, omalla osoitteella. PDF-oppaassa.</li>
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

<h2>Seuraavaksi: osat 3–6</h2>
<div class="lock"><b>Täysi opas PDF:nä</b>Osissa 3–6 rakennat sivun, tuot datan sille, teet päivityksestä automaattisen ja pohdit, miten pienestä sivusta kasvaa tuote. PDF sisältää valmiit kopioitavat koodit, tarkistuslistat ja koko esimerkin askel askeleelta, myös viimeisen osan, joka säästää sinulta suurimman osan työstä.</div>
<p>PDF ei ole vielä myynnissä. Jos haluat tietää, kun se on valmis, kommentoi videolle <b>OPETA</b> tai lähetä viesti osoitteeseen <a href="mailto:miika@eduskuntaseuranta.fi">miika@eduskuntaseuranta.fi</a>.</p>
</div>`;
  return [{ path: "/opas/", html: shell({ title: TITLE + " | Eduskuntaseuranta", desc: "Ilmainen opas: tee oma datasivu, joka päivittyy itsestään, pelkällä puhelimella.", path: "/opas/", body }) }];
}
