// Etsii viranomaisten RSS-syötteet: hakee etusivun ja ajankohtaista-sivun, poimii rel=alternate-syötteet ja testaa ne.
const SITES = ["valtioneuvosto.fi","vm.fi","stm.fi","tem.fi","okm.fi","mmm.fi","lvm.fi","ym.fi","um.fi","intermin.fi","oikeusministerio.fi","defmin.fi","vnk.fi",
 "poliisi.fi","migri.fi","kela.fi","vero.fi","traficom.fi","ruokavirasto.fi","thl.fi","tukes.fi","kkv.fi","stat.fi","tilastokeskus.fi","sttinfo.fi","eduskunta.fi",
 "hel.fi","tampere.fi","ouka.fi","turku.fi","espoo.fi","vantaa.fi","kuntaliitto.fi","vtv.fi","oikeuskansleri.fi","oikeusasiamies.fi","valvira.fi","ely-keskus.fi","avi.fi","pelastustoimi.fi","rajavartiolaitos.fi","puolustusvoimat.fi","pirkanmaa.fi","jyvaskyla.fi","kuopio.fi","lahti.fi","pori.fi","joensuu.fi","seinajoki.fi","vaasa.fi","rovaniemi.fi","kokkola.fi","ylivieska.fi","hankintailmoitukset.fi","finlex.fi","valtiokonttori.fi","hansel.fi","prh.fi","avoindata.fi","julkaisut.valtioneuvosto.fi","lausuntopalvelu.fi","otakantaa.fi","kansalaisaloite.fi","fimea.fi","ttl.fi","energiavirasto.fi","fiva.fi","suomenpankki.fi"];
const STATUS = {};
const PATHS = ["/", "/ajankohtaista", "/fi/ajankohtaista", "/tiedotteet", "/fi/tiedotteet", "/uutiset", "/fi/uutiset", "/ajankohtaista/tiedotteet", "/rss", "/fi/rss", "/rss-syotteet", "/fi/rss-syotteet"];
const UA = { "user-agent": "Mozilla/5.0 (compatible; Eduskuntaseuranta/1.0; +https://eduskuntaseuranta.fi)", accept: "text/html,application/rss+xml,application/xml,*/*" };
async function get(u) { const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000); try { const r = await fetch(u, { headers: UA, signal: c.signal, redirect: "follow" }); return { ok: r.ok, status: r.status, url: r.url, text: r.ok ? await r.text() : "" }; } catch (e) { return { ok: false, status: String(e.message).slice(0, 40), text: "" }; } finally { clearTimeout(t); } }
const isFeed = t => /<rss[\s>]|<feed[\s>]|<rdf:RDF/i.test(t.slice(0, 3000));
const items = t => (t.match(/<item[\s>]|<entry[\s>]/gi) || []).length;
const first = t => { const m = t.match(/<item[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i) || t.match(/<entry[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 70) : ""; };
const found = [];
for (const s of SITES) {
  const cands = new Set();
  for (const p of PATHS) {
    const r = await get("https://" + s + p);
    if (p === "/") STATUS[s] = r.status;
    if (!r.ok) continue;
    if (isFeed(r.text)) { cands.add(r.url); continue; }
    for (const m of r.text.matchAll(/<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/gi)) { const h = (m[0].match(/href=["']([^"']+)["']/i) || [])[1]; if (h) cands.add(new URL(h.replace(/&amp;/g, "&"), r.url).href); }
    for (const m of r.text.matchAll(/href=["']([^"']*(?:rss|feed)[^"']*)["']/gi)) { try { const u = new URL(m[1].replace(/&amp;/g, "&"), r.url); if (u.hostname.endsWith(s.replace(/^www\./, "")) || /sttinfo/.test(u.hostname)) cands.add(u.href); } catch {} }
  }
  let ok = 0;
  for (const c of [...cands].slice(0, 25)) {
    const r = await get(c);
    if (r.ok && isFeed(r.text)) { ok++; found.push({ s, url: r.url, n: items(r.text), t: first(r.text) }); console.log(`::notice title=SYOTE ${s}::${r.url} | ${items(r.text)} | ${first(r.text)}`); }
  }
  if (!ok) console.log(`::warning title=EI ${s}::ehdokkaita ${cands.size}`);
}
import { writeFileSync } from "node:fs";
writeFileSync("syotekoe-tulos.json", JSON.stringify({ found, STATUS }, null, 1));
