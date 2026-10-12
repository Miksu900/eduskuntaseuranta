// Kelan avoimen datan kunnittainen yhteenveto -> data/kela/
import fs from "node:fs";
import path from "node:path";

const SAMPLE = 200000;
const CONC = 4;
const OUT = "data/kela";
const TYPE_ORDER = ["Vuosi", "Kuukausi", "Neljännesvuosi", "Vuosikertymä"];

function splitCsv(line) {
  if (line.indexOf('"') < 0) return line.split(",");
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}
const num = (s) => { if (s === undefined || s === "") return 0; const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const pop = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

function pickTotal(vals) {
  const a = [...vals];
  let t = a.find((v) => /^yhteensä$/i.test(v)); if (t !== undefined) return t;
  t = a.find((v) => /^kaikki/i.test(v) && !v.startsWith("-")); if (t !== undefined) return t;
  const c = a.filter((v) => /yhteensä/i.test(v) && !v.startsWith("-"));
  return c.length === 1 ? c[0] : null;
}

async function* lines(source) {
  let stream;
  if (source.startsWith("file:")) {
    stream = fs.createReadStream(source.slice(5));
  } else {
    const res = await fetch(source, { redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    stream = res.body;
  }
  const dec = new TextDecoder("utf-8");
  let left = "";
  for await (const chunk of stream) {
    const s = left + (typeof chunk === "string" ? chunk : dec.decode(chunk, { stream: true }));
    const parts = s.split("\n");
    left = parts.pop();
    for (const p of parts) yield p.endsWith("\r") ? p.slice(0, -1) : p;
  }
  left += dec.decode();
  if (left) yield left.endsWith("\r") ? left.slice(0, -1) : left;
}

// Palauttaa {map, names, rows, kept, info}
async function processFile(item) {
  const map = new Map(); // key -> [eur, saaja, monthMask]
  const names = new Map();
  let H = null, rows = 0, kept = 0;
  let c = null, buf = [], ready = false, filt = null, info = "";

  function setup(header) {
    H = header.map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());
    const ix = (n) => H.indexOf(n);
    c = {
      v: ix("vuosi"), kn: ix("kunta_nro"), kname: ix("kunta_nimi"), at: ix("aikatyyppi"), kk: ix("kuukausi_nro"),
      eur: ix("maksettu_eur") >= 0 ? ix("maksettu_eur") : ix("maksettu_laskenta_eur"),
      sa: ix("saaja_lkm") >= 0 ? ix("saaja_lkm") : ix("saaja_laskenta_lkm"),
    };
    c.lab = ["etuus", "etuuslaji", "tukimuoto"].map(ix).find((i) => i >= 0);
    if (c.lab === undefined) c.lab = -1;
    const skip = new Set([c.v, c.kn, c.kname, c.at, c.kk, c.lab, ix("vuosikuukausi")]);
    c.dims = [];
    H.forEach((h, i) => {
      if (skip.has(i)) return;
      if (/(_lkm|_eur|_laskenta|_paiva)$/.test(h) || /^(maksettu|saaja|lapsi|korvattu|kunta_osuus)/.test(h)) return;
      c.dims.push(i);
    });
  }
  function finishSetup() {
    const sets = c.dims.map(() => new Set());
    for (const f of buf) c.dims.forEach((d, j) => sets[j].add(f[d] ?? ""));
    filt = c.dims.map((d, j) => {
      const t = pickTotal(sets[j]);
      const hasTop = [...sets[j]].some((v) => !v.startsWith("-"));
      return { t, dash: t === null && hasTop };
    });
    info = c.dims.map((d, j) => H[d] + "=" + (filt[j].t ?? (filt[j].dash ? "(ylin taso)" : "(kaikki)"))).join("; ");
    ready = true;
    for (const f of buf) handle(f);
    buf = null;
  }
  function handle(f) {
    for (let j = 0; j < c.dims.length; j++) {
      const v = f[c.dims[j]] ?? "";
      const p = filt[j];
      if (p.t !== null) { if (v !== p.t) return; }
      else if (p.dash && v.startsWith("-")) return;
    }
    kept++;
    const kn = (f[c.kn] ?? "").trim(); const vuosi = (f[c.v] ?? "").trim();
    if (!kn || !vuosi) return;
    const at = c.at >= 0 ? f[c.at] : "Vuosi";
    const kk = c.kk >= 0 ? parseInt(f[c.kk]) || 0 : 0;
    const lab = c.lab >= 0 ? (f[c.lab] ?? "") : "";
    const key = kn + "|" + vuosi + "|" + lab + "|" + at + "|" + (at === "Vuosikertymä" ? kk : 0);
    let e = map.get(key);
    if (!e) { e = [0, 0, 0]; map.set(key, e); }
    e[0] += c.eur >= 0 ? num(f[c.eur]) : 0;
    e[1] += c.sa >= 0 ? num(f[c.sa]) : 0;
    if (kk > 0 && kk <= 12) e[2] |= 1 << (kk - 1);
    if (c.kname >= 0) {
      const nm = (f[c.kname] ?? "").trim();
      if (nm && !/^\d+$/.test(nm)) { const o = names.get(kn); if (!o || +vuosi >= o[1]) names.set(kn, [nm, +vuosi]); }
    }
  }

  for await (const line of lines(item.url)) {
    if (!line) continue;
    if (!H) { setup(splitCsv(line)); continue; }
    rows++;
    const f = splitCsv(line);
    if (!ready) { buf.push(f); if (buf.length >= SAMPLE) finishSetup(); }
    else handle(f);
  }
  if (!H) throw new Error("tyhjä tiedosto");
  if (!ready) finishSetup();
  return { map, names, rows, kept, info, hasEur: c.eur >= 0 };
}

async function discover() {
  if (process.env.KELA_LOCAL) {
    return process.env.KELA_LOCAL.split(",").map((p, i) => ({ ds: "Testi" + (i % 2), url: "file:" + p, name: path.basename(p) }));
  }
  const items = []; const seen = new Set();
  for (let start = 0; start < 1000; start += 200) {
    const r = await fetch("https://avoindata.suomi.fi/data/api/3/action/package_search?q=Kela&rows=200&start=" + start);
    const j = await r.json();
    const res = j.result.results;
    if (!res.length) break;
    for (const p of res) {
      const org = (p.organization && p.organization.title) || "";
      if (!/Kela|Kansaneläke/i.test(org + " " + (p.title || ""))) continue;
      for (const rs of p.resources || []) {
        const u = rs.url || "";
        if (!/\.csv$/i.test(u) || seen.has(u)) continue;
        seen.add(u);
        items.push({ ds: p.title, url: u, name: u.split("/").pop() });
      }
    }
  }
  return items;
}

async function main() {
  const t0 = Date.now();
  const items = await discover();
  console.log("## Kelan CSV-tiedostoja: " + items.length);
  const dsList = [...new Set(items.map((i) => i.ds))];
  const dsIdx = new Map(dsList.map((d, i) => [d, i]));
  const labels = []; const labIdx = new Map();
  const lab = (l) => { let i = labIdx.get(l); if (i === undefined) { i = labels.length; labels.push(l); labIdx.set(l, i); } return i; };
  const owner = new Map(); // ds|vuosi -> file name
  const global = new Map(); // ds|kunta|vuosi|label|atype|kk -> [eur,saaja,mask]
  const names = new Map();
  let totalRows = 0, fails = 0;

  const queue = items.map((it, i) => ({ ...it, i }));
  async function worker() {
    while (queue.length) {
      const it = queue.shift();
      let r = null, err = "";
      for (let a = 1; a <= 3 && !r; a++) {
        try { r = await processFile(it); } catch (e) { err = String(e.message || e); console.log("  yritys " + a + " epäonnistui: " + it.name + " " + err); }
      }
      if (!r) { fails++; console.log("- EPÄONNISTUI " + it.name + ": " + err); continue; }
      totalRows += r.rows;
      const ds = dsIdx.get(it.ds);
      const years = new Set();
      let skipped = 0;
      for (const [k, v] of r.map) {
        const [kn, vuosi, l, at, kk] = k.split("|");
        const ok = ds + "|" + vuosi;
        const o = owner.get(ok);
        if (o === undefined) owner.set(ok, it.name);
        else if (o !== it.name) { skipped++; continue; }
        years.add(vuosi);
        const gk = ds + "|" + kn + "|" + vuosi + "|" + lab(l) + "|" + at + "|" + kk;
        const g = global.get(gk);
        if (g) { g[0] += v[0]; g[1] += v[1]; g[2] |= v[2]; } else global.set(gk, [v[0], v[1], v[2]]);
      }
      for (const [kn, nm] of r.names) { const o = names.get(kn); if (!o || nm[1] >= o[1]) names.set(kn, nm); }
      console.log("- " + it.ds + " / " + it.name + ": rivejä " + r.rows + ", suodatuksen jälkeen " + r.kept + ", vuodet " + [...years].sort().join(",") + (skipped ? ", ohitettu päällekkäisiä " + skipped : "") + (r.hasEur ? "" : ", EI euro-saraketta") + " | " + r.info);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  // Viimeistely: valitse aikatyyppi per ds|kunta|vuosi|label
  const groups = new Map();
  for (const [k, v] of global) {
    const [ds, kn, vuosi, l, at, kk] = k.split("|");
    const gk = ds + "|" + kn + "|" + vuosi + "|" + l;
    let g = groups.get(gk); if (!g) { g = {}; groups.set(gk, g); }
    (g[at] = g[at] || []).push({ kk: +kk, v });
  }
  const byKunta = new Map(); const nat = new Map();
  for (const [gk, g] of groups) {
    const [ds, kn, vuosi, l] = gk.split("|");
    let t = TYPE_ORDER.findIndex((x) => g[x]);
    if (t < 0) continue;
    const arr = g[TYPE_ORDER[t]];
    let eur = 0, sa = 0, months = 0, mask = 0;
    if (TYPE_ORDER[t] === "Vuosikertymä") { const last = arr.reduce((a, b) => (b.kk > a.kk ? b : a)); eur = last.v[0]; sa = last.v[1]; months = last.kk; }
    else { for (const x of arr) { eur += x.v[0]; sa += x.v[1]; mask |= x.v[2]; } months = TYPE_ORDER[t] === "Vuosi" ? 12 : pop(mask); }
    if (TYPE_ORDER[t] === "Kuukausi" && months > 0) sa = sa / months;
    eur = Math.round(eur); sa = Math.round(sa);
    if (!eur && !sa) continue;
    const row = [+ds, +vuosi, +l, eur, sa, months, t];
    if (!byKunta.has(kn)) byKunta.set(kn, []);
    byKunta.get(kn).push(row);
    const nk = ds + "|" + vuosi + "|" + l + "|" + t;
    const n = nat.get(nk);
    if (n) { n[3] += eur; n[4] += sa; n[5] = Math.max(n[5], months); } else nat.set(nk, [...row]);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "k"), { recursive: true });
  let maxSize = 0;
  const kunnat = {};
  for (const [kn, rows] of byKunta) {
    rows.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    const nm = names.get(kn);
    kunnat[kn] = nm ? nm[0] : "Kunta " + kn;
    const s = JSON.stringify({ n: kunnat[kn], r: rows });
    maxSize = Math.max(maxSize, s.length);
    fs.writeFileSync(path.join(OUT, "k", kn + ".json"), s);
  }
  fs.writeFileSync(path.join(OUT, "k", "all.json"), JSON.stringify({ n: "Koko maa", r: [...nat.values()] }));
  const years = [...new Set([...groups.keys()].map((g) => +g.split("|")[2]))].sort();
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({
    built: new Date().toISOString(), files: items.length, rows: totalRows, datasets: dsList, labels, kunnat,
    years: [years[0], years[years.length - 1]], types: TYPE_ORDER,
  }));
  console.log("\n## VALMIS");
  console.log("Tiedostoja " + items.length + ", epäonnistui " + fails + ", rivejä luettu " + totalRows);
  console.log("Tietosarjoja " + dsList.length + ", etuusnimikkeitä " + labels.length + ", kuntia " + byKunta.size + ", vuodet " + years[0] + "-" + years[years.length - 1]);
  console.log("Suurin kuntatiedosto " + Math.round(maxSize / 1024) + " kt");
  console.log("Aikaa " + Math.round((Date.now() - t0) / 1000) + " s");
  const sample = byKunta.get("564") || byKunta.values().next().value || [];
  console.log("Esimerkki (kunta 564 tai ensimmäinen), 12 riviä:");
  for (const r of sample.filter((x) => x[1] >= 2023).slice(0, 12)) console.log(" " + dsList[r[0]] + " | " + labels[r[2]] + " | " + r[1] + " | " + r[3] + " € | saajia " + r[4] + " | kk " + r[5] + " | tyyppi " + TYPE_ORDER[r[6]]);
  if (fails > items.length / 4) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
