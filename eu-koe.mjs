const H = { "User-Agent": "Mozilla/5.0 (compatible; eduskuntaseuranta-probe)" };
console.log("## EU-koehaku 2\n");

async function getJson(u) {
  const r = await fetch(u, { headers: Object.assign({ Accept: "application/json" }, H) });
  const t = await r.text();
  console.log("HTTP " + r.status + " " + u);
  try { return JSON.parse(t); } catch (e) { console.log(t.slice(0, 300)); return null; }
}

console.log("### Dataportaalin haku\n");
for (const q of ["transparency register", "financial transparency system fts"]) {
  console.log("**Haku: " + q + "**\n");
  try {
    const d = await getJson("https://data.europa.eu/api/hub/search/search?q=" + encodeURIComponent(q) + "&limit=8&filter=dataset");
    const res = (d && d.result && d.result.results) || [];
    console.log("Tuloksia: " + res.length + "\n");
    for (const r of res) {
      const title = r.title && (r.title.en || Object.values(r.title)[0]);
      console.log("- " + r.id + " | " + title);
      for (const dist of (r.distributions || []).slice(0, 6)) {
        const urls = [].concat(dist.download_url || [], dist.access_url || []);
        const f = dist.format && (dist.format.id || dist.format.label || dist.format);
        console.log("  - " + f + " " + urls.join(" "));
      }
    }
  } catch (e) { console.log("Virhe: " + e.message); }
  console.log("");
}

console.log("### FTS-tiedostojen arvaus\n");
const base = "https://ec.europa.eu/budget/financial-transparency-system/download/";
const names = [];
for (const y of [2023, 2024]) for (const ext of ["csv", "xlsx", "zip"]) names.push(y + "_FTS_dataset_en." + ext);
for (const n of names) {
  try {
    const r = await fetch(base + n, { headers: Object.assign({ Range: "bytes=0-300" }, H), redirect: "follow" });
    const t = r.status < 300 ? (await r.text()).slice(0, 150).replace(/\s+/g, " ") : "";
    console.log("- " + r.status + " " + (r.headers.get("content-type") || "") + " " + n + " " + t);
  } catch (e) { console.log("- virhe " + n + ": " + e.message); }
}
