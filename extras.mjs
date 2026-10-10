// Uutiset (RSS rakennusvaiheessa) ja blogi. Ei vaadi tietokantaa uutisille.
import { POSTS } from "./blogi.mjs";

// Uutislähteet. Jokaisella lähteellä voi olla useita vaihtoehtoisia osoitteita: ensimmäinen toimiva valitaan.
// Näytetään vain otsikko, lähde, aika ja suora linkki alkuperäiseen juttuun (Ylen RSS-ehtojen mukaisesti).
const FEEDS = [
  { lahde: "Yle", laji: "uutinen", urls: ["https://yle.fi/rss/t/18-38033/fi"] },
  { lahde: "Yle", laji: "mielipide", urls: ["https://yle.fi/rss/t/18-215844/fi"] },
  { lahde: "Iltalehti", laji: "uutinen", urls: ["https://www.iltalehti.fi/rss/politiikka.xml", "https://www.iltalehti.fi/rss/uutiset.xml"] },
  { lahde: "Helsingin Sanomat", laji: "uutinen", urls: ["https://www.hs.fi/rss/politiikka.xml", "https://www.hs.fi/rss/tuoreimmat.xml"] },
  { lahde: "Maaseudun Tulevaisuus", laji: "uutinen", urls: ["https://www.mt.fi/rss/politiikka", "https://www.mt.fi/rss/uutiset", "https://www.mt.fi/rss.xml"] },
];
const OPINION = /mielipide|kolumni|kommentti|pääkirjoitus|vieraskynä|analyysi|kannanotto|\/kolumni|\/mielipide/i;
// Otsikkosuodatin yleisfeedeille (Iltalehti/HS varavaihtoehto): vain politiikkaan ja yhteiskuntaan liittyvät
const POLITICAL = /eduskun|hallitus|ministeri|puolue|kansanedust|vaali|presidentti|pääministeri|oppositio|budjetti|laki|lakiesit|veroj|vero\b|maahanmuut|turvapaikka|nato|eu\b|ps\b|kok\b|sdp|keskusta|vihreät|vasemmisto|rkp|kd\b|liike nyt|orpo|purra|marin|stubb|puolustus|ulkopolit|politiik/i;

const dec = s => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
  .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? dec(m[1]) : ""; };

