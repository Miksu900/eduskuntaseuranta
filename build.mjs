// build.mjs – rakentaa Eduskuntaseuranta-sivuston staattiset sivut Supabasen datasta.
// Ajetaan GitHub Actionsissa (ks. .github/workflows/build.yml). Tulos kirjoitetaan kansioon dist/.
import { mkdir, writeFile, copyFile, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { SRC, TIMELINE, GOV as BGOV, PARTIES, AI_FACTS, TABLE, KEY2, WELL, TRANSPORT } from "./budget.mjs";

const SB = process.env.SUPABASE_URL || "https://arwenhbwzoavbonlwkdr.supabase.co";
const KEY = process.env.SUPABASE_KEY || "sb_publishable_7baeuteHYaarCEv4-j8C_g_OLxcKzJp";
const SITE = (process.env.SITE_URL || "https://eduskuntaseuranta.fi").replace(/\/$/, "");
const OUT = "dist";
const BEACON = `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "3b541d79fcdc4cd684f2a937c50e613b"}'></script>`; // Cloudflare Web Analytics (evästeetön kävijälaskuri)
const DETAIL_N = 1000; // montako uusinta äänestystä saa edustajakohtaiset äänet sivuille
const QUIZ_N = 12;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const AANI = { jaa: "Jaa", ei: "Ei", tyhja: "Tyhjää", poissa: "Poissa" };
const PARTY = { kok: "Kokoomus", ps: "Perussuomalaiset", sd: "SDP", kesk: "Keskusta", vihr: "Vihreät", vas: "Vasemmistoliitto", rkp: "RKP", r: "RKP", kd: "Kristillisdemokraatit", liik: "Liike Nyt" };
const pk = p => { const x = String(p ?? "").trim().toLowerCase(); return x === "r" ? "rkp" : x; };
const pname = p => PARTY[pk(p)] || (pk(p) ? pk(p).toUpperCase() : "Ei ryhmää");
const dateFi = d => (d ? new Date(d).toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki" }) : "");
const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const vtitle = v => v.otsikko || v.lisaotsikko || "Äänestys " + v.id;
// Lisäotsikko on usein muotoa "Mietintö JAA / Anna Kontulan lausumaehdotus EI": kertoo, mitä Jaa ja Ei tarkoittavat.
function voteMeaning(v) {
  const out = {};
  for (const part of String(v.lisaotsikko || "").split("/")) {
    const m = part.trim().match(/^(.*?)\s+(JAA|EI)\s*$/i);
    if (m && m[1].trim()) out[m[2].toLowerCase() === "jaa" ? "jaa" : "ei"] = m[1].trim();
  }
  return out.jaa || out.ei ? out : null;
}

// ---------- Aiheet (avainsanasäännöt otsikosta; tekoälyn antama aihe käytetään, jos se on olemassa) ----------
const TOPICS = [
  { name: "Maahanmuutto ja kansalaisuus", re: /maahanmuut|ulkomaalais|kansalaisuus|turvapaikka|oleskelu|pakolai|kotouttam/, info: "Maahanmuuttoon, oleskelulupiin, turvapaikkaan ja kansalaisuuteen liittyvät äänestykset." },
  { name: "Ulkoasiat ja EU", re: /euroopan|\beu\b|eu:n|ulkoasi|ukrain|kehitysyhteistyö|kansainväli|pakote|sopimuksen hyväksymi/, info: "Suhteet muihin maihin, EU-asiat ja kansainväliset sopimukset." },
  { name: "Turvallisuus ja puolustus", re: /puolustus|sotilas|rajavartio|poliisi|turvallisuus|kriisi|valmius|asevelvoll|pelastus|vakoilu|terror|maanpuolustus|aseet|ampuma/, info: "Puolustus, poliisi, rajaturvallisuus ja varautuminen kriiseihin." },
  { name: "Sosiaali- ja terveysasiat", re: /sosiaali|terveys|hyvinvointialue|sairaan|lääke|potilas|eläke|toimeentulo|vammais|päihde|lastensuojelu|hoiva|työttömyysturva|asumistuki|\bkela|etuus/, info: "Sosiaaliturva, terveydenhuolto, hyvinvointialueet, eläkkeet ja etuudet." },
  { name: "Koulutus ja tiede", re: /koulu|opetus|oppivelvoll|yliopisto|ammattikorkea|varhaiskasvatus|opintotuki|tutkimus|korkeakoulu|oppilaitos|kulttuuri|taide|urheilu|liikunta/, info: "Koulutus, tutkimus, kulttuuri ja liikunta." },
  { name: "Asuminen ja ympäristö", re: /asum|asunto|vuokra|ympäristö|ilmasto|energia|luonto|päästö|kaava|rakennus|maankäyttö|jäte|ydin|sähkö|vesi/, info: "Asuminen, rakentaminen, ympäristö, ilmasto ja energia." },
  { name: "Liikenne ja viestintä", re: /liikenne|\brata|raide|ajoneuvo|ajokortti|satama|viestintä|tietoliikenne|posti|lentoasema|lento/, info: "Tiet, raiteet, ajoneuvot ja viestintäverkot." },
  { name: "Maatalous, metsät ja eläimet", re: /maatalous|maa- ja metsä|metsä|eläin|kiss[aoi]|koira|koiri|kalastus|metsästys|riista|maaseutu|elintarvike|\bporo/, info: "Maatalous, metsät, kalastus, metsästys ja eläinten pito." },
  { name: "Työ ja elinkeinot", re: /\btyö|työ(?:sopimus|lain)|elinkeino|yritys|yrittäj|kilpailu|matkailu|palkka|lomautus|irtisano|kauppa/, info: "Työelämä, yritykset ja elinkeinoelämän säännöt." },
  { name: "Talous ja verot", re: /vero|talousarvio|budjetti|valtion|tulo|vakuutus|rahoitus|velka|pankki|arvonlisä|korko|kehys|lisätalous/, info: "Verot, valtion talousarvio ja julkinen talous." },
  { name: "Oikeus ja hallinto", re: /rikos|oikeus|rangaistus|tuomio|vankeus|hallinto|kunta|vaali|perustuslaki|tietosuoja|kielilaki|julkisuus|laki/, info: "Rikos- ja oikeusasiat, hallinto, kunnat ja vaalit." },
  { name: "Muut aiheet", re: /$^/, info: "Äänestykset, joiden aihetta ei voitu päätellä otsikosta." },
];
const TOPIC_ALIAS = { "Maatalous ja metsät": "Maatalous, metsät ja eläimet", "Työ ja elinkeinot": "Työ ja elinkeinot", "Muu": "Muut aiheet" };
const topicOf = v => {
  if (v.aihe) { const n = TOPIC_ALIAS[v.aihe] || v.aihe; const t = TOPICS.find(x => x.name === n); if (t) return t; }
  const txt = ((v.otsikko || "") + " " + (v.lisaotsikko || "")).toLowerCase();
  return TOPICS.find(t => t.re.test(txt)) || TOPICS[TOPICS.length - 1];
};
const tslug = t => slug(t.name);
const lc1 = x => x.charAt(0).toLowerCase() + x.slice(1);

// ---------- Datan haku ----------
async function rest(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(SB + "/rest/v1/" + path, { headers: { apikey: KEY } });
      if (!r.ok) { const e = new Error(r.status + " " + (await r.text()).slice(0, 200)); e.status = r.status; throw e; }
      return await r.json();
    } catch (e) {
      if ((e.status && e.status < 500) || i === 2) throw e;
      await new Promise(s => setTimeout(s, 1500 * (i + 1)));
    }
  }
}
async function all(path, order) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const rows = await rest(`${path}${path.includes("?") ? "&" : "?"}order=${order}&limit=1000&offset=${off}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}


// Vaalipiirit haetaan Supabasen taulusta edustaja_vaalipiiri (täytetään Edge Functionilla Eduskunnan datasta).
// Jos taulua ei ole tai se on tyhjä, sivusto rakentuu ilman vaalipiiritietoa.
async function fetchVaalipiirit() {
  const map = new Map();
  try {
    for (const r of await all("edustaja_vaalipiiri?select=henkilo,vaalipiiri", "henkilo")) if (r.vaalipiiri) map.set(String(r.henkilo), String(r.vaalipiiri).trim());
  } catch (e) { console.log("Vaalipiiritaulua ei saatu, jatketaan ilman:", e.message); }
  console.log("Vaalipiiri löytyi", map.size, "henkilölle");
  return map;
}

// ---------- Ulkoasu ----------
const CSS = `:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#111;color:#fff;font:16px/1.5 system-ui,sans-serif}
a{color:#7ab0ff;text-decoration:none}a:hover{text-decoration:underline}
.top{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding:12px;border-bottom:1px solid #222;background:#111}
.brand{font-weight:700;font-size:18px;color:#fff}
.top nav{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}
main{max-width:800px;margin:auto;padding:14px 12px 50px}
h1{font-size:24px;line-height:1.25;margin:6px 0 4px}h2{font-size:18px;margin:26px 0 8px}
.meta{color:#999;font-size:13px}.note{color:#999;font-size:13px;margin:8px 0}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.chip{background:#1b1b1b;border-radius:10px;padding:8px 12px;min-width:110px}
.chip b{display:block;font-size:20px}.chip span{color:#999;font-size:12px}
.card{display:block;background:#1b1b1b;border-radius:10px;padding:10px 14px;margin:8px 0;color:#fff}
.card:hover{text-decoration:none;background:#222}
.jaa{color:#6c6}.ei{color:#e66}.tyhja{color:#ccc}.poissa{color:#888}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{padding:8px 4px;border-bottom:1px solid #262626;text-align:left}th{color:#999;font-weight:500}
.ai{background:#17202e;border-left:3px solid #2a5db0;border-radius:6px;padding:10px 12px;margin:12px 0}
.ai small{display:block;color:#8aa;margin-top:6px}
.share{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
button,.btn{font:inherit;color:#fff;background:#222;border:0;border-radius:16px;padding:8px 14px;cursor:pointer;display:inline-block}
button.on,.btn.on{background:#2a5db0}button:disabled{opacity:.4}
.names a{display:inline-block;margin:2px 10px 2px 0}
footer{max-width:800px;margin:auto;padding:0 12px 40px;color:#777;font-size:12px}
.q{background:#1b1b1b;border-radius:12px;padding:16px;margin:12px 0}
.q .t{font-size:17px;margin-bottom:6px}.bar{height:6px;background:#2a2a2a;border-radius:3px;margin-top:8px;overflow:hidden}.bar i{display:block;height:100%;background:#2a5db0}`;

const SHARE_JS = `<script>document.querySelectorAll("[data-share]").forEach(function(b){b.onclick=function(){var u=location.href,t=document.title;if(navigator.share){navigator.share({title:t,url:u}).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(u).then(function(){b.textContent="Linkki kopioitu"})}else{prompt("Kopioi linkki",u)}}})</script>`;

let HAS_VP = false;
function shell({ title, desc, path, body, head = "" }) {
  const url = SITE + path;
  return `<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:locale" content="fi_FI"><meta property="og:site_name" content="Eduskuntaseuranta">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
<style>${CSS}</style>${head}</head><body>
<header class="top"><a class="brand" href="/">Eduskuntaseuranta</a><nav><a href="/edustajat/">Edustajat</a><a href="/aanestykset/">Äänestykset</a><a href="/aiheet/">Aiheet</a><a href="/budjetti/">Budjetti</a><a href="/haku/">Kysy</a><a href="/viikko/">Viikkokatsaus</a><a href="/tilaa/">Tilaa</a><a href="/#p">Puolueet</a>${HAS_VP ? '<a href="/oma-edustaja/">Oma edustaja</a>' : ""}<a href="/testi/">Kuka äänestää kuten sinä?</a><a href="/data/">Data</a><a href="/menetelma/">Menetelmä</a></nav></header>
<main>${body}</main>
<footer>Lähde: Eduskunnan avoin data. Tiedot on laskettu koneellisesti ja ne ovat vain yksi osa edustajan työtä. <a href="/menetelma/">Lue, miten luvut lasketaan.</a> Päivitetty ${dateFi(new Date())}.</footer>
${SHARE_JS}${process.env.NO_ANALYTICS ? "" : BEACON}</body></html>`;
}

// Asiakirjatunnukset (HE 123/2026, VaVM 5/2026 ...) otsikosta -> linkit Eduskunnan omille sivuille
function docLinks(v) {
  const txt = `${v.otsikko || ""} ${v.lisaotsikko || ""}`;
  const codes = [...new Set([...txt.matchAll(/\b(HE|KA|VNS|VNK|LA|TAA|KK|EV|HaVM|VaVM|StVM|TyVM|SiVM|LaVM|PuVM|UaVM|YmVM|MmVM|PeVM|TaVM|TrVM|SuVM|LiVM|SoVM|PeVL|VaVM)\s+(\d{1,3})\/(20\d\d)\b/g)].map(m => `${m[1]} ${m[2]}/${m[3]}`))];
  const he = codes.filter(c => c.startsWith("HE "));
  const items = he.map(c => `<a href="https://www.eduskunta.fi/FI/Vaski/KasittelytiedotValtiopaivaasia/Sivut/${c.replace(" ", "_").replace("/", "+")}.aspx" rel="noopener">${esc(c)} – hallituksen esitys ja käsittelytiedot (Eduskunta)</a>`);
  const others = codes.filter(c => !c.startsWith("HE "));
  return `<div class="note"><b>Lähteet ja asiakirjat</b><br>${items.join("<br>")}${items.length && others.length ? "<br>" : ""}${others.length ? "Mainitut asiakirjat: " + esc(others.join(", ")) + "<br>" : ""}${items.length || others.length ? "" : "Tämän äänestyksen otsikossa ei ole asiakirjatunnusta. "}<a href="https://www.eduskunta.fi/FI/valtiopaivaasiakirjat/Sivut/default.aspx" rel="noopener">Hae asiakirjoja Eduskunnan sivuilta</a> · <a href="/valtioneuvosto/">Valtioneuvoston tiedot</a></div>`;
}
const shareBtns = `<div class="share"><button data-share>Jaa tämä sivu</button></div>`;
const voteTag = a => `<span class="${a}">${AANI[a] || a}</span>`;

// ---------- Pääohjelma ----------
async function main() {
  const t0 = Date.now();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const mps = await all("mp_stats?select=*", "henkilo");
  for (const m of mps) m.puolue = pk(m.puolue);
  const vpMap = await fetchVaalipiirit();
  const vpName = n => String(n || "").replace(/\s*vaalipiiri$/i, "").replace(/\s*maakunnan$/i, "").trim();
  for (const m of mps) m.vaalipiiri = vpMap.get(String(m.henkilo)) || "";
  HAS_VP = mps.some(m => m.vaalipiiri);
  let votings;
  try {
    votings = await all("aanestykset?select=id,vuosi,istunto,numero,alkoi,otsikko,lisaotsikko,jaa,ei,tyhja,poissa,ladattu,tiivistelma,aihe", "alkoi.desc,id.desc");
  } catch (e) {
    console.log("Tiivistelmä-sarakkeita ei ole vielä, jatketaan ilman:", e.message);
    votings = await all("aanestykset?select=id,vuosi,istunto,numero,alkoi,otsikko,lisaotsikko,jaa,ei,tyhja,poissa,ladattu", "alkoi.desc,id.desc");
  }
  const loaded = votings.filter(v => v.ladattu);
  if (!mps.length || !loaded.length) throw new Error("Ei dataa – keskeytetään, jotta vanha sivu säilyy.");
  console.log(`Edustajia ${mps.length}, äänestyksiä ${votings.length} (ladattu ${loaded.length})`);

  let pa = [];
  try { pa = await all("puolue_aanet?select=aanestys_id,puolue,jaa,ei,tyhja,poissa", "aanestys_id,puolue"); }
  catch (e) { console.log("puolue_aanet-näkymä puuttuu, puoluetaulukot jäävät pois:", e.message); }
  const paBy = new Map();
  for (const r of pa) { r.puolue = pk(r.puolue); if (!paBy.has(r.aanestys_id)) paBy.set(r.aanestys_id, []); paBy.get(r.aanestys_id).push(r); }

  // Edustajakohtaiset äänet uusimmista äänestyksistä
  const detail = loaded.slice(0, DETAIL_N);
  const ids = detail.map(v => v.id);
  const batches = []; for (let i = 0; i < ids.length; i += 5) batches.push(ids.slice(i, i + 5));
  const parts = await pool(batches, 4, b => all(`aanestys_edustaja?select=aanestys_id,henkilo,etunimi,sukunimi,puolue,aani&aanestys_id=in.(${b.join(",")})`, "aanestys_id,henkilo"));
  const byV = new Map(), byMp = new Map();
  for (const rows of parts) for (const r of rows) {
    r.puolue = pk(r.puolue);
    if (!byV.has(r.aanestys_id)) byV.set(r.aanestys_id, []);
    byV.get(r.aanestys_id).push(r);
  }
  for (const v of detail) for (const r of byV.get(v.id) || []) {
    if (!byMp.has(r.henkilo)) byMp.set(r.henkilo, []);
    byMp.get(r.henkilo).push({ aid: v.id, aani: r.aani });
  }

  // Edustajien osoitteet (sama logiikka kuin etusivulla)
  const full = m => `${m.etunimi || ""} ${m.sukunimi || ""}`.trim();
  const base = new Map();
  for (const m of mps) { const b = slug(full(m)) || String(m.henkilo); base.set(b, (base.get(b) || 0) + 1); }
  const mpSlug = new Map();
  for (const m of mps) { const b = slug(full(m)) || String(m.henkilo); mpSlug.set(m.henkilo, base.get(b) > 1 ? `${b}-${m.henkilo}` : b); }
  const mpLink = (henkilo, text) => `<a href="/edustaja/${mpSlug.get(henkilo) || henkilo}/">${esc(text)}</a>`;
  const lasna = m => pct(m.yhteensa - m.poissa, m.yhteensa);
  const eri = m => pct(m.eri_mielta, m.vertailtavia);
  const urls = [];
  const jobs = [];
  const put = (path, html) => { urls.push(path); jobs.push({ path, html }); };

  // --- Edustajasivut ---
  for (const m of mps) {
    const nm = full(m), s = mpSlug.get(m.henkilo);
    const allv = byMp.get(m.henkilo) || [];
    const list = allv.slice(0, 50);
    const vmap = new Map(votings.map(v => [v.id, v]));
    const li = list.map(x => { const v = vmap.get(x.aid) || { id: x.aid }; return `<a class="card" href="/aanestys/${v.id}/"><div>${esc(vtitle(v))}</div><div class="meta">${dateFi(v.alkoi)} · ${voteTag(x.aani)}</div></a>`; }).join("");
    const rest = allv.slice(50).map(x => { const v = vmap.get(x.aid) || { id: x.aid }; const t = vtitle(v); return `<a class="card rv" data-q="${esc((t + " " + dateFi(v.alkoi)).toLowerCase())}" href="/aanestys/${v.id}/"><div>${esc(short(t, 140))}</div><div class="meta">${dateFi(v.alkoi)} · ${voteTag(x.aani)}</div></a>`; }).join("");
    const restBlock = rest ? `<details><summary><b>Näytä kaikki ${allv.length} äänestystä</b></summary><input style="width:100%;box-sizing:border-box;padding:12px 14px;margin:8px 0 12px;font-size:16px;border-radius:10px;border:1px solid #444;background:#1a1a1a;color:inherit" type="search" placeholder="Hae äänestyksistä (esim. laki, aihe)" oninput="var q=this.value.trim().toLowerCase();this.parentNode.querySelectorAll('.rv').forEach(function(e){e.style.display=(!q||e.getAttribute('data-q').indexOf(q)>-1)?'':'none'})">${rest}</details>` : "";
    const body = `<div class="meta"><a href="/puolue/${slug(m.puolue) || "muut"}/">${esc(pname(m.puolue))}</a> · kansanedustaja${m.vaalipiiri ? ` · <a href="/vaalipiiri/${slug(vpName(m.vaalipiiri))}/">${esc(vpName(m.vaalipiiri))} vaalipiiri</a>` : ""}</div>
<h1>${esc(nm)} – äänestykset ja läsnäolo</h1>
<div class="chips"><div class="chip"><b>${lasna(m)} %</b><span>läsnä äänestyksissä</span></div><div class="chip"><b>${eri(m)} %</b><span>ryhmänsä linjasta poikkeavia ääniä</span></div><div class="chip"><b>${m.yhteensa}</b><span>äänestystä yhteensä</span></div></div>
<p class="meta">Jaa ${m.jaa} · Ei ${m.ei} · Tyhjää ${m.tyhja} · Poissa ${m.poissa}. Poissaolo voi johtua esimerkiksi luottamustehtävästä, sairaudesta tai virkamatkasta.</p>
${shareBtns}
<h2>Äänestykset</h2>${li || '<p class="note">Yksittäisiä äänestyksiä ei ole vielä saatavilla.</p>'}${restBlock}
<p class="note"><a href="/menetelma/">Miten ”ryhmänsä linjasta poikkeava” lasketaan?</a></p>`;
    put(`/edustaja/${s}/`, shell({ title: `${nm} (${pname(m.puolue)}) – äänestykset | Eduskuntaseuranta`, desc: `Miten ${nm} on äänestänyt eduskunnassa? Läsnäolo ${lasna(m)} %, ryhmästä poikkeavia ääniä ${eri(m)} % (${m.yhteensa} äänestystä).`, path: `/edustaja/${s}/`, body }));
  }

  // --- Äänestyssivut ---
  const hint = x => (/mietintö/i.test(x) ? " (valiokunnan ehdotus eduskunnalle)" : "");
  const meaningBox = v => {
    const mn = voteMeaning(v);
    const rows = mn ? `<div><b class="jaa">Jaa</b> = ${esc(mn.jaa ? mn.jaa + hint(mn.jaa) : "ei tietoa")}</div><div><b class="ei">Ei</b> = ${esc(mn.ei ? mn.ei + hint(mn.ei) : "ei tietoa")}</div>` : "";
    return `<div class="ai" style="border-left-color:#c9a227"><b>Mitä Jaa ja Ei tarkoittavat tässä äänestyksessä?</b><span class="meta"> Eduskunnan tietojen mukaan:</span>${rows}<small>Otsikko kertoo, mistä asiasta on kyse, mutta Jaa tai Ei ei aina tarkoita otsikon asian kannattamista. Usein äänestetään valiokunnan mietinnöstä tai vastaehdotuksesta, ja Jaa voi tarkoittaa esimerkiksi aloitteen hylkäämistä.${mn ? "" : " Tämän äänestyksen tarkkaa vaihtoehtoa ei ole saatavilla, joten tarkista se eduskunnan omilta sivuilta."}</small></div>`;
  };
  for (const v of loaded) {
    const t = vtitle(v);
    const parties = (paBy.get(v.id) || []).slice().sort((a, b) => (b.jaa + b.ei) - (a.jaa + a.ei));
    const ptab = parties.length ? `<h2>Ryhmittäin</h2><table><tr><th>Ryhmä</th><th>Jaa</th><th>Ei</th><th>Tyhjää</th><th>Poissa</th></tr>${parties.map(p => `<tr><td>${esc(pname(p.puolue))}</td><td class="jaa">${p.jaa}</td><td class="ei">${p.ei}</td><td class="tyhja">${p.tyhja}</td><td class="poissa">${p.poissa}</td></tr>`).join("")}</table>` : "";
    let who = "";
    const rows = byV.get(v.id);
    if (rows) {
      who = "<h2>Edustajat ja heidän äänensä</h2>" + ["jaa", "ei", "tyhja", "poissa"].map(a => {
        const rs = rows.filter(r => r.aani === a).sort((x, y) => String(x.puolue).localeCompare(String(y.puolue), "fi") || String(x.sukunimi).localeCompare(String(y.sukunimi), "fi"));
        if (!rs.length) return "";
        return `<h3 class="${a}" style="margin:16px 0 6px;font-size:15px">${AANI[a]} (${rs.length})</h3><div class="names">${rs.map(r => mpLink(r.henkilo, `${r.etunimi || ""} ${r.sukunimi || ""}`.trim()) + `<span class="meta">${esc(String(r.puolue || "").toUpperCase())}</span>`).join(" ")}</div>`;
      }).join("");
    }
    const ai = v.tiivistelma ? `<div class="ai"><b>Selkokielellä:</b> ${esc(v.tiivistelma)}<small>Tekoälyn tekemä selitys äänestyksen otsikosta – voi sisältää virheitä. Virallinen otsikko on yllä.</small></div>` : "";
    const body = `<div class="meta">Äänestys ${dateFi(v.alkoi)} · <a href="/aihe/${tslug(topicOf(v))}/">${esc(topicOf(v).name)}</a></div><h1>${esc(t)}</h1>
${v.lisaotsikko && v.lisaotsikko !== v.otsikko ? `<p class="meta">${esc(v.lisaotsikko)}</p>` : ""}${ai}
${meaningBox(v)}${docLinks(v)}
<div class="chips"><div class="chip"><b class="jaa">${v.jaa ?? "–"}</b><span>Jaa</span></div><div class="chip"><b class="ei">${v.ei ?? "–"}</b><span>Ei</span></div><div class="chip"><b class="tyhja">${v.tyhja ?? "–"}</b><span>Tyhjää</span></div><div class="chip"><b class="poissa">${v.poissa ?? "–"}</b><span>Poissa</span></div></div>
${shareBtns}${ptab}${who}`;
    put(`/aanestys/${v.id}/`, shell({
      title: `${short(t, 70)} – äänestys ${dateFi(v.alkoi)} | Eduskuntaseuranta`,
      desc: v.tiivistelma ? short(v.tiivistelma, 200) : `Eduskunnan äänestys ${dateFi(v.alkoi)}: Jaa ${v.jaa ?? "–"}, Ei ${v.ei ?? "–"}. Katso miten ryhmät ja kansanedustajat äänestivät.`,
      path: `/aanestys/${v.id}/`, body,
    }));
  }

  // --- Puoluesivut ---
  const groups = new Map();
  for (const m of mps) { const k = slug(m.puolue) || "muut"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
  for (const [k, ms] of groups) {
    const p = ms[0].puolue, y = ms.reduce((a, m) => a + m.yhteensa, 0), po = ms.reduce((a, m) => a + m.poissa, 0), ve = ms.reduce((a, m) => a + m.vertailtavia, 0), ee = ms.reduce((a, m) => a + m.eri_mielta, 0);
    ms.sort((a, b) => eri(b) - eri(a) || b.vertailtavia - a.vertailtavia);
    const body = `<h1>${esc(pname(p))} – kansanedustajien äänestykset</h1>
<div class="chips"><div class="chip"><b>${ms.length}</b><span>edustajaa</span></div><div class="chip"><b>${pct(y - po, y)} %</b><span>läsnäolo keskimäärin</span></div><div class="chip"><b>${pct(ee, ve)} %</b><span>poikkeaa ryhmän linjasta</span></div></div>${shareBtns}
<h2>Edustajat</h2>${ms.map(m => `<a class="card" href="/edustaja/${mpSlug.get(m.henkilo)}/"><div>${esc(full(m))}</div><div class="meta">läsnä ${lasna(m)} % · poikkeaa ryhmästä ${eri(m)} %</div></a>`).join("")}`;
    put(`/puolue/${k}/`, shell({ title: `${pname(p)} – edustajien äänestykset | Eduskuntaseuranta`, desc: `${pname(p)}: ${ms.length} kansanedustajaa, läsnäolo ${pct(y - po, y)} %, ryhmän linjasta poikkeavia ääniä ${pct(ee, ve)} %.`, path: `/puolue/${k}/`, body }));
  }

  // --- Hakemistosivut (jotta hakukoneet löytävät kaiken) ---
  const sorted = mps.slice().sort((a, b) => String(a.sukunimi).localeCompare(String(b.sukunimi), "fi"));
  put("/edustajat/", shell({ title: "Kaikki kansanedustajat – äänestykset ja läsnäolo | Eduskuntaseuranta", desc: "Kaikkien kansanedustajien äänestykset, läsnäolo ja ryhmästä poikkeavat äänet.", path: "/edustajat/",
    body: `<h1>Kansanedustajat</h1><p class="meta">${mps.length} edustajaa. Hae nimellä <a href="/">etusivulta</a> tai valitse alta.</p>${sorted.map(m => `<a class="card" href="/edustaja/${mpSlug.get(m.henkilo)}/"><div>${esc(`${m.sukunimi || ""}, ${m.etunimi || ""}`)}</div><div class="meta">${esc(pname(m.puolue))} · läsnä ${lasna(m)} % · poikkeaa ryhmästä ${eri(m)} %</div></a>`).join("")}` }));
  put("/aanestykset/", shell({ title: "Uusimmat eduskunnan äänestykset | Eduskuntaseuranta", desc: "Eduskunnan uusimmat äänestykset ja niiden tulokset ryhmittäin.", path: "/aanestykset/",
    body: `<h1>Uusimmat äänestykset</h1>${loaded.slice(0, 500).map(v => `<a class="card" href="/aanestys/${v.id}/"><div>${esc(vtitle(v))}</div><div class="meta">${dateFi(v.alkoi)} · <span class="jaa">Jaa ${v.jaa ?? "–"}</span> · <span class="ei">Ei ${v.ei ?? "–"}</span>${v.aihe ? " · " + esc(v.aihe) : ""}</div></a>`).join("")}` }));


  // --- Aiheet ---
  {
    const groupsT = new Map(TOPICS.map(t => [t.name, []]));
    for (const v of loaded) groupsT.get(topicOf(v).name).push(v);
    const shown = TOPICS.filter(t => groupsT.get(t.name).length);
    put("/aiheet/", shell({ title: "Eduskunnan äänestysten aiheet | Eduskuntaseuranta", desc: "Selaa eduskunnan äänestyksiä aiheittain: maahanmuutto, talous, terveys, koulutus, ympäristö ja muut.", path: "/aiheet/",
      body: `<h1>Aiheet</h1><p class="meta">Valitse aihe ja näe sen äänestykset. Aihe on arvioitu äänestyksen otsikon avainsanoista, joten se voi joskus olla epätarkka.</p>${shown.map(t => `<a class="card" href="/aihe/${tslug(t)}/"><div><b>${esc(t.name)}</b> · ${groupsT.get(t.name).length} äänestystä</div><div class="meta">${esc(t.info)}</div></a>`).join("")}` }));
    for (const t of shown) {
      const vs = groupsT.get(t.name);
      const close = vs.filter(v => (v.jaa || 0) + (v.ei || 0) >= 100).map(v => ({ v, m: Math.abs((v.jaa || 0) - (v.ei || 0)) })).sort((a, b) => a.m - b.m).slice(0, 3);
      const closeBox = close.length ? `<h2>Niukimmat äänestykset</h2>${close.map(x => `<a class="card" href="/aanestys/${x.v.id}/"><div>${esc(short(vtitle(x.v), 160))}</div><div class="meta">${dateFi(x.v.alkoi)} · Jaa ${x.v.jaa} · Ei ${x.v.ei} (ero ${x.m} ääntä)</div></a>`).join("")}` : "";
      const list = vs.slice(0, 300).map(v => { const mn = voteMeaning(v); return `<a class="card" href="/aanestys/${v.id}/"><div>${esc(short(vtitle(v), 200))}</div><div class="meta">${dateFi(v.alkoi)} · <span class="jaa">Jaa ${v.jaa ?? "–"}</span> · <span class="ei">Ei ${v.ei ?? "–"}</span></div>${mn ? `<div class="meta">${esc([mn.jaa ? "Jaa = " + mn.jaa : "", mn.ei ? "Ei = " + mn.ei : ""].filter(Boolean).join(" · "))}</div>` : ""}</a>`; }).join("");
      put(`/aihe/${tslug(t)}/`, shell({ title: `${t.name}: eduskunnan äänestykset | Eduskuntaseuranta`, desc: `${t.info} ${vs.length} äänestystä Eduskuntaseurannassa.`, path: `/aihe/${tslug(t)}/`,
        body: `<p class="meta"><a href="/aiheet/">← Kaikki aiheet</a></p><h1>${esc(t.name)}</h1><p>${esc(t.info)}</p><p class="meta">${vs.length} äänestystä. Aihe on arvioitu otsikon avainsanoista, joten se voi olla epätarkka. Huom. Jaa tai Ei ei aina tarkoita otsikon asian kannattamista: katso kunkin äänestyksen sivulta, mitä vaihtoehdot tarkoittavat.</p>${shareBtns}${closeBox}<h2>Äänestykset${vs.length > 300 ? " (300 uusinta)" : ""}</h2>${list}` }));
    }
  }

  // --- Oma kansanedustaja: vaalipiirit ---
  const vps = new Map();
  for (const m of mps) if (m.vaalipiiri) { const k = vpName(m.vaalipiiri); if (!vps.has(k)) vps.set(k, []); vps.get(k).push(m); }
  if (vps.size) {
    const vpList = [...vps.entries()].sort((a, b) => a[0].localeCompare(b[0], "fi"));
    for (const [k, ms] of vpList) {
      const ss = ms.slice().sort((a, b) => String(a.sukunimi).localeCompare(String(b.sukunimi), "fi"));
      put(`/vaalipiiri/${slug(k)}/`, shell({ title: `${k} vaalipiirin kansanedustajat | Eduskuntaseuranta`, desc: `${k} vaalipiirin ${ms.length} kansanedustajaa: miten he ovat äänestäneet eduskunnassa.`, path: `/vaalipiiri/${slug(k)}/`,
        body: `<p class="meta"><a href="/oma-edustaja/">← Kaikki vaalipiirit</a></p><h1>${esc(k)} vaalipiirin kansanedustajat</h1><p class="meta">${ms.length} edustajaa. Valitse edustaja nähdäksesi hänen äänensä.</p>${ss.map(m => `<a class="card" href="/edustaja/${mpSlug.get(m.henkilo)}/"><div>${esc(full(m))}</div><div class="meta">${esc(pname(m.puolue))} · läsnä ${lasna(m)} % · poikkeaa ryhmästä ${eri(m)} %</div></a>`).join("")}` }));
    }
    put("/oma-edustaja/", shell({ title: "Oma kansanedustaja: löydä vaalipiirisi edustajat | Eduskuntaseuranta", desc: "Valitse vaalipiirisi ja näe alueesi kansanedustajat sekä se, miten he ovat äänestäneet.", path: "/oma-edustaja/",
      body: `<h1>Oma kansanedustaja</h1><p>Valitse vaalipiirisi, niin näet alueesi kansanedustajat ja sen, miten he ovat äänestäneet eduskunnassa.</p><p class="meta">Vaalipiiri on yleensä oma maakuntasi. Esimerkiksi Ylivieska kuuluu Oulun vaalipiiriin. Jos et ole varma, vaalipiirin voi tarkistaa oikeusministeriön vaalit.fi-sivulta.</p>${vpList.map(([k, ms]) => `<a class="card" href="/vaalipiiri/${slug(k)}/"><div>${esc(k)} vaalipiiri</div><div class="meta">${ms.length} edustajaa</div></a>`).join("")}` }));
  }

  // --- Viikkokatsaus: koneellisesti laskettu yhteenveto ja tulkinta ---
  const GOV = new Set(["kok", "ps", "rkp", "kd"]); // hallituspuolueet (tarkista, jos hallitus vaihtuu)
  const hDate = d => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const isoWeek = ds => { const [y, m, d] = ds.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3); const wy = t.getUTCFullYear(); const j = new Date(Date.UTC(wy, 0, 4)); return { year: wy, week: 1 + Math.round(((t - j) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7) }; };
  const weeks = new Map();
  for (const v of loaded) { if (!v.alkoi) continue; const w = isoWeek(hDate(v.alkoi)); const k = `${w.year}-${String(w.week).padStart(2, "0")}`; if (!weeks.has(k)) weeks.set(k, { key: k, ...w, vs: [] }); weeks.get(k).vs.push(v); }
  // Ihmisen tarkistamat syvemmät tulkinnat: tiedosto tulkinnat.json, esim. {"2026-41": {"kappaleet": ["## Otsikko", "Teksti..."]}}
  let TULK = {};
  try { TULK = JSON.parse(await readFile("tulkinnat.json", "utf8")); } catch (e) { console.log("tulkinnat.json puuttuu tai on virheellinen, ohitetaan:", e.message); }
  const weekList = [...weeks.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 52);
  const pname2 = p => pname(p);
  const analyse = w => {
    const vs = w.vs.slice().sort((a, b) => String(b.alkoi).localeCompare(String(a.alkoi)));
    const pos = s => (s.jaa + s.ei >= 20 ? (s.jaa > s.ei ? "jaa" : s.ei > s.jaa ? "ei" : null) : null);
    const items = [], unity = new Map(), dev = new Map(), abs = new Map();
    for (const v of vs) {
      const pr = paBy.get(v.id) || [];
      const g = { jaa: 0, ei: 0 }, o = { jaa: 0, ei: 0 }, line = new Map();
      for (const r of pr) {
        const side = GOV.has(r.puolue) ? g : o; side.jaa += r.jaa || 0; side.ei += r.ei || 0;
        const u = unity.get(r.puolue) || { agree: 0, total: 0 }; u.agree += Math.max(r.jaa || 0, r.ei || 0); u.total += (r.jaa || 0) + (r.ei || 0); unity.set(r.puolue, u);
        if ((r.jaa || 0) + (r.ei || 0) >= 3 && r.jaa !== r.ei) line.set(r.puolue, r.jaa > r.ei ? "jaa" : "ei");
      }
      const gp = pos(g), op = pos(o), out = (v.jaa || 0) > (v.ei || 0) ? "jaa" : (v.ei || 0) > (v.jaa || 0) ? "ei" : null;
      const divided = !!(gp && op && gp !== op);
      items.push({ v, divided, govWon: divided && out === gp, gp, op, out, margin: Math.abs((v.jaa || 0) - (v.ei || 0)), size: (v.jaa || 0) + (v.ei || 0) });
      for (const r of byV.get(v.id) || []) {
        const a = abs.get(r.henkilo) || { n: 0, poissa: 0, r }; a.n++; if (r.aani === "poissa") a.poissa++; abs.set(r.henkilo, a);
        const l = line.get(r.puolue);
        if (l && (r.aani === "jaa" || r.aani === "ei")) { const d = dev.get(r.henkilo) || { n: 0, eri: 0, r }; d.n++; if (r.aani !== l) d.eri++; dev.set(r.henkilo, d); }
      }
    }
    const divs = items.filter(i => i.divided);
    const narrow = items.filter(i => i.size >= 150).sort((a, b) => a.margin - b.margin)[0];
    const uni = [...unity.entries()].filter(([, u]) => u.total >= 30).map(([p, u]) => ({ p, pct: pct(u.agree, u.total) })).sort((a, b) => b.pct - a.pct);
    const topDev = [...dev.values()].filter(d => d.n >= 5 && d.eri > 0).sort((a, b) => b.eri - a.eri || b.eri / b.n - a.eri / a.n).slice(0, 5);
    const topAbs = [...abs.values()].filter(a => a.n >= 5 && a.poissa > 0).sort((a, b) => b.poissa - a.poissa).slice(0, 5);
    const days = vs.map(v => hDate(v.alkoi)).sort();
    const range = days.length ? (days[0] === days[days.length - 1] ? dateFi(vs[0].alkoi) : `${dateFi(days[0])}–${dateFi(days[days.length - 1])}`) : "";
    const lines = [];
    lines.push(`Viikolla ${w.week}/${w.year} (${range}) eduskunnassa pidettiin ${vs.length} äänestystä.`);
    if (divs.length) {
      const won = divs.filter(i => i.govWon).length;
      lines.push(`Hallituspuolueet (${[...GOV].map(pname).join(", ")}) ja oppositio olivat selvästi eri kannalla ${divs.length} äänestyksessä (${pct(divs.length, vs.length)} % kaikista). Näistä hallituksen kanta voitti ${won} ja hävisi ${divs.length - won}.`);
    } else lines.push("Hallituksen ja opposition enemmistökannat eivät eronneet selvästi yhdessäkään viikon äänestyksessä.");
    if (narrow) lines.push(`Viikon niukin äänestys oli ”${short(vtitle(narrow.v), 110)}”: jaa ${narrow.v.jaa}, ei ${narrow.v.ei} (ero ${narrow.margin} ääntä).`);
    if (uni.length >= 2) lines.push(`Yhtenäisimmin äänesti ${pname(uni[0].p)} (${uni[0].pct} % ryhmän enemmistön linjalla). Vähiten yhtenäisesti äänesti ${pname(uni[uni.length - 1].p)} (${uni[uni.length - 1].pct} %).`);
    if (topDev.length) lines.push(`Eniten oman ryhmänsä enemmistön linjaa vastaan äänesti ${full(topDev[0].r)} (${pname(topDev[0].r.puolue)}): ${topDev[0].eri} ääntä ${topDev[0].n}:stä.`);
    const sum = `${vs.length} äänestystä${divs.length ? `, hallitus ja oppositio eri kannalla ${divs.length}:ssa` : ""}.`;
    return { w, vs, items, divs, uni, topDev, topAbs, range, lines, sum, tulk: TULK[w.key] || null };
  };
  const SUB_URL = "https://aba151bd.sibforms.com/serve/MUIFACVlzng7cU-kcDGZrtLUtyllWs0ZAD8M-6T8SaurezkvDv9td9lKbDdjRlMMI3S_Wr_zixFtmqBcS47Jgg95hszNzoaHe_Rv0RUwAkUljWy8C5iKCHQ4ffCVl5Guvni--3bV4vEJhM3ifmpUi3cKEGpaxnHQYsHlPDtlgGvM-XmzfNXC9r5ExVg_ZCz6fCw-TA3vConv_LLOZw==";
  const SUB_FORM = `<div id="sib-form-container" class="sib-form-container">
<div id="error-message" class="sib-form-message-panel" style="font-size:16px;text-align:left;color:#661d1d;background-color:#ffeded;border-color:#ff4949;border-radius:3px;max-width:540px"><div class="sib-form-message-panel__text sib-form-message-panel__text--center"><span class="sib-form-message-panel__inner-text">Tilausta ei voitu tallentaa. Yritä hetken päästä uudelleen.</span></div></div>
<div id="success-message" class="sib-form-message-panel" style="font-size:16px;text-align:left;color:#085229;background-color:#e7faf0;border-color:#13ce66;border-radius:3px;max-width:540px"><div class="sib-form-message-panel__text sib-form-message-panel__text--center"><span class="sib-form-message-panel__inner-text">Kiitos! Tilauksesi on vastaanotettu. Saat viikkokatsauksen sähköpostiisi.</span></div></div>
<div id="sib-container" class="sib-container--large sib-container--vertical" style="max-width:540px;text-align:center;background-color:#fff;border:1px solid #C0CCD9;border-radius:3px;direction:ltr">
<form id="sib-form" method="POST" action="https://aba151bd.sibforms.com/serve/MUIFACVlzng7cU-kcDGZrtLUtyllWs0ZAD8M-6T8SaurezkvDv9td9lKbDdjRlMMI3S_Wr_zixFtmqBcS47Jgg95hszNzoaHe_Rv0RUwAkUljWy8C5iKCHQ4ffCVl5Guvni--3bV4vEJhM3ifmpUi3cKEGpaxnHQYsHlPDtlgGvM-XmzfNXC9r5ExVg_ZCz6fCw-TA3vConv_LLOZw==" data-type="subscription">
<div style="padding:8px 0"><div class="sib-form-block" style="font-size:26px;font-weight:700;text-align:left;color:#3C4858"><p>Tilaa viikkokatsaus</p></div></div>
<div style="padding:8px 0"><div class="sib-form-block" style="font-size:16px;text-align:left;color:#3C4858"><div class="sib-text-form-block"><p>Kerran viikossa sähköpostiisi: mitä eduskunnassa äänestettiin ja miten puolueet jakautuivat. Ilmainen, voit perua milloin vain.</p></div></div></div>
<div style="padding:8px 0"><div class="sib-input sib-form-block"><div class="form__entry entry_block"><div class="form__label-row">
<label class="entry__label" style="font-weight:700;text-align:left;font-size:16px;color:#3c4858" for="EMAIL" data-required="*">Sähköpostiosoitteesi</label>
<div class="entry__field"><input class="input" type="text" id="EMAIL" name="EMAIL" autocomplete="off" value="" placeholder="nimi@esimerkki.fi" data-required="true" required /></div></div>
<label class="entry__error entry__error--primary" style="font-size:16px;text-align:left;color:#661d1d;background-color:#ffeded;border-color:#ff4949;border-radius:3px"></label>
<label class="entry__specification" style="font-size:12px;text-align:left;color:#8390A4">Kirjoita sähköpostiosoitteesi, esimerkiksi nimi@esimerkki.fi</label></div></div></div>
<div style="padding:8px 0"><div class="sib-form-block" style="text-align:left"><button class="sib-form-block__button sib-form-block__button-with-loader" style="font-size:16px;font-weight:700;text-align:left;color:#FFFFFF;background-color:#3E4857;border-width:0;border-radius:3px" form="sib-form" type="submit">TILAA ILMAISEKSI</button></div></div>
<input type="text" name="email_address_check" value="" class="input--hidden">
<input type="hidden" name="locale" value="en">
</form></div></div>`;
  const SUB_HEAD = `<link rel="stylesheet" href="https://sibforms.com/forms/end-form/build/sib-styles.css"><style>:where(.sib-form-message-panel){display:none}#sib-container input::placeholder{color:#99a5b5}</style>`;
  const SUB_JS = `<script>(function(){var f=document.getElementById("sib-form");if(!f)return;var ok=document.getElementById("success-message"),er=document.getElementById("error-message"),inp=document.getElementById("EMAIL"),bt=f.querySelector("button"),lab=f.querySelector(".entry__error");
function show(el,t){ok.style.display="none";er.style.display="none";if(el){el.style.display="block";if(t)el.querySelector(".sib-form-message-panel__inner-text").textContent=t}}
f.addEventListener("submit",function(e){e.preventDefault();var v=inp.value.trim();lab.textContent="";
if(!v){lab.textContent="Tämä kenttä ei saa olla tyhjä.";return}
if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)){lab.textContent="Antamasi tiedot eivät kelpaa. Tarkista sähköpostiosoite.";return}
bt.disabled=true;show(null);
fetch(f.action,{method:"POST",body:new FormData(f),headers:{Accept:"application/json"}}).then(function(r){bt.disabled=false;if(r.ok){show(ok);inp.value=""}else show(er)}).catch(function(){bt.disabled=false;show(er)})})})()</script>`;
  const subBox = `<div class="card" style="border-left:4px solid #1a5fb4"><div><b>Tilaa viikkokatsaus sähköpostiisi</b></div><div class="meta">Kerran viikossa: eduskunnan äänestykset ja tulkinta. Ilmainen, voit perua milloin vain.</div><p><a class="btn" href="/tilaa/" style="display:inline-block;padding:10px 16px;background:#1a5fb4;color:#fff;border-radius:8px;text-decoration:none">Tilaa ilmaiseksi</a></p></div>`;
  const weekBody = a => {
    const { w, items, uni, topDev, topAbs, range, lines, tulk } = a;
    const deep = tulk && Array.isArray(tulk.kappaleet) && tulk.kappaleet.length ? `<h2>Syvempi tulkinta</h2>${tulk.kappaleet.map(k => String(k).startsWith("## ") ? `<h3 style="margin:18px 0 6px;font-size:16px">${esc(String(k).slice(3))}</h3>` : `<p>${esc(k)}</p>`).join("")}<p class="note">Tulkinnan on kirjoittanut tekoäly (Claude) viikon äänestystulosten pohjalta, ja Eduskuntaseuranta on lukenut ja tarkistanut sen ennen julkaisua. Se on tulkinta, ei tosiasia. Luvut löytyvät alta ja datasta.</p>` : "";
    return `<h1>Eduskunnan viikko ${w.week}/${w.year}: äänestykset ja tulkinta</h1><p class="meta">${esc(range)} · ${items.length} äänestystä</p>
${deep}
${subBox}
<h2>Viikon luvut</h2><ul>${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
<p class="note">Tulkinnat on laskettu koneellisesti äänestystuloksista. Ne eivät ole toimituksellista arviointia, eivätkä ne kerro syitä sille, miksi joku äänesti niin kuin äänesti.</p>
${shareBtns}
${uni.length ? `<h2>Ryhmien yhtenäisyys</h2><p class="meta">Osuus jaa- ja ei-äänistä, jotka olivat ryhmän enemmistön linjalla.</p>${uni.map(u => `<div class="card"><div>${esc(pname(u.p))} <b>${u.pct} %</b></div></div>`).join("")}` : ""}
${topDev.length ? `<h2>Eniten ryhmän linjaa vastaan</h2><p class="meta">Vain jaa- ja ei-äänet, vähintään 5 vertailtavaa äänestystä.</p>${topDev.map(d => `<div class="card"><div>${mpLink(d.r.henkilo, full(d.r))} <span class="meta">${esc(pname(d.r.puolue))}</span></div><div class="meta">${d.eri} / ${d.n} ääntä ryhmän linjaa vastaan</div></div>`).join("")}` : ""}
${topAbs.length ? `<h2>Eniten poissaoloja</h2><p class="meta">Poissaolo ei kerro laiskuudesta: syynä voi olla sairaus, virkamatka tai ministerin tehtävät.</p>${topAbs.map(d => `<div class="card"><div>${mpLink(d.r.henkilo, full(d.r))} <span class="meta">${esc(pname(d.r.puolue))}</span></div><div class="meta">poissa ${d.poissa} / ${d.n} äänestyksessä</div></div>`).join("")}` : ""}
<h2>Viikon äänestykset</h2>${items.map(i => `<a class="card" href="/aanestys/${i.v.id}/"><div>${esc(short(vtitle(i.v), 160))}</div><div class="meta">${dateFi(i.v.alkoi)} · <span class="jaa">Jaa ${i.v.jaa ?? "–"}</span> · <span class="ei">Ei ${i.v.ei ?? "–"}</span>${i.divided ? " · hallitus ja oppositio eri kannalla" : ""}</div></a>`).join("")}`;
  };
  if (weekList.length) {
    const an = weekList.map(analyse);
    const archive = an.map(a => `<a class="card" href="/viikko/${a.w.key}/"><div>Viikko ${a.w.week}/${a.w.year}</div><div class="meta">${esc(a.range)} · ${esc(a.sum)}</div></a>`).join("");
    for (const a of an) put(`/viikko/${a.w.key}/`, shell({ title: `Eduskunnan viikko ${a.w.week}/${a.w.year}: äänestykset ja tulkinta | Eduskuntaseuranta`, desc: `Viikon ${a.w.week} eduskuntaäänestykset: ${a.sum} Ryhmien yhtenäisyys, niukimmat äänestykset ja poissaolot.`, path: `/viikko/${a.w.key}/`, body: `<p class="meta"><a href="/viikko/">← Viikkokatsaukset</a></p>${weekBody(a)}` }));
    put("/viikko/", shell({ title: `Eduskunnan viikkokatsaus: viikon ${an[0].w.week} äänestykset ja tulkinta | Eduskuntaseuranta`, desc: `Eduskunnan viikon äänestykset ja koneellinen tulkinta: ${an[0].sum}`, path: "/viikko/", body: `${weekBody(an[0])}<h2>Aiemmat viikot</h2><p class="meta"><a href="/viikko/rss.xml">RSS-syöte</a> (seuraa viikkokatsauksia lukijasovelluksella)</p>${archive}` }));
    await mkdir(OUT + "/viikko", { recursive: true });
    const rssItems = an.slice(0, 20).map(a => `<item><title>${esc(`Eduskunnan viikko ${a.w.week}/${a.w.year}`)}</title><link>${SITE}/viikko/${a.w.key}/</link><guid>${SITE}/viikko/${a.w.key}/</guid><pubDate>${new Date(a.vs[0].alkoi).toUTCString()}</pubDate><description>${esc((a.tulk && a.tulk.kappaleet ? a.tulk.kappaleet.filter(k => !String(k).startsWith("## ")).join(" ") : a.lines.join(" ")))}</description></item>`).join("");
    await writeFile(OUT + "/viikko/rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Eduskuntaseuranta: viikkokatsaus</title><link>${SITE}/viikko/</link><description>Eduskunnan viikon äänestykset ja koneellinen tulkinta</description><language>fi</language>${rssItems}</channel></rss>`);
  }


  // --- Budjetti, Valtioneuvosto, Kysy ---
  {
    const srcLink = k => `<a href="${SRC[k].url}" rel="noopener">${esc(SRC[k].label)}</a>`;
    const tbl = (rows, h = ["Asia", "Luku", "Huomio"]) => `<div class="tw"><table><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
    const stageNote = `<p class="note">Kaikki luvut ovat hallituksen ja valtiovarainministeriön omia tietoja niiden tiedotteista. Lyhyet selitykset ovat hallituksen oma sanamuoto tiivistettynä, eivät Eduskuntaseurannan arvio. Aikajanalla on kerrottu, minkä vaiheen tieto on kyseessä, koska luvut muuttuvat vaiheesta toiseen.</p>`;
    const tl = `<div class="tw"><table><tr><th>Milloin</th><th>Vaihe</th><th>Huomio</th></tr>${TIMELINE.map(x => `<tr><td><b>${esc(x.d)}</b></td><td>${esc(x.t)}</td><td>${esc(x.n)}${x.s ? ` <small>(<a href="${SRC[x.s].url}" rel="noopener">lähde</a>)</small>` : ""}</td></tr>`).join("")}</table></div>`;
    const partyCards = PARTIES.map(p => `<div class="card" style="display:block"><b>${esc(p.n)}</b><div class="meta">Vuoden 2027 vaihtoehtobudjettia ei ole vielä julkaistu. Uusimmat löydetyt asiakirjat:</div>${p.links.map(l => `<div><a href="${l.u}" rel="noopener">${esc(l.t)}</a></div>`).join("")}</div>`).join("");
    const partyLists = PARTIES.map(p => `<h3>${esc(p.n)}</h3>${tbl([["Leikkaukset ja säästöt", "–", "Lisätään, kun puolueen 2027-vaihtoehto on julkaistu"], ["Veronkorotukset", "–", "Lisätään, kun puolueen 2027-vaihtoehto on julkaistu"], ["Verojen kevennykset", "–", "Lisätään, kun puolueen 2027-vaihtoehto on julkaistu"]])}`).join("");
    put("/budjetti/", shell({ head: "<style>.tw{overflow-x:auto;margin:8px 0}.tw table{table-layout:auto;width:100%}.tw td,.tw th{padding:8px 6px;vertical-align:top;text-align:left;overflow-wrap:anywhere;word-break:normal;hyphens:auto}.tw td:first-child{min-width:7.5em}.tw td{border-top:1px solid #2a2a2a}</style>", title: "Valtion budjetti 2027: hallituksen esitys ja opposition vaihtoehdot | Eduskuntaseuranta", desc: "Valtion budjettiesitys 2027 selkeästi: aikajana, verot, leikkaukset ja lisäykset lähteineen. Opposition vaihtoehdot samassa muodossa, kun ne julkaistaan.", path: "/budjetti/",
      body: `<h1>Valtion budjetti 2027</h1><p>Tähän on koottu hallituksen budjettiesitys ja myöhemmin opposition vaihtoehdot samassa muodossa, jotta niitä voi verrata. Jokaisella luvulla on lähde.</p>
<div class="chips"><a class="chip" href="#aikajana"><b>1</b><span>Aikajana</span></a><a class="chip" href="#esitys"><b>2</b><span>Hallituksen esitys</span></a><a class="chip" href="#verot"><b>3</b><span>Verot</span></a><a class="chip" href="#leikkaukset"><b>4</b><span>Leikkaukset</span></a><a class="chip" href="#oppositio"><b>5</b><span>Oppositio</span></a></div>${stageNote}${shareBtns}
<h2 id="aikajana">1. Missä vaiheessa budjetti on?</h2>${tl}
<h2 id="esitys">2. Hallituksen esitys: keskeiset luvut</h2><p class="meta">Lähde: ${srcLink("vn")}. Valtiovarainministeriön ehdotus 6.8.2026: menot 92,2 mrd €, alijäämä 12,9 mrd € (${srcLink("vm")}).</p>${tbl(KEY2)}<h3>Tulot, menot ja tasapaino (mrd €)</h3><div class="tw"><table><tr>${TABLE.head.map(x => `<th>${esc(x)}</th>`).join("")}</tr>${TABLE.rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' style="text-align:right"' : ""}>${i === 0 ? "<b>" + esc(c) + "</b>" : esc(c)}</td>`).join("")}</tr>`).join("")}</table></div><p class="meta">${esc(TABLE.note)}</p><h3>Säästöt ja muut kehysluvut</h3>${tbl(BGOV.kehys)}<h3>Hyvinvointialueet</h3>${tbl(WELL.hyvinvointialueet)}<h3>Kuntatalous</h3>${tbl(WELL.kunnat)}
<h2 id="verot">3. Verot: korotukset, kevennykset ja toteutumatta jäävät</h2><h3>Veronkorotukset ja verotuloja lisäävät muutokset</h3>${tbl(BGOV.tax.up)}<h3>Verojen kevennykset</h3>${tbl(BGOV.tax.down)}<h3>Hallituksen mukaan toteutumatta</h3><ul>${BGOV.tax.notDone.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
<h2 id="leikkaukset">4. Leikkaukset ja lisäykset</h2><h3>Leikkaukset ja säästöt</h3>${tbl(BGOV.cuts)}<h3>Lisäykset ja panostukset (poimintoja)</h3>${tbl(BGOV.plus)}<h3>Investointiohjelman liikennehankkeet</h3><p class="meta">Valtuus = sitoumusvaltuus eli lupa sitoutua hankkeeseen. Määräraha = vuoden 2027 rahoitus.</p>${tbl(TRANSPORT.map(r => [r[0], r[1]]), ["Hanke", "Luku"])}<p class="note">Lista on poiminta hallituksen tiedotteesta, ei koko budjetti. Koko talousarvioesitys julkaistaan 21.9. osoitteessa <a href="https://budjetti.vm.fi" rel="noopener">budjetti.vm.fi</a>.</p>
<h2 id="oppositio">5. Opposition vaihtoehdot</h2><p>Oppositiopuolueet esittävät vaihtoehtonsa talousarvioaloitteina ja vaihtoehtobudjetteina. Vuoden 2027 versioita ei ole vielä julkaistu: viime vuonna ne tulivat marraskuussa. Kun ne julkaistaan, luvut lisätään tähän samassa muodossa kuin hallituksen esitys. Virallinen lähde ovat Eduskunnan <a href="https://www.eduskunta.fi/FI/valtiopaivaasiakirjat/Sivut/default.aspx" rel="noopener">talousarvioaloitteet (KA)</a>.</p>${partyCards}
<h3 style="margin-top:20px">Leikkaus- ja veronkorotuslistat puolueittain</h3><p class="meta">Sama kolmen rivin muoto jokaiselle puolueelle. Hallituspuolueiden (Kok, PS, RKP, KD) linja on yllä oleva hallituksen esitys.</p>${partyLists}
<p class="note">Lähteet: ${srcLink("vn")} · ${srcLink("vm")} · ${srcLink("edBudjetti")}. Tämä sivu ei ota kantaa budjetin sisältöön.</p>` }));

    const VN = [
      ["Valtioneuvosto: tiedotteet ja päätökset", "https://valtioneuvosto.fi/tiedotteet", "Hallituksen ja ministeriöiden virallinen tiedotus."],
      ["Budjetti (valtiovarainministeriö)", "https://budjetti.vm.fi", "Valtion talousarvioesitys ja budjetin luvut."],
      ["Hankeikkuna", "https://valtioneuvosto.fi/hankkeet", "Valtioneuvoston hankkeet ja lainvalmistelu."],
      ["Lausuntopalvelu.fi", "https://www.lausuntopalvelu.fi", "Lakiluonnokset ja niistä annetut lausunnot."],
      ["Eduskunta: valtiopäiväasiakirjat", "https://www.eduskunta.fi/FI/valtiopaivaasiakirjat/Sivut/default.aspx", "Hallituksen esitykset (HE), valiokuntien mietinnöt ja aloitteet."],
      ["Finlex", "https://www.finlex.fi", "Voimassa oleva lainsäädäntö."],
    ];
    put("/valtioneuvosto/", shell({ title: "Valtioneuvoston julkiset tiedot ja asiakirjat | Eduskuntaseuranta", desc: "Mistä löytyvät hallituksen esitykset, budjetti, lakiluonnokset ja lausunnot: selkeä lista virallisista lähteistä.", path: "/valtioneuvosto/",
      body: `<h1>Valtioneuvoston julkiset tiedot</h1><p>Virallisista lähteistä oikeat paikat yhdessä listassa. Eduskuntaseuranta ei kopioi asiakirjoja, vaan linkittää alkuperäisiin.</p>${VN.map(x => `<a class="card" href="${x[1]}" rel="noopener"><div><b>${esc(x[0])}</b></div><div class="meta">${esc(x[2])}</div></a>`).join("")}<h2>Ajankohtaista</h2><a class="card" href="/budjetti/"><div><b>Valtion budjetti 2027</b></div><div class="meta">Hallituksen esitys, verot, leikkaukset ja opposition vaihtoehdot</div></a>` }));

    const SEARCH_URL = `${SB}/functions/v1/haku`;
    put("/haku/", shell({ title: "Kysy eduskunnasta ja budjetista | Eduskuntaseuranta", desc: "Kysy mitä tahansa eduskunnan äänestyksistä tai valtion budjetista. Vastaus perustuu vain sivuston tietoihin ja kertoo lähteet.", path: "/haku/",
      body: `<h1>Kysy eduskunnasta ja budjetista</h1><p>Kirjoita kysymys, esimerkiksi ”Mitä budjetti 2027 tekee veroille?” tai ”Milloin eduskunta äänesti kissoista?”. Tekoäly vastaa vain Eduskuntaseurannan omien tietojen perusteella ja näyttää lähteet. Se voi erehtyä, joten tarkista tärkeät asiat lähteestä.</p>
<form id="qf"><input id="q" type="search" maxlength="300" placeholder="Kirjoita kysymys" style="width:100%;padding:12px 14px;font-size:16px;border-radius:10px;border:1px solid #444;background:#1a1a1a;color:inherit;margin:8px 0"><label style="display:block;margin:6px 0 10px;font-size:15px"><input type="checkbox" id="lj"> Laaja haku: tekoäly saa hakea tietoa verkosta ja tulkita vapaasti (hitaampi)</label><button type="submit" id="qb" style="padding:12px 18px;font-size:16px;border-radius:10px;border:0;background:#3b6fd4;color:#fff">Kysy</button></form><div id="ans" aria-live="polite" style="margin-top:16px"></div>
<p class="note">Vastaus on tekoälyn tekemä. Tavallinen haku käyttää vain tämän sivuston tietoja (äänestykset, budjetti, lakialoitteet ja hallituksen esitykset). Laaja haku käyttää myös verkkoa. Kysymyksiä ei tallenneta henkilöihin yhdistettynä.</p>
<script>(function(){var f=document.getElementById("qf"),q=document.getElementById("q"),b=document.getElementById("qb"),a=document.getElementById("ans");
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
f.addEventListener("submit",function(e){e.preventDefault();var v=q.value.trim();if(v.length<3){a.textContent="Kirjoita kysymys.";return}
b.disabled=true;a.textContent="Haetaan…";
fetch(${JSON.stringify(SEARCH_URL)},{method:"POST",headers:{"Content-Type":"application/json",apikey:${JSON.stringify(KEY)},Authorization:"Bearer "+${JSON.stringify(KEY)}},body:JSON.stringify({q:v,laaja:!!document.getElementById("lj").checked})}).then(function(r){return r.json()}).then(function(j){b.disabled=false;
if(j.virhe){a.innerHTML='<div class="ai">'+esc(j.virhe)+'</div>';return}
var h='<div class="ai"><b>Vastaus</b><div style="white-space:pre-wrap;margin-top:6px">'+esc(j.vastaus||"")+'</div><small>'+(j.laaja?"Laaja haku: tekoäly käytti verkkoa ja omaa tulkintaansa. Tiedot eivät ole Eduskuntaseurannan vahvistamia – tarkista lähteistä.":"Tekoälyn tekemä vastaus sivuston tietojen perusteella – voi sisältää virheitä.")+'</small></div>';
if(j.lahteet&&j.lahteet.length){h+='<h2>Lähteet</h2>'+j.lahteet.map(function(s){return'<a class="card" href="'+esc(s.url)+'"><div>'+esc(s.otsikko)+'</div></a>'}).join("")}
a.innerHTML=h}).catch(function(){b.disabled=false;a.textContent="Haku ei onnistunut juuri nyt. Yritä myöhemmin uudelleen."})})})()</script>` }));
    await mkdir(OUT, { recursive: true });
    await writeFile(OUT + "/budjetti-data.json", JSON.stringify(AI_FACTS()));
  }

  put("/tilaa/", shell({ title: "Tilaa viikkokatsaus sähköpostiin | Eduskuntaseuranta", desc: "Tilaa eduskunnan viikon äänestykset ja tulkinta ilmaiseksi sähköpostiisi.", path: "/tilaa/", head: SUB_HEAD, body: `<h1>Tilaa viikkokatsaus</h1><p>Kerran viikossa sähköpostiisi: mitä eduskunnassa äänestettiin, miten puolueet jakautuivat ja mitä tuloksista voi päätellä. Ilmainen.</p>${SUB_FORM}${SUB_JS}<p class="note">Tilaus tallentaa vain sähköpostiosoitteesi viikkokatsauksen lähettämistä varten. Jokaisessa viestissä on peruutuslinkki. Osoitetta ei luovuteta eteenpäin. Viestit lähetetään Brevo-palvelun kautta (EU).</p>` }));

  // --- Menetelmäsivu ---
  put("/menetelma/", shell({ title: "Miten luvut lasketaan | Eduskuntaseuranta", desc: "Eduskuntaseurannan tietolähde, laskutavat ja rajoitukset.", path: "/menetelma/", body: METHOD }));


  // --- Avoin data: ladattavat tiedostot toimittajille, kouluille ja tutkijoille ---
  const cell = x => { const t = x === null || x === undefined ? "" : String(x); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const toCsv = (cols, rows) => "\uFEFF" + [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\r\n") + "\r\n";
  const cellSemi = x => { const t = x === null || x === undefined ? "" : String(x); return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const toCsvSemi = (cols, rows) => "\uFEFF" + [cols.join(";"), ...rows.map(r => cols.map(c => cellSemi(r[c])).join(";"))].join("\r\n") + "\r\n";
  const FILES = [];
  const addData = async (name, desc, cols, rows) => {
    await writeFile(`${OUT}/data/${name}.csv`, toCsv(cols, rows));
    await writeFile(`${OUT}/data/${name}-excel.csv`, toCsvSemi(cols, rows));
    await writeFile(`${OUT}/data/${name}.json`, JSON.stringify(rows));
    FILES.push({ name, desc, cols, n: rows.length, rows });
  };
  await mkdir(OUT + "/data", { recursive: true });
  await addData("edustajat", "Kansanedustajat: äänestysten määrät, läsnäolo ja ryhmästä poikkeavat äänet",
    ["henkilo", "etunimi", "sukunimi", "puolue", "puolue_nimi", "vaalipiiri", "aanestyksia", "jaa", "ei", "tyhja", "poissa", "lasnaolo_pros", "vertailtavia", "eri_mielta", "eri_mielta_pros"],
    mps.map(m => ({ henkilo: m.henkilo, etunimi: m.etunimi, sukunimi: m.sukunimi, puolue: m.puolue, puolue_nimi: pname(m.puolue), vaalipiiri: m.vaalipiiri || "", aanestyksia: m.yhteensa, jaa: m.jaa, ei: m.ei, tyhja: m.tyhja, poissa: m.poissa, lasnaolo_pros: lasna(m), vertailtavia: m.vertailtavia, eri_mielta: m.eri_mielta, eri_mielta_pros: eri(m) })));
  await addData("aanestykset", "Eduskunnan äänestykset ja niiden kokonaistulokset",
    ["id", "vuosi", "istunto", "numero", "alkoi", "otsikko", "lisaotsikko", "jaa", "ei", "tyhja", "poissa"],
    loaded.map(v => ({ id: v.id, vuosi: v.vuosi, istunto: v.istunto, numero: v.numero, alkoi: v.alkoi, otsikko: v.otsikko, lisaotsikko: v.lisaotsikko, jaa: v.jaa, ei: v.ei, tyhja: v.tyhja, poissa: v.poissa })));
  if (pa.length) await addData("puolueaanet", "Äänet puolueittain jokaisessa äänestyksessä",
    ["aanestys_id", "puolue", "puolue_nimi", "jaa", "ei", "tyhja", "poissa"],
    pa.map(r => ({ aanestys_id: r.aanestys_id, puolue: r.puolue, puolue_nimi: pname(r.puolue), jaa: r.jaa, ei: r.ei, tyhja: r.tyhja, poissa: r.poissa })));
  const voteRows = [];
  for (const v of detail) for (const r of byV.get(v.id) || []) voteRows.push({ aanestys_id: v.id, henkilo: r.henkilo, puolue: r.puolue, aani: r.aani });
  if (voteRows.length) await addData("aanet", `Jokaisen edustajan ääni ${detail.length} uusimmassa äänestyksessä`, ["aanestys_id", "henkilo", "puolue", "aani"], voteRows);
  const stamp = new Date().toISOString().slice(0, 10);
  const ld = { "@context": "https://schema.org", "@type": "Dataset", name: "Eduskuntaseuranta: kansanedustajien äänestykset", description: "Suomen eduskunnan äänestysten tulokset, kansanedustajien läsnäolo ja ryhmästä poikkeavat äänet. Pohjana Eduskunnan avoin data.", url: SITE + "/data/", inLanguage: "fi", dateModified: stamp, creator: { "@type": "Organization", name: "Eduskuntaseuranta", url: SITE },
    distribution: FILES.flatMap(f => [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/data/${f.name}.csv` }, { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/${f.name}.json` }]) };

  const COLDESC = { henkilo: "edustajan tunniste eduskunnan datassa", etunimi: "etunimi", sukunimi: "sukunimi", puolue: "eduskuntaryhmän lyhenne (esim. kok = Kokoomus, rkp = RKP). Selitykset sivun lopussa.", puolue_nimi: "eduskuntaryhmän nimi", vaalipiiri: "edustajan vaalipiiri (Eduskunnan tietojen mukaan)", aanestyksia: "äänestysten määrä, joihin edustajalla on merkintä", jaa: "Jaa-äänet", ei: "Ei-äänet", tyhja: "tyhjät äänet", poissa: "poissaolot", lasnaolo_pros: "läsnäolo prosentteina (ei poissa)", vertailtavia: "äänestykset, joissa ryhmällä oli selvä linja", eri_mielta: "äänet ryhmän linjaa vastaan", eri_mielta_pros: "ryhmän linjaa vastaan äänestäneet prosentteina", id: "äänestyksen tunniste", vuosi: "valtiopäivävuosi", istunto: "istunnon numero", numero: "äänestyksen numero istunnossa", alkoi: "äänestyksen alkamisaika", otsikko: "äänestyksen otsikko", lisaotsikko: "lisäotsikko", aanestys_id: "äänestyksen tunniste (id)", aani: "ääni: jaa, ei, tyhja tai poissa" };
  const META = {
    edustajat: { title: "Kansanedustajat", what: "Yhteenveto jokaisesta kansanedustajasta: kuinka monessa äänestyksessä hän on ollut mukana, miten hän on äänestänyt, kuinka usein hän on ollut läsnä ja kuinka usein hän on äänestänyt eri tavalla kuin oma eduskuntaryhmänsä.", row: "Yksi rivi on yksi kansanedustaja.", use: "Esimerkiksi: kuka on aktiivisin tai poissaolevin edustaja, tai kuka äänestää useimmin ryhmänsä linjaa vastaan." },
    aanestykset: { title: "Äänestykset", what: "Kaikki eduskunnan äänestykset, jotka sivustolle on ladattu: milloin äänestys pidettiin, mistä asiasta ja mikä oli kokonaistulos.", row: "Yksi rivi on yksi äänestys.", use: "Esimerkiksi: kuinka monta äänestystä pidettiin vuonna 2025, tai mitkä äänestykset menivät niukasti (jaa- ja ei-äänet lähellä toisiaan)." },
    puolueaanet: { title: "Äänet puolueittain", what: "Jokaisessa äänestyksessä: kuinka monta jaa-, ei-, tyhjää ja poissa-ääntä kullakin eduskuntaryhmällä oli.", row: "Yksi rivi on yksi eduskuntaryhmä yhdessä äänestyksessä.", use: "Esimerkiksi: miten Kokoomus ja SDP ovat äänestäneet samoissa asioissa. Liitä äänestyksen otsikko mukaan sarakkeen aanestys_id avulla (se vastaa tiedoston Äänestykset saraketta id)." },
    aanet: { title: "Jokaisen edustajan ääni", what: "Tarkin tieto: miten jokainen edustaja äänesti jokaisessa mukana olevassa äänestyksessä. Mukana ovat vain uusimmat äänestykset.", row: "Yksi rivi on yksi edustajan ääni yhdessä äänestyksessä.", use: "Esimerkiksi: miten tietty edustaja äänesti tietyssä asiassa. Nimen saat liittämällä sarakkeen henkilo tiedostoon Kansanedustajat, ja äänestyksen otsikon liittämällä sarakkeen aanestys_id tiedostoon Äänestykset." }
  };
  const PCODES = Object.entries(PARTY).filter(([k]) => k !== "r");
  const TABLE_CSS = `<style>.tw{overflow-x:auto;margin:12px -12px;padding:0 12px}.tw table{min-width:max-content}.tw td,.tw th{white-space:nowrap;padding:8px 10px}.tw td.w{white-space:normal;min-width:260px}.tw th{position:sticky;top:0;background:#111}</style>`;
  const LIMIT = 300;
  const CARD_CSS = `<style>.sr{width:100%;box-sizing:border-box;padding:12px 14px;margin:8px 0 12px;font-size:16px;border-radius:10px;border:1px solid #444;background:#1a1a1a;color:inherit}.rc{border:1px solid #333;border-radius:10px;padding:10px 12px;margin:8px 0}.rc .t{font-weight:600;margin-bottom:6px}.rc .g{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14px}.rc .g span{color:#9aa}.rc .g b{color:inherit;font-weight:500}.hid{display:none}</style>`;
  const TITLE = { edustajat: r => `${r.sukunimi ?? ""} ${r.etunimi ?? ""}`.trim(), aanestykset: r => r.otsikko || "(ei otsikkoa)", puolueaanet: r => `${r.puolue_nimi} · äänestys ${r.aanestys_id}`, aanet: r => `Edustaja ${r.henkilo} · äänestys ${r.aanestys_id}` };
  const SKIP = { edustajat: ["etunimi", "sukunimi", "puolue"], aanestykset: ["otsikko"], puolueaanet: ["puolue_nimi", "aanestys_id"], aanet: ["henkilo", "aanestys_id"] };
  const LABEL = { henkilo: "tunniste", puolue: "puolue", puolue_nimi: "puolue", aanestyksia: "äänestyksiä", jaa: "jaa", ei: "ei", tyhja: "tyhjä", poissa: "poissa", lasnaolo_pros: "läsnä %", vertailtavia: "vertailtavia", eri_mielta: "eri mieltä", eri_mielta_pros: "eri mieltä %", id: "tunniste", vuosi: "vuosi", istunto: "istunto", numero: "numero", alkoi: "päivä", lisaotsikko: "lisätieto", aani: "ääni" };
  const fmtVal = (c, v) => c === "alkoi" ? dateFi(v) : v;
  for (const f of FILES) {
    const shown = f.rows.slice(0, LIMIT);
    const cut = shown.length < f.rows.length;
    const tf = TITLE[f.name] || (r => String(r[f.cols[0]] ?? ""));
    const skip = SKIP[f.name] || [];
    const cards = shown.map(r => {
      const t = tf(r);
      const g = f.cols.filter(c => !skip.includes(c) && r[c] !== null && r[c] !== undefined && r[c] !== "").map(c => `<div><span>${esc(LABEL[c] || c)}:</span> <b>${esc(fmtVal(c, r[c]))}</b></div>`).join("");
      return `<div class="rc" data-q="${esc((t + " " + f.cols.map(c => r[c] ?? "").join(" ")).toLowerCase())}"><div class="t">${esc(t)}</div><div class="g">${g}</div></div>`;
    }).join("");
    const script = `<script>(function(){var i=document.getElementById("sr"),n=document.getElementById("cnt"),c=document.querySelectorAll(".rc");i.addEventListener("input",function(){var q=i.value.trim().toLowerCase(),k=0;c.forEach(function(e){var m=!q||e.getAttribute("data-q").indexOf(q)>-1;e.classList.toggle("hid",!m);if(m)k++});n.textContent=k+" riviä näkyvissä"})})();</script>`;
    const head = "";
    const trs = "";
    const M = META[f.name] || { title: f.name, what: f.desc, row: "", use: "" };
    const ex = f.rows[0] || {};
    const body = `<p class="meta"><a href="/data/">← Kaikki tiedostot</a></p><h1>${esc(M.title)}</h1>
<p>${esc(M.what)}</p><p><b>${esc(M.row)}</b></p><p class="meta">${esc(M.use)}</p>
<h2>Lataa</h2>
<div class="share"><a class="btn" href="/data/${f.name}-excel.csv" download>Lataa Exceliin (CSV)</a><a class="btn" href="/data/${f.name}.csv" download>Lataa muuhun taulukko-ohjelmaan (CSV)</a><a class="btn" href="/data/${f.name}.json" download>Lataa ohjelmoijille (JSON)</a></div>
<h2>Esikatselu</h2>
${cut ? `<p class="note">Tässä näkyy ${LIMIT} ensimmäistä riviä ${f.n.toLocaleString("fi-FI")} rivistä. Haku etsii vain näistä. Koko aineisto on ladattavissa painikkeista.</p>` : `<p class="note">${f.n.toLocaleString("fi-FI")} riviä.</p>`}
<input id="sr" class="sr" type="search" placeholder="Hae esikatselusta (nimi, puolue, aihe...)"><p class="note" id="cnt">${shown.length} riviä näkyvissä</p>
${cards}${script}
<h2>Mitä sarakkeet tarkoittavat</h2><ul>${f.cols.map(c => `<li><b>${esc(c)}</b>: ${esc(COLDESC[c] || "")}${ex[c] !== undefined && ex[c] !== null && String(ex[c]).length < 40 ? ` <span class="meta">(esim. ${esc(ex[c])})</span>` : ""}</li>`).join("")}</ul>
${f.cols.includes("puolue") ? `<h2>Puolueiden lyhenteet</h2><ul>${PCODES.map(([k, v]) => `<li><b>${k}</b> = ${esc(v)}</li>`).join("")}</ul>` : ""}`;
    jobs.push({ path: `/data/${f.name}/`, html: shell({ title: `${M.title} – avoin data | Eduskuntaseuranta`, desc: f.desc, path: `/data/${f.name}/`, body, head: CARD_CSS + '<meta name="robots" content="noindex">' }) });
  }
  const dataBody = `<h1>Avoin data: eduskunnan äänestykset ladattavana</h1>
<p>Täältä voit ladata sivuston tiedot ilmaiseksi taulukkona. Tiedot päivittyvät itsestään noin kuuden tunnin välein. Viimeksi päivitetty ${dateFi(new Date())}.</p>
<h2>Näin pääset alkuun</h2>
<ol><li>Valitse alta tiedosto, jonka haluat.</li><li>Paina <b>Katso taulukkona</b>, jos haluat vain selata tietoja. Siellä on myös selitys jokaiselle sarakkeelle.</li><li>Paina <b>Lataa Exceliin</b>, jos haluat tiedoston omalle koneellesi taulukko-ohjelmaan. (Puhelimessa tiedosto latautuu, mutta avaaminen onnistuu parhaiten tietokoneella.)</li></ol>
<h2>Tiedostot</h2>
${FILES.map(f => { const M = META[f.name] || { title: f.name, what: f.desc, row: "" }; return `<div class="card"><div><b>${esc(M.title)}</b> · ${f.n.toLocaleString("fi-FI")} riviä</div><div class="meta">${esc(M.what)}</div><div class="meta"><b>${esc(M.row)}</b></div><div class="share"><a class="btn on" href="/data/${f.name}/">Katso taulukkona</a><a class="btn" href="/data/${f.name}-excel.csv" download>Lataa Exceliin</a><a class="btn" href="/data/${f.name}.csv" download>CSV</a><a class="btn" href="/data/${f.name}.json" download>JSON</a></div></div>`; }).join("")}
<h2>Mikä on CSV ja mikä JSON?</h2>
<ul><li><b>CSV</b> on tavallinen taulukkotiedosto. Se aukeaa Excelissä, Google Sheetsissä ja LibreOfficessa. Suomalaiseen Exceliin käytä painiketta <b>Lataa Exceliin</b>.</li><li><b>JSON</b> on ohjelmoijille tarkoitettu muoto (Python, R, verkkosovellukset). Jos et ohjelmoi, älä välitä siitä.</li></ul>
<h2>Miten tiedostot liittyvät toisiinsa</h2>
<ul><li>Äänestyksen tunniste: <b>id</b> (tiedosto Äänestykset) = <b>aanestys_id</b> (tiedostot Äänet puolueittain ja Jokaisen edustajan ääni).</li><li>Edustajan tunniste: <b>henkilo</b> on sama tiedostoissa Kansanedustajat ja Jokaisen edustajan ääni.</li></ul>
<h2>Esimerkkejä kysymyksistä, joihin datalla voi vastata</h2>
<ul><li>Kuka kansanedustaja on äänestänyt useimmin oman ryhmänsä linjaa vastaan?</li><li>Miten paljon eri puolueiden edustajat ovat poissa äänestyksistä?</li><li>Mitkä äänestykset ovat menneet niukimmin?</li></ul>
<h2>Puolueiden lyhenteet</h2>
<ul>${PCODES.map(([k, v]) => `<li><b>${k}</b> = ${esc(v)}</li>`).join("")}</ul>
<h2>Lähteen merkitseminen</h2>
<p>Voit käyttää tietoja vapaasti toimituksissa, opetuksessa ja tutkimuksessa. Mainitse lähteeksi ”Eduskuntaseuranta.fi, perustuu Eduskunnan avoimeen dataan (avoindata.eduskunta.fi)” ja hakupäivä. Esimerkki: <i>Eduskuntaseuranta.fi (${dateFi(new Date())}). Kansanedustajien äänestykset. ${SITE}/data/</i></p>
<h2>Muista</h2>
<ul><li>Äänikohtaiset tiedot (tiedosto <b>aanet</b>) kattavat vain ${detail.length} uusinta äänestystä. Kaikkien äänestysten yhteenvedot ovat tiedostoissa <b>edustajat</b> ja <b>aanestykset</b>.</li><li>Poissaolo ei tarkoita laiskuutta: syynä voi olla sairaus, virkamatka tai ministerin tehtävät.</li><li>Laskutavat on kuvattu <a href="/menetelma/">Menetelmä-sivulla</a>. Alkuperäinen virallinen tieto on aina eduskunnan omissa palveluissa.</li></ul>
<p class="meta">Kysymyksiä tai toiveita datasta? Kerro, mitä tietoa tarvitset, niin tarkistetaan, voiko sen lisätä.</p>`;
  put("/data/", shell({ title: "Avoin data: kansanedustajien äänestykset CSV ja JSON | Eduskuntaseuranta", desc: "Lataa eduskunnan äänestysten ja kansanedustajien läsnäolon tiedot ilmaiseksi CSV- ja JSON-muodossa toimittajille, opiskelijoille ja tutkijoille.", path: "/data/", body: dataBody, head: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` }));

  // --- Testi: kuka äänestää kuten sinä ---
  const cand = detail.filter(v => Math.min(v.jaa || 0, v.ei || 0) >= 35 && (v.jaa || 0) + (v.ei || 0) >= 150);
  const seen = new Set(), qs = [];
  for (const v of cand) { const k = (v.otsikko || "").trim().toLowerCase(); if (!k || seen.has(k)) continue; seen.add(k); qs.push(v); if (qs.length === QUIZ_N) break; }
  if (qs.length >= 5) {
    const maps = qs.map(q => new Map((byV.get(q.id) || []).map(r => [r.henkilo, r.aani])));
    const m = [];
    for (const mp of mps) {
      const c = maps.map(mm => ({ jaa: "j", ei: "e" }[mm.get(mp.henkilo)] || "-")).join("");
      if ((c.match(/[je]/g) || []).length >= 5) m.push({ s: mpSlug.get(mp.henkilo), n: full(mp), p: pname(mp.puolue), c });
    }
    await mkdir(OUT + "/data", { recursive: true });
    await writeFile(OUT + "/data/quiz.json", JSON.stringify({ q: qs.map(v => ({ t: vtitle(v), s: v.tiivistelma || "", m: (() => { const x = voteMeaning(v); return x ? [x.jaa ? "Jaa = " + x.jaa : "", x.ei ? "Ei = " + x.ei : ""].filter(Boolean).join(" · ") : ""; })(), d: dateFi(v.alkoi), j: v.jaa, e: v.ei, id: v.id })), m }));
    put("/testi/", shell({ title: "Kuka kansanedustaja äänestää kuten sinä? | Eduskuntaseuranta", desc: `Vastaa ${qs.length} oikeaan eduskunnan äänestykseen ja katso, ketkä kansanedustajat ja puolueet äänestivät samoin kuin sinä.`, path: "/testi/", body: QUIZ_HTML }));
  } else console.log("Testiin ei löytynyt tarpeeksi äänestyksiä, ohitetaan.");

  // --- Kirjoitus levylle ---
  await pool(jobs, 16, async j => { const dir = OUT + j.path; await mkdir(dir, { recursive: true }); await writeFile(dir + "index.html", j.html); });
  for (const f of ["index.html", "og.png"]) if (existsSync(f)) await copyFile(f, `${OUT}/${f}`);
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(OUT + "/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", ...urls].map(u => `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("")}</urlset>`);
  await writeFile(OUT + "/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  await writeFile(OUT + "/CNAME", new URL(SITE).host + "\n");
  await writeFile(OUT + "/404.html", shell({ title: "Sivua ei löytynyt | Eduskuntaseuranta", desc: "Sivua ei löytynyt.", path: "/404.html", body: `<h1>Sivua ei löytynyt</h1><p><a href="/">Siirry etusivulle</a></p>` }));
  console.log(`Valmis: ${urls.length} sivua, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const METHOD = `<h1>Miten luvut lasketaan</h1>
<h2>Tietolähde</h2><p>Kaikki tiedot tulevat Eduskunnan avoimesta datasta (avoindata.eduskunta.fi): äänestysten tulokset ja jokaisen kansanedustajan ääni nykyiseltä vaalikaudelta (vuodesta 2023). Sivusto päivittyy automaattisesti, kun uusia äänestyksiä tulee.</p>
<h2>Läsnäolo</h2><p>Läsnäolo on niiden äänestysten osuus, joissa edustajan ääni oli jotain muuta kuin ”Poissa”. Poissaolo ei kerro laiskuudesta: syynä voi olla esimerkiksi sairaus, virkamatka, eduskunnan edustustehtävä tai ministerin tehtävät. Luku ei myöskään mittaa edustajan kokonaistyötä, koska suurin osa työstä tehdään valiokunnissa ja vaalipiirissä.</p>
<h2>Ryhmänsä linjasta poikkeava ääni</h2><p>Ryhmän ”linja” on äänestyksessä se vaihtoehto, Jaa tai Ei, jota useampi ryhmän edustaja äänesti. Edustajan ääni lasketaan poikkeavaksi, kun hän äänesti Jaa tai Ei toisin kuin ryhmän enemmistö. Tasatilanteita ei lasketa mukaan, eikä myöskään Tyhjää- tai Poissa-ääniä. Pienessä ryhmässä yksittäinen ääni vaikuttaa linjaan paljon. Poikkeaminen ei ole itsessään hyvä tai huono asia.</p>
<h2>Mitä Jaa ja Ei tarkoittavat</h2><p>Eduskunnan äänestyksen otsikko kertoo yleensä asian aiheen, ei sitä, mitä Jaa tai Ei tarkoittaa. Usein äänestetään valiokunnan mietinnöstä tai vastaehdotuksesta: esimerkiksi kansalaisaloitteessa Jaa voi tarkoittaa mietinnön kannattamista eli aloitteen hylkäämistä. Kun eduskunnan lisäotsikko kertoo vaihtoehtojen merkityksen, näytämme sen jokaisen äänestyksen sivulla.</p>
<h2>Aiheet</h2><p>Äänestys sijoitetaan aiheeseen otsikon ja lisäotsikon avainsanojen perusteella (esimerkiksi sana "vero" vie aiheeseen Talous ja verot). Jos äänestykselle on tekoälyn antama aihe, käytetään sitä. Luokittelu on karkea eikä aina osu oikeaan, ja yksi äänestys kuuluu vain yhteen aiheeseen.</p>
<h2>Tekoälyn tekemät selitykset</h2><p>Osalle äänestyksistä on tehty lyhyt selkokielinen selitys tekoälyn avulla. Selitys perustuu eduskunnan antamaan otsikkoon, ja se on aina merkitty tekoälyn tekemäksi. Se voi sisältää virheitä, joten virallinen otsikko on aina näkyvissä sen yläpuolella.</p>
<h2>Testi ”Kuka äänestää kuten sinä?”</h2><p>Testi valitsee uusimmista äänestyksistä sellaisia, joissa eduskunta jakautui selvästi. Se ei ole vaalikone: se vertaa vastauksiasi vain näihin muutamaan äänestykseen eikä kerro, ketä kannattaa äänestää.</p>
<h2>Riippumattomuus ja mainokset</h2><p>Sivusto ei ole eduskunnan tai minkään puolueen ylläpitämä. Sivustolla voi olla tulevaisuudessa mainoksia. Mainokset eivät vaikuta tietojen sisältöön.</p>`;

const QUIZ_HTML = `<h1>Kuka kansanedustaja äänestää kuten sinä?</h1>
<p class="meta">Valitse jokaiseen oikeaan eduskunnan äänestykseen Jaa, Ei tai Ohita. Lopuksi näet, ketkä edustajat ja puolueet äänestivät eniten samoin kuin sinä. Tämä ei ole vaalikone.</p>
<div id="app"><p class="note">Ladataan…</p></div>
<script>
(function(){var A=document.getElementById("app"),D,i=0,ans=[];
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
fetch("/data/quiz.json").then(function(r){return r.json()}).then(function(d){D=d;show()}).catch(function(){A.textContent="Lataus epäonnistui."});
function show(){A.textContent="";if(i>=D.q.length)return result();var q=D.q[i],c=el("div","q");
c.appendChild(el("div","meta","Kysymys "+(i+1)+" / "+D.q.length+" · "+q.d));
c.appendChild(el("div","t",q.s||q.t));if(q.s)c.appendChild(el("div","meta","Virallinen otsikko: "+q.t));c.appendChild(el("div","note",q.m?"Mitä vaihtoehdot tarkoittavat: "+q.m:"Huom. Jaa tai Ei voi tarkoittaa muutakin kuin otsikon asian kannattamista."));
var row=el("div","share");[["j","Jaa"],["e","Ei"],["-","Ohita"]].forEach(function(o){var b=el("button","",o[1]);b.onclick=function(){ans[i]=o[0];var n=el("div","note","Eduskunnassa: Jaa "+q.j+", Ei "+q.e);c.appendChild(n);row.querySelectorAll("button").forEach(function(x){x.disabled=true});var nx=el("button","on",i+1<D.q.length?"Seuraava":"Näytä tulos");nx.onclick=function(){i++;show()};c.appendChild(nx)};row.appendChild(b)});
c.appendChild(row);A.appendChild(c)}
function result(){var R=[],P={};D.m.forEach(function(m){var s=0,n=0;for(var k=0;k<D.q.length;k++){var a=ans[k],b=m.c[k];if((a==="j"||a==="e")&&(b==="j"||b==="e")){n++;if(a===b)s++}}
if(n>=5){var r={m:m,s:s/n,n:n};R.push(r);var p=P[m.p]||(P[m.p]={t:0,c:0});p.t+=r.s;p.c++}});
A.textContent="";if(R.length<3){A.appendChild(el("p","","Vastasit liian harvaan kysymykseen tuloksen laskemiseksi. Yritä uudelleen ja vastaa useampaan."));restart();return}
R.sort(function(a,b){return b.s-a.s||b.n-a.n});
A.appendChild(el("h2","","Eniten samoin äänestäneet edustajat"));
R.slice(0,10).forEach(function(r){var a=el("a","card");a.href="/edustaja/"+r.m.s+"/";a.appendChild(el("div","",r.m.n+" ("+r.m.p+")"));a.appendChild(el("div","meta","Samoin "+Math.round(100*r.s)+" % ("+r.n+" vertailtua äänestystä)"));var b=el("div","bar"),f=el("i");f.style.width=Math.round(100*r.s)+"%";b.appendChild(f);a.appendChild(b);A.appendChild(a)});
A.appendChild(el("h2","","Puolueet keskimäärin"));
var ps=Object.keys(P).filter(function(k){return P[k].c>=3}).map(function(k){return[k,P[k].t/P[k].c]}).sort(function(a,b){return b[1]-a[1]});
var t=el("table");ps.forEach(function(p){var tr=el("tr");tr.appendChild(el("td","",p[0]));tr.appendChild(el("td","",Math.round(100*p[1])+" %"));t.appendChild(tr)});A.appendChild(t);
A.appendChild(el("p","note","Vertailu perustuu vain näihin "+D.q.length+" äänestykseen, joissa eduskunta jakautui selvästi. Se ei ole vaalikone."));
var sh=el("div","share"),b=el("button","","Jaa testi");b.onclick=function(){var u=location.href;if(navigator.share)navigator.share({title:document.title,url:u}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(u).then(function(){b.textContent="Linkki kopioitu"})};sh.appendChild(b);A.appendChild(sh);restart()}
function restart(){var b=el("button","","Tee testi uudelleen");b.onclick=function(){i=0;ans=[];show()};A.appendChild(b)}
})();
</script>`;

main().catch(e => { console.error("VIRHE:", e.stack); process.exit(1); });
