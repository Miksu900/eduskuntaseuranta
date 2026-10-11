// Yritystiedot: PRH:n YTJ avoin data (ei avainta) yhdistettynä lobbaus- ja vaalirahoitustietoihin.
// Vain yritykset ja yhteisöt. Toiminimet (yksityiset elinkeinonharjoittajat) jätetään pois, koska ne ovat yksityishenkilöitä.

const API = process.env.PRH_API || "https://avoindata.prh.fi/opendata-ytj-api/v3";
const BUDGET_MS = Number(process.env.PRH_BUDGET_MS || 5 * 60 * 1000);
const nf = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function normId(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length < 6 || d.length > 8) return "";
  const p = d.padStart(8, "0");
  return p.slice(0, 7) + "-" + p.slice(7);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let cooldownUntil = 0;
async function getJson(url) {
  for (let i = 0; i < 5; i++) {
    const w = cooldownUntil - Date.now();
    if (w > 0) await sleep(w);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: "application/json" } });
      if (r.status === 404) return { notFound: true };
      if (r.status === 429 || r.status === 503) { cooldownUntil = Date.now() + 10000 * (i + 1); throw new Error("HTTP " + r.status); }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { if (i === 4) return null; await sleep(1000 * (i + 1)); }
  }
  return null;
}

const fi = arr => {
  const a = Array.isArray(arr) ? arr : [];
  const x = a.find(d => String(d.languageCode) === "1") || a.find(d => String(d.languageCode) === "3") || a[0];
  return x ? String(x.description || "").trim() : "";
};
const current = arr => {
  const a = Array.isArray(arr) ? arr : [];
  return a.find(x => !x.endDate) || a[0] || null;
};

export function parseCompany(c) {
  if (!c) return null;
  const nm = current((c.names || []).filter(x => String(x.type) === "1")) || current(c.names);
  const form = current(c.companyForms);
  const formName = form ? fi(form.descriptions) : "";
  const mbl = c.mainBusinessLine || null;
  const situations = (c.companySituations || []).filter(s => !s.endDate).map(s => fi(s.descriptions)).filter(Boolean);
  const site = c.website && c.website.url ? String(c.website.url) : "";
  return {
    name: nm ? String(nm.name || "").trim() : "",
    form: formName,
    registered: (c.businessId && c.businessId.registrationDate) || "",
    industry: mbl ? fi(mbl.descriptions) : "",
    industryCode: mbl ? String(mbl.type || "") : "",
    website: /^https?:\/\//i.test(site) ? site : site ? "http://" + site : "",
    situations,
    soleTrader: /elinkeinonharjoittaja|toiminimi/i.test(formName),
  };
}

