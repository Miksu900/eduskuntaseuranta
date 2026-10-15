// etusivu.mjs - Etusivun aihelaatat (selkeämpi ja täydempi) ja pikahaku laatoista.
// build.mjs käyttää tilesHtml2()-funktiota; jos tämä epäonnistuu, build.mjs palaa vanhoihin laattoihin.

const UUSI_ASTI = Date.parse("2026-11-20T00:00:00Z"); // "Uusi"-merkki näkyy tähän asti

const IC = {
  vote: '<path d="M4 12l5 5L20 6"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  law: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9c-.5-1-1.5-1.5-2.7-1.5-1.6 0-2.6.8-2.6 2 0 3 5.6 1.5 5.6 4.5 0 1.2-1.1 2-2.8 2-1.3 0-2.4-.6-2.9-1.7M12 6v1.5M12 16.5V18"/>',
  firm: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6M8 11h.01M16 11h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  eu: '<circle cx="12" cy="12" r="9"/><path d="M12 5l1 2.5 2.6.2-2 1.7.7 2.6-2.3-1.4-2.3 1.4.7-2.6-2-1.7 2.6-.2z"/>',
  mega: '<path d="M3 11v3l12 5V6L3 11z"/><path d="M18 9a4 4 0 010 6"/>',
  city: '<path d="M3 21h18M5 21V8h6v13M13 21V4h6v17"/>',
  cart: '<path d="M3 4h3l2 12h10l2-8H7"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  kela: '<path d="M12 21s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 11c0 5.5-7 10-7 10z"/>',
  db: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
};

// [osoite, kuvake, väri, otsikko, kuvaus, hakusanat, uusi]
const TILES = [
  ["/aanestykset/", "vote", "#2f7be0", "Äänestykset", "Miten eduskunta äänesti ja kuka äänesti miten", "äänestys äänestää eduskunta jaa ei"],
  ["/edustajat/", "person", "#7c5cff", "Kansanedustajat", "Läsnäolo, äänet ja poikkeamat ryhmän linjasta", "kansanedustaja edustaja kansanedustajat mp puolue"],
  ["/budjetti/", "money", "#1fa971", "Mihin rahat menevät", "Valtion budjetti, menot, verot ja avustukset", "budjetti raha rahat menot verot verotus valtio valtion talous velka avustukset"],
  ["/lait/", "law", "#d9822b", "Lait ja asetukset", "Hae Suomen lakeja ja katso, mitä ne sanovat", "laki lait asetus finlex säädökset"],
  ["/yritykset/", "firm", "#c24d8a", "Yritykset", "Hae yritystä ja sen tietoja", "yritys yritykset y-tunnus prh firma"],
  ["/tilastot/", "chart", "#2aa7b8", "Tilastot", "Työttömyys, inflaatio, väestö ja paljon muuta", "tilasto tilastot työttömyys inflaatio väestö tulli syke"],
  ["/sahko/", "bolt", "#e0a31a", "Sähkö juuri nyt", "Pörssisähkön hinta, halvin aika ja tuotanto", "sähkö sähkön hinta pörssisähkö kulutus tuotanto fingrid energia halpa", true],
  ["/kela/", "kela", "#d9534f", "Kela kunnittain", "Paljonko Kela maksaa omassa kunnassasi", "kela etuudet tuet kunta toimeentulo eläke asumistuki", true],
  ["/eu/", "eu", "#3b4ec9", "EU", "Euroopan parlamentin äänet, meppien ja EU-rahat", "eu euroopan unioni parlamentti meppi europarlamentti rahat"],
  ["/lobbaus/", "mega", "#b84545", "Lobbaus ja vaalirahoitus", "Kuka vaikuttaa ja kuka rahoittaa", "lobbaus lobbari vaalirahoitus vaalit rahoitus vaikuttaminen"],
  ["/kunnat/", "city", "#6b8e23", "Kunnat", "Oman kuntasi luvut ja vertailu", "kunta kunnat kaupunki kuntatalous"],
  ["/hankinnat/", "cart", "#8a6bd1", "Julkiset hankinnat", "Mihin julkinen raha tilataan", "hankinnat hankinta kilpailutus hilma tarjous"],
  ["/datapankki/", "db", "#2f9e9e", "Datapankki", "Kuinka paljon dataa sivustolla on ja mistä se tulee", "data datapankki avoin data rivit lataa csv json", true],
  ["/videot/", "play", "#c2410c", "Videot", "Lyhyet videot datasta ja politiikasta", "video videot tiktok youtube", true],
  ["/opas/", "book", "#0e8a7d", "Tee oma datasivu", "Ilmainen opas: oma sivu verkkoon pelkällä puhelimella", "opas opetus ohje oma sivu verkkosivu github puhelin tee itse koodaus", true],
];

export const TILE_CSS = String.raw`
.tf{position:relative;margin:20px 0 0}
.tf input{width:100%;font:inherit;font-size:17px;color:var(--text);background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:14px 16px 14px 44px;min-height:52px}
.tf input:focus{outline:none;border-color:var(--accent)}
.tf svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:20px;height:20px;stroke:var(--mute);fill:none;stroke-width:2;stroke-linecap:round}
.tile[hidden]{display:none}
.tile .nw{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#3ddc97;color:#06281a;font-size:12px;font-weight:800;vertical-align:middle;letter-spacing:.01em}
.tnone{margin:14px 0;padding:16px;border:1px dashed var(--line);border-radius:var(--r,18px);color:var(--mute)}
.tnone button{margin-top:10px;display:block}
.skip{position:absolute;left:-999px;top:8px;background:#fff;color:#000;padding:10px 14px;border-radius:10px;z-index:50}
.skip:focus{left:8px}
`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FILTER_JS = String.raw`<script>(function(){
var i=document.getElementById("tf-q"),box=document.getElementById("tf-t"),none=document.getElementById("tf-n");
if(!i||!box)return;
var tiles=[].slice.call(box.querySelectorAll(".tile"));
function norm(s){return String(s||"").toLowerCase()}
function run(){var q=norm(i.value).trim().split(/\s+/).filter(Boolean),shown=0;
tiles.forEach(function(t){var h=norm(t.getAttribute("data-k")+" "+t.textContent),ok=q.every(function(w){return h.indexOf(w)>-1});t.hidden=!ok;if(ok)shown++});
none.hidden=shown>0}
i.addEventListener("input",run);
})()</script>`;

export function tilesHtml2(now = Date.now()) {
  const tile = ([h, ic, c, title, d, k, uusi]) =>
    `<a class="tile" href="${h}" data-k="${esc(k)}"><div class="ic" style="--c:${c}"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[ic]}</svg></div><div><b>${esc(title)}${uusi && now < UUSI_ASTI ? '<span class="nw">Uusi</span>' : ""}</b><span>${esc(d)}</span></div></a>`;
  return (
    `<div class="tf"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>` +
    `<input id="tf-q" type="search" placeholder="Hae aihetta, esim. sähkö, Kela tai budjetti" autocomplete="off" aria-label="Hae aihetta sivustolta"></div>` +
    `<div class="tiles" id="tf-t">${TILES.map(tile).join("")}</div>` +
    `<div class="tnone" id="tf-n" hidden>Ei löytynyt tällä sanalla. Kysy tekoälyltä, se hakee vastauksen äänestyksistä, laeista ja budjetista.<button type="button" class="askbig" data-ask>Kysy tekoälyltä<small>Kirjoita kysymys omin sanoin</small></button></div>` +
    FILTER_JS
  );
}
