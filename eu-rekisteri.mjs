import fs from "node:fs";
import { execSync } from "node:child_process";

const out = (s) => console.log(s);
fs.mkdirSync("data/eu", { recursive: true });
execSync('curl -L -sS -A "Mozilla/5.0" --retry 3 --max-time 600 -o /tmp/reg.xml "https://transparency-register.europa.eu/odplastorganisationxml_en"', { stdio: "inherit" });

const dec = (s) => String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const get = (b, t) => {
  const m = String(b || "").match(new RegExp("<" + t + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + t + ">"));
  return m ? m[1] : "";
};
const all = (b, t) => [...String(b || "").matchAll(new RegExp("<" + t + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + t + ">", "g"))].map((m) => m[1]);
const txt = (b, t) => dec(get(b, t).replace(/<[^>]+>/g, " "));
const num = (s) => { const n = parseFloat(String(s || "").replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };

const catCount = {}, countryCount = {};
const fin = [];
let total = 0;

function handle(blk) {
  total++;
  const head = get(blk, "headOffice");
  const country = txt(head, "country");
  const cat = txt(blk, "registrationCategory");
  countryCount[country] = (countryCount[country] || 0) + 1;
  catCount[cat] = (catCount[cat] || 0) + 1;
  if (!/^finland$/i.test(country)) return;

  const fd = get(blk, "financialData");
  const cy = get(fd, "closedYear") || fd;
  const costs = get(cy, "costs");
  const range = get(costs, "range");
  const costMin = num(get(range, "min"));
  const costMax = num(get(range, "max"));
  const costAbs = range ? 0 : num(get(costs, "absoluteCost"));

  const grants = all(get(cy, "grants"), "grant")
    .map((g) => ({ s: txt(g, "source"), a: num(get(get(g, "amount"), "absoluteCost")) }))
    .filter((g) => g.s || g.a);
  const grantTotal = grants.reduce((a, g) => a + g.a, 0);

  const budget = num(get(get(cy, "totalBudget"), "absoluteCost"));
  const contrib = all(get(cy, "contributions"), "contributor")
    .map((c) => ({ n: txt(c, "name"), a: num(get(get(c, "amount"), "absoluteCost")) }))
    .filter((c) => c.n);

  const clients = all(get(cy, "clients"), "client")
    .map((c) => {
      const r = get(get(c, "revenue"), "range");
      return { n: txt(c, "name"), min: num(get(r, "min")), max: num(get(r, "max")) };
    })
    .filter((c) => c.n);
  const rr = get(get(cy, "totalAnnualRevenue"), "range");

  const nameBlk = get(blk, "name");
  fin.push({
    id: txt(blk, "identificationCode"),
    n: txt(nameBlk, "originalName"),
    a: txt(blk, "acronym"),
    cat,
    form: txt(blk, "entityForm"),
    city: txt(head, "city"),
    web: txt(blk, "webSiteURL"),
    reg: txt(blk, "registrationDate").slice(0, 10),
    upd: txt(blk, "lastUpdateDate").slice(0, 10),
    fte: txt(blk, "membersFTE"),
    ep: txt(blk, "EPAccreditedNumber"),
    goals: txt(blk, "goals").slice(0, 400),
    interests: all(get(blk, "interests"), "interest").map((x) => dec(x.replace(/<[^>]+>/g, " "))).filter(Boolean).slice(0, 12),
    legis: txt(blk, "EULegislativeProposals").slice(0, 600),
    fy: [txt(cy, "startDate").slice(0, 10), txt(cy, "endDate").slice(0, 10)],
    costMin, costMax, costAbs,
    grants, grantTotal,
    budget,
    contrib: contrib.slice(0, 15),
    clients: clients.slice(0, 30),
    revMin: num(get(rr, "min")), revMax: num(get(rr, "max"))
  });
}

const stream = fs.createReadStream("/tmp/reg.xml", { encoding: "utf8" });
let buf = "";
const END = "</interestRepresentative>";
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
const exportDate = (fs.readFileSync("/tmp/reg.xml", "utf8").slice(0, 3000).match(/<exportDate>(.*?)<\/exportDate>/) || [, ""])[1];
fs.unlinkSync("/tmp/reg.xml");

fs.writeFileSync("data/eu/avoimuus.json", JSON.stringify({
  updated: new Date().toISOString(),
  exportDate,
  source: "EU:n avoimuusrekisteri",
  note: "Kulut ja rahoitus ovat organisaatioiden itse ilmoittamia lukuja viimeksi päättyneeltä tilikaudelta.",
  total,
  categories: catCount,
  countries: countryCount,
  finland: fin
}));

const fmt = (n) => Math.round(n).toLocaleString("fi-FI");
out("## Avoimuusrekisteri (uusi haku)");
out("Organisaatioita yhteensä: " + total + ", suomalaisia: " + fin.length);
out("Viennin päivä: " + exportDate);

const lob = (o) => o.costAbs || o.costMax;
out("\n### Suurimmat vaikuttamiskulut (suomalaiset)");
[...fin].sort((a, b) => lob(b) - lob(a)).slice(0, 10)
  .forEach((o) => out("- " + o.n + ": " + (o.costAbs ? fmt(o.costAbs) : fmt(o.costMin) + "–" + fmt(o.costMax)) + " €"));

out("\n### Suurimmat saadut avustukset (suomalaiset)");
[...fin].sort((a, b) => b.grantTotal - a.grantTotal).slice(0, 10)
  .forEach((o) => out("- " + o.n + ": " + fmt(o.grantTotal) + " €"));

const withCost = fin.filter((o) => lob(o) > 0).length;
const withGrants = fin.filter((o) => o.grantTotal > 0).length;
const withClients = fin.filter((o) => o.clients.length > 0).length;
out("\nKulutieto: " + withCost + ", avustustieto: " + withGrants + ", asiakastieto: " + withClients);
