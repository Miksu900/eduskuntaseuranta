import fs from "fs";

const KEY = process.env.FINGRID_API_KEY;
if (!KEY) { console.error("FINGRID_API_KEY puuttuu"); process.exit(1); }
const BASE = "https://data.fingrid.fi/api";
const IDS = [124, 192, 74, 181, 188, 191, 183, 194, 248, 177, 245, 265];
const DAYS = 7;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { "x-api-key": KEY, Accept: "application/json" } });
    if (r.ok) return r.json();
    console.log("  HTTP " + r.status + " " + url.replace(BASE, ""));
    if (r.status === 404 || r.status === 401 || r.status === 403) return null;
    await sleep(5000);
  }
  return null;
}

fs.mkdirSync("data/fingrid", { recursive: true });
const end = new Date();
const start = new Date(end.getTime() - DAYS * 86400000);
const iso = (d) => d.toISOString().replace(/\.\d+Z$/, "Z");
const index = [];
console.log("## Fingrid-haku " + iso(end) + "\n");
console.log("| id | nimi | yksikkö | rivejä | viimeisin arvo | aika |\n|---|---|---|---|---|---|");

for (const id of IDS) {
  const meta = await get(BASE + "/datasets/" + id);
  await sleep(2200);
  const rows = [];
  let url = BASE + "/datasets/" + id + "/data?format=json&pageSize=20000&sortBy=startTime&sortOrder=asc&startTime=" + iso(start) + "&endTime=" + iso(end);
  for (let p = 0; p < 5 && url; p++) {
    const j = await get(url);
    await sleep(2200);
    if (!j) break;
    const arr = Array.isArray(j) ? j : (j.data || []);
    for (const x of arr) rows.push([x.startTime, Number(x.value)]);
    const pg = j.pagination;
    url = pg && pg.nextPage ? pg.nextPage : null;
  }
  const name = meta ? (meta.nameEn || meta.name || meta.title || meta.nameFi || "?") : "?";
  const nameFi = meta ? (meta.nameFi || meta.name || name) : "?";
  const unit = meta ? (meta.unitEn || meta.unit || meta.unitFi || "") : "";
  const h = new Map();
  for (const [t, v] of rows) {
    if (!isFinite(v)) continue;
    const k = t.slice(0, 13);
    const o = h.get(k) || [0, 0];
    o[0] += v; o[1]++; h.set(k, o);
  }
  const hourly = [...h.entries()].map(([k, o]) => [k + ":00:00Z", Math.round((o[0] / o[1]) * 100) / 100]);
  const last = rows.length ? rows[rows.length - 1] : [null, null];
  fs.writeFileSync("data/fingrid/" + id + ".json", JSON.stringify({ id, name, nameFi, unit, updated: iso(end), latest: last, hourly }));
  index.push({ id, name, nameFi, unit, n: rows.length, latest: last });
  console.log("| " + id + " | " + name + " | " + unit + " | " + rows.length + " | " + last[1] + " | " + last[0] + " |");
}
fs.writeFileSync("data/fingrid/index.json", JSON.stringify({ updated: iso(end), datasets: index }));
