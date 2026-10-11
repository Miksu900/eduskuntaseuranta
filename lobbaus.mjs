// Lobbaus: Avoimuusrekisteri (avoimuusrekisteri.fi, VTV) avoin rajapinta. Ei avainta.
// Tiedot: toimintailmoitukset (kuka on ilmoittanut vaikuttamistoiminnasta, mistä aiheista ja keneen on oltu yhteydessä)
// ja edellisen vuoden vaikuttamistoiminnan kustannukset. Jos haku epäonnistuu, sivusto rakentuu silti.

const API = process.env.LOB_API || "https://public.api.avoimuusrekisteri.fi";

async function getJson(path, ms = 120000) {
  const r = await fetch(API + path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(ms) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t.slice(0, 160)}`);
  return JSON.parse(t);
}

const dash = x => (x && String(x).trim() && String(x).trim() !== "-" ? String(x).trim() : "");
export function targetLabel(t) {
  if (!t) return "";
  const f = t.fi || t;
  return [dash(f.organization), dash(f.department), dash(f.unit), dash(f.title), dash(f.name)].filter(Boolean).join(" · ");
}
export function targetGroup(t) {
  if (!t) return "";
  const f = t.fi || t;
  return [dash(f.organization), dash(f.department)].filter(Boolean).join(" · ");
}

export async function loadLobbaus() {
  try {
    const terms = await getJson("/open-data-term/all");
    const real = terms.filter(t => t.status !== "draft").sort((a, b) => b.id - a.id);
    if (!real.length) throw new Error("jaksoja ei löytynyt");
    const term = real[0];
    console.log(`Lobbaus: jakso ${term.id} (${String(term.reportingStartDate).slice(0, 10)} – ${String(term.reportingEndDate).slice(0, 10)}, ${term.status})`);
    let targets = [];
    try { targets = await getJson(`/open-data-target/all/${term.id}`); } catch (e) { console.log("Lobbaus: kohteet epäonnistui: " + e.message); }
    const tmap = new Map();
    for (const t of Array.isArray(targets) ? targets : []) if (t && t.id != null) tmap.set(t.id, t);
    console.log(`Lobbaus: kohteita ${tmap.size}`);
    const notes = await getJson(`/open-data-activity-notification/term/${term.id}`, 240000);
    if (!Array.isArray(notes) || !notes.length) throw new Error("ilmoituksia ei löytynyt");
    console.log(`Lobbaus: ilmoituksia ${notes.length}`);
    return { term, notes, tmap, terms: real };
  } catch (e) {
    console.log("Lobbaus ohitettu: " + e.message);
    return null;
  }
}

const nf = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const METHOD = { phone: "puhelin", mail: "sähköposti", online: "verkossa", meeting: "tapaaminen", letter: "kirje", other: "muu" };

function topicText(t) {
  if (!t) return "";
  const p = t.contactTopicProject;
  const pn = p && typeof p === "object" ? (p.title || p.name || p.fi || p.projectTitle || "") : (p || "");
  return dash(t.title) || dash(t.contactTopicOther) || dash(pn) || dash(t.contactTopicType) || "";
}

export function lobbausPages({ shell, esc, dateFi, data, mps = [] }) {
  const { term, notes, tmap } = data;
  let skipped = 0;
  const rows = [];
  const used = new Set();
  for (const n of notes) {
    // Vain yritykset ja yhteisöt, joilla on y-tunnus. Yksityishenkilöitä ei käsitellä.
    if (n.companyType && n.companyType !== "company_id") { skipped++; continue; }
    const topics = Array.isArray(n.topics) ? n.topics : [];
    let contacts = 0;
    const groups = new Map();
    for (const t of topics) for (const c of (t.contactedTargets || [])) {
      contacts++;
      const g = targetGroup(tmap.get(c.contactedTargetId));
      if (g) groups.set(g, (groups.get(g) || 0) + 1);
    }
    const fin = n.previousYearFinancials && n.previousYearFinancials.lobbying ? n.previousYearFinancials.lobbying : null;
    const cost = fin ? ["externalLobbyingGuidanceCosts", "marketingCosts", "representationCosts"].reduce((s, k) => s + (Number(fin[k]) || 0), 0) : 0;
    let s = slug(n.companyName) || "ilmoittaja";
    if (used.has(s)) s += "-" + slug(n.companyId || n.id);
    used.add(s);
    rows.push({ n, topics, contacts, groups, fin, cost, slug: s, name: n.companyName || "Ilmoittaja" });
  }
  console.log(`Lobbaus: sivuja ${rows.length}, ohitettu ${skipped}`);

  // Kansanedustajat: kohteen nimi yhdistetään edustajan sivuun. Epäselvät (kaksi samannimistä) jätetään pois.
  const idx = new Map();
  const addKey = (k, v) => { if (!k) return; idx.set(k, idx.has(k) && idx.get(k) !== v ? null : v); };
  for (const m of mps) {
    const first = String(m.etunimi || "").trim().split(/\s+/)[0];
    for (const k of [slug(first + " " + m.sukunimi), slug(m.etunimi + " " + m.sukunimi), slug(m.sukunimi + " " + first), slug(m.sukunimi + " " + m.etunimi)]) addKey(k, m.slug);
  }
  const mpNames = new Map(mps.map(m => [m.slug, `${m.etunimi || ""} ${m.sukunimi || ""}`.trim()]));
  const byMp = new Map();
  for (const r of rows) for (const t of r.topics) for (const c of (t.contactedTargets || [])) {
    const tg = tmap.get(c.contactedTargetId);
    const f = tg && (tg.fi || tg);
    if (!f || !/kansanedustaja/i.test(String(f.title || "")) || !dash(f.name)) continue;
    const ms = idx.get(slug(f.name));
    if (!ms) continue;
    if (!byMp.has(ms)) byMp.set(ms, new Map());
    const cm = byMp.get(ms);
    if (!cm.has(r.slug)) cm.set(r.slug, { name: r.name, slug: r.slug, n: 0, topics: new Set() });
    const e = cm.get(r.slug);
    e.n++;
    const tt = topicText(t);
    if (tt) e.topics.add(tt);
  }
  console.log(`Lobbaus: kansanedustajia joihin yhteydenottoja yhdistetty ${byMp.size}`);

  const groupTotals = new Map();
  for (const r of rows) for (const [g, c] of r.groups) groupTotals.set(g, (groupTotals.get(g) || 0) + c);

  const period = `${dateFi(term.reportingStartDate)}–${dateFi(term.reportingEndDate)}`;
  const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot ovat Avoimuusrekisteristä (avoimuusrekisteri.fi, Valtiontalouden tarkastusvirasto). Rekisteriin ilmoitetaan eduskuntaan ja ministeriöihin kohdistuvasta vaikuttamistoiminnasta. Tässä on ilmoitusjakso ${period}. Luvut ovat ilmoittajien omia ilmoituksia sellaisenaan. Yhteydenottojen määrä kertoo, kuinka monta kertaa ilmoittaja on kertonut olleensa yhteydessä johonkin kohteeseen. Se ei kerro, onnistuiko vaikuttaminen. Kaikki vaikuttaminen ei kuulu rekisterin piiriin.</div>`;
  const FILTER = `<input id="lf" type="search" placeholder="Hae ilmoittajaa tai aihetta" style="width:100%;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<script>(function(){var f=document.getElementById("lf");f.oninput=function(){var q=f.value.toLowerCase().trim();document.querySelectorAll("[data-t]").forEach(function(c){c.style.display=!q||c.getAttribute("data-t").indexOf(q)>-1?"":"none"})}})()</script>`;

  const topRows = [...rows].sort((a, b) => b.contacts - a.contacts).slice(0, 40);
  const topGroups = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  const withCost = [...rows].filter(r => r.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 25);

  const mpTotals = [...byMp.entries()].map(([sl, cm]) => ({ slug: sl, name: mpNames.get(sl) || sl, n: [...cm.values()].reduce((a, e) => a + e.n, 0), cos: cm.size }));
  const topMps = mpTotals.sort((a, b) => b.n - a.n).slice(0, 25);
  const link = r => `<a class="card" href="/lobbaus/${r.slug}/"><b>${esc(r.name)}</b><br><span class="meta">${nf.format(r.contacts)} yhteydenottoa · ${r.topics.length} aihetta${r.n.mainIndustry ? " · " + esc(r.n.mainIndustry) : ""}</span></a>`;
  const all = [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), "fi"));
  const pages = [];
  pages.push({
    path: "/lobbaus/",
    html: shell({
      title: "Lobbaus: kuka vaikuttaa päättäjiin | Eduskuntaseuranta",
      desc: "Avoimuusrekisterin tiedot: kuka on ilmoittanut vaikuttamistoiminnasta eduskuntaan ja ministeriöihin, mistä aiheista ja keneen on oltu yhteydessä.",
      path: "/lobbaus/",
      body: `<h1>Lobbaus</h1><p>Kuka yrittää vaikuttaa eduskuntaan ja ministeriöihin ja mistä asioista? Tähän on koottu Avoimuusrekisteriin ilmoitetut yhteydenotot.</p>${NOTE}
<p class="meta">${nf.format(rows.length)} ilmoittajaa · ilmoitusjakso ${period}</p>
<h2>Eniten ilmoitettuja yhteydenottoja</h2>${topRows.map(link).join("")}
<h2>Keihin yhteyttä on otettu eniten</h2><p class="meta">Kaikkien ilmoittajien ilmoittamat yhteydenotot yhteensä, organisaation ja yksikön mukaan.</p>
${topGroups.length ? topGroups.map(([g, c]) => `<div class="card"><b>${esc(g)}</b><br><span class="meta">${nf.format(c)} yhteydenottoa</span></div>`).join("") : '<p class="note">Kohteiden nimiä ei saatu haettua tällä kertaa.</p>'}
${topMps.length ? `<h2>Eniten yhteydenottoja saaneet kansanedustajat</h2><p class="meta">Ilmoittajien ilmoittamat yhteydenotot kansanedustajiin yhteensä.</p>${topMps.map(x => `<a class="card" href="/edustaja/${x.slug}/"><b>${esc(x.name)}</b><br><span class="meta">${nf.format(x.n)} yhteydenottoa · ${x.cos} ilmoittajaa</span></a>`).join("")}` : ""}
${withCost.length ? `<h2>Suurimmat ilmoitetut vaikuttamistoiminnan kulut</h2><p class="meta">Edellisen vuoden kulut: ulkopuolinen palvelu, markkinointi ja edustus yhteensä. Ilmoittajan oma arvio.</p>${withCost.map(r => `<a class="card" href="/lobbaus/${r.slug}/"><b>${esc(r.name)}</b><br><span class="meta">${nf.format(r.cost)} €</span></a>`).join("")}` : ""}
<h2>Kaikki ilmoittajat</h2>${FILTER}
${all.map(r => `<div data-t="${esc((r.name + " " + r.topics.map(topicText).join(" ")).toLowerCase())}">${link(r)}</div>`).join("")}`,
    }),
  });

  for (const r of rows) {
    const n = r.n;
    const fin = r.fin;
    const finHtml = fin ? `<h2>Vaikuttamistoiminnan kulut edellisenä vuonna</h2><table class="t"><tbody>
<tr><td>Henkilöitä vaikuttamistyössä</td><td><b>${nf.format(Number(fin.employeeTotal) || 0)}</b></td></tr>
<tr><td>Henkilötyövuodet</td><td><b>${esc(fin.manYears == null ? "–" : new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 }).format(Number(fin.manYears) || 0))}</b></td></tr>
<tr><td>Ulkopuoliset palvelut</td><td><b>${nf.format(Number(fin.externalLobbyingGuidanceCosts) || 0)} €</b></td></tr>
<tr><td>Markkinointi</td><td><b>${nf.format(Number(fin.marketingCosts) || 0)} €</b></td></tr>
<tr><td>Edustus</td><td><b>${nf.format(Number(fin.representationCosts) || 0)} €</b></td></tr></tbody></table><p class="meta">Ilmoittajan oma ilmoitus.</p>` : "";
    const topicsHtml = r.topics.length ? r.topics.map(t => {
      const tg = (t.contactedTargets || []).map(c => {
        const lab = targetLabel(tmap.get(c.contactedTargetId)) || `Kohde ${c.contactedTargetId}`;
        const m = (c.contactMethods || []).map(x => METHOD[x] || x).join(", ");
        return esc(lab) + (m ? ` <span class="meta">(${esc(m)})</span>` : "");
      });
      const client = dash(t.customerCompanyName);
      return `<div class="card"><b>${esc(topicText(t) || "(aihetta ei kerrottu)")}</b>${client ? `<br><span class="meta">Asiakas: ${esc(client)}</span>` : ""}${tg.length ? `<br><span class="meta">Yhteydenotot kohdistuivat:</span><br>${tg.join("<br>")}` : ""}</div>`;
    }).join("") : '<p class="note">Aiheita ei ole ilmoitettu.</p>';
    pages.push({
      path: `/lobbaus/${r.slug}/`,
      html: shell({
        title: `${r.name}: lobbaus | Eduskuntaseuranta`,
        desc: `${r.name} on ilmoittanut Avoimuusrekisteriin vaikuttamistoiminnasta: ${r.topics.length} aihetta, ${r.contacts} yhteydenottoa.`,
        path: `/lobbaus/${r.slug}/`,
        body: `<h1>${esc(r.name)}</h1><p class="meta">${n.companyId ? "Y-tunnus " + esc(n.companyId) + " · " : ""}${n.mainIndustry ? esc(n.mainIndustry) + " · " : ""}ilmoitus ${dateFi(n.activityNotificationDate)}${n.isOverdue ? " · ilmoitus myöhässä" : ""}</p>
<p><b>${nf.format(r.contacts)}</b> ilmoitettua yhteydenottoa, <b>${r.topics.length}</b> aihetta (jakso ${period}).</p>${NOTE}${finHtml}
<h2>Aiheet ja yhteydenotot</h2>${topicsHtml}<p><a href="/lobbaus/">Kaikki lobbaus</a></p>`,
      }),
    });
  }
  const mpBlocks = new Map();
  for (const [sl, cm] of byMp) {
    const list = [...cm.values()].sort((a, b) => b.n - a.n);
    const total = list.reduce((a, e) => a + e.n, 0);
    const card = e => `<a class="card" href="/lobbaus/${e.slug}/"><b>${esc(e.name)}</b><br><span class="meta">${e.n} yhteydenottoa${e.topics.size ? " · " + esc([...e.topics].slice(0, 2).join(" · ").slice(0, 200)) : ""}</span></a>`;
    const rest = list.slice(5, 60);
    mpBlocks.set(sl, `<h2 id="lobbaus">Lobbaus: ketkä ovat ottaneet yhteyttä</h2>
<p><b>${list.length}</b> ilmoittajaa on ilmoittanut ottaneensa yhteyttä tähän edustajaan, yhteensä <b>${total}</b> kertaa (jakso ${period}).</p>
${list.slice(0, 5).map(card).join("")}${rest.length ? `<details><summary><b>Näytä lisää (${list.length - 5})</b></summary>${rest.map(card).join("")}</details>` : ""}
<p class="meta">Avoimuusrekisterin ilmoitukset, ilmoittajien omia tietoja sellaisenaan. Yhteydenotto ei kerro, vaikuttiko se edustajan kantaan. <a href="/lobbaus/">Lisää lobbauksesta</a></p>`);
  }
  pages.mpBlocks = mpBlocks;
  pages.companyRows = rows.filter(r => r.n.companyId).map(r => ({ id: r.n.companyId, name: r.name, slug: r.slug, contacts: r.contacts, topics: r.topics.length }));
  return pages;
}
