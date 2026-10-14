// datapankki.mjs - /datapankki/: laskuri sivuston datan koosta.
import { readdirSync, readFileSync, statSync } from "node:fs";

const nf = (n) => new Intl.NumberFormat("fi-FI").format(Math.round(n));

function rowsIn(x, depth = 0) {
  if (Array.isArray(x)) {
    let n = x.length;
    if (depth < 2) for (const e of x) if (e && typeof e === "object") n += rowsIn(e, depth + 1) - (Array.isArray(e) ? e.length : 0);
    return n;
  }
  if (x && typeof x === "object" && depth < 3) {
    let n = 0;
    for (const k of Object.keys(x)) if (x[k] && typeof x[k] === "object") n += rowsIn(x[k], depth + 1);
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
  ["data/eu", "EU: rahoitus ja avoimuusrekisteri", "EU-komission suorat rahoitukset ja avoimuusrekisterin suomalaiset toimijat"],
  ["data/kela", "Kela kunnittain", "Kelan etuuksien maksut kunnittain"],
  ["data/fingrid", "Sähköjärjestelmä (Fingrid)", "Sähkön kulutus, tuotanto ja siirto tunneittain"],
  ["data/hinta", "Pörssisähkön hinta", "Tuntihinnat"],
  ["data/valtiontalous", "Valtion talous", "Valtiokonttorin budjetti- ja kirjanpitodata"],
  ["data/finlex", "Lait ja asetukset (Finlex)", "Säädösten otsikot ja tunnisteet vuosittain"],
];

const CSS = `<style>.big{font-size:44px;font-weight:800;line-height:1.1;margin:6px 0}.big small{display:block;font-size:15px;font-weight:500;color:#9aa6bd;margin-top:6px}.dt{width:100%;border-collapse:collapse;margin:14px 0}.dt td{padding:10px 6px;border-bottom:1px solid #2a3350;vertical-align:top}.dt td.n{text-align:right;font-weight:700;white-space:nowrap}.dt .d{font-weight:400;font-size:14px;color:#9aa6bd;margin-top:2px}</style>`;

export function datapankkiPages({ shell, esc, files = [] }) {
  let total = 0;
  const grp = GROUPS.map(([dir, title, desc]) => {
    let n = 0;
    for (const p of walk(dir)) {
      try { n += rowsIn(JSON.parse(readFileSync(p, "utf8"))); } catch (e) {}
    }
    total += n;
    return { title, desc, n };
  });
  const NAMES = { edustajat: "kansanedustajat", aanestykset: "äänestykset" };
  const own = files.map((x) => ({ title: NAMES[x.name] || x.name, n: x.n || 0 }));
  total += own.reduce((a, b) => a + b.n, 0);
  const rows = [
    ...own.map((o) => `<tr><td>Eduskunta: ${esc(o.title)}</td><td class="n">${nf(o.n)}</td></tr>`),
    ...grp.filter((g) => g.n > 0).map((g) => `<tr><td>${esc(g.title)}<div class="d">${esc(g.desc)}</div></td><td class="n">${nf(g.n)}</td></tr>`),
  ].join("");
  const body = CSS + `<h1>Datapankki</h1>
<p>Laskuri siitä, kuinka paljon dataa Eduskuntaseurannan omassa tallennuksessa on.</p>
<div class="big">${nf(total)}<small>riviä sivuston omassa tallennuksessa</small></div>
<table class="dt"><tbody>${rows}</tbody></table>
<h2>Luetaan suoraan lähteestä</h2>
<p>Nämä eivät ole yllä olevassa luvussa, koska ne haetaan suoraan lähteestä:</p>
<ul><li><a href="/kela/">Kelan avoin data</a>: yli 160 miljoonaa riviä (Kelan oman tiedon mukaan).</li><li><a href="/yritykset/">Kaikki Suomen yritykset</a>: PRH:n avoin rekisteri.</li></ul>
<p class="meta">Rivi tarkoittaa yhtä tietuetta: yksi äänestys, yksi tuntihinta, yksi yritys. Luku päivittyy jokaisessa rakennuksessa.</p>`;
  return [{ path: "/datapankki/", html: shell({ title: "Datapankki | Eduskuntaseuranta", desc: "Laskuri Eduskuntaseurannan datan koosta: rivit ja lähteet.", path: "/datapankki/", body }) }];
}
