// VTV: Valtiontalouden tarkastusviraston tarkastus- ja muut raportit (WordPress REST API, avoin, ei avainta).
const API = process.env.VTV_API || "https://www.vtv.fi/wp-json/wp/v2";
const BUDGET_MS = Number(process.env.VTV_BUDGET_MS || 4 * 60 * 1000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ent = s => String(s || "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const txt = h => ent(String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function getJson(url, ms = 40000) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: "application/json", "User-Agent": "Eduskuntaseuranta/1.0 (eduskuntaseuranta.fi)" } });
      if (r.status === 429 || r.status === 503) { await sleep(10000 * (i + 1)); continue; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return { json: await r.json(), pages: Number(r.headers.get("x-wp-totalpages")) || 1, total: Number(r.headers.get("x-wp-total")) || 0 };
    } catch (e) { if (i === 3) { console.log("VTV: virhe", e.message, url.slice(-60)); return null; } await sleep(1500 * (i + 1)); }
  }
  return null;
}

export function parseReport(r, tax) {
  const link = r.link || "";
  if (/vtv\.fi\/(sv|en)\//.test(link)) return null; // vain suomenkieliset
  const title = txt(r.title && r.title.rendered);
  if (!title) return null;
  const content = (r.content && r.content.rendered) || "";
  const good = t => t.length >= 110 && /[.!?]/.test(t.slice(30)) && t.split(" ").length >= 14 && !/^Lataa raportti/i.test(t);
  let summary = txt(r.excerpt && r.excerpt.rendered);
  if (!good(summary)) {
    const ps = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => txt(m[1])).filter(good);
    summary = ps.slice(0, 2).join(" ");
  }
  if (summary.length > 700) summary = summary.slice(0, 700).replace(/\s+\S*$/, "") + "…";
  let pdf = (content.match(/href=["']([^"']+\.pdf)["']/i) || [])[1] || "";
  if (pdf.startsWith("/")) pdf = "https://vtv.fi" + pdf;
  const names = k => ((r[k] || []).map(id => tax[k] && tax[k][id]).filter(Boolean));
  return { id: r.id, date: String(r.date || "").slice(0, 10), title, link, summary, pdf, type: names("report-type"), topic: names("report-topic"), area: names("report-area") };
}

export async function loadVtv() {
  const t0 = Date.now();
  const tax = {};
  for (const k of ["report-type", "report-topic", "report-area"]) {
    tax[k] = {};
    const g = await getJson(`${API}/${k}?per_page=100&_fields=id,name`);
    if (g && Array.isArray(g.json)) for (const t of g.json) tax[k][t.id] = ent(t.name);
  }
  const rows = [];
  const base = `${API}/report?lang=fi&per_page=50&_fields=id,date,link,title,excerpt,content,report-type,report-topic,report-area`;
  const first = await getJson(base + "&page=1");
  if (!first || !Array.isArray(first.json)) { console.log("VTV: haku epäonnistui"); return null; }
  const take = j => { for (const r of j) { const p = parseReport(r, tax); if (p) rows.push(p); } };
  take(first.json);
  for (let p = 2; p <= first.pages && Date.now() - t0 < BUDGET_MS; p++) {
    const g = await getJson(base + "&page=" + p);
    if (g && Array.isArray(g.json)) take(g.json);
    await sleep(200);
  }
  const seen = new Set();
  const out = rows.filter(r => !seen.has(r.id) && seen.add(r.id)).sort((a, b) => b.date.localeCompare(a.date));
  console.log(`VTV: ${out.length} suomenkielistä raporttia (sivuja ${first.pages})`);
  return out.length ? out : null;
}

