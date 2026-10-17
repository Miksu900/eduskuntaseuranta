// Viranomais- ja organisaatiotiedotteet (RSS rakennusvaiheessa). Näytetään otsikko, lähde, aika ja linkki alkuperäiseen.
// Syötteet tunnistettu GitHubin ajoympäristöstä toimiviksi (scripts/syotekoe.mjs, 17.10.2026).
// Ministeriöt, poliisi ja THL estävät automaattiset haut; niiden tiedotteet tulevat pääosin STT Infon kautta.
import { parseRss } from "./extras.mjs";

export const SYOTTEET = [
  { lahde: "STT Info: tiedotteet", ryhma: "Organisaatiot ja yritykset", url: "https://www.sttinfo.fi/rss/releases/latest" },
  { lahde: "STT Info: pörssitiedotteet", ryhma: "Organisaatiot ja yritykset", url: "https://www.sttinfo.fi/rss/announcements/latest?lang=fi" },
  { lahde: "Kuntaliitto: tiedotteet", ryhma: "Valtio ja virastot", url: "https://www.kuntaliitto.fi/rss/kuntaliiton-tiedotteet.xml" },
  { lahde: "Kuntaliitto: lausunnot", ryhma: "Valtio ja virastot", url: "https://www.kuntaliitto.fi/rss/kuntaliiton-lausunnot.xml" },
  { lahde: "Kuntaliitto: yleiskirjeet", ryhma: "Valtio ja virastot", url: "https://www.kuntaliitto.fi/rss/kuntaliiton-yleiskirjeet.xml" },
  { lahde: "Valtiontalouden tarkastusvirasto", ryhma: "Valtio ja virastot", url: "https://vtv.fi/feed/" },
  { lahde: "Valtiokonttori", ryhma: "Valtio ja virastot", url: "https://www.valtiokonttori.fi/feed/" },
  { lahde: "Työterveyslaitos", ryhma: "Valtio ja virastot", url: "https://www.ttl.fi/topical/rss.xml" },
  { lahde: "Helsinki", ryhma: "Kunnat", url: "https://www.hel.fi/fi/uutiset/rss" },
  { lahde: "Espoo", ryhma: "Kunnat", url: "https://www.espoo.fi/fi/rss/news" },
  { lahde: "Vantaa", ryhma: "Kunnat", url: "https://www.vantaa.fi/fi/rss" },
  { lahde: "Oulu", ryhma: "Kunnat", url: "https://www.ouka.fi/news/feed?region=All&topic=All&audience=All" },
  { lahde: "Oulu: kuulutukset", ryhma: "Kunnat", url: "https://asiakirjat.ouka.fi/ktwebscr/kuul_rssfeed.htm" },
  { lahde: "Kuopio", ryhma: "Kunnat", url: "https://www.kuopio.fi/feed/" },
  { lahde: "Lahti", ryhma: "Kunnat", url: "https://www.lahti.fi/feed/" },
  { lahde: "Pori", ryhma: "Kunnat", url: "https://www.pori.fi/feed/" },
  { lahde: "Joensuu", ryhma: "Kunnat", url: "https://www.joensuu.fi/ajankohtaista/tiedotteet/feed/" },
  { lahde: "Vaasa", ryhma: "Kunnat", url: "https://www.vaasa.fi/feed/" },
  { lahde: "Kokkola", ryhma: "Kunnat", url: "https://www.kokkola.fi/feed/" },
  { lahde: "Ylivieska", ryhma: "Kunnat", url: "https://www.ylivieska.fi/feed/" },
];

