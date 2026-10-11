// Finlex: uusimmat säädökset (lait ja asetukset) Oikeusministeriön Finlex-avoimesta datasta. Ei avainta.
// Lista: /akn/fi/act/statute/list?startYear=YYYY, jokaisen säädöksen otsikko ja päivämäärät luetaan sen XML:stä.
// Jos haku epäonnistuu, sivusto rakentuu silti.

const API = process.env.FINLEX_API || "https://opendata.finlex.fi/finlex/avoindata/v1";
const BUDGET_MS = Number(process.env.FINLEX_BUDGET_MS || 4 * 60 * 1000);

const ent = s => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

async function getText(url, ms = 40000) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
      if (!r.ok) throw new Error(String(r.status));
      return await r.text();
    } catch (e) { if (i === 1) return null; }
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
    let i = 0;
    const worker = async () => {
      while (i < pick.length && Date.now() - t0 < BUDGET_MS) {
        const r = pick[i++];
        const xml = await getText(r.url, 60000);
        if (!xml) continue;
        const p = parseStatute(xml);
        if (p.title) out.push({ year: r.year, n: r.n, ...p });
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    out.sort((a, b) => b.year - a.year || (parseInt(b.n, 10) || 0) - (parseInt(a.n, 10) || 0));
    console.log(`Finlex: säädöksiä luettu ${out.length} (aikaa ${Math.round((Date.now() - t0) / 1000)} s)`);
    if (!out.length) return null;
    return { rows: out };
  } catch (e) {
    console.log("Finlex ohitettu: " + e.message);
    return null;
  }
}

export function finlexPages({ shell, esc, dateFi, data }) {
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
