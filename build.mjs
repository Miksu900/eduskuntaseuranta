// build.mjs – rakentaa Eduskuntaseuranta-sivuston staattiset sivut Supabasen datasta.
// Ajetaan GitHub Actionsissa (ks. .github/workflows/build.yml). Tulos kirjoitetaan kansioon dist/.
import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const SB = process.env.SUPABASE_URL || "https://arwenhbwzoavbonlwkdr.supabase.co";
const KEY = process.env.SUPABASE_KEY || "sb_publishable_7baeuteHYaarCEv4-j8C_g_OLxcKzJp";
const SITE = (process.env.SITE_URL || "https://eduskuntaseuranta.fi").replace(/\/$/, "");
const OUT = "dist";
const DETAIL_N = 300; // montako uusinta äänestystä saa edustajakohtaiset äänet sivuille
const QUIZ_N = 12;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const AANI = { jaa: "Jaa", ei: "Ei", tyhja: "Tyhjää", poissa: "Poissa" };
const PARTY = { kok: "Kokoomus", ps: "Perussuomalaiset", sd: "SDP", kesk: "Keskusta", vihr: "Vihreät", vas: "Vasemmistoliitto", rkp: "RKP", kd: "Kristillisdemokraatit", liik: "Liike Nyt" };
const pname = p => PARTY[String(p || "").toLowerCase()] || (p ? String(p).toUpperCase() : "Ei ryhmää");
const dateFi = d => (d ? new Date(d).toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki" }) : "");
const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const vtitle = v => v.otsikko || v.lisaotsikko || "Äänestys " + v.id;

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

function shell({ title, desc, path, body, head = "" }) {
  const url = SITE + path;
  return `<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:locale" content="fi_FI"><meta property="og:site_name" content="Eduskuntaseuranta">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
<style>${CSS}</style>${head}</head><body>
<header class="top"><a class="brand" href="/">Eduskuntaseuranta</a><nav><a href="/edustajat/">Edustajat</a><a href="/aanestykset/">Äänestykset</a><a href="/#p">Puolueet</a><a href="/testi/">Kuka äänestää kuten sinä?</a><a href="/menetelma/">Menetelmä</a></nav></header>
<main>${body}</main>
<footer>Lähde: Eduskunnan avoin data. Tiedot on laskettu koneellisesti ja ne ovat vain yksi osa edustajan työtä. <a href="/menetelma/">Lue, miten luvut lasketaan.</a> Päivitetty ${dateFi(new Date())}.</footer>
${SHARE_JS}</body></html>`;
}
const shareBtns = `<div class="share"><button data-share>Jaa tämä sivu</button></div>`;
const voteTag = a => `<span class="${a}">${AANI[a] || a}</span>`;

// ---------- Pääohjelma ----------
async function main() {
  const t0 = Date.now();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const mps = await all("mp_stats?select=*", "henkilo");
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
  for (const r of pa) { if (!paBy.has(r.aanestys_id)) paBy.set(r.aanestys_id, []); paBy.get(r.aanestys_id).push(r); }

  // Edustajakohtaiset äänet uusimmista äänestyksistä
  const detail = loaded.slice(0, DETAIL_N);
  const ids = detail.map(v => v.id);
  const batches = []; for (let i = 0; i < ids.length; i += 5) batches.push(ids.slice(i, i + 5));
  const parts = await pool(batches, 4, b => all(`aanestys_edustaja?select=aanestys_id,henkilo,etunimi,sukunimi,puolue,aani&aanestys_id=in.(${b.join(",")})`, "aanestys_id,henkilo"));
  const byV = new Map(), byMp = new Map();
  for (const rows of parts) for (const r of rows) {
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
    const list = (byMp.get(m.henkilo) || []).slice(0, 50);
    const vmap = new Map(votings.map(v => [v.id, v]));
    const li = list.map(x => { const v = vmap.get(x.aid) || { id: x.aid }; return `<a class="card" href="/aanestys/${v.id}/"><div>${esc(vtitle(v))}</div><div class="meta">${dateFi(v.alkoi)} · ${voteTag(x.aani)}</div></a>`; }).join("");
    const body = `<div class="meta"><a href="/puolue/${slug(m.puolue) || "muut"}/">${esc(pname(m.puolue))}</a> · kansanedustaja</div>
<h1>${esc(nm)} – äänestykset ja läsnäolo</h1>
<div class="chips"><div class="chip"><b>${lasna(m)} %</b><span>läsnä äänestyksissä</span></div><div class="chip"><b>${eri(m)} %</b><span>ryhmänsä linjasta poikkeavia ääniä</span></div><div class="chip"><b>${m.yhteensa}</b><span>äänestystä yhteensä</span></div></div>
<p class="meta">Jaa ${m.jaa} · Ei ${m.ei} · Tyhjää ${m.tyhja} · Poissa ${m.poissa}. Poissaolo voi johtua esimerkiksi luottamustehtävästä, sairaudesta tai virkamatkasta.</p>
${shareBtns}
<h2>Viimeisimmät äänestykset</h2>${li || '<p class="note">Yksittäisiä äänestyksiä ei ole vielä saatavilla.</p>'}
<p class="note"><a href="/menetelma/">Miten ”ryhmänsä linjasta poikkeava” lasketaan?</a></p>`;
    put(`/edustaja/${s}/`, shell({ title: `${nm} (${pname(m.puolue)}) – äänestykset | Eduskuntaseuranta`, desc: `Miten ${nm} on äänestänyt eduskunnassa? Läsnäolo ${lasna(m)} %, ryhmästä poikkeavia ääniä ${eri(m)} % (${m.yhteensa} äänestystä).`, path: `/edustaja/${s}/`, body }));
  }

  // --- Äänestyssivut ---
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
    const body = `<div class="meta">Äänestys ${dateFi(v.alkoi)}${v.aihe ? " · " + esc(v.aihe) : ""}</div><h1>${esc(t)}</h1>
${v.lisaotsikko && v.lisaotsikko !== v.otsikko ? `<p class="meta">${esc(v.lisaotsikko)}</p>` : ""}${ai}
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

  // --- Menetelmäsivu ---
  put("/menetelma/", shell({ title: "Miten luvut lasketaan | Eduskuntaseuranta", desc: "Eduskuntaseurannan tietolähde, laskutavat ja rajoitukset.", path: "/menetelma/", body: METHOD }));

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
    await writeFile(OUT + "/data/quiz.json", JSON.stringify({ q: qs.map(v => ({ t: vtitle(v), s: v.tiivistelma || "", d: dateFi(v.alkoi), j: v.jaa, e: v.ei, id: v.id })), m }));
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
c.appendChild(el("div","t",q.s||q.t));if(q.s)c.appendChild(el("div","meta","Virallinen otsikko: "+q.t));
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

main().catch(e => { console.error("VIRHE:", e.message); process.exit(1); });
