// EU-osio: suomalaisten meppien äänet (HowTheyVote, avoin data) ja suomalaiset organisaatiot EU:n avoimuusrekisterissä.
import { Readable } from "node:stream";
import { createGunzip, gunzipSync } from "node:zlib";
import { createInterface } from "node:readline";

const REL = process.env.HTV_REL || "https://github.com/HowTheyVote/data/releases/latest/download";
const TR_URL = process.env.EU_TR_URL || "https://transparency-register.europa.eu/odplastorganisationxml_en";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nf = new Intl.NumberFormat("fi-FI");

export function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
    else if (c !== "\r") f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function table(text) {
  const r = parseCsv(text); const h = r.shift() || [];
  return r.map(x => { const o = {}; h.forEach((k, i) => o[k] = x[i] ?? ""); return o; });
}

async function fetchRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Eduskuntaseuranta/1.0 (eduskuntaseuranta.fi)" }, signal: AbortSignal.timeout(300000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r;
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000 * (i + 1)); }
  }
}
async function getGz(name) {
  const r = await fetchRetry(`${REL}/${name}.csv.gz`);
  return gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8");
}

const POS = { FOR: "+", AGAINST: "-", ABSTENTION: "0", DID_NOT_VOTE: "x" };
const cap = s => String(s || "").toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

// Lukee member_votes-rivit (vote_id,member_id,position,...) ja kerää vain suomalaisten meppien pääasiallisten äänestysten rivit.
export async function collectVotes(lines, finIds, mainIds) {
  const out = new Map(); let first = true;
  for await (const line of lines) {
    if (first) { first = false; continue; }
    const a = line.indexOf(","), b = line.indexOf(",", a + 1);
    if (a < 0 || b < 0) continue;
    const mid = line.slice(a + 1, b);
    if (!finIds.has(mid)) continue;
    const vid = line.slice(0, a);
    if (!mainIds.has(vid)) continue;
    const c = line.indexOf(",", b + 1);
    const p = POS[line.slice(b + 1, c < 0 ? undefined : c)];
    if (!p) continue;
    let m = out.get(vid); if (!m) out.set(vid, m = new Map());
    m.set(mid, p);
  }
  return out;
}

export function buildMeps({ members, votes, groups, groupMemberships, parties, partyMemberships, positions }) {
  const fin = members.filter(m => m.country_code === "FIN");
  const gname = new Map(groups.map(g => [g.code, g.short_label || g.label]));
  const pname = new Map(parties.map(p => [p.id, p.label]));
  const last = (rows, id) => rows.filter(r => r.member_id === id).sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0];
  const meps = fin.map(m => {
    const g = last(groupMemberships, m.id), p = last(partyMemberships, m.id);
    return { id: m.id, name: cap(m.first_name) + " " + cap(m.last_name), group: g ? gname.get(g.group_code) || g.group_code : "", party: p ? pname.get(p.national_party_id) || "" : "", current: !!g && !g.end_date };
  });
  const order = meps.map(m => m.id);
  const vrows = votes.filter(v => v.is_main === "True" && positions.has(v.id)).map(v => {
    const pm = positions.get(v.id);
    return { id: v.id, date: (v.timestamp || "").slice(0, 10), title: v.display_title || v.procedure_title || "", result: v.result || "", f: +v.count_for || 0, a: +v.count_against || 0, ab: +v.count_abstention || 0, n: +v.count_did_not_vote || 0, pos: order.map(id => pm.get(id) || ".").join("") };
  }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { meps, votes: vrows };
}

export async function loadEuVotes() {
  const [membersT, votesT, groupsT, gmT, partiesT, pmT] = await Promise.all(["members", "votes", "groups", "group_memberships", "national_parties", "national_party_memberships"].map(getGz));
  const members = table(membersT), votes = table(votesT);
  const finIds = new Set(members.filter(m => m.country_code === "FIN").map(m => m.id));
  const mainIds = new Set(votes.filter(v => v.is_main === "True").map(v => v.id));
  const r = await fetchRetry(`${REL}/member_votes.csv.gz`);
  const lines = createInterface({ input: Readable.fromWeb(r.body).pipe(createGunzip()), crlfDelay: Infinity });
  const positions = await collectVotes(lines, finIds, mainIds);
  const d = buildMeps({ members, votes, groups: table(groupsT), groupMemberships: table(gmT), parties: table(partiesT), partyMemberships: table(pmT), positions });
  console.log(`EU: suomalaisia meppejä ${d.meps.length}, äänestyksiä ${d.votes.length}`);
  return d;
}

