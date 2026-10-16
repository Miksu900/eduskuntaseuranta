import fs from "node:fs";
import { execSync } from "node:child_process";

// EU-maat: komission FTS-rahat jokaiselle EU-maalle ohjelmittain ja saajittain (vuodet 2014-2025).
const EU = ["Austria","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Ireland","Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden"];
const YEARS = [];
for (let y = 2014; y <= 2025; y++) YEARS.push(y);

async function readCsv(file, onRow) {
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  let row = [], field = "", inQ = false, prev = "";
  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQ) {
        if (c === '"') {
          if (chunk[i + 1] === '"') { field += '"'; i++; }
          else if (i + 1 >= chunk.length) { prev = "q"; inQ = false; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') {
        if (prev === "q") { field += '"'; inQ = true; prev = ""; } else inQ = true;
      } else if (c === ",") { row.push(field); field = ""; prev = ""; }
      else if (c === "\n") { row.push(field.replace(/\r$/, "")); onRow(row); row = []; field = ""; prev = ""; }
      else { field += c; prev = ""; }
    }
  }
  if (field || row.length) { row.push(field); onRow(row); }
}

const num = (s) => parseFloat(String(s || "0").replace(/[^0-9.\-]/g, "")) || 0;
const cleanName = (s) => String(s || "").split("*")[0].trim() || String(s || "").trim();
const q = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const euSet = new Map(EU.map((c) => [c.toLowerCase(), c]));

const prog = new Map();  // maa|ohjelma|vuosi -> summa
const bens = new Map();  // maa|saaja -> {tyyppi,kaupunki,cnt,total,y}
let totalRows = 0;

for (const y of YEARS) {
  const f = "/tmp/fts" + y + ".csv";
  const url = "https://ec.europa.eu/budget/financial-transparency-system/download/" + y + "_FTS_dataset_en.csv";
  try { execSync('curl -L -sS -A "Mozilla/5.0" --retry 3 --max-time 900 -o ' + f + ' "' + url + '"', { stdio: "inherit" }); }
  catch (e) { console.log("- " + y + ": lataus epäonnistui"); continue; }
  if (!fs.existsSync(f) || fs.statSync(f).size < 1000000) { console.log("- " + y + ": tiedosto puuttuu tai liian pieni"); continue; }
  let header = null, ix = {}, rows = 0;
  await readCsv(f, (r) => {
    if (!header) {
      header = r;
      const find = (re) => r.findIndex((h) => re.test(h));
      ix.name = find(/^name of benef/i); ix.country = find(/^beneficiary country/i);
      ix.amount = find(/^beneficiary.s contracted amount/i); ix.prog = find(/^programme name/i);
      ix.type = find(/^beneficiary type/i); ix.city = find(/^city/i);
      return;
    }
    rows++;
    const c = euSet.get((r[ix.country] || "").trim().toLowerCase());
    if (!c) return;
    const amt = num(r[ix.amount]);
    const pn = (r[ix.prog] || "").trim() || "(ei ohjelmaa)";
    const pk = c + "|" + pn + "|" + y;
    prog.set(pk, (prog.get(pk) || 0) + amt);
    const type = (r[ix.type] || "").trim();
    if (/private persons/i.test(type)) return; // yksityishenkilöt pois saajalistasta
    const bn = cleanName(r[ix.name]);
    const bk = c + "|" + bn;
    let b = bens.get(bk);
    if (!b) { b = { c, n: bn, type, city: (r[ix.city] || "").trim(), cnt: 0, total: 0, y: {} }; bens.set(bk, b); }
    b.cnt++; b.total += amt; b.y[y] = (b.y[y] || 0) + amt;
  });
  totalRows += rows;
  console.log("- " + y + ": " + rows + " riviä");
  fs.unlinkSync(f);
}

fs.mkdirSync("data/eu-maat", { recursive: true });
const pl = ["maa,ohjelma,vuosi,summa_eur"];
for (const [k, v] of [...prog].sort()) { const [c, p, y] = k.split("|"); pl.push([c, p, y, Math.round(v)].map(q).join(",")); }
fs.writeFileSync("data/eu-maat/maat_ohjelmat_vuosittain.csv", "\uFEFF" + pl.join("\n") + "\n");

const TOP = 1000; // suurimmat saajat per maa
const bl = ["maa,saaja,tyyppi,kaupunki,sopimuksia,yhteensa_eur," + YEARS.join(",")];
let kept = 0;
for (const c of EU) {
  const list = [...bens.values()].filter((b) => b.c === c).sort((a, b) => b.total - a.total).slice(0, TOP);
  for (const b of list) { bl.push([c, b.n, b.type, b.city, b.cnt, Math.round(b.total), ...YEARS.map((y) => Math.round(b.y[y] || 0))].map(q).join(",")); kept++; }
}
fs.writeFileSync("data/eu-maat/maat_saajat_suurimmat.csv", "\uFEFF" + bl.join("\n") + "\n");
console.log("Valmis: " + prog.size + " ohjelmariviä, " + kept + " saajariviä, " + totalRows + " lähderiviä");
