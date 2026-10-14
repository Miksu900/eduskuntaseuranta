// datapankki.mjs - /datapankki/: tarkka laskuri sivuston datan koosta. Lukee data-kansion JSON-tiedostot ja build.mjs:n antamat tiedostomäärät.
import { readdirSync, readFileSync, statSync } from "node:fs";

const nf = (n) => new Intl.NumberFormat("fi-FI").format(Math.round(n));

// Rivi = taulukon alkio. Lasketaan kaikkien taulukoiden pituudet (enintään 3 tasoa), mutta pelkät pienet apulistat ohitetaan.
function rowsIn(x, depth = 0) {
  if (Array.isArray(x)) {
    let n = x.length;
    if (depth < 2) for (const e of x) if (e && typeof e === "object") n += rowsIn(e, depth + 1) - (Array.isArray(e) ? e.length : 0);
    return n;
  }
  if (x && typeof x === "object" && depth < 3) {
    let n = 0;
    for (const k of Object.keys(x)) if (Array.isArray(x[k])) n += rowsIn(x[k], depth + 1); else if (x[k] && typeof x[k] === "object") n += rowsIn(x[k], depth + 1);
    return n;
  }
  return 0;
}

function walk(dir, acc = []) {
  let ents = [];
  try { ents = readdirSync(dir); } catch (e) { return acc; }
  for (const e of ents) {
    const p = dir + "/" + e;
    let st; try { st = statSync(p); } catch (x) { continue; }
    if (st.isDirectory()) walk(p, acc); else if (e.endsWith(".json")) acc.push(p);
  }
  return acc;
}

const GROUPS = [
  ["data/eu", "EU: rahoitus ja avoimuusrekisteri", "EU-komission suorat rahoitukset (FTS) ja avoimuusrekisterin suomalaiset toimijat"],
  ["data/kela", "Kela kunnittain", "Kelan etuuksien maksut kunnittain tallennettuna sivulle"],
  ["data/fingrid", "Sähköjärjestelmä (Fingrid)", "Sähkön kulutus, tuotanto ja siirto tunneittain"],
  ["data/hinta", "Pörssisähkön hinta", "Tuntihinnat"],
  ["data/valtiontalous", "Valtion talous", "Valtiokonttorin vuosittainen budjetti- ja kirjanpitodata"],
  ["data/finlex", "Lait ja asetukset (Finlex)", "Säädösten otsikot ja tunnisteet vuosittain"],
];

export function datapankkiPages({ shell, esc, files = [] }) {
  const out = [];
  let total = 0, filesTot = 0;
  const grp = GROUPS.map(([dir, title, desc]) => {
    let n = 0, f = 0;
    for (const p of walk(dir)) {
      f++;
      try { n += rowsIn
