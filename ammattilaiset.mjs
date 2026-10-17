// Ammattilaisille: maksullisten palvelujen myyntisivu (Seuraa-hälytykset, raportit). Linkki sähköposteista ja valikosta.
const YHTEYS = "miika@eduskuntaseuranta.fi";

const PAKETIT = [
  { nimi: "Ilmainen", hinta: "0 €", jakso: "", kuvaus: "Kokeile ja pysy ajan tasalla", ominaisuudet: ["1 seurattava aihe tai hakusana", "Viikkokooste sähköpostiin", "Kaikki sivuston tiedot vapaasti"], nappi: "Aloita ilmaiseksi", href: "/kirjaudu/" },
  { nimi: "Perus", hinta: "19 €", jakso: "/kk + alv", kuvaus: "Asiantuntijalle ja yrittäjälle", ominaisuudet: ["10 aihetta, edustajaa tai hakusanaa", "Päivittäinen kooste sähköpostiin", "Eduskunta, viranomaistiedotteet ja julkiset hankinnat", "Arkisto ja haku"], nappi: "Pyydä 30 päivän kokeilu", korostus: true },
  { nimi: "Organisaatio", hinta: "79 €", jakso: "/kk + alv", kuvaus: "Liitolle, järjestölle ja yritykselle", ominaisuudet: ["Rajattomasti seurattavia", "Hälytys heti, kun aiheesta tulee jotain uutta", "Useita vastaanottajia", "Kuukausiraportti PDF:nä", "Hankintavahti omalle toimialalle"], nappi: "Pyydä tarjous ja kokeilu" },
];

const LAHTEET = [
  ["Eduskunta", "Täysistuntojen äänestykset, hallituksen esitykset ja niiden käsittely"],
  ["Viranomaistiedotteet", "Ministeriöiden, virastojen ja kaupunkien tiedotteet ja kuulutukset"],
  ["Julkiset hankinnat", "Hilman hankinta- ja jälki-ilmoitukset: tarjouskilpailut ja voittajat"],
  ["Yritysten tiedotteet", "STT Infon tiedotteet ja pörssitiedotteet"],
  ["Lait ja lobbaus", "Finlex, avoimuusrekisteri ja vaalirahoitus"],
];

const KENELLE = [
  ["Liitot ja etujärjestöt", "Tiedätte heti, kun jäsenistöänne koskeva asia etenee eduskunnassa tai ministeriössä."],
  ["Yritykset", "Uudet tarjouskilpailut omalta alalta ja päätökset, jotka vaikuttavat liiketoimintaan."],
  ["Viestintä- ja PA-toimistot", "Asiakkaiden aiheiden seuranta ilman käsityötä, valmis raportti asiakkaalle."],
  ["Kunnat ja päättäjät", "Mitä valtio, eduskunta ja naapurikunnat päättävät teitä koskevista asioista."],
  ["Toimittajat ja tutkijat", "Kaikki päätökset ja tiedotteet yhdestä paikasta, haettavana ja lähteineen."],
];

export function ammattilaisetPages({ shell, esc }) {
  const mail = (aihe, runko) => `mailto:${YHTEYS}?subject=${encodeURIComponent(aihe)}&body=${encodeURIComponent(runko)}`;
  const kortit = PAKETIT.map(p => {
    const href = p.href || mail(`${p.nimi}: kokeilu`, `Hei,\n\nhaluaisin kokeilla Eduskuntaseurannan ${p.nimi}-palvelua.\n\nOrganisaatio:\nSeurattavat aiheet (esim. laki, ala, kunta, yritys):\nVastaanottajien määrä:\n\nTerveisin,\n`);
    return `<div class="card pk${p.korostus ? " on" : ""}"><div class="pn">${esc(p.nimi)}</div><div class="ph">${esc(p.hinta)}<small>${esc(p.jakso)}</small></div><div class="meta">${esc(p.kuvaus)}</div><ul>${p.ominaisuudet.map(o => `<li>${esc(o)}</li>`).join("")}</ul><a class="btn${p.korostus ? " on" : ""}" href="${href}">${esc(p.nappi)}</a></div>`;
  }).join("");
  const css = `<style>.pks{display:grid;gap:12px;margin:18px 0}@media(min-width:760px){.pks{grid-template-columns:repeat(3,1fr)}}
.pk{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line)!important}.pk.on{border-color:#2a5db0!important;box-shadow:0 0 0 1px #2a5db0}
.pn{font-weight:700;font-size:15px}.ph{font-size:30px;font-weight:800;letter-spacing:-.02em}.ph small{font-size:13px;font-weight:500;color:var(--mute);margin-left:4px}
.pk ul{margin:8px 0 12px;padding-left:18px;line-height:1.55;font-size:14.5px;flex:1}.pk .btn{text-align:center;text-decoration:none}
.two{display:grid;gap:10px}@media(min-width:760px){.two{grid-template-columns:1fr 1fr}}.hero{font-size:17px;line-height:1.55}</style>`;
  const body = `${css}<h1>Ammattilaisille: tiedä ensimmäisenä, kun päätöksiä tehdään</h1>
<p class="hero">Eduskuntaseuranta kokoaa eduskunnan äänestykset, viranomaisten tiedotteet, julkiset hankinnat ja lait yhteen paikkaan. <b>Seuraa-hälytykset</b> kertovat sähköpostilla, kun teille tärkeästä aiheesta tapahtuu jotain uutta. Teidän ei tarvitse käydä kymmeniä sivuja läpi itse.</p>
<div class="pks">${kortit}</div>
<h2>Mistä hälytykset tulevat</h2><div class="two">${LAHTEET.map(([a, b]) => `<div class="card"><b>${esc(a)}</b><div class="meta">${esc(b)}</div></div>`).join("")}</div>
<h2>Kenelle</h2><div class="two">${KENELLE.map(([a, b]) => `<div class="card"><b>${esc(a)}</b><div class="meta">${esc(b)}</div></div>`).join("")}</div>
<h2>Räätälöidyt raportit</h2><p>Tarvitsetteko koosteen tietystä aiheesta, esimerkiksi kaikki aihetta koskevat äänestykset, tiedotteet ja hankinnat vuodelta 2026, tai vertailun kunnista, puolueista tai edustajista? Teen sen kertatyönä, hinta alkaen 200 € + alv.</p>
<p><a class="btn on" href="${mail("Raporttipyyntö", "Hei,\n\ntarvitsisimme raportin aiheesta:\n\nAikaväli:\nKäyttötarkoitus:\nAikataulu:\n\nTerveisin,\n")}">Pyydä raportti</a></p>
<div class="note"><b>Luvut puolueettomia.</b> Kaikki tieto tulee virallisista avoimista lähteistä, ja jokaisessa hälytyksessä on linkki alkuperäiseen lähteeseen. Palvelua ylläpitää Miika Koskela, yhteys <a href="mailto:${YHTEYS}">${YHTEYS}</a>.</div>`;
  return [{ path: "/ammattilaisille/", html: shell({ title: "Ammattilaisille: hälytykset eduskunnasta, viranomaisilta ja hankinnoista | Eduskuntaseuranta", desc: "Seuraa-hälytykset sähköpostiin: eduskunnan äänestykset, viranomaistiedotteet ja julkiset hankinnat omista aiheistanne. Liitoille, yrityksille ja viestintätoimistoille.", path: "/ammattilaisille/", body }) }];
}