async function hae(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; Eduskuntaseuranta/1.0; +https://eduskuntaseuranta.fi)", accept: "application/rss+xml, application/xml, text/xml, */*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    // Osa syötteistä (esim. Oulun kuulutukset) on ISO-8859-1-merkistössä: luetaan XML-esittelyn tai otsakkeen mukaan
    const buf = new Uint8Array(await r.arrayBuffer());
    const alku = new TextDecoder("latin1").decode(buf.slice(0, 300));
    const cs = ((alku.match(/encoding=["']([\w-]+)["']/i) || [])[1] || (r.headers.get("content-type") || "").match(/charset=([\w-]+)/i)?.[1] || "utf-8").toLowerCase();
    try { return new TextDecoder(cs).decode(buf); } catch { return new TextDecoder("utf-8").decode(buf); }
  } finally { clearTimeout(to); }
}

export async function loadTiedotteet() {
  const out = [];
  await Promise.all(SYOTTEET.map(async s => {
    try {
      const rows = parseRss(await hae(s.url)).slice(0, 60);
      for (const r of rows) out.push({ otsikko: r.otsikko, url: r.url, aika: r.aika ? r.aika.toISOString() : null, lahde: s.lahde, ryhma: s.ryhma });
      console.log(`Tiedotteet ${s.lahde}: ${rows.length}`);
    } catch (e) { console.log(`Tiedotteet ${s.lahde} epäonnistui: ${e.message}`); }
  }));
  const nahty = new Set();
  return out.filter(t => !nahty.has(t.url) && nahty.add(t.url)).sort((a, b) => String(b.aika || "").localeCompare(String(a.aika || "")));
}

export function tiedotteetPages({ shell, esc, dateFi, data }) {
  const ryhmat = ["Valtio ja virastot", "Kunnat", "Organisaatiot ja yritykset"];
  const kortti = t => `<a class="card ti" href="${esc(t.url)}" rel="noopener" data-q="${esc((t.otsikko + " " + t.lahde).toLowerCase())}"><div>${esc(t.otsikko)}</div><div class="meta">${esc(t.lahde)}${t.aika ? " · " + dateFi(t.aika) : ""}</div></a>`;
  const haku = `<input id="tq" type="search" placeholder="Hae tiedotteista, esim. kunnan nimi, laki tai yritys" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:inherit;margin:8px 0 4px">
<p class="meta" id="tn"></p>
<script>(function(){var q=document.getElementById("tq"),n=document.getElementById("tn"),c=[].slice.call(document.querySelectorAll(".ti"));q.addEventListener("input",function(){var w=q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean),k=0;c.forEach(function(e){var ok=!w.length||w.every(function(x){return e.dataset.q.indexOf(x)>-1});e.style.display=ok?"":"none";if(ok)k++});n.textContent=w.length?k+" osumaa":""})})()</script>`;
  const osiot = ryhmat.map(r => { const l = data.filter(t => t.ryhma === r).slice(0, 120); return l.length ? `<h2>${esc(r)}</h2>${l.map(kortti).join("")}` : ""; }).join("");
  const body = `<h1>Viranomaisten ja organisaatioiden tiedotteet</h1>
<p>Valtion virastojen, kuntien, Kuntaliiton sekä STT Infon kautta julkaistut tiedotteet yhdessä paikassa. Ministeriöiden tiedotteet tulevat pääosin STT Infon kautta. Lista päivittyy useita kertoja päivässä.</p>
<div class="note"><b>Haluatko hälytyksen, kun omasta aiheestasi tulee tiedote?</b> Seuraa-hälytykset kertovat sähköpostilla uusista tiedotteista, äänestyksistä ja julkisista hankinnoista. <a href="/ammattilaisille/">Katso palvelut</a></div>
${haku}${osiot || "<p>Tiedotteita ei juuri nyt saatu haettua.</p>"}
<p class="note">Lähteet: ${esc(SYOTTEET.map(s => s.lahde).join(", "))}. Näytetään vain otsikko ja linkki alkuperäiseen tiedotteeseen.</p>`;
  return [{ path: "/tiedotteet/", html: shell({ title: "Viranomaisten ja kuntien tiedotteet | Eduskuntaseuranta", desc: "Valtion virastojen, kuntien, Kuntaliiton ja STT Infon tiedotteet yhdessä paikassa. Hae ja seuraa omaa aihettasi.", path: "/tiedotteet/", body }) }];
}
