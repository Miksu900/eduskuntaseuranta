import fs from "fs";

const URL = "https://api.porssisahko.net/v1/latest-prices.json";
console.log("## Hintahaku\n");
const r = await fetch(URL, { headers: { Accept: "application/json" } });
console.log("HTTP " + r.status + "\n");
const txt = await r.text();
console.log("```\n" + txt.slice(0, 400) + "\n```\n");
if (!r.ok) process.exit(1);

const j = JSON.parse(txt);
const arr = Array.isArray(j) ? j : (j.prices || j.data || []);
const fresh = arr
  .map((x) => ({
    s: x.startDate || x.start || x.startTime,
    e: x.endDate || x.end || x.endTime,
    p: Number(x.price !== undefined ? x.price : x.value),
  }))
  .filter((x) => x.s && isFinite(x.p));

fs.mkdirSync("data/hinta", { recursive: true });
let old = [];
try { old = JSON.parse(fs.readFileSync("data/hinta/hinnat.json", "utf8")).prices || []; } catch (e) {}
const m = new Map();
for (const x of old) m.set(x.s, x);
for (const x of fresh) m.set(x.s, x);
const cut = Date.now() - 14 * 86400000;
const prices = [...m.values()]
  .filter((x) => Date.parse(x.s) >= cut)
  .sort((a, b) => Date.parse(a.s) - Date.parse(b.s));
fs.writeFileSync(
  "data/hinta/hinnat.json",
  JSON.stringify({ updated: new Date().toISOString(), source: "porssisahko.net", unit: "c/kWh", prices })
);

const now = Date.now();
const cur = prices.find((x) => Date.parse(x.s) <= now && (!x.e || now < Date.parse(x.e)));
console.log("Uusia rivejä: " + fresh.length + ", yhteensä tallessa: " + prices.length);
console.log("Ensimmäinen: " + (prices[0] ? prices[0].s : "-"));
console.log("Viimeinen: " + (prices.length ? prices[prices.length - 1].s : "-"));
console.log("Nyt: " + (cur ? cur.p + " c/kWh" : "ei löytynyt"));