// --- Avoimuusrekisteri ---
const ent = s => String(s || "").replace(/&#xd;/gi, "\n").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (s, t) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(s); return m ? ent(m[1]).trim() : ""; };

export function parseRegister(xml) {
  const out = []; let i = 0;
  for (;;) {
    const s = xml.indexOf("<interestRepresentative>", i); if (s < 0) break;
    const e = xml.indexOf("</interestRepresentative>", s); if (e < 0) break;
    i = e; const rec = xml.slice(s, e);
    const ho = (/<headOffice>([\s\S]*?)<\/headOffice>/.exec(rec) || [])[1] || "";
    if (tag(ho, "country").toUpperCase() !== "FINLAND") continue;
    const cat = tag(rec, "registrationCategory"), form = tag(rec, "entityForm");
    if (/self-employed|individual|natural person/i.test(cat + " " + form)) continue; // ei yksityishenkilöitä
    const ints = [...((/<interests>([\s\S]*?)<\/interests>/.exec(rec) || [])[1] || "").matchAll(/<name>([\s\S]*?)<\/name>/g)].map(m => ent(m[1]).trim()).filter(Boolean);
    out.push({
      id: tag(rec, "identificationCode"), name: tag(rec, "originalName") || tag(rec, "name"), acronym: tag(rec, "acronym"), form, category: cat,
      web: tag(rec, "webSiteURL"), city: tag(ho, "city"), registered: tag(rec, "registrationDate").slice(0, 10), updated: tag(rec, "lastUpdateDate").slice(0, 10),
      goals: tag(rec, "goals").slice(0, 1500), interests: ints, fte: tag(rec, "membersFTE"), ep: tag(rec, "EPAccreditedNumber"),
    });
  }
  return out.filter(o => o.id && o.name);
}
export async function loadEuRegister() {
  const r = await fetchRetry(TR_URL);
  const list = parseRegister(await r.text()).sort((a, b) => a.name.localeCompare(b.name, "fi"));
  console.log(`EU-avoimuusrekisteri: suomalaisia organisaatioita ${list.length}`);
  return list;
}

export async function loadEu() {
  const out = {};
  try { out.votes = await loadEuVotes(); } catch (e) { console.log("EU-äänet ohitettu:", e.message); }
  try { out.lobby = await loadEuRegister(); } catch (e) { console.log("EU-avoimuusrekisteri ohitettu:", e.message); }
  return out.votes || out.lobby ? out : null;
}

const RES = { ADOPTED: "Hyväksytty", REJECTED: "Hylätty" };
export function euPages({ shell, esc, dateFi, data }) {
  const pages = []; const files = [];
  const SRC_V = `<div class="note"><b>Mistä tiedot ovat</b><br>Äänestystiedot ovat HowTheyVote.eu-palvelun keräämiä Euroopan parlamentin avoimesta datasta. Mukana ovat parlamentin täysistuntojen pääasialliset äänestykset vuodesta 2019. Otsikot ovat parlamentin omia, yleensä englanniksi tai ranskaksi. Ääni on mepin oma ääni: puolesta, vastaan, pidättyi tai ei äänestänyt.</div>`;
  const SRC_L = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot ovat EU:n avoimuusrekisteristä (transparency-register.europa.eu), jonne EU-päättäjiin vaikuttavat järjestöt ja yritykset ilmoittavat itse tietonsa. Tässä näytetään organisaatiot, joiden päätoimipaikka on Suomessa. Yksityishenkilöitä ei näytetä. Ilmoitukset ovat ilmoittajien omia tietoja sellaisenaan.</div>`;
  const filt = (id, ph) => `<input id="${id}" type="search" placeholder="${ph}" style="width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">`;
  const D = data.votes, L = data.lobby;

  if (D) {
    const cnt = (m, i) => { const c = { "+": 0, "-": 0, "0": 0, x: 0 }; for (const v of D.votes) { const ch = v.pos[i]; if (c[ch] !== undefined) c[ch]++; } return c; };
    D.meps.forEach((m, i) => { m.c = cnt(m, i); m.n = m.c["+"] + m.c["-"] + m.c["0"] + m.c.x; });
    const L4 = { "+": "Puolesta", "-": "Vastaan", "0": "Pidättyi", x: "Ei äänestänyt" };
    for (const [i, m] of D.meps.entries()) {
      if (!m.n) continue;
      const path = `/eu/mepit/${m.id}/`;
      const rows = D.votes.filter(v => v.pos[i] !== ".").slice(0, 40).map(v => `<tr><td>${esc(dateFi(v.date))}</td><td><a href="https://howtheyvote.eu/votes/${v.id}" rel="noopener">${esc(v.title)}</a></td><td style="white-space:nowrap"><b>${L4[v.pos[i]]}</b></td></tr>`).join("");
      const pct = k => Math.round(100 * m.c[k] / m.n);
      pages.push({ path, html: shell({
        title: `${m.name}: EU-parlamentin äänet | Eduskuntaseuranta`,
        desc: `${m.name}${m.party ? " (" + m.party + ")" : ""}: miten suomalainen meppi on äänestänyt Euroopan parlamentissa.`,
        path,
        body: `<h1>${esc(m.name)}</h1><p class="meta">${[m.party, m.group, m.current ? "Nykyinen meppi" : "Entinen meppi"].filter(Boolean).map(esc).join(" · ")}</p>
<table class="t"><tbody><tr><td>Äänestyksiä yhteensä</td><td><b>${nf.format(m.n)}</b></td></tr><tr><td>Puolesta</td><td><b>${nf.format(m.c["+"])}</b> (${pct("+")} %)</td></tr><tr><td>Vastaan</td><td><b>${nf.format(m.c["-"])}</b> (${pct("-")} %)</td></tr><tr><td>Pidättyi</td><td><b>${nf.format(m.c["0"])}</b> (${pct("0")} %)</td></tr><tr><td>Ei äänestänyt</td><td><b>${nf.format(m.c.x)}</b> (${pct("x")} %)</td></tr></tbody></table>
<h2>Viimeisimmät äänestykset</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table></div><p><a href="/eu/aanestykset/">Hae kaikista EU-äänestyksistä</a></p>${SRC_V}<p><a href="/eu/">EU</a></p>`,
      }) });
    }
    const mcard = m => `<a class="card" href="/eu/mepit/${m.id}/"><b>${esc(m.name)}</b><br><span class="meta">${[m.party, m.group].filter(Boolean).map(esc).join(" · ")} · ${nf.format(m.n)} äänestystä</span></a>`;
    const act = D.meps.filter(m => m.n);
    files.push({ path: "/data/eu-haku.json", content: JSON.stringify({ m: D.meps.map(m => [m.id, m.name, m.party]), v: D.votes.map(v => [v.id, v.date, v.title, v.result, v.f, v.a, v.ab, v.n, v.pos]) }) });
    const JS = `<script>(function(){var D=null,q=document.getElementById("eq"),o=document.getElementById("er");
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fd(s){var m=s.split("-");return(+m[2])+"."+(+m[1])+"."+m[0]}
var P={"+":"Puolesta","-":"Vastaan","0":"Pidättyi","x":"Ei äänestänyt"},R={ADOPTED:"Hyväksytty",REJECTED:"Hylätty"};
function card(x){var m=D.m,s=x[8],g={"+":[],"-":[],"0":[],"x":[]};for(var i=0;i<m.length;i++){var c=s.charAt(i);if(g[c])g[c].push(m[i][1])}
var h="<div class='card'><b>"+e(x[2])+"</b><br><span class='meta'>"+fd(x[1])+(x[3]?" · "+(R[x[3]]||e(x[3])):"")+" · EU yhteensä: "+x[4]+" puolesta, "+x[5]+" vastaan, "+x[6]+" pidättyi</span>";
["+","-","0","x"].forEach(function(k){if(g[k].length)h+="<br><span class='meta'><b>"+P[k]+":</b> "+e(g[k].join(", "))+"</span>"});
return h+"<br><a class='meta' href='https://howtheyvote.eu/votes/"+x[0]+"' rel='noopener'>Katso koko äänestys</a></div>"}
function show(){var t=q.value.toLowerCase().trim(),r=D.v.filter(function(x){return!t||x[2].toLowerCase().indexOf(t)>-1});
o.innerHTML="<p class='meta'>"+r.length+" äänestystä"+(r.length>40?", näytetään 40 uusinta":"")+"</p>"+r.slice(0,40).map(card).join("")}
q.oninput=function(){if(D)return show();fetch("/data/eu-haku.json").then(function(r){return r.json()}).then(function(j){D=j;show()})};
o.textContent="Ladataan…";fetch("/data/eu-haku.json").then(function(r){return r.json()}).then(function(j){D=j;show()})})()</script>`;
    pages.push({ path: "/eu/aanestykset/", html: shell({
      title: "EU-parlamentin äänestykset: miten suomalaiset mepit äänestivät | Eduskuntaseuranta",
      desc: "Hae Euroopan parlamentin täysistuntoäänestyksiä ja katso, miten suomalaiset mepit äänestivät.",
      path: "/eu/aanestykset/",
      body: `<h1>EU-parlamentin äänestykset</h1><p>Hae aiheen mukaan ja katso, miten jokainen suomalainen meppi äänesti.</p>${filt("eq", "Hae äänestystä otsikosta, esim. climate")}<div id="er"></div>${JS}${SRC_V}<p><a href="/eu/">EU</a></p>`,
    }) });
    pages.mepList = `<h2>Suomalaiset mepit</h2>${act.filter(m => m.current).map(mcard).join("")}${act.some(m => !m.current) ? `<h2>Entiset mepit</h2>${act.filter(m => !m.current).map(mcard).join("")}` : ""}<p><a class="btn" href="/eu/aanestykset/">Hae EU-äänestyksiä</a></p>`;
  }

  if (L) {
    for (const o of L) {
      const path = `/eu/lobbaus/${o.id}/`;
      const rows = [["Rekisteritunnus", esc(o.id)], o.form && ["Muoto", esc(o.form)], o.category && ["Luokka", esc(o.category)], o.city && ["Kotipaikka", esc(o.city)], o.registered && ["Rekisteröity", esc(dateFi(o.registered))], o.updated && ["Päivitetty", esc(dateFi(o.updated))], o.fte && ["Lobbaukseen osallistuvia (kokoaikaisiksi muutettuna)", esc(o.fte)], o.ep && ["Euroopan parlamentin kulkulupia", esc(o.ep)], o.web && ["Verkkosivu", `<a href="${esc(/^https?:/.test(o.web) ? o.web : "http://" + o.web)}" rel="noopener nofollow">${esc(o.web.replace(/^https?:\/\//, ""))}</a>`]].filter(Boolean);
      pages.push({ path, html: shell({
        title: `${o.name}: EU-lobbaus | Eduskuntaseuranta`,
        desc: `${o.name}: suomalainen organisaatio EU:n avoimuusrekisterissä, tavoitteet ja aihealueet.`,
        path,
        body: `<h1>${esc(o.name)}</h1>${o.acronym ? `<p class="meta">${esc(o.acronym)}</p>` : ""}<table class="t"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join("")}</tbody></table>${o.goals ? `<h2>Tavoitteet ja toiminta (ilmoittajan oma kuvaus, englanniksi)</h2><p>${esc(o.goals).replace(/\n+/g, "<br>")}</p>` : ""}${o.interests.length ? `<h2>Aihealueet</h2><p>${o.interests.map(esc).join(", ")}</p>` : ""}<p><a href="https://transparency-register.europa.eu/searchregister-or-update/organisation-detail_en?id=${encodeURIComponent(o.id)}" rel="noopener">Katso ilmoitus EU:n rekisterissä</a></p>${SRC_L}<p><a href="/eu/lobbaus/">Kaikki suomalaiset organisaatiot</a></p>`,
      }) });
    }
    const card = o => `<a class="card" data-t="${esc((o.name + " " + o.acronym + " " + o.interests.join(" ") + " " + o.city).toLowerCase())}" href="/eu/lobbaus/${o.id}/"><b>${esc(o.name)}</b><br><span class="meta">${[o.category, o.city].filter(Boolean).map(esc).join(" · ")}</span></a>`;
    pages.push({ path: "/eu/lobbaus/", html: shell({
      title: "Suomalaiset EU-lobbarit: avoimuusrekisteri | Eduskuntaseuranta",
      desc: "Suomalaiset organisaatiot, jotka ovat ilmoittautuneet EU:n avoimuusrekisteriin: keitä ne ovat ja mihin aiheisiin ne vaikuttavat.",
      path: "/eu/lobbaus/",
      body: `<h1>Suomalaiset EU-lobbarit</h1><p>EU:n avoimuusrekisteriin ilmoittautuvat organisaatiot, jotka pyrkivät vaikuttamaan EU:n päätöksentekoon. Tässä ovat ne, joiden päätoimipaikka on Suomessa.</p>${SRC_L}<p class="meta">${nf.format(L.length)} organisaatiota.</p>${filt("lf", "Hae organisaatiota tai aihetta")}<script>(function(){var f=document.getElementById("lf");f.oninput=function(){var q=f.value.toLowerCase().trim();document.querySelectorAll("[data-t]").forEach(function(c){c.style.display=!q||c.getAttribute("data-t").indexOf(q)>-1?"":"none"})}})()</script>${L.map(card).join("")}`,
    }) });
  }

  pages.push({ path: "/eu/", html: shell({
    title: "EU: äänestykset ja lobbaus | Eduskuntaseuranta",
    desc: "Suomalaisten meppien äänet Euroopan parlamentissa ja suomalaiset EU-lobbarit yhdessä paikassa.",
    path: "/eu/",
    body: `<h1>EU</h1><p>Mitä Brysselissä päätetään, miten suomalaiset mepit äänestävät ja ketkä yrittävät vaikuttaa päätöksiin?</p>${pages.mepList || ""}${L ? `<h2>EU-lobbaus</h2><p>${nf.format(L.length)} suomalaista organisaatiota EU:n avoimuusrekisterissä.</p><p><a class="btn" href="/eu/lobbaus/">Katso suomalaiset EU-lobbarit</a></p>` : ""}<p class="meta">EU:n rahavirrat (koheesio- ja elpymisrahat) lisätään seuraavaksi.</p>`,
  }) });
  pages.files = files;
  console.log(`EU: sivuja ${pages.length}`);
  return pages;
}
