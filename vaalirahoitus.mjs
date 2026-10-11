// Vaalirahoitus: Vaali- ja puoluerahoitusvalvonnan (VTV) julkiset ehdokasilmoitukset, eduskuntavaalit 2023.
// Sivut ovat tavallisia HTML-sivuja: vaalipiirin sivulla on ehdokaslista ja linkit ilmoituksiin.
// Haetaan vain nykyisten kansanedustajien ilmoitukset. Yksityishenkilöiden nimiä ei kerätä, vain summat.
// Jos haku epäonnistuu, sivusto rakentuu silti ilman vaalirahoitusosiota.

const BASE = process.env.VR_BASE || "https://www.vaalirahoitusvalvonta.fi";
const ROOT = "/fi/index/vaalirahoitus/ilmoituksetvaaleittain/eduskuntavaalit2023";
const BUDGET_MS = Number(process.env.VR_BUDGET_MS || 7 * 60 * 1000);

const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ent = s => String(s).replace(/&euro;/g, "€").replace(/&ouml;/g, "ö").replace(/&auml;/g, "ä").replace(/&aring;/g, "å").replace(/&Ouml;/g, "Ö").replace(/&Auml;/g, "Ä").replace(/&Aring;/g, "Å").replace(/&eacute;/g, "é").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

async function getText(path, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + path, { signal: AbortSignal.timeout(40000), headers: { Accept: "text/html" } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.text();
    } catch (e) { if (i === tries - 1) return null; }
  }
  return null;
}

export function parseList(html) {
  const out = [];
  const flat = html.replace(/\s+/g, " ");
  for (const row of flat.match(/<tr>.*?<\/tr>/g) || []) {
    const name = (row.match(/<td>([^<]+, [^<]+)<\/td>/) || [])[1];
    const link = (row.match(/href="([^"]*vaalirahoitusilmoitus\.html)"/) || [])[1];
    if (name) out.push({ name: ent(name).trim(), link: link || "" });
  }
  return out;
}

