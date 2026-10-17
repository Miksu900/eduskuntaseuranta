// Seuraa-hälytykset: lähettää kerran päivässä jokaiselle seuraajalle koosteen uusista äänestyksistä,
// tiedotteista ja julkisista hankinnoista, jotka osuvat hänen seurantoihinsa.
// Ajetaan GitHub Actionsissa (.github/workflows/halytykset.yml). Tarvitsee salaisuudet:
//   SUPABASE_SERVICE_KEY  (Supabase -> Project Settings -> API -> service_role / secret key)
//   BREVO_API_KEY         (Brevo -> SMTP & API -> API Keys)
// Ilman niitä skripti vain tulostaa, mitä se lähettäisi (kuivaharjoitus).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const SB = process.env.SUPABASE_URL || "https://arwenhbwzoavbonlwkdr.supabase.co";
const SERVICE = (process.env.SUPABASE_SERVICE_KEY || "").trim();
const BREVO = (process.env.BREVO_API_KEY || "").trim();
const SITE = (process.env.SITE_URL || "https://eduskuntaseuranta.fi").replace(/\/$/, "");
const LAHETTAJA = process.env.HALYTYS_LAHETTAJA || "miika@eduskuntaseuranta.fi";
const TILA = ".halytystila/tila.json";
const kuiva = !SERVICE || !BREVO || process.env.KUIVA === "1";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dfi = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", year: "numeric" }); };