export function parseRss(xml) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(m => m[0]);
  return items.map(it => {
    const link = tag(it, "link") || (it.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "";
    const cats = [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map(m => dec(m[1])).join(" ");
    const d = new Date(tag(it, "pubDate") || tag(it, "dc:date") || "");
    return { otsikko: tag(it, "title"), url: link.trim(), aika: isNaN(d) ? null : d, cats };
  }).filter(x => x.otsikko && /^https?:\/\//.test(x.url));
}

async function fetchText(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "Eduskuntaseuranta/1.0 (+https://eduskuntaseuranta.fi)", accept: "application/rss+xml, application/xml, text/xml, */*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(to); }
}

export async function loadNews() {
  const out = [], status = [];
  for (const f of FEEDS) {
    let ok = false;
    for (const u of f.urls) {
      try {
        const items = parseRss(await fetchText(u));
        if (!items.length) throw new Error("ei juttuja");
        const general = !/politiikka|18-38033/.test(u) && f.laji !== "mielipide";
        let n = 0;
        for (const it of items.slice(0, 40)) {
          const op = f.laji === "mielipide" || OPINION.test(it.url + " " + it.cats + " " + it.otsikko);
          if (general && !op && !POLITICAL.test(it.otsikko)) continue;
          out.push({ lahde: f.lahde, laji: op ? "mielipide" : "uutinen", otsikko: it.otsikko, url: it.url, aika: it.aika });
          n++;
        }
        status.push(`${f.lahde} (${f.laji}): ${n} juttua osoitteesta ${u}`);
        ok = true; break;
      } catch (e) { status.push(`${f.lahde} (${f.laji}): EI TOIMI ${u} – ${e.message}`); }
    }
  }
  const seen = new Set();
  const list = out.filter(x => (seen.has(x.url) ? false : seen.add(x.url)))
    .sort((a, b) => (b.aika || 0) - (a.aika || 0)).slice(0, 80);
  console.log("Uutislähteet:\n  " + status.join("\n  "));
  return list;
}

const fmtTime = d => d ? new Date(d).toLocaleString("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export function newsPage(news, { shell, esc }) {
  const sources = [...new Set(news.map(n => n.lahde))];
  const rows = news.map(n => `<a class="card nw" data-s="${esc(n.lahde)}" href="${esc(n.url)}" rel="noopener nofollow" target="_blank"><div>${esc(n.otsikko)}</div><div class="meta">${esc(n.lahde)} · ${esc(fmtTime(n.aika))}${n.laji === "mielipide" ? ' · <span class="op">Mielipide / kolumni</span>' : ""}</div></a>`).join("");
  const chips = ["Kaikki", ...sources].map((s, i) => `<button type="button" data-f="${esc(s)}"${i === 0 ? ' class="on"' : ""}>${esc(s)}</button>`).join("");
  const js = `<script>(function(){var b=document.querySelectorAll("[data-f]"),c=document.querySelectorAll(".nw");b.forEach(function(x){x.onclick=function(){b.forEach(function(y){y.classList.remove("on")});x.classList.add("on");var f=x.getAttribute("data-f");c.forEach(function(k){k.style.display=(f==="Kaikki"||k.getAttribute("data-s")===f)?"":"none"})}})})();</script>`;
  const body = `<h1>Politiikan ja yhteiskunnan uutiset</h1>
<p class="meta">Otsikot suomalaisilta uutismedioilta yhteen paikkaan. Linkki vie aina alkuperäiseen juttuun. Lista päivittyy useita kertoja päivässä.</p>
<div class="share">${chips}</div>${news.length ? rows : "<p>Uutisia ei saatu juuri nyt. Kokeile hetken kuluttua uudelleen.</p>"}${js}
<p class="note">Otsikot ja linkit ovat uutismedioiden RSS-syötteistä. Jutut ja otsikot kuuluvat niiden tekijöille. Mielipide- ja kolumnijutut on merkitty erikseen, ne ovat kirjoittajiensa näkemyksiä, eivät Eduskuntaseurannan. Valinta perustuu lähteiden omiin politiikkaosioihin, ei Eduskuntaseurannan arvioon jutun puolueellisuudesta.</p>`;
  return shell({ title: "Politiikan ja yhteiskunnan uutiset | Eduskuntaseuranta", desc: "Politiikan ja yhteiskunnan uutisotsikot Ylestä, Iltalehdestä, Helsingin Sanomista ja Maaseudun Tulevaisuudesta yhdessä paikassa.", path: "/uutiset/", body, head: "<style>.op{color:#e6b450}</style>" });
}

// ---------- Blogi ----------
function inline(s, esc) {
  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, a, u) => `<a href="${u}" rel="noopener">${a}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  return t;
}
function md(text, esc) {
  return String(text).trim().split(/\n\s*\n/).map(block => {
    const b = block.trim();
    if (b.startsWith("## ")) return `<h2>${inline(b.slice(3), esc)}</h2>`;
    if (b.split("\n").every(l => l.trim().startsWith("- "))) return `<ul>${b.split("\n").map(l => `<li>${inline(l.trim().slice(2), esc)}</li>`).join("")}</ul>`;
    return `<p>${inline(b, esc).replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
}

export function blogPages({ shell, esc, SITE, SB, KEY, dateFi }) {
  const all = POSTS.filter(p => p.julkaise !== false).sort((a, b) => String(b.pvm).localeCompare(String(a.pvm)));
  const pages = [];
  const base = p => (p.laji === "vieras" ? "/vieraskyna/" : "/blogi/");
  const label = p => p.laji === "vieras" ? `<div class="ai" style="background:#2a2417;border-color:#b8860b">Vieraskyn\u00e4. Kirjoittaja: ${esc(p.kirjoittaja)}. N\u00e4kemykset ovat kirjoittajan omia, eiv\u00e4t Eduskuntaseurannan. Julkaistu vasta toimittajan hyv\u00e4ksynn\u00e4n j\u00e4lkeen.</div>` : `<div class="note">Kirjoittaja: ${esc(p.kirjoittaja || "Miika Koskela")}. Blogissa esitetyt kannat ovat kirjoittajan omia. Sivuston luvut ja \u00e4\u00e4nestystiedot ovat puolueettomia.</div>`;
  for (const p of all) {
    const b = base(p), nm = p.laji === "vieras" ? "Vieraskyn\u00e4" : "Blogi";
    pages.push({ path: `${b}${p.slug}/`, html: shell({ title: `${p.otsikko} | Eduskuntaseuranta`, desc: p.tiivistelma || p.otsikko, path: `${b}${p.slug}/`, body: `<p class="meta"><a href="${b}">\u2190 ${nm}</a></p><h1>${esc(p.otsikko)}</h1><p class="meta">${esc(dateFi(p.pvm))} \u00b7 ${esc(p.kirjoittaja || "Miika Koskela")}</p>${label(p)}${md(p.teksti, esc)}<div class="share"><button data-share>Jaa t\u00e4m\u00e4 kirjoitus</button></div>` }) });
  }
  const listOf = arr => arr.map(p => `<a class="card" href="${base(p)}${p.slug}/"><div><b>${esc(p.otsikko)}</b></div><div class="meta">${esc(dateFi(p.pvm))} \u00b7 ${esc(p.kirjoittaja || "Miika Koskela")}</div>${p.tiivistelma ? `<div class="meta">${esc(p.tiivistelma)}</div>` : ""}</a>`).join("");
  const own = all.filter(p => p.laji !== "vieras"), guest = all.filter(p => p.laji === "vieras");
  pages.push({ path: "/blogi/", html: shell({ title: "Blogi | Eduskuntaseuranta", desc: "Eduskuntaseurannan blogi: Miika Koskelan kirjoituksia politiikasta ja yhteiskunnasta.", path: "/blogi/", body: `<h1>Blogi</h1><p>Miikan kirjoituksia politiikasta ja yhteiskunnasta. Blogin kannat ovat kirjoittajan omia. Sivuston \u00e4\u00e4nestysluvut pysyv\u00e4t puolueettomina.</p>${listOf(own) || "<p>Ensimm\u00e4inen kirjoitus tulossa pian.</p>"}<p><a class="btn" href="/blogi/rss.xml">RSS</a></p>` }) });
  pages.push({ path: "/vieraskyna/", html: shell({ title: "Vieraskyn\u00e4 | Eduskuntaseuranta", desc: "Vieraskyn\u00e4kirjoituksia politiikasta ja yhteiskunnasta. Kirjoittajien omia n\u00e4kemyksi\u00e4.", path: "/vieraskyna/", body: `<h1>Vieraskyn\u00e4</h1><p>Muiden kirjoittajien tekstej\u00e4 politiikasta ja yhteiskunnasta. N\u00e4kemykset ovat kirjoittajien omia, eiv\u00e4t Eduskuntaseurannan. Mik\u00e4\u00e4n kirjoitus ei tule julkaistuksi ennen kuin toimittaja on lukenut ja hyv\u00e4ksynyt sen.</p>${listOf(guest) || "<p>Ei viel\u00e4 julkaistuja vieraskyn\u00e4kirjoituksia.</p>"}<p><a class="btn" href="/vieraskyna/kirjoita/">Kirjoita vieraskyn\u00e4</a></p>` }) });
  const formJs = `<script>(function(){var f=document.getElementById("vk");f.addEventListener("submit",function(e){e.preventDefault();var m=document.getElementById("vkm"),b=f.querySelector("button");if(f.www.value){return}b.disabled=true;m.textContent="Lähetetään...";fetch(${JSON.stringify(SB + "/functions/v1/vieraskyna")},{method:"POST",headers:{"Content-Type":"application/json",apikey:${JSON.stringify(KEY)},Authorization:"Bearer "+${JSON.stringify(KEY)}},body:JSON.stringify({nimi:f.nimi.value.trim(),sposti:f.sposti.value.trim(),otsikko:f.otsikko.value.trim(),teksti:f.teksti.value.trim()})}).then(function(r){if(r.ok){f.style.display="none";m.textContent="Kiitos! Kirjoitus on vastaanotettu. Luen sen ja otan yhteyttä sähköpostitse.";}else{b.disabled=false;m.textContent="Lähetys epäonnistui. Tarkista kentät ja yritä uudelleen."}}).catch(function(){b.disabled=false;m.textContent="Lähetys epäonnistui. Yritä uudelleen."})})})();</script>`;
  const inp = "width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#1b1b1b;color:#fff;font:inherit";
  pages.push({ path: "/vieraskyna/kirjoita/", html: shell({ title: "Kirjoita vieraskynä | Eduskuntaseuranta", desc: "Lähetä vieraskynäkirjoitus Eduskuntaseurannan blogiin.", path: "/vieraskyna/kirjoita/", body: `<p class="meta"><a href="/vieraskyna/">← Vieraskynä</a></p><h1>Kirjoita vieraskynä</h1>
<p>Haluatko kirjoittaa politiikasta tai yhteiskunnasta? Lähetä tekstisi tällä lomakkeella. Luen jokaisen. Julkaisen vain asialliset, perustellut ja lakia noudattavat kirjoitukset. Voin pyytää korjauksia ja tarkistan tosiasiat ennen julkaisua. Mikään ei julkaista ennen kuin olen hyväksynyt sen, ja lopullisen version hyväksyt sinä. Vieraskynät merkitään selvästi: näkemys on kirjoittajan oma, ei Eduskuntaseurannan.</p>
<form id="vk" style="display:grid;gap:10px;max-width:640px">
<input name="nimi" required maxlength="80" placeholder="Nimi (julkaistaan kirjoituksen yhteydessä)" style="${inp}">
<input name="sposti" type="email" required maxlength="120" placeholder="Sähköposti (ei julkaista)" style="${inp}">
<input name="otsikko" required maxlength="140" placeholder="Otsikko" style="${inp}">
<textarea name="teksti" required minlength="300" maxlength="12000" rows="14" placeholder="Teksti (vähintään 300 merkkiä)" style="${inp}"></textarea>
<input name="www" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<button type="submit">Lähetä</button>
</form><p id="vkm" class="meta"></p>${formJs}
<p class="note">Lomake tallentaa nimesi, sähköpostiosoitteesi ja tekstin pelkästään kirjoituksen käsittelyä varten. Tietoja ei luovuteta eteenpäin.</p>` }) });

  const items = own.slice(0, 20).map(p => `<item><title>${esc(p.otsikko)}</title><link>${SITE}/blogi/${p.slug}/</link><guid>${SITE}/blogi/${p.slug}/</guid><pubDate>${new Date(p.pvm).toUTCString()}</pubDate><description>${esc(p.tiivistelma || p.otsikko)}</description></item>`).join("");
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Eduskuntaseuranta: blogi</title><link>${SITE}/blogi/</link><description>Kirjoituksia politiikasta ja yhteiskunnasta</description><language>fi</language>${items}</channel></rss>`;
  return { pages, rss };
}
