import { readdirSync, readFileSync, existsSync } from "node:fs";
// Finlex: uusimmat säädökset (lait ja asetukset) Oikeusministeriön Finlex-avoimesta datasta. Ei avainta.
// Lista: /akn/fi/act/statute/list?startYear=YYYY, jokaisen säädöksen otsikko ja päivämäärät luetaan sen XML:stä.
// Jos haku epäonnistuu, sivusto rakentuu silti.

export const API = process.env.FINLEX_API || "https://opendata.finlex.fi/finlex/avoindata/v1";
const BUDGET_MS = Number(process.env.FINLEX_BUDGET_MS || 4 * 60 * 1000);

const ent = s => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

let lastErr = "", errN = 0, cooldownUntil = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function getText(url, ms = 40000) {
  for (let i = 0; i < 6; i++) {
    const wait = cooldownUntil - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: "application/xml, application/json" } });
      if (r.status === 429 || r.status === 503) {
        const ra = Number(r.headers.get("retry-after")) || 0;
        cooldownUntil = Date.now() + Math.min(90000, Math.max(ra * 1000, 12000 * (i + 1)));
        throw new Error("HTTP " + r.status);
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) {
      lastErr = (e.cause && e.cause.code ? e.cause.code + " " : "") + e.message + " " + url.slice(-40);
      errN++;
      if (i === 5) return null;
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

export function parseStatute(xml) {
  const t = xml.replace(/\s+/g, " ");
  const title = ent(((t.match(/<docTitle[^>]*>(.*?)<\/docTitle>/) || [])[1] || "").replace(/<[^>]*>/g, "")).trim();
  const num = (t.match(/<docNumber[^>]*>([^<]*)</) || [])[1] || "";
  const issued = (t.match(/<FRBRdate date="([^"]+)" name="dateIssued"/) || [])[1] || "";
  const published = (t.match(/<FRBRdate date="([^"]+)" name="datePublished"/) || [])[1] || "";
  return { title, num: num.trim(), issued, published };
}

export function kindOf(title) {
  const head = String(title).slice(0, 70).toLowerCase();
  if (/asetus/.test(head)) return "Asetus";
  if (/^laki\b|\blaki\b|\blain\b|\blaiksi\b|\blakia\b/.test(head)) return "Laki";
  return "Muu säädös";
}

export async function listYear(y) {
  const refs = [];
  let ok = false;
  for (let page = 1; page <= 400; page++) {
    const txt = await getText(`${API}/akn/fi/act/statute/list?page=${page}&limit=10&format=json&startYear=${y}&endYear=${y}`);
    if (!txt) break;
    let arr; try { arr = JSON.parse(txt); } catch { break; }
    if (!Array.isArray(arr)) break;
    for (const x of arr) {
      const m = String(x.akn_uri || "").match(/statute\/(\d{4})\/([^/]+)\/fin@/);
      if (m && Number(m[1]) === y) refs.push({ year: y, n: m[2], url: x.akn_uri });
    }
    if (arr.length < 10) { ok = true; break; }
    await sleep(120);
  }
  const seen = new Set();
  return { refs: refs.filter(r => (seen.has(r.n) ? false : (seen.add(r.n), true))), ok };
}

export const lastErrInfo = () => ({ errN, lastErr });

// Arkisto: data/finlex/YYYY.json = {year, complete, rows:[[n,title,issued,published],...]}
export function loadFinlexArchive(dir = "data/finlex") {
  if (!existsSync(dir)) return null;
  const years = {};
  for (const f of readdirSync(dir)) {
    if (!/^\d{4}\.json$/.test(f)) continue;
    try {
      const j = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
      if (!j.rows.length) continue;
      years[j.year] = j.rows.map(r => ({ year: j.year, n: r[0], title: r[1], issued: r[2], published: r[3] }))
        .sort((a, b) => (parseInt(b.n, 10) || 0) - (parseInt(a.n, 10) || 0));
    } catch (e) { console.log("Finlex-arkisto: virhe " + f + " " + e.message); }
  }
  const n = Object.values(years).reduce((a, b) => a + b.length, 0);
  console.log(`Finlex-arkisto: ${Object.keys(years).length} vuotta, ${n} säädöstä`);
  return n ? { years } : null;
}

export async function loadFinlex() {
  const t0 = Date.now();
  try {
    const year = new Date().getFullYear();
    const refs = [];
    for (const y of [year, year - 1]) {
      for (let page = 1; page <= 150; page++) {
        const txt = await getText(`${API}/akn/fi/act/statute/list?page=${page}&limit=10&format=json&startYear=${y}&endYear=${y}`);
        if (!txt) break;
        let arr; try { arr = JSON.parse(txt); } catch { break; }
        if (!Array.isArray(arr) || !arr.length) break;
        for (const x of arr) {
          const m = String(x.akn_uri || "").match(/statute\/(\d{4})\/([^/]+)\/fin@/);
          if (m) refs.push({ year: Number(m[1]), n: m[2], url: x.akn_uri });
        }
        if (arr.length < 10) break;
      }
      console.log(`Finlex: vuosi ${y}, löytyi yhteensä ${refs.length}`);
    }
    if (!refs.length) throw new Error("säädöksiä ei löytynyt");
    const seen = new Set();
    const uniq = refs.filter(r => (seen.has(r.url) ? false : (seen.add(r.url), true)));
    const numOf = r => parseInt(r.n, 10) || 0;
    uniq.sort((a, b) => b.year - a.year || numOf(b) - numOf(a));
    const pick = uniq.slice(0, 320);
    const out = [];
    let noTitle = 0;
    let i = 0;
    const worker = async () => {
      while (i < pick.length && Date.now() - t0 < BUDGET_MS) {
        const r = pick[i++];
        const xml = await getText(r.url, 60000);
        if (!xml) continue;
        const p = parseStatute(xml);
        if (p.title) out.push({ year: r.year, n: r.n, ...p });
        else { noTitle++; if (noTitle === 1) console.log("Finlex: ei otsikkoa, alku: " + xml.slice(0, 200).replace(/\s+/g, " ")); }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    out.sort((a, b) => b.year - a.year || (parseInt(b.n, 10) || 0) - (parseInt(a.n, 10) || 0));
    console.log(`Finlex: virheitä ${errN}, viimeisin: ${lastErr}, ilman otsikkoa ${noTitle}`);
    console.log(`Finlex: säädöksiä luettu ${out.length} (aikaa ${Math.round((Date.now() - t0) / 1000)} s)`);
    if (!out.length) return null;
    return { rows: out };
  } catch (e) {
    console.log("Finlex ohitettu: " + e.message);
    return null;
  }
}

export function finlexPages({ shell, esc, dateFi, data }) {
  if (data.years) return finlexArchivePages({ shell, esc, dateFi, data });
  const rows = data.rows.map(r => ({ ...r, kind: kindOf(r.title) }));
  const count = k => rows.filter(r => r.kind === k).length;
  const link = r => `https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/${r.year}/${encodeURIComponent(r.n)}`;
  const card = r => `<div class="card" data-k="${esc(r.kind)}" data-t="${esc((r.title + " " + r.n + "/" + r.year).toLowerCase())}"><b>${esc(r.title)}</b><br><span class="meta">${esc(r.kind)} ${esc(r.n)}/${r.year}${r.issued ? " · annettu " + dateFi(r.issued) : ""}${r.published ? " · julkaistu " + dateFi(r.published) : ""}</span><br><a href="${link(r)}" rel="noopener">Lue Finlexissä</a></div>`;
  const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot ovat Oikeusministeriön Finlex-oikeustietopalvelun avoimesta datasta (finlex.fi). Listassa ovat uusimmat Suomen säädöskokoelmaan julkaistut lait ja asetukset. Otsikko ja päivämäärät ovat Finlexin tietoja sellaisenaan. Tässä näkyy vain säädöksen otsikko. Koko teksti on Finlexissä. Tämä ei ole virallinen lähde, ja ajantasainen lainsäädäntö on aina Finlexissä.</div>`;
  const FILTER = `<input id="lf" type="search" placeholder="Hae lakia tai asetusta" style="width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<div style="margin:6px 0 12px"><label style="margin-right:14px"><input type="radio" name="lk" value="" checked> Kaikki (${rows.length})</label><label style="margin-right:14px"><input type="radio" name="lk" value="Laki"> Lait (${count("Laki")})</label><label><input type="radio" name="lk" value="Asetus"> Asetukset (${count("Asetus")})</label></div>
<script>(function(){var f=document.getElementById("lf"),rs=document.querySelectorAll('input[name=lk]');function up(){var q=f.value.toLowerCase().trim(),k=(document.querySelector('input[name=lk]:checked')||{}).value||"";document.querySelectorAll("[data-t]").forEach(function(c){var ok=(!q||c.getAttribute("data-t").indexOf(q)>-1)&&(!k||c.getAttribute("data-k")===k);c.style.display=ok?"":"none"})}f.oninput=up;rs.forEach(function(r){r.onchange=up})})()</script>`;
  return [{
    path: "/lait/",
    html: shell({
      title: "Uudet lait ja asetukset | Eduskuntaseuranta",
      desc: "Uusimmat Suomen säädöskokoelmaan julkaistut lait ja asetukset Finlexistä, haettavana ja linkillä alkuperäiseen tekstiin.",
      path: "/lait/",
      body: `<h1>Uudet lait ja asetukset</h1><p>Mitä on juuri säädetty? Tässä ovat uusimmat lait ja asetukset Finlexistä. Eduskunnan äänestyksistä näet, miten edustajat äänestivät.</p>${NOTE}${FILTER}${rows.map(card).join("")}`,
    }),
  }];
}

const KN = ["Laki", "Asetus", "Muu säädös"];
function finlexArchivePages({ shell, esc, dateFi, data }) {
  const yrs = Object.keys(data.years).map(Number).sort((a, b) => b - a);
  const all = [];
  for (const y of yrs) for (const r of data.years[y]) all.push({ ...r, k: KN.indexOf(kindOf(r.title)) });
  const link = r => `https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/${r.year}/${encodeURIComponent(r.n)}`;
  const card = r => `<div class="card"><b>${esc(r.title)}</b><br><span class="meta">${esc(KN[r.k])} ${esc(r.n)}/${r.year}${r.issued ? " · annettu " + dateFi(r.issued) : ""}${r.published ? " · julkaistu " + dateFi(r.published) : ""}</span><br><a href="${link(r)}" rel="noopener">Lue Finlexissä</a></div>`;
  const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot ovat Oikeusministeriön Finlex-oikeustietopalvelun avoimesta datasta (finlex.fi). Arkistossa on ${all.length.toLocaleString("fi-FI")} Suomen säädöskokoelmaan julkaistua lakia ja asetusta vuosilta ${yrs[yrs.length - 1]}–${yrs[0]}. Otsikko ja päivämäärät ovat Finlexin tietoja sellaisenaan. Tässä näkyy vain säädöksen otsikko. Koko teksti on Finlexissä. Tämä ei ole virallinen lähde, ja ajantasainen lainsäädäntö on aina Finlexissä.</div>`;
  const recent = all.slice(0, 300);
  const FILTER = `<input id="lf" type="search" placeholder="Hae koko arkistosta, esim. verotus tai ulkomaalaislaki" style="width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<div style="margin:6px 0 12px"><label style="margin-right:14px"><input type="radio" name="lk" value="" checked> Kaikki</label><label style="margin-right:14px"><input type="radio" name="lk" value="0"> Lait</label><label><input type="radio" name="lk" value="1"> Asetukset</label></div>
<div id="lst" class="meta"></div><div id="res"></div>
<script>(function(){var f=document.getElementById("lf"),res=document.getElementById("res"),st=document.getElementById("lst"),def=document.getElementById("def"),idx=null,loading=false,KN=${JSON.stringify(KN)};
function kind(){return (document.querySelector('input[name=lk]:checked')||{}).value||""}
function card(r){var d=document.createElement("div");d.className="card";var b=document.createElement("b");b.textContent=r[2];d.appendChild(b);d.appendChild(document.createElement("br"));var m=document.createElement("span");m.className="meta";m.textContent=KN[r[3]]+" "+r[1]+"/"+r[0];d.appendChild(m);d.appendChild(document.createElement("br"));var a=document.createElement("a");a.href="https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/"+r[0]+"/"+encodeURIComponent(r[1]);a.rel="noopener";a.textContent="Lue Finlexissä";d.appendChild(a);return d}
function run(){var q=f.value.toLowerCase().trim().split(/\s+/).filter(Boolean),k=kind();res.textContent="";
if(!q.length&&!k){def.style.display="";st.textContent="";return}
def.style.display="none";
if(!idx){st.textContent="Ladataan arkistoa…";if(!loading){loading=true;fetch("/data/lait-haku.json").then(function(r){return r.json()}).then(function(j){idx=j.map(function(r){r.push((r[2]+" "+r[1]+"/"+r[0]).toLowerCase());return r});run()}).catch(function(){st.textContent="Arkiston lataus epäonnistui."})}return}
var out=[],n=0;for(var i=0;i<idx.length;i++){var r=idx[i];if(k!==""&&String(r[3])!==k)continue;var ok=true;for(var j=0;j<q.length;j++){if(r[4].indexOf(q[j])<0){ok=false;break}}if(ok){n++;if(out.length<100)out.push(r)}}
st.textContent=n+" osumaa"+(n>100?", näytetään 100 ensimmäistä. Tarkenna hakua." :"");out.forEach(function(r){res.appendChild(card(r))})}
f.oninput=run;document.querySelectorAll('input[name=lk]').forEach(function(r){r.onchange=run})})()</script>`;
  const yearLinks = `<p>${yrs.map(y => `<a href="/lait/${y}/">${y}</a>`).join(" · ")}</p>`;
  const pages = [{
    path: "/lait/",
    html: shell({
      title: "Lait ja asetukset | Eduskuntaseuranta",
      desc: "Suomen säädöskokoelman lait ja asetukset haettavana, linkillä Finlexin alkuperäiseen tekstiin.",
      path: "/lait/",
      body: `<h1>Lait ja asetukset</h1><p>Mitä on säädetty ja milloin? Hae koko arkistosta tai selaa vuosittain. Eduskunnan äänestyksistä näet, miten edustajat äänestivät.</p>${NOTE}<h2>Selaa vuosittain</h2>${yearLinks}${FILTER}<div id="def"><h2>Uusimmat</h2>${recent.map(card).join("")}</div>`,
    }),
  }];
  for (const y of yrs) {
    const rs = all.filter(r => r.year === y);
    if (!rs.length) continue;
    pages.push({
      path: `/lait/${y}/`,
      html: shell({
        title: `Lait ja asetukset ${y} | Eduskuntaseuranta`,
        desc: `Vuoden ${y} säädöskokoelmaan julkaistut ${rs.length} lakia ja asetusta.`,
        path: `/lait/${y}/`,
        body: `<h1>Lait ja asetukset ${y}</h1><p>${rs.length} säädöstä. <a href="/lait/">Hae koko arkistosta</a></p>${NOTE}${rs.map(card).join("")}`,
      }),
    });
  }
  pages.files = [{ path: "/data/lait-haku.json", content: JSON.stringify(all.map(r => [r.year, r.n, r.title, r.k])) }];
  return pages;
}
