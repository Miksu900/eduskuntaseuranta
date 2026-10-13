import fs from "node:fs";
import { execSync } from "node:child_process";

function out(s) { console.log(s); }
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
const r0 = Math.round;

fs.mkdirSync("data/eu", { recursive: true });

// ---------- FTS ----------
const countries = {};
const byYear = {};
const progs = new Map();
const bens = new Map();
const yearsDone = [];
out("## FTS-haku");

for (const y of YEARS) {
  const f = "/tmp/fts" + y + ".csv";
  const url = "https://ec.europa.eu/budget/financial-transparency-system/download/" + y + "_FTS_dataset_en.csv";
  try {
    execSync('curl -L -sS -A "Mozilla/5.0" --retry 3 --max-time 900 -o ' + f + ' "' + url + '"', { stdio: "inherit" });
  } catch (e) { out("- " + y + ": lataus epäonnistui"); continue; }
  if (!fs.existsSync(f) || fs.statSync(f).size < 1000000) { out("- " + y + ": tiedosto puuttuu tai liian pieni"); continue; }

  let header = null, ix = {}, rows = 0;
  await readCsv(f, (r) => {
    if (!header) {
      header = r;
      const find = (re) => r.findIndex((h) => re.test(h));
      ix.name = find(/^name of benef/i);
      ix.country = find(/^beneficiary country/i);
      ix.amount = find(/^beneficiary.s contracted amount/i);
      ix.prog = find(/^programme name/i);
      ix.type = find(/^beneficiary type/i);
      ix.city = find(/^city/i);
      return;
    }
    rows++;
    const country = (r[ix.country] || "").trim();
    if (!country) return;
    const amt = num(r[ix.amount]);
    if (!countries[country]) countries[country] = {};
    countries[country][y] = (countries[country][y] || 0) + amt;
    if (/^finland$/i.test(country)) {
      byYear[y] = (byYear[y] || 0) + amt;
      const pn = (r[ix.prog] || "").trim() || "(ei ohjelmaa)";
      let p = progs.get(pn);
      if (!p) { p = { n: pn, total: 0, y: {} }; progs.set(pn, p); }
      p.total += amt; p.y[y] = (p.y[y] || 0) + amt;
      const bn = cleanName(r[ix.name]);
      let b = bens.get(bn);
      if (!b) { b = { n: bn, type: (r[ix.type] || "").trim(), city: (r[ix.city] || "").trim(), total: 0, cnt: 0, y: {} }; bens.set(bn, b); }
      b.total += amt; b.cnt++; b.y[y] = (b.y[y] || 0) + amt;
    }
  });
  yearsDone.push(y);
  out("- " + y + ": " + rows + " riviä, Suomi " + r0((byYear[y] || 0) / 1e6) + " M€");
  fs.unlinkSync(f);
}

const rd = (o) => { const x = {}; for (const k in o) x[k] = r0(o[k]); return x; };
const ctry = {};
for (const c in countries) ctry[c] = rd(countries[c]);
const topBens = [...bens.values()].filter((b) => b.total > 0).sort((a, b) => b.total - a.total).slice(0, 3000)
  .map((b) => ({ n: b.n, type: b.type, city: b.city, total: r0(b.total), cnt: b.cnt, y: rd(b.y) }));
const progList = [...progs.values()].sort((a, b) => b.total - a.total).slice(0, 60)
  .map((p) => ({ n: p.n, total: r0(p.total), y: rd(p.y) }));

fs.writeFileSync("data/eu/fts.json", JSON.stringify({
  updated: new Date().toISOString(),
  source: "Euroopan komission Financial Transparency System",
  unit: "EUR",
  note: "Summa = saajan sopimuksen mukainen summa (commitment) vuoden kirjauksissa. Monivuotiset hankkeet kirjataan sopimusvuodelle.",
  years: yearsDone,
  countries: ctry,
  finland: { byYear: rd(byYear), programmes: progList, beneficiaries: topBens }
}));
out("\nSuomalaisia saajia yhteensä: " + bens.size + ", tallennettu " + topBens.length);

// ---------- Avoimuusrekisteri ----------
out("\n## Avoimuusrekisteri");
const xf = "/tmp/reg.xml";
execSync('curl -L -sS -A "Mozilla/5.0" --retry 3 --max-time 600 -o ' + xf + ' "https://transparency-register.europa.eu/odplastorganisationxml_en"', { stdio: "inherit" });

const dec = (s) => String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const tag = (blk, t) => { const m = blk.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">")); return m ? dec(m[1]) : ""; };

const catCount = {}, countryCount = {};
const fin = [];
let total = 0, exportDate = "";

const stream = fs.createReadStream(xf, { encoding: "utf8" });
let buf = "";
const END = "</interestRepresentative>";
function handle(blk) {
  total++;
  const head = (blk.match(/<headOffice>([\s\S]*?)<\/headOffice>/) || [, ""])[1];
  const country = tag(head, "country");
  const cat = tag(blk, "registrationCategory");
  countryCount[country] = (countryCount[country] || 0) + 1;
  catCount[cat] = (catCount[cat] || 0) + 1;
  if (/^finland$/i.test(country)) {
    const fd = (blk.match(/<financialData>([\s\S]*?)<\/financialData>/) || [, ""])[1];
    const nameBlk = (blk.match(/<name>([\s\S]*?)<\/name>/) || [, ""])[1];
    fin.push({
      id: tag(blk, "identificationCode"),
      n: tag(nameBlk, "originalName"),
      a: tag(blk, "acronym"),
      cat,
      form: tag(blk, "entityForm"),
      city: tag(head, "city"),
      web: tag(blk, "webSiteURL"),
      reg: tag(blk, "registrationDate").slice(0, 10),
      upd: tag(blk, "lastUpdateDate").slice(0, 10),
      ep: tag(blk, "EPAccreditedNumber"),
      fte: tag(blk, "membersFTE"),
      goals: tag(blk, "goals").slice(0, 400),
      cost: tag(fd, "absoluteCost"),
      min: tag(fd, "min"),
      max: tag(fd, "max"),
      fdraw: fd.replace(/\s+/g, " ").slice(0, 1200)
    });
  }
}
for await (const chunk of stream) {
  buf += chunk;
  let i;
  while ((i = buf.indexOf(END)) >= 0) {
    const start = buf.indexOf("<interestRepresentative>");
    if (start >= 0 && start < i) handle(buf.slice(start, i + END.length));
    buf = buf.slice(i + END.length);
  }
  if (buf.length > 5000000) buf = buf.slice(-2000000);
}
const em = fs.readFileSync(xf, "utf8").slice(0, 3000).match(/<exportDate>(.*?)<\/exportDate>/);
exportDate = em ? em[1] : "";
fs.unlinkSync(xf);

fin.sort((a, b) => (parseFloat(b.cost) || 0) - (parseFloat(a.cost) || 0));
fs.writeFileSync("data/eu/rekisteri.json", JSON.stringify({
  updated: new Date().toISOString(),
  exportDate,
  source: "EU:n avoimuusrekisteri",
  total,
  categories: catCount,
  countries: countryCount,
  finland: fin
}));
out("Organisaatioita yhteensä: " + total + ", suomalaisia: " + fin.length);
out("Viennin päivä: " + exportDate);
out("\nSuurimmat suomalaiset (ilmoitettu kulu):");
fin.slice(0, 10).forEach((o) => out("- " + o.n + " (" + o.cat + "): kulu " + (o.cost || o.min + "–" + o.max)));
out("\nRahoitusdatan näyte:");
fin.slice(0, 3).forEach((o) => out("```\n" + o.n + ": " + o.fdraw + "\n```"));
