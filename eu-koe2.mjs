import fs from "node:fs";

function out(s) { console.log(s); }

// Virtaava CSV-lukija (kestää lainausmerkit ja rivinvaihdot kentissä)
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

const csv = process.argv[2];
const xml = process.argv[3];

out("## FTS-koe (2024)");
out("Tiedoston koko: " + (fs.statSync(csv).size / 1048576).toFixed(1) + " MB");

let header = null, n = 0, ci = -1, ai = -1, ni = -1;
const fin = [], samples = [];
await readCsv(csv, (r) => {
  if (!header) {
    header = r;
    out("\nSarakkeet (" + r.length + "):");
    r.forEach((h, i) => out(i + ": " + h));
    ci = r.findIndex((h) => /country/i.test(h) && /benef/i.test(h));
    if (ci < 0) ci = r.findIndex((h) => /country/i.test(h));
    ai = r.findIndex((h) => /amount/i.test(h));
    ni = r.findIndex((h) => /name of benef/i.test(h));
    out("\nMaasarake: " + ci + " (" + r[ci] + "), summa: " + ai + " (" + r[ai] + "), nimi: " + ni);
    return;
  }
  n++;
  if (samples.length < 3) samples.push(r);
  if (ci >= 0 && /^(finland|fi)$/i.test((r[ci] || "").trim())) fin.push(r);
});
out("\nRivejä yhteensä: " + n);
out("Suomalaisia saajarivejä: " + fin.length);
const by = new Map();
for (const r of fin) {
  const k = r[ni];
  const v = parseFloat((r[ai] || "0").replace(/[^0-9.\-]/g, "")) || 0;
  by.set(k, (by.get(k) || 0) + v);
}
out("\nSuurimmat suomalaiset saajat (summa):");
[...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([k, v]) => out("- " + k + ": " + Math.round(v).toLocaleString("fi-FI") + " €"));
out("\nNäyterivit:");
samples.forEach((r) => out("```\n" + JSON.stringify(r).slice(0, 1200) + "\n```"));

out("\n## Avoimuusrekisteri XML");
const x = fs.readFileSync(xml, "utf8");
out("Koko: " + (x.length / 1048576).toFixed(1) + " MB");
out("Alku:\n```\n" + x.slice(0, 2500) + "\n```");
const tags = new Map();
for (const m of x.slice(0, 3000000).matchAll(/<([A-Za-z0-9_:\-]+)[ >\/]/g)) {
  tags.set(m[1], (tags.get(m[1]) || 0) + 1);
}
out("\nTagit (ensimmäiset 3 MB):");
[...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)
  .forEach(([k, v]) => out("- " + k + ": " + v));