export function vtvPages({ shell, esc, dateFi, rows }) {
  const nf = new Intl.NumberFormat("fi-FI");
  const pages = [];
  const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Tiedot ovat Valtiontalouden tarkastusviraston (vtv.fi) julkaisemia raportteja. Tällä sivustolla näytetään otsikko, päivämäärä, luokittelu ja lyhyt tiivistelmä. Koko raportti luetaan VTV:n sivustolta. Eduskuntaseuranta ei ole VTV:n palvelu.</div>`;
  const tags = r => [...r.type, ...r.topic, ...r.area].filter((x, i, a) => a.indexOf(x) === i);
  for (const r of rows) {
    const path = `/vtv/${r.id}/`;
    const tg = tags(r);
    pages.push({ path, html: shell({
      title: `${r.title} | VTV:n raportti | Eduskuntaseuranta`,
      desc: r.summary ? r.summary.slice(0, 160) : `Valtiontalouden tarkastusviraston raportti ${dateFi(r.date)}.`,
      path,
      body: `<h1>${esc(r.title)}</h1><p class="meta">${esc(dateFi(r.date))}${r.type.length ? " · " + esc(r.type.join(", ")) : ""}</p>${r.summary ? `<p>${esc(r.summary)}</p>` : ""}${tg.length ? `<p class="meta">Aiheet: ${esc(tg.join(", "))}</p>` : ""}<p><a class="btn" href="${esc(r.link)}" rel="noopener">Lue raportti VTV:n sivuilla</a>${r.pdf ? ` <a href="${esc(r.pdf)}" rel="noopener">PDF</a>` : ""}</p>${NOTE}<p><a href="/vtv/">Kaikki VTV:n raportit</a></p>`,
    }) });
  }
  const card = r => `<a class="card" href="/vtv/${r.id}/"><b>${esc(r.title)}</b><br><span class="meta">${esc(dateFi(r.date))}${r.type.length ? " · " + esc(r.type.join(", ")) : ""}</span></a>`;
  const search = rows.map(r => [r.id, r.date, r.title, r.type[0] || "", tags(r).join(" ")]);
  const JS = `<input id="vq" type="search" placeholder="Hae raporttia otsikosta tai aiheesta" style="width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)"><div id="vr"></div>
<script>(function(){var D=null,q=document.getElementById("vq"),o=document.getElementById("vr"),n=document.getElementById("vn");
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fd(s){var m=s.split("-");return(+m[2])+"."+(+m[1])+"."+m[0]}
q.oninput=function(){var t=q.value.toLowerCase().trim();if(t.length<2){o.innerHTML="";if(n)n.style.display="";return}
if(n)n.style.display="none";
function go(){var r=D.filter(function(x){return(x[2]+" "+x[3]+" "+x[4]).toLowerCase().indexOf(t)>-1});
o.innerHTML="<p class='meta'>"+r.length+" osumaa"+(r.length>100?", näytetään 100 uusinta":"")+"</p>"+r.slice(0,100).map(function(x){return"<a class='card' href='/vtv/"+x[0]+"/'><b>"+e(x[2])+"</b><br><span class='meta'>"+fd(x[1])+(x[3]?" · "+e(x[3]):"")+"</span></a>"}).join("")}
if(D)return go();fetch("/data/vtv-haku.json").then(function(r){return r.json()}).then(function(j){D=j;go()})}})()</script>`;
  pages.push({ path: "/vtv/", html: shell({
    title: "VTV:n raportit | Eduskuntaseuranta",
    desc: "Valtiontalouden tarkastusviraston tarkastukset ja raportit: mitä valtion rahankäytöstä on todettu. Haku otsikosta ja aiheesta.",
    path: "/vtv/",
    body: `<h1>VTV:n raportit</h1><p>Valtiontalouden tarkastusvirasto tarkastaa, käytetäänkö valtion rahaa lakien ja tavoitteiden mukaisesti. Tähän on koottu sen julkaisemat raportit. Hae otsikosta tai aiheesta.</p>${NOTE}<p class="meta">${nf.format(rows.length)} raporttia.</p>${JS}<div id="vn"><h2>Uusimmat</h2>${rows.slice(0, 60).map(card).join("")}</div>`,
  }) });
  pages.files = [{ path: "/data/vtv-haku.json", content: JSON.stringify(search) }];
  console.log(`VTV: sivuja ${rows.length}`);
  return pages;
}
