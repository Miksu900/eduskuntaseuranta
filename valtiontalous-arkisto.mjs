// Lataa Valtiokonttorin budjettitalouden kuukausitiedostot ja tiivistää ne momenteittain data/valtiontalous/YYYY.json.
// Jokainen kuukausitiedosto sisältää kyseisen kuukauden liikkeet. Vuosisumma = 12 kuukautta yhteen.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
const API = "https://api.tutkihallintoa.fi/valtiontalous/v1/budjettitalousvuosikuukausi";
const DIR = "data/valtiontalous";
const FIRST = Number(process.env.VT_FIRST_YEAR || 1998);
mkdirSync(DIR, { recursive: true });

function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (q) { if (c === 34) { if (text.charCodeAt(i + 1) === 34) { f += '"'; i++; } else q = false; } else f += text[i]; }
    else if (c === 34) q = true;
    else if (c === 44) { row.push(f); f = ""; }
    else if (c === 10) { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== 13) f += text[i];
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const num = s => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };
async function get(url, tries = 4) {
  for (let t = 1; t <= tries; t++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); }
    catch (e) { if (t === tries) throw e; await new Promise(r => setTimeout(r, 1500 * t)); }
  }
}

const list = JSON.parse(await get(API));
const byYear = {};
for (const u of list) { const m = u.match(/budjettitalous\/(\d{4})\/(\d{1,2})\//); if (m) (byYear[m[1]] ||= {})[Number(m[2])] = u; }
const years = Object.keys(byYear).map(Number).filter(y => y >= FIRST).sort((a, b) => b - a);
console.log("vuodet:", years[years.length - 1], "-", years[0], "tiedostoja", list.length);
const nowYear = new Date().getFullYear();

for (const y of years) {
  const file = `${DIR}/${y}.json`;
  const months = Object.keys(byYear[y]).map(Number).sort((a, b) => a - b);
  if (existsSync(file) && y < nowYear - 1) {
    try { const c = JSON.parse(readFileSync(file, "utf8")); if (c.v === 1 && c.months.length >= months.length) { continue; } } catch {}
  }
  const mom = new Map(); const pl = {};
  for (const m of months) {
    const rows = parseCsv(await get(byYear[y][m]));
    const h = rows[0].map(x => x.replace(/^﻿/, "")); const ix = n => h.indexOf(n);
    const iMom = ix("Momentti_TunnusP"), iMomN = ix("Momentti_sNimi"), iPl = ix("PaaluokkaOsasto_TunnusP"), iPlN = ix("PaaluokkaOsasto_sNimi"), iTk = ix("TakpT_sNimi"), iKo = ix("Nettokertymä_ko_vuodelta"), iNk = ix("Nettokertymä");
    if ([iMom, iPl, iTk, iKo, iNk].some(v => v < 0)) { console.log(y, m, "sarakkeita puuttuu"); continue; }
    for (let r = 1; r < rows.length; r++) {
      const x = rows[r]; if (x.length < h.length - 2) continue;
      const code = x[iMom]; if (!code) continue;
      if (/^vain liikekirjanpidossa/i.test(x[iTk]) || /^Tapahtumia/i.test(x[iTk])) continue;
      const ko = num(x[iKo]), nk = num(x[iNk]); if (!ko && !nk) continue;
      let e = mom.get(code);
      if (!e) { e = { c: code, n: x[iMomN], p: x[iPl].replace(/\.$/, ""), k: new Array(12).fill(0), t: new Array(12).fill(0) }; mom.set(code, e); }
      e.k[m - 1] += ko; e.t[m - 1] += nk;
      pl[x[iPl].replace(/\.$/, "")] = x[iPlN];
    }
  }
  const out = { year: y, v: 1, months, paaluokat: pl, rows: [...mom.values()].map(e => [e.c, e.n, e.p, e.k.map(Math.round), e.t.map(Math.round)]) };
  writeFileSync(file, JSON.stringify(out));
  // Yhteenveto lokiin: pääluokittain vuoden summat (milj. €): ko_vuodelta / nettokertymä
  const s = {}; for (const r of out.rows) { const a = (s[r[2]] ||= [0, 0]); a[0] += r[3].reduce((p, c) => p + c, 0); a[1] += r[4].reduce((p, c) => p + c, 0); }
  console.log(`${y}: ${out.rows.length} momenttia, kuukausia ${months.length}`);
  if (y === Math.max(...years.filter(v => v < nowYear))) for (const k of Object.keys(s).sort()) console.log("  ", k, (pl[k] || "").slice(0, 30), Math.round(s[k][0] / 1e6), Math.round(s[k][1] / 1e6));
}