export async function loadPrh(ids) {
  const t0 = Date.now();
  const list = [...new Set(ids.map(normId).filter(Boolean))];
  const out = new Map();
  let i = 0, miss = 0, fail = 0;
  const worker = async () => {
    while (i < list.length && Date.now() - t0 < BUDGET_MS) {
      const id = list[i++];
      const j = await getJson(`${API}/companies?businessId=${id}`);
      if (!j) { fail++; continue; }
      const c = j.companies && j.companies[0];
      if (!c) { miss++; continue; }
      const p = parseCompany(c);
      if (p && p.name) out.set(id, p);
      await sleep(80);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`PRH: ${list.length} tunnusta, löytyi ${out.size}, ei löytynyt ${miss}, virheitä ${fail} (aikaa ${Math.round((Date.now() - t0) / 1000)} s)`);
  return out;
}

export function yrityksetPages({ shell, esc, dateFi, prh, lobbaus = [], vaali = [] }) {
  // lobbaus: [{id,name,slug,contacts,topics}], vaali: rivit joilla donors.yrit [{n,y,v}] ja slug,name,party
  const cos = new Map();
  const get = (id, name) => { if (!cos.has(id)) cos.set(id, { id, name, lob: null, don: [] }); return cos.get(id); };
  for (const r of lobbaus) { const id = normId(r.id); if (id) get(id, r.name).lob = r; }
  for (const r of vaali) for (const d of (r.donors && r.donors.yrit) || []) {
    const id = normId(d.y); if (!id) continue;
    get(id, d.n).don.push({ slug: r.slug, name: r.name, party: r.party || "", v: d.v });
  }
  const list = [];
  for (const c of cos.values()) {
    const p = prh.get(c.id) || null;
    if (p && p.soleTrader) continue;
    if (!p && !c.lob) continue;
    list.push({ ...c, p, title: (p && p.name) || c.name });
  }
  const NOTE = `<div class="note"><b>Mistä tiedot ovat</b><br>Yrityksen perustiedot ovat Patentti- ja rekisterihallituksen YTJ-rekisteristä (avoin data, CC BY 4.0). Lobbaustiedot ovat Avoimuusrekisteristä ja vaalirahoitustiedot Valtiontalouden tarkastusviraston vaalirahoitusvalvonnasta, ilmoittajien omia tietoja sellaisenaan. Tässä näytetään vain yritykset ja yhteisöt, ei yksityishenkilöitä eikä toiminimiä. Tieto siitä, että yritys esiintyy kahdessa rekisterissä, ei kerro yhteydestä tai vaikutuksesta.</div>`;
  const pages = [];
  const have = new Set();
  for (const c of list) {
    const p = c.p;
    const rows = [];
    if (p) {
      if (p.form) rows.push(["Yhtiömuoto", esc(p.form)]);
      if (p.registered) rows.push(["Rekisteröity", esc(dateFi(p.registered))]);
      if (p.industry) rows.push(["Päätoimiala", esc(p.industry) + (p.industryCode ? ` <span class="meta">${esc(p.industryCode)}</span>` : "")]);
      if (p.website) rows.push(["Kotisivu", `<a href="${esc(p.website)}" rel="noopener nofollow">${esc(p.website.replace(/^https?:\/\//, ""))}</a>`]);
      if (p.situations.length) rows.push(["Tilanne", esc(p.situations.join(", "))]);
    }
    const tbl = rows.length ? `<table class="t"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join("")}</tbody></table>` : '<p class="note">Perustietoja ei saatu PRH:n rekisteristä.</p>';
    let lobHtml = "";
    if (c.lob) lobHtml = `<h2>Lobbaus</h2><p>Yritys on ilmoittanut Avoimuusrekisteriin <b>${nf.format(c.lob.contacts)}</b> yhteydenottoa ja <b>${nf.format(c.lob.topics)}</b> aihetta. <a href="/lobbaus/${c.lob.slug}/">Katso ilmoitus</a></p>`;
    let donHtml = "";
    if (c.don.length) {
      const total = c.don.reduce((s, d) => s + d.v, 0);
      const ds = c.don.slice().sort((a, b) => b.v - a.v);
      const row = d => `<tr><td><a href="/edustaja/${d.slug}/">${esc(d.name)}</a>${d.party ? ` <span class="meta">${esc(d.party)}</span>` : ""}</td><td style="text-align:right;white-space:nowrap"><b>${nf.format(d.v)} €</b></td></tr>`;
      donHtml = `<h2>Vaalirahoitus 2023</h2><p>Yritys on ilmoitettu nimellä <b>${c.don.length}</b> kansanedustajan vaalirahoituksessa, yhteensä <b>${nf.format(total)} €</b>.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tbody>${ds.slice(0, 60).map(row).join("")}</tbody></table></div>${ds.length > 60 ? `<p class="meta">Näytetään 60 suurinta.</p>` : ""}`;
    }
    const path = `/yritys/${c.id}/`;
    have.add(c.id);
    pages.push({
      path,
      html: shell({
        title: `${c.title}: yritystiedot, lobbaus ja vaalirahoitus | Eduskuntaseuranta`,
        desc: `${c.title} (${c.id}): yrityksen perustiedot PRH:n rekisteristä sekä Avoimuusrekisterin ja vaalirahoitusilmoitusten tiedot.`,
        path,
        body: `<h1>${esc(c.title)}</h1><p class="meta">Y-tunnus ${esc(c.id)}</p>${tbl}${lobHtml}${donHtml}${NOTE}<p><a href="/yritykset/">Kaikki yritykset</a></p>`,
      }),
    });
  }
  const both = list.filter(c => c.lob && c.don.length).sort((a, b) => b.don.reduce((s, d) => s + d.v, 0) - a.don.reduce((s, d) => s + d.v, 0));
  const card = c => {
    const bits = [];
    if (c.lob) bits.push(`${nf.format(c.lob.contacts)} ilmoitettua yhteydenottoa`);
    if (c.don.length) bits.push(`vaalituki ${c.don.length} edustajalle, ${nf.format(c.don.reduce((s, d) => s + d.v, 0))} €`);
    if (c.p && c.p.industry) bits.push(esc(c.p.industry));
    return `<a class="card" data-t="${esc((c.title + " " + c.id + " " + (c.p ? c.p.industry : "")).toLowerCase())}" href="/yritys/${c.id}/"><b>${esc(c.title)}</b><br><span class="meta">${bits.join(" · ")}</span></a>`;
  };
  const sorted = list.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), "fi"));
  const FILTER = `<input id="yf" type="search" placeholder="Hae yritystä, y-tunnusta tai toimialaa" style="width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:10px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)">
<script>(function(){var f=document.getElementById("yf");f.oninput=function(){var q=f.value.toLowerCase().trim();document.querySelectorAll("[data-t]").forEach(function(c){c.style.display=!q||c.getAttribute("data-t").indexOf(q)>-1?"":"none"})}})()</script>`;
  pages.push({
    path: "/yritykset/",
    html: shell({
      title: "Yritykset: lobbaus ja vaalirahoitus | Eduskuntaseuranta",
      desc: "Yritykset, jotka esiintyvät Avoimuusrekisterissä tai kansanedustajien vaalirahoituksessa, perustiedot PRH:n rekisteristä.",
      path: "/yritykset/",
      body: `<h1>Yritykset</h1><p>Mitä yritys on ja missä rekistereissä se esiintyy? Tähän on koottu yritykset, jotka ovat ilmoittaneet lobbauksesta tai joita kansanedustajat ovat ilmoittaneet vaalirahoittajikseen.</p>${NOTE}
<p class="meta">${nf.format(list.length)} yritystä ja yhteisöä.</p>
${SEARCH(have)}
${both.length ? `<h2>Esiintyy sekä lobbauksessa että vaalirahoituksessa</h2><p class="meta">Yritys on tehnyt lobbausilmoituksen ja on mainittu nimellä kansanedustajien vaalirahoittajana. Tämä ei kerro yhteydestä.</p>${both.slice(0, 40).map(card).join("")}` : ""}
<h2>Lobbaus- ja vaalirahoitusyritykset</h2>${FILTER}${sorted.map(card).join("")}`,
    }),
  });
  pages.have = have;
  console.log(`Yritykset: sivuja ${list.length}, sekä lobbaus että vaalirahoitus ${both.length}`);
  return pages;
}