const num = (txt, re) => { const m = txt.match(re); return m ? Number(m[1]) : null; };
export function parseReport(html) {
  const t = ent(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
  const N = "([0-9]+(?:\\.[0-9]+)?)";
  const r = {
    kulut: num(t, new RegExp("1\\. Vaalikampanjan kulut yhteensä " + N)),
    rahoitus: num(t, new RegExp("2\\. Vaalikampanjan rahoitus yhteensä (?:\\(rahoitus eritellään alla oleviin kohtiin\\) )?" + N)),
    omat: num(t, new RegExp("2\\.1 Rahoitus sisältää omia varoja yhteensä " + N)),
    lainat: num(t, new RegExp("2\\.2 Rahoitus sisältää ehdokkaan ja tukiryhmän ottamia lainoja yhteensä " + N)),
    yksityiset: num(t, new RegExp("2\\.3 Rahoitus sisältää yksityishenkilöiltä saatua tukea yhteensä " + N)),
    yritykset: num(t, new RegExp("2\\.4 Rahoitus sisältää yrityksiltä saatua tukea yhteensä " + N)),
    puolue: num(t, new RegExp("2\\.5 Rahoitus sisältää puolueelta saatua tukea yhteensä " + N)),
    puolueyhd: num(t, new RegExp("2\\.6 Rahoitus sisältää puolueyhdistyksiltä saatua tukea yhteensä " + N)),
    muut: num(t, new RegExp("2\\.7 Rahoitus sisältää muilta tahoilta saatua tukea yhteensä " + N)),
    valitetty: num(t, new RegExp("2\\.8 Rahoitus sisältää välitettyä tukea yhteensä " + N)),
  };
  return r.kulut == null && r.rahoitus == null ? null : r;
}

export async function loadVaalirahoitus(mps) {
  if (!mps || !mps.length) return null;
  const t0 = Date.now();
  try {
    // Nimihaku: etunimi (ensimmäinen) + sukunimi
    const idx = new Map();
    const add = (k, m) => { if (!k) return; idx.set(k, idx.has(k) && idx.get(k) !== m ? null : m); };
    for (const m of mps) {
      const first = String(m.etunimi || "").trim().split(/\s+/)[0];
      add(slug(first + " " + m.sukunimi), m);
      add(slug(m.etunimi + " " + m.sukunimi), m);
    }
    const found = [];
    for (let n = 1; n <= 13; n++) {
      const p = `${ROOT}/${String(n).padStart(2, "0")}.html`;
      const html = await getText(p);
      if (!html) continue;
      const title = (html.match(/<h1[^>]*>([^<]*)/) || [])[1] || "";
      const rows = parseList(html);
      for (const c of rows) {
        const [sur, giv] = c.name.split(/,\s*/);
        const m = idx.get(slug(String(giv || "").split(/\s+/)[0] + " " + sur)) || idx.get(slug(giv + " " + sur));
        if (m && c.link) found.push({ m, link: c.link, piiri: ent(title).replace(/\s*vaalipiiri\s*/i, "").trim() });
      }
    }
    console.log(`Vaalirahoitus: edustajaehdokkaita löytyi ${found.length} / ${mps.length}`);
    const out = [];
    let i = 0;
    const worker = async () => {
      while (i < found.length && Date.now() - t0 < BUDGET_MS) {
        const f = found[i++];
        const html = await getText(f.link);
        const rep = html ? parseReport(html) : null;
        if (rep) out.push({ slug: f.m.slug, name: f.m.name, party: f.m.party || "", piiri: f.piiri, url: BASE + f.link, ...rep });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    console.log(`Vaalirahoitus: ilmoituksia luettu ${out.length} (aikaa ${Math.round((Date.now() - t0) / 1000)} s)`);
    if (!out.length) return null;
    return { rows: out, year: 2023 };
  } catch (e) {
    console.log("Vaalirahoitus ohitettu: " + e.message);
    return null;
  }
}

const nf = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });
const eur = v => (v == null ? "–" : nf.format(v) + " €");
const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot ovat Valtiontalouden tarkastusviraston vaali- ja puoluerahoitusvalvonnan julkisista ehdokasilmoituksista, eduskuntavaalit 2023. Ehdokas ilmoittaa itse vaalikampanjansa kulut ja rahoituksen. Luvut ovat ilmoituksista sellaisenaan. Rahoituksen jako on ilmoittajan oma jaottelu. Sivusto näyttää vain summat. Yksityisten tukijoiden nimiä ei kerätä tänne. Ilmoituksessa voi olla myös tukiryhmän rahoitusta. Luku ei kerro, onko rahoitus ollut sopivaa tai vaikuttiko se päätöksiin.</div>`;

export function vaalirahoitusPages({ shell, esc, data }) {
  const rows = data.rows;
  const byMp = new Map(rows.map(r => [r.slug, r]));
  const pages = [];
  const sorted = [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), "fi"));
  const sum = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const filter = `<input id="vf" type="search" placeholder="Hae edustajaa tai puoluetta" style="width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<script>(function(){var f=document.getElementById("vf");f.oninput=function(){var q=f.value.toLowerCase().trim();document.querySelectorAll("[data-t]").forEach(function(c){c.style.display=!q||c.getAttribute("data-t").indexOf(q)>-1?"":"none"})}})()</script>`;
  const card = r => `<a class="card" data-t="${esc((r.name + " " + r.party + " " + r.piiri).toLowerCase())}" href="/edustaja/${r.slug}/"><b>${esc(r.name)}</b><br><span class="meta">${esc(r.party)}${r.party ? " · " : ""}kulut ${eur(r.kulut)} · yritysten tuki ${eur(r.yritykset)} · yksityisten tuki ${eur(r.yksityiset)}</span></a>`;
  const topCost = [...rows].filter(r => r.kulut > 0).sort((a, b) => b.kulut - a.kulut).slice(0, 15);
  const topCorp = [...rows].filter(r => r.yritykset > 0).sort((a, b) => b.yritykset - a.yritykset).slice(0, 15);
  pages.push({
    path: "/vaalirahoitus/",
    html: shell({
      title: "Vaalirahoitus: kansanedustajien kampanjat | Eduskuntaseuranta",
      desc: "Mitä kansanedustajien vaalikampanjat maksoivat ja kuka niitä rahoitti? Eduskuntavaalit 2023, Valtiontalouden tarkastusviraston ilmoitusten mukaan.",
      path: "/vaalirahoitus/",
      body: `<h1>Vaalirahoitus</h1><p>Mitä nykyisten kansanedustajien vaalikampanja maksoi ja mistä raha tuli? Tässä ovat eduskuntavaalien 2023 ilmoitukset.</p>${NOTE}
<p class="meta">${rows.length} kansanedustajaa. Ilmoitetut kulut yhteensä ${eur(sum("kulut"))}, yritysten tuki yhteensä ${eur(sum("yritykset"))}, yksityisten tuki yhteensä ${eur(sum("yksityiset"))}.</p>
<h2>Suurimmat ilmoitetut kulut</h2>${topCost.map(card).join("")}
<h2>Eniten yritysten tukea</h2>${topCorp.map(card).join("")}
<h2>Kaikki kansanedustajat</h2>${filter}${sorted.map(card).join("")}`,
    }),
  });
  const blocks = new Map();
  for (const r of rows) {
    const share = (r.rahoitus > 0 && r.yritykset != null) ? Math.round(100 * r.yritykset / r.rahoitus) : null;
    blocks.set(r.slug, `<h2 id="vaalirahoitus">Vaalirahoitus 2023</h2>
<p>Ilmoitetut kampanjan kulut <b>${eur(r.kulut)}</b>${share != null ? `. Rahoituksesta ${share} % tuli yrityksiltä` : ""}.</p>
<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tbody>
<tr><td>Omat varat</td><td style="text-align:right"><b>${eur(r.omat)}</b></td></tr>
<tr><td>Lainat</td><td style="text-align:right"><b>${eur(r.lainat)}</b></td></tr>
<tr><td>Yksityishenkilöiden tuki</td><td style="text-align:right"><b>${eur(r.yksityiset)}</b></td></tr>
<tr><td>Yritysten tuki</td><td style="text-align:right"><b>${eur(r.yritykset)}</b></td></tr>
<tr><td>Puolueen tuki</td><td style="text-align:right"><b>${eur(r.puolue)}</b></td></tr>
<tr><td>Puolueyhdistysten tuki</td><td style="text-align:right"><b>${eur(r.puolueyhd)}</b></td></tr>
<tr><td>Muiden tahojen tuki</td><td style="text-align:right"><b>${eur(r.muut)}</b></td></tr>
<tr><td>Rahoitus yhteensä</td><td style="text-align:right"><b>${eur(r.rahoitus)}</b></td></tr></tbody></table></div>
<p class="meta">Ehdokkaan oma ilmoitus ${esc(String(data.year))} vaaleista. <a href="${esc(r.url)}" rel="noopener">Katso alkuperäinen ilmoitus</a> · <a href="/vaalirahoitus/">Kaikki kansanedustajat</a></p>`);
  }
  pages.blocks = blocks;
  return pages;
}
