// Lataa Finlexin säädösten otsikot arkistoon data/finlex/YYYY.json. Jatkaa siitä mihin jäi.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { getText, listYear, parseStatute, lastErrInfo } from "./finlex.mjs";

const DIR = "data/finlex";
const BUDGET = Number(process.env.FINLEX_ARK_MS || 5 * 3600 * 1000 + 20 * 60 * 1000);
const FIRST = Number(process.env.FINLEX_FIRST_YEAR || 1860);
const t0 = Date.now();
const nowYear = new Date().getFullYear();
mkdirSync(DIR, { recursive: true });
const left = () => BUDGET - (Date.now() - t0);

let total = 0;
for (let y = nowYear; y >= FIRST && left() > 60000; y--) {
  const file = `${DIR}/${y}.json`;
  let cur = { year: y, complete: false, rows: [] };
  if (existsSync(file)) { try { cur = JSON.parse(readFileSync(file, "utf8")); } catch {} }
  if (cur.complete && cur.v === 2 && y < nowYear - 1) continue;
  const { refs, ok: listOk } = await listYear(y);
  const have = new Set(cur.rows.map(r => String(r[0])));
  const todo = refs.filter(r => !have.has(String(r.n)));
  console.log(`${y}: listassa ${refs.length}, uusia ${todo.length}, aikaa jäljellä ${Math.round(left() / 60000)} min`);
  let i = 0, fail = 0, saved = 0;
  const save = (complete) => {
    cur.rows.sort((a, b) => (parseInt(b[0], 10) || 0) - (parseInt(a[0], 10) || 0));
    cur.complete = complete; cur.v = 2;
    writeFileSync(file, JSON.stringify(cur));
  };
  const worker = async () => {
    while (i < todo.length && left() > 30000) {
      const r = todo[i++];
      const xml = await getText(r.url, 60000);
      await new Promise(rs => setTimeout(rs, 150));
      if (!xml) { fail++; continue; }
      const p = parseStatute(xml);
      if (!p.title) { fail++; continue; }
      cur.rows.push([r.n, p.title, p.issued, p.published]);
      total++;
      if (++saved % 300 === 0) save(false);
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  const finished = i >= todo.length;
  save(finished && listOk && fail === 0);
  console.log(`${y}: tallennettu ${cur.rows.length}, virheitä ${fail}${finished ? "" : " (kesken)"}`);
  if (!finished) break;
}
console.log(`Valmis: ${total} uutta säädöstä, ${Math.round((Date.now() - t0) / 60000)} min`, JSON.stringify(lastErrInfo()));