// Lisää linkit yritysten y-tunnuksiin jo rakennettuihin sivuihin.

const SEARCH = (have) => `<h2>Hae kaikista Suomen yrityksistä</h2>
<p>Haku kysyy PRH:n YTJ-rekisteristä suoraan. Kirjoita y-tunnus (esim. 0112038-9) tai yrityksen nimi ja paina Hae. Näet kaikki rekisterin kentät. Toiminimet ja yksityiset elinkeinonharjoittajat jätetään pois.</p>
<form id="pf" style="display:flex;gap:8px;margin:10px 0"><input id="pq" type="search" placeholder="Y-tunnus tai yrityksen nimi" style="flex:1;min-width:0;box-sizing:border-box;padding:12px;font-size:16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)"><button type="submit" style="padding:12px 18px;font-size:16px;border-radius:10px;border:0;background:var(--accent,#1a5fb4);color:#fff">Hae</button></form>
<div id="pr" aria-live="polite"></div>
<script>(function(){
var API="https://avoindata.prh.fi/opendata-ytj-api/v3/companies",HAVE=${JSON.stringify([...have])};
var L={businessId:"Y-tunnus",names:"Nimet",companyForms:"Yhtiömuoto",mainBusinessLine:"Päätoimiala",website:"Kotisivu",companySituations:"Tilanne",addresses:"Osoitteet",registeredEntries:"Rekisterimerkinnät",tradeRegisterStatus:"Kaupparekisterin tila",status:"Tila",registrationDate:"Rekisteröity",endDate:"Päättynyt",lastModified:"Viimeksi muutettu",type:"Tyyppi",name:"Nimi",value:"Arvo",street:"Katu",postCode:"Postinumero",postOffices:"Postitoimipaikka",city:"Kaupunki",country:"Maa",description:"Kuvaus",descriptions:"Kuvaukset",url:"Osoite",registrationDate2:"Rekisteröity",employerRegisters:"Työnantajarekisteri",auxiliaryNames:"Aputoiminimet",companyReorganisations:"Yrityssaneeraukset",liquidations:"Selvitystilat",businessInformation:"Perustiedot",contactDetails:"Yhteystiedot",phone:"Puhelin",email:"Sähköposti"};
var LANG={1:"fi",2:"sv",3:"en"};
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fd(s){var m=/^(\\d{4})-(\\d\\d)-(\\d\\d)/.exec(s);return m?(+m[3])+"."+(+m[2])+"."+m[1]:s}
function lab(k){return L[k]||k}
function isDesc(a){return Array.isArray(a)&&a.length&&a[0]&&typeof a[0]==="object"&&"languageCode" in a[0]}
function pick(a){var f=a.filter(function(x){return x.languageCode==1})[0]||a[0];return f.description||""}
function rv(v){
 if(v==null||v==="")return"";
 if(typeof v!=="object")return /^\\d{4}-\\d\\d-\\d\\d/.test(v)?e(fd(v)):e(v);
 if(isDesc(v))return e(pick(v));
 if(Array.isArray(v)){if(!v.length)return"";return"<ul style='margin:0;padding-left:18px'>"+v.map(function(x){return"<li>"+rv(x)+"</li>"}).join("")+"</ul>"}
 var o="<table class='t'><tbody>";
 Object.keys(v).forEach(function(k){var x=rv(v[k]);if(x)o+="<tr><td>"+e(lab(k))+"</td><td>"+x+"</td></tr>"});
 return o+"</tbody></table>";
}
function sole(c){var f=(c.companyForms||[]).map(function(x){return isDesc(x.descriptions)?pick(x.descriptions):""}).join(" ");return /elinkeinonharjoittaja|toiminimi/i.test(f)}
function nm(c){var n=(c.names||[]).filter(function(x){return x.type==="1"&&!x.endDate})[0]||(c.names||[])[0];return n?n.name:"(nimetön)"}
function id(c){return c.businessId&&c.businessId.value}
function form(c){var f=(c.companyForms||[])[0];return f&&isDesc(f.descriptions)?pick(f.descriptions):""}
function card(c){
 var i=id(c),x=HAVE.indexOf(i)>-1;
 var d=document.createElement("details");d.style.cssText="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0";
 var s=document.createElement("summary");s.style.cursor="pointer";
 s.innerHTML="<b>"+e(nm(c))+"</b> <span class='meta'>"+e(i)+(form(c)?" · "+e(form(c)):"")+"</span>";
 d.appendChild(s);
 var b=document.createElement("div");b.style.cssText="margin-top:8px;overflow-x:auto";
 var h=rv(c);
 if(x)h="<p><a href='/yritys/"+e(i)+"/'><b>Katso lobbaus- ja vaalirahoitustiedot tälle yritykselle</b></a></p>"+h;
 b.innerHTML=h;d.appendChild(b);return d;
}
var out=document.getElementById("pr");
document.getElementById("pf").onsubmit=function(ev){
 ev.preventDefault();
 var q=document.getElementById("pq").value.trim();
 if(q.length<2){out.textContent="Kirjoita vähintään kaksi merkkiä.";return}
 var idq=/^\\d{6,7}-?\\d$/.test(q);
 var u=API+"?"+(idq?"businessId="+encodeURIComponent(q.replace(/^(\\d{6,7})(\\d)$/,function(m,a,b){return(a.length==6?"0"+a:a)+"-"+b}).replace(/^(\\d{6})-(\\d)$/,"0$1-$2")):"name="+encodeURIComponent(q));
 out.textContent="Haetaan…";
 fetch(u).then(function(r){if(!r.ok)throw new Error("PRH vastasi "+r.status);return r.json()}).then(function(j){
  var cs=(j.companies||[]).filter(function(c){return !sole(c)});
  out.innerHTML="";
  if(!cs.length){out.textContent="Ei yrityksiä tällä haulla. Toiminimiä ei näytetä.";return}
  var p=document.createElement("p");p.className="meta";
  p.textContent="Löytyi "+(j.totalResults||cs.length)+" osumaa"+(cs.length>50?", näytetään 50 ensimmäistä":"")+". Avaa yritys nähdäksesi kaikki tiedot.";
  out.appendChild(p);
  cs.slice(0,50).forEach(function(c){out.appendChild(card(c))});
  if(cs.length==1)out.querySelector("details").open=true;
 }).catch(function(er){out.textContent="Haku epäonnistui: "+er.message+". Yritä hetken päästä uudelleen."});
};
})()</script>`;

export function linkifyHtml(html, have) {
  return html
    .replace(/<span class="meta">(\d{6,8}-\d)<\/span>/g, (m, id) => (have.has(normId(id)) ? `<a class="meta" href="/yritys/${normId(id)}/">${id}</a>` : m))
    .replace(/Y-tunnus (\d{6,8}-\d) ·/g, (m, id) => (have.has(normId(id)) ? `<a href="/yritys/${normId(id)}/">Y-tunnus ${id}</a> ·` : m));
}
