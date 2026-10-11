// Kuntasivut: Tilastokeskuksen Kuntien avainluvut (PxWeb-rajapinta, pxdata.stat.fi). Ei avainta.
// Rakenne haetaan ajon aikana: taulun muuttujat luetaan metadatasta, joten koodi ei nojaa arvattuihin tunnuksiin.
// Jos haku epäonnistuu, sivusto rakentuu silti ilman kuntasivuja ja lokiin jää syy.

const BASE = process.env.PX_BASE || "https://pxdata.stat.fi/PxWeb/api/v1/fi/Kuntien_avainluvut";
const MAX_CELLS = 90000;

async function getJson(url, init) {
  const r = await fetch(url, init);
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${url}: ${t.slice(0, 160)}`);
  return JSON.parse(t);
}

function idxOf(cat) {
  const i = cat.index;
  if (Array.isArray(i)) return Object.fromEntries(i.map((c, n) => [c, n]));
  return i || {};
}

export async function loadKunnat() {
  try {
    const list = await getJson(`${BASE}/uusin/`);
    console.log("Kunnat: taulut: " + list.map(x => `${x.type}:${x.id}`).join(", ").slice(0, 400));
    const tbl = list.find(x => x.type === "t") || null;
    let path = tbl ? `${BASE}/uusin/${tbl.id}` : null;
    if (!path) {
      const folder = list.find(x => x.type === "l");
      if (!folder) throw new Error("taulua ei löytynyt");
      const sub = await getJson(`${BASE}/uusin/${folder.id}/`);
      const t2 = sub.find(x => x.type === "t");
      if (!t2) throw new Error("taulua ei löytynyt alikansiosta");
      path = `${BASE}/uusin/${folder.id}/${t2.id}`;
    }
    const meta = await getJson(path);
    console.log("Kunnat: muuttujat: " + meta.variables.map(v => `${v.code}(${v.values.length}${v.time ? ",aika" : ""})`).join(", "));
    const query = [];
    let cells = 1;
    for (const v of meta.variables) {
      let vals;
      if (v.time || /vuosi|year|aika/i.test(v.code)) vals = [v.values[v.values.length - 1]];
      else if (/alue|kunta|area/i.test(v.code)) vals = v.values.filter(c => /^KU\d+/.test(c));
      else vals = v.values.slice();
      if (!vals.length) throw new Error(`muuttujalle ${v.code} ei löytynyt arvoja`);
      cells *= vals.length;
      query.push({ code: v.code, selection: { filter: "item", values: vals } });
    }
    if (cells > MAX_CELLS) {
      // karsi tietosarakkeita, jotta kysely mahtuu rajapinnan rajaan
      const tv = query.find(q => !/vuosi|year|aika|alue|kunta|area/i.test(q.code));
      if (tv) { const others = cells / tv.selection.values.length; tv.selection.values = tv.selection.values.slice(0, Math.max(1, Math.floor(MAX_CELLS / others))); }
    }
    const d = await getJson(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, response: { format: "json-stat2" } }) });
    const ids = d.id, sizes = d.size;
    const dimOf = k => d.dimension[k];
    const areaId = ids.find(k => /alue|kunta|area/i.test(k));
    const timeId = ids.find(k => /vuosi|year|aika/i.test(k));
    const infoIds = ids.filter(k => k !== areaId && k !== timeId);
    if (!areaId) throw new Error("aluedimensiota ei löytynyt");
    const strides = []; let s = 1; for (let i = ids.length - 1; i >= 0; i--) { strides[i] = s; s *= sizes[i]; }
    const pos = ids.map(k => idxOf(dimOf(k).category));
    const lab = ids.map(k => dimOf(k).category.label || {});
    const _ti = timeId ? ids.indexOf(timeId) : -1;
    const timeLabel = _ti >= 0 ? (Object.values(lab[_ti])[0] || Object.keys(pos[_ti])[0] || "") : "";
    const areas = Object.entries(pos[ids.indexOf(areaId)]).map(([code, n]) => ({ code, name: lab[ids.indexOf(areaId)][code] || code, n }));
    const infoDim = infoIds.length ? ids.indexOf(infoIds[0]) : -1;
    const infos = infoDim >= 0 ? Object.entries(pos[infoDim]).map(([code, n]) => ({ code, name: lab[infoDim][code] || code, n })) : [{ code: "x", name: d.label || "Arvo", n: 0 }];
    const at = (areaN, infoN) => {
      let idx = 0;
      ids.forEach((k, i) => { const n = k === areaId ? areaN : i === infoDim ? infoN : 0; idx += n * strides[i]; });
      const v = d.value[idx];
      return v == null ? null : v;
    };
    const out = areas.map(a => ({ code: a.code, name: a.name, vals: infos.map(i => at(a.n, i.n)) }));
    const rank = infos.map((_, j) => {
      const xs = out.map(o => o.vals[j]).filter(v => typeof v === "number").sort((a, b) => b - a);
      return xs;
    });
    console.log(`Kunnat: ${out.length} aluetta, ${infos.length} tietoa, vuosi ${timeLabel}`);
    const debug = {
      path, label: d.label, source: d.source, updated: d.updated, id: d.id, size: d.size, note: d.note, extension: d.extension,
      dims: Object.fromEntries(d.id.map(k => [k, { label: d.dimension[k].label, first: Object.entries(d.dimension[k].category.label || {}).slice(0, 3), idx: Object.keys(idxOf(d.dimension[k].category)).slice(0, 3) }])),
      meta: meta.variables.map(v => ({ code: v.code, text: v.text, time: !!v.time, n: v.values.length, first: v.values.slice(0, 2), last: v.values.slice(-2), lastTexts: (v.valueTexts || []).slice(-2) })),
    };
    return { areas: out, infos, rank, year: timeLabel, title: meta.title || d.label || "", debug };
  } catch (e) {
    console.log("Kunnat ohitettu:", e.message);
    return null;
  }
}

const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nf = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 2 });

export function kunnatPages({ shell, esc, data }) {
  const pages = [];
  const cleanName = n => String(n).replace(/^\s*KU\d+\s*/i, "").trim();
  const muni = data.areas.filter(a => !/^(SSS|MK|KOKO)/i.test(a.code) && a.name).map(a => ({ ...a, name: cleanName(a.name) }));
  muni.sort((a, b) => a.name.localeCompare(b.name, "fi"));
  const letters = []; for (const m of muni) { const L = m.name[0].toLocaleUpperCase("fi"); if (!letters.length || letters[letters.length - 1][0] !== L) letters.push([L, []]); letters[letters.length - 1][1].push(m); }
  const yr = data.year ? ` Tilastovuosi: ${esc(data.year)}.` : "";
  const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot ovat Tilastokeskuksen Kuntien avainluvut -tilastosta.${yr} Luvut ovat tilaston virallisia lukuja sellaisenaan. Sija kertoo, monentenako kunta on kaikkien kuntien vertailussa suurimmasta pienimpään. Se ei kerro, onko luku hyvä vai huono.</div>`;
  pages.push({
    path: "/kunnat/",
    html: shell({
      title: "Kunnat: tilastot ja luvut | Eduskuntaseuranta", desc: "Jokaisen Suomen kunnan avainluvut Tilastokeskuksesta samalla tavalla koottuna: väestö, talous, työllisyys ja muut luvut.", path: "/kunnat/",
      body: `<h1>Kunnat</h1><p>Jokaisen kunnan avainluvut samassa muodossa. Valitse kunta.</p>${NOTE}
<input id="kf" type="search" placeholder="Hae kuntaa" style="width:100%;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<div id="kl">${letters.map(([L, ms]) => `<section data-s><h2 style="margin:22px 0 6px">${esc(L)}</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 12px">${ms.map(m => `<a data-n="${esc(m.name.toLowerCase())}" href="/kunnat/${slug(m.name)}/" style="padding:6px 0">${esc(m.name)}</a>`).join("")}</div></section>`).join("")}</div>
<script>(function(){var f=document.getElementById("kf");f.oninput=function(){var q=f.value.toLowerCase().trim();document.querySelectorAll("#kl section").forEach(function(sec){var n=0;sec.querySelectorAll("a").forEach(function(a){var ok=!q||a.getAttribute("data-n").indexOf(q)>-1;a.style.display=ok?"":"none";if(ok)n++});sec.style.display=n?"":"none"})}})()</script>`,
    }),
  });
  const seen = new Set();
  for (const m of muni) {
    const s = slug(m.name); if (!s || seen.has(s)) continue; seen.add(s);
    const KEY = [/^väkiluku$/i, /maapinta-ala/i, /väestötiheys/i, /väkiluvun muutos edellisestä/i, /työttömyysaste/i, /työpaikkaomavaraisuus/i, /huoltosuhde/i, /kunnallisvero|veroprosentti/i, /ulkomaan kansalaiset.*%|vieraskielisiä.*%/i, /yli 64-vuotiaita, %|65 vuotta täyttäneet.*%/i, /alle 15-vuotiaita, %/i, /korkea-asteen/i, /tulot|verotettavat/i, /lainakanta|velka/i, /vuosikate/i, /toimintakate/i];
    const mk = (inf, j) => {
      const v = m.vals[j]; if (v == null) return null;
      const xs = data.rank[j]; let r = "";
      if (typeof v === "number" && xs.length > 20) { const p = xs.findIndex(x => x <= v) + 1; r = `${p}. / ${xs.length}`; }
      return `<tr data-t="${esc(inf.name.toLowerCase())}"><td>${esc(inf.name)}</td><td style="text-align:right;white-space:nowrap"><b>${typeof v === "number" ? nf.format(v) : esc(v)}</b></td><td class="meta" style="text-align:right;white-space:nowrap">${r}</td></tr>`;
    };
    const isKey = inf => KEY.some(re => re.test(inf.name));
    const keyRows = data.infos.map((inf, j) => (isKey(inf) ? mk(inf, j) : null)).filter(Boolean).join("");
    const allRows = data.infos.map((inf, j) => mk(inf, j)).filter(Boolean).join("");
    const th = `<thead><tr><th style="text-align:left">Tieto</th><th style="text-align:right">Luku</th><th style="text-align:right">Sija</th></tr></thead>`;
    const rows = `${keyRows ? `<h2>Tärkeimmät luvut</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">${th}<tbody>${keyRows}</tbody></table></div>` : ""}
<h2>Kaikki luvut</h2><input id="rf" type="search" placeholder="Hae lukua, esim. työttömyys" style="width:100%;padding:12px;font-size:16px;margin:6px 0 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<div style="overflow-x:auto"><table id="rt" style="width:100%;border-collapse:collapse">${th}<tbody>${allRows}</tbody></table></div>
<script>(function(){var f=document.getElementById("rf");f.oninput=function(){var q=f.value.toLowerCase().trim();document.querySelectorAll("#rt tbody tr").forEach(function(r){r.style.display=!q||r.getAttribute("data-t").indexOf(q)>-1?"":"none"})}})()</script>`;
    pages.push({
      path: `/kunnat/${s}/`,
      html: shell({
        title: `${m.name}: kunnan tilastot | Eduskuntaseuranta`, desc: `${m.name}: kunnan avainluvut Tilastokeskuksesta, ${data.year ? "tilastovuosi " + data.year + "." : ""}`, path: `/kunnat/${s}/`,
        body: `<h1>${esc(m.name)}</h1><p class="meta">Kunnan avainluvut${data.year ? ", tilastovuosi " + esc(data.year) : ""}</p>${NOTE}
${rows}
<p><a href="/kunnat/">Kaikki kunnat</a></p>`,
      }),
    });
  }
  return pages;
}