async function sbGet(path) {
  const r = await fetch(`${SB}${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  if (!r.ok) throw new Error(`${path} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Seurannat-taulun käyttäjäsarake selvitetään tietokannan kuvauksesta (ei oleteta nimeä).
async function kayttajaSarake() {
  const spec = await sbGet("/rest/v1/");
  const cols = Object.keys(spec?.definitions?.seurannat?.properties || {});
  const ehd = cols.find(c => /^(kayttaja|user_id|user|uid|omistaja|kayttaja_id|profiili)$/i.test(c))
    || cols.find(c => (spec.definitions.seurannat.properties[c].format || "") === "uuid" && c !== "id");
  if (!ehd) throw new Error("Seurannat-taulusta ei löytynyt käyttäjäsaraketta: " + cols.join(", "));
  return ehd;
}

async function kayttajat() {
  const out = new Map();
  for (let page = 1; page < 50; page++) {
    const d = await sbGet(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const us = d.users || [];
    for (const u of us) if (u.email) out.set(u.id, u.email);
    if (us.length < 1000) break;
  }
  return out;
}

const osuu = (teksti, sana) => { const t = String(teksti || "").toLowerCase(); return String(sana).toLowerCase().split(/\s+/).filter(Boolean).every(w => t.includes(w)); };

function koosteHtml(nimiLista, osumat) {
  const osio = (otsikko, rivit) => rivit.length ? `<h3 style="font:600 16px system-ui;margin:20px 0 8px">${otsikko}</h3>` + rivit.map(r =>
    `<div style="margin:0 0 10px"><a href="${esc(r.url)}" style="color:#1a5fb4;font:600 15px system-ui;text-decoration:none">${esc(r.otsikko)}</a><div style="color:#666;font:13px system-ui">${esc(r.meta)}</div></div>`).join("") : "";
  return `<div style="max-width:600px;margin:0 auto;font:15px/1.5 system-ui;color:#111">
<h2 style="font:700 20px system-ui;margin:0 0 4px">Seurantasi: uutta ${dfi(new Date().toISOString())}</h2>
<p style="color:#666;margin:0 0 12px">Seuraat: ${esc(nimiLista.join(", "))}</p>
${osio("Eduskunnan äänestykset", osumat.aanestykset)}${osio("Tiedotteet", osumat.tiedotteet)}${osio("Julkiset hankinnat", osumat.hankinnat)}${osio("Edustajat", osumat.edustajat)}
<p style="color:#666;font-size:13px;margin-top:24px">Saat tämän, koska seuraat aiheita Eduskuntaseurannassa. <a href="${SITE}/seuranta/">Muokkaa tai lopeta seurannat</a> · <a href="${SITE}/ammattilaisille/">Palvelut organisaatioille</a></p></div>`;
}

async function laheta(to, aihe, html) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: LAHETTAJA, name: "Eduskuntaseuranta" }, to: [{ email: to }], subject: aihe, htmlContent: html }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status} ${(await r.text()).slice(0, 200)}`);
}

// Tarkistaa avaimet ja lähettäjän; tulos näkyy ajon huomautuksena (::notice), ei paljasta avaimia.
async function tarkista() {
  const rivit = [];
  rivit.push(`Supabase-avain: ${SERVICE ? "on" : "PUUTTUU"}`, `Brevo-avain: ${BREVO ? "on" : "PUUTTUU"}`);
  if (SERVICE) {
    try { const col = await kayttajaSarake(); const u = await kayttajat(); const s = await sbGet(`/rest/v1/seurannat?select=tyyppi&limit=100000`);
      rivit.push(`Supabase OK: ${u.size} käyttäjää, ${s.length} seurantaa (sarake ${col})`); }
    catch (e) { rivit.push(`Supabase VIRHE: ${e.message.slice(0, 120)}`); }
  }
  if (BREVO) {
    try {
      const r = await fetch("https://api.brevo.com/v3/senders", { headers: { "api-key": BREVO, accept: "application/json" } });
      if (!r.ok) rivit.push(`Brevo VIRHE ${r.status}`);
      else { const d = await r.json(); const l = (d.senders || []).find(x => x.email?.toLowerCase() === LAHETTAJA.toLowerCase());
        rivit.push(`Brevo OK. Lähettäjä ${LAHETTAJA}: ${l ? (l.active ? "vahvistettu" : "EI VAHVISTETTU") : "EI LISÄTTY"}. Lähettäjät: ${(d.senders || []).map(x => x.email.replace(/^(.).*@/, "$1***@") + (x.active ? "" : "(ei vahv.)")).join(", ")}`); }
    } catch (e) { rivit.push(`Brevo VIRHE: ${e.message.slice(0, 120)}`); }
  }
  for (const r of rivit) console.log(`::notice title=Tarkistus::${r}`);
}

async function main() {
  if (process.env.TARKISTA === "1") return tarkista();
  // Tila: jo käsitellyt kohteet (url). Ensimmäisellä ajolla merkitään kaikki nykyiset nähdyiksi, jotta ei lähetetä vanhaa.
  const tila = existsSync(TILA) ? JSON.parse(readFileSync(TILA, "utf8")) : null;
  const nahdyt = new Set(tila?.nahdyt || []);
  const nyt = new Date().toISOString();
  const lahteet = await (await fetch(`${SITE}/data/halytyslahteet.json?t=${Date.now()}`)).json();
  const kaikki = [...(lahteet.aanestykset || []), ...(lahteet.tiedotteet || []), ...(lahteet.hankinnat || [])];
  const ensimmainen = !tila;
  const uusi = x => !ensimmainen && !nahdyt.has(x.url);
  const A = (lahteet.aanestykset || []).filter(uusi), T = (lahteet.tiedotteet || []).filter(uusi), H = (lahteet.hankinnat || []).filter(uusi);
  const tallennaTila = () => { mkdirSync(".halytystila", { recursive: true }); writeFileSync(TILA, JSON.stringify({ viimeksi: nyt, nahdyt: [...new Set([...kaikki.map(x => x.url), ...nahdyt])].slice(0, 30000) })); };
  console.log(`${ensimmainen ? "Ensimmäinen ajo: merkitään nykyiset nähdyiksi. " : ""}Uutta: ${A.length} äänestystä, ${T.length} tiedotetta, ${H.length} hankintaa. ${kuiva ? "KUIVAHARJOITUS (salaisuudet puuttuvat)" : ""}`);
  if (ensimmainen) { tallennaTila(); return; }
  if (kuiva && (!SERVICE)) { console.log("SUPABASE_SERVICE_KEY puuttuu: seurantoja ei voi lukea. Lopetetaan."); return; }

  const col = await kayttajaSarake();
  const seurannat = await sbGet(`/rest/v1/seurannat?select=${col},tyyppi,kohde,nimi,osoite&limit=100000`);
  const emails = await kayttajat();
  const perKayttaja = new Map();
  for (const s of seurannat) { const k = s[col]; if (!perKayttaja.has(k)) perKayttaja.set(k, []); perKayttaja.get(k).push(s); }

  let lahetetty = 0;
  for (const [uid, lista] of perKayttaja) {
    const email = emails.get(uid); if (!email) continue;
    const os = { aanestykset: [], tiedotteet: [], hankinnat: [], edustajat: [] };
    const lisaa = (k, r) => { if (!os[k].some(x => x.url === r.url)) os[k].push(r); };
    for (const s of lista) {
      if (s.tyyppi === "aihe") A.filter(v => v.aihe === s.kohde).forEach(v => lisaa("aanestykset", { url: v.url, otsikko: v.otsikko, meta: `${v.aiheNimi} · ${dfi(v.aika)} · Jaa ${v.jaa ?? "–"}, Ei ${v.ei ?? "–"}` }));
      else if (s.tyyppi === "edustaja") { if (A.length) lisaa("edustajat", { url: SITE + s.osoite, otsikko: `${s.nimi}: ${A.length} uutta äänestystä`, meta: "Katso, miten edustaja äänesti" }); }
      else {
        const w = s.kohde;
        A.filter(v => osuu(v.otsikko, w)).forEach(v => lisaa("aanestykset", { url: v.url, otsikko: v.otsikko, meta: `Hakusana "${w}" · ${dfi(v.aika)}` }));
        T.filter(t => osuu(t.otsikko, w)).forEach(t => lisaa("tiedotteet", { url: t.url, otsikko: t.otsikko, meta: `${t.lahde} · ${dfi(t.aika)} · hakusana "${w}"` }));
        H.filter(h => osuu(h.otsikko + " " + h.ostaja, w)).forEach(h => lisaa("hankinnat", { url: h.url, otsikko: h.otsikko, meta: `${h.ostaja} · ${dfi(h.aika)} · hakusana "${w}"` }));
      }
    }
    const n = os.aanestykset.length + os.tiedotteet.length + os.hankinnat.length + os.edustajat.length;
    if (!n) continue;
    const aihe = `Seurantasi: ${n} uutta (${dfi(nyt)})`;
    if (kuiva) { console.log(`[kuiva] ${email.replace(/(.).*@/, "$1***@")}: ${n} osumaa`); continue; }
    try { await laheta(email, aihe, koosteHtml(lista.map(s => s.nimi || s.kohde), os)); lahetetty++; }
    catch (e) { console.log("Lähetys epäonnistui:", e.message); }
  }
  console.log(`Lähetetty ${lahetetty} koostetta.`);
  if (!kuiva) tallennaTila();
}

main().catch(e => { console.error(e); process.exit(1); });
