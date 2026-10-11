// Julkiset hankinnat: Hilma (hankintailmoitukset.fi) AVP-Read-rajapinnasta.
// Haku: POST https://api.hankintailmoitukset.fi/avp/eformnotices/docs/search (Azure Search). Avain: HILMA_API_KEY.
// Kaikki haut on suojattu: jos jokin kysely epäonnistuu, sivusto rakentuu silti ja lokiin jää syy.

const API = process.env.HILMA_API || "https://api.hankintailmoitukset.fi";
const YLE_YTUNNUS = "0215438-8";

async function search(key, body) {
  const r = await fetch(API + "/avp/eformnotices/docs/search", {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Hilma ${r.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

export async function loadHilma(key) {
  if (!key) { console.log("Hankinnat ohitettu: HILMA_API_KEY puuttuu."); return null; }
  const out = { recent: [], awards: [], yle: [], count: null };
  const run = async (nimi, body, keep) => {
    try {
      const d = await search(key, body);
      const rows = (d.value || []).filter(keep || (() => true));
      console.log(`Hilma ${nimi}: ${rows.length} ilmoitusta` + (d["@odata.count"] != null ? ` (osumia ${d["@odata.count"]})` : ""));
      return { rows, count: d["@odata.count"] ?? null };
    } catch (e) { console.log(`Hilma ${nimi} epäonnistui: ${e.message}`); return { rows: [], count: null }; }
  };
  const base = { top: 300, count: true, orderby: "datePublished desc" };
  const a = await run("uusimmat", { ...base, search: "*", filter: "isCancelled eq false" });
  out.recent = a.rows; out.count = a.count;
  let b = await run("jälki-ilmoitukset", { ...base, search: "*", filter: "isCancelled eq false and mainType eq 'ContractAwardNotices'" });
  if (!b.rows.length) b = await run("jälki-ilmoitukset (varahaku)", { ...base, search: "*" }, n => /Award/i.test(n.mainType || "") || n.type === "E4");
  out.awards = b.rows;
  const c = await run("Yle", { ...base, search: "Yleisradio" }, n => /yleisradio/i.test(n.organisationNameFi || "") || n.organisationNationalRegistrationNumber === YLE_YTUNNUS);
  out.yle = c.rows;
  const first = out.awards[0] || out.recent[0];
  if (first) console.log("Hilma kentät (esimerkki): " + Object.keys(first).filter(k => first[k] != null && first[k] !== "").join(", "));
  const winnerKeys = first ? Object.keys(first).filter(k => /winner|contractor|supplier|tenderer|awardee/i.test(k)) : [];
  if (winnerKeys.length) console.log("Voittajakentät: " + winnerKeys.join(", "));
  if (!out.recent.length && !out.awards.length && !out.yle.length) return null;
  return out;
}

const MAIN = { ContractNotices: "Hankintailmoitus", PriorInformationNotices: "Ennakkoilmoitus", ContractAwardNotices: "Jälki-ilmoitus (sopimus tehty)", ContractModificationNotices: "Sopimusmuutos" };
const TYPE = { E1: "Markkinakartoitus", E3: "Kansallinen hankintailmoitus", E4: "Kansallinen jälki-ilmoitus" };
const nf = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });
const kind = n => TYPE[n.type] || MAIN[n.mainType] || n.mainType || "Ilmoitus";
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function winnerOf(n) {
  for (const k of Object.keys(n)) if (/winner|contractor|supplier|awardee/i.test(k) && typeof n[k] === "string" && n[k].trim() && !/id$|number$|address$|nuts|type$/i.test(k)) return n[k];
  return "";
}

export function hankinnatPages({ shell, esc, dateFi, data }) {
  const all = new Map();
  for (const n of [...data.recent, ...data.awards, ...data.yle]) if (n && n.id) all.set(n.id, n);
  const list = [...all.values()].sort((a, b) => String(b.datePublished || "").localeCompare(String(a.datePublished || "")));
  const buyer = n => n.organisationNameFi || "Tuntematon hankkija";
  const bySlug = new Map();
  for (const n of list) { const s = slug(buyer(n)); if (!s) continue; if (!bySlug.has(s)) bySlug.set(s, { name: buyer(n), ytunnus: n.organisationNationalRegistrationNumber || "", items: [] }); bySlug.get(s).items.push(n); }

  const card = (n, showBuyer = true) => {
    const amt = Number(n.noticeResultTotalAmount);
    const win = winnerOf(n);
    const ted = n.tedPublicationId ? `<a href="https://ted.europa.eu/fi/notice/-/detail/${esc(n.tedPublicationId)}" rel="noopener">Katso TED:ssä</a> · ` : "";
    const buyerLink = showBuyer ? `<a href="/hankinnat/${slug(buyer(n))}/">${esc(buyer(n))}</a> · ` : "";
    const text = `${n.titleFi || ""} ${buyer(n)} ${win} ${n.cpvCodes || ""}`.toLowerCase();
    return `<div class="card" data-t="${esc(text)}"><b>${esc(n.titleFi || "(ei otsikkoa)")}</b><br>
<span class="meta">${buyerLink}${esc(kind(n))} · julkaistu ${dateFi(n.datePublished)}${n.deadline && /Contract(?!Award)|Prior/.test(n.mainType || "") ? " · määräaika " + dateFi(n.deadline) : ""}</span>
${win ? `<br><span class="meta">Valittu toimittaja: ${esc(win)}</span>` : ""}${amt > 0 ? `<br><span class="meta">Arvo ilmoituksen mukaan: ${nf.format(amt)} €</span>` : ""}
<br><span class="meta">${ted}Ilmoitusnumero ${esc(n.noticeNumber || n.noticeId || "")}</span></div>`;
  };
  const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot tulevat Hilma-hankintapalvelusta (hankintailmoitukset.fi, Hansel Oy) sen avoimen rajapinnan kautta. Ilmoitus kertoo, mitä hankitaan, kuka hankkii ja mihin mennessä tarjoukset on jätettävä. Jälki-ilmoituksessa kerrotaan valittu toimittaja ja arvo. Ilmoituksen arvo on arvio tai sopimuksen arvo ilmoitushetkellä, ei välttämättä lopullinen maksettu summa. Kaikista hankinnoista ei tehdä ilmoitusta, esimerkiksi pienimmät jäävät kynnysarvon alle.</div>`;
  const FILTER = `<input id="hf" type="search" placeholder="Hae otsikosta, hankkijasta tai toimittajasta" style="width:100%;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<script>(function(){var f=document.getElementById("hf");f.oninput=function(){var q=f.value.toLowerCase().trim();document.querySelectorAll(".card[data-t]").forEach(function(c){c.style.display=!q||c.getAttribute("data-t").indexOf(q)>-1?"":"none"})}})()</script>`;

  const pages = [];
  const recent = list.filter(n => !/Award/i.test(n.mainType || "") && n.type !== "E4").slice(0, 60);
  const awards = list.filter(n => /Award/i.test(n.mainType || "") || n.type === "E4").slice(0, 60);
  const topBuyers = [...bySlug.entries()].sort((a, b) => b[1].items.length - a[1].items.length).slice(0, 12);
  pages.push({
    path: "/hankinnat/",
    html: shell({
      title: "Julkiset hankinnat | Eduskuntaseuranta", desc: "Mitä Suomen valtio, kunnat ja julkiset yhtiöt ostavat? Uusimmat hankintailmoitukset ja tehdyt sopimukset Hilmasta.", path: "/hankinnat/",
      body: `<h1>Julkiset hankinnat</h1><p>Mitä valtio, kunnat ja julkiset yhtiöt ostavat veronmaksajien rahoilla? Tähän on koottu uusimmat hankintailmoitukset ja tehdyt sopimukset. Luvut ovat ilmoituksista sellaisenaan.</p>${NOTE}
${data.yle.length ? `<p><a href="/hankinnat/${slug(data.yle[0].organisationNameFi)}/">Yleisradion hankinnat (${data.yle.length})</a></p>` : ""}
${FILTER}
<h2>Tehdyt sopimukset</h2>${awards.length ? awards.map(n => card(n)).join("") : '<p class="note">Jälki-ilmoituksia ei saatu haettua tällä kertaa.</p>'}
<h2>Uusimmat hankintailmoitukset</h2>${recent.map(n => card(n)).join("")}
<h2>Eniten ilmoituksia tässä aineistossa</h2><p>${topBuyers.map(([s, b]) => `<a class="tag" href="/hankinnat/${s}/">${esc(b.name)} (${b.items.length})</a>`).join(" ")}</p>`,
    }),
  });
  for (const [s, b] of [...bySlug.entries()].sort((a, c) => c[1].items.length - a[1].items.length).slice(0, 250)) {
    const total = b.items.reduce((t, n) => t + (Number(n.noticeResultTotalAmount) > 0 && (/Award/i.test(n.mainType || "") || n.type === "E4") ? Number(n.noticeResultTotalAmount) : 0), 0);
    pages.push({
      path: `/hankinnat/${s}/`,
      html: shell({
        title: `${b.name}: hankinnat | Eduskuntaseuranta`, desc: `${b.name} hankintailmoitukset Hilmassa: mitä hankitaan ja kenelle sopimus on tehty.`, path: `/hankinnat/${s}/`,
        body: `<h1>${esc(b.name)}: hankinnat</h1><p class="meta">${b.ytunnus ? "Y-tunnus " + esc(b.ytunnus) + " · " : ""}${b.items.length} ilmoitusta aineistossa${total > 0 ? " · jälki-ilmoitusten arvot yhteensä " + nf.format(total) + " €" : ""}</p>${NOTE}${FILTER}${b.items.map(n => card(n, false)).join("")}<p><a href="/hankinnat/">Kaikki hankinnat</a></p>`,
      }),
    });
  }
  return pages;
}
