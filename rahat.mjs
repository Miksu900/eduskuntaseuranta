// EU:n rahavirrat: koheesiorahat (haku selaimessa, cohesiondata.ec.europa.eu) ja elpymisrahasto RRF (Eurostat, haetaan rakennuksessa).
const ES = process.env.EUROSTAT_API || "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
const nf = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 });

const FI = { Austria: "Itävalta", Belgium: "Belgia", Bulgaria: "Bulgaria", Croatia: "Kroatia", Cyprus: "Kypros", Czechia: "Tšekki", "Czech Republic": "Tšekki", Denmark: "Tanska", Estonia: "Viro", Finland: "Suomi", France: "Ranska", Germany: "Saksa", Greece: "Kreikka", Hungary: "Unkari", Ireland: "Irlanti", Italy: "Italia", Latvia: "Latvia", Lithuania: "Liettua", Luxembourg: "Luxemburg", Malta: "Malta", Netherlands: "Alankomaat", Poland: "Puola", Portugal: "Portugali", Romania: "Romania", Slovakia: "Slovakia", Slovenia: "Slovenia", Spain: "Espanja", Sweden: "Ruotsi", "United Kingdom": "Britannia", Interreg: "Alueiden välinen yhteistyö (Interreg)" };
const GEO = { AT: "Itävalta", BE: "Belgia", BG: "Bulgaria", HR: "Kroatia", CY: "Kypros", CZ: "Tšekki", DK: "Tanska", EE: "Viro", FI: "Suomi", FR: "Ranska", DE: "Saksa", EL: "Kreikka", HU: "Unkari", IE: "Irlanti", IT: "Italia", LV: "Latvia", LT: "Liettua", LU: "Luxemburg", MT: "Malta", NL: "Alankomaat", PL: "Puola", PT: "Portugali", RO: "Romania", SK: "Slovakia", SI: "Slovenia", ES: "Espanja", SE: "Ruotsi" };

// JSON-stat -> {dim: {id: label}, get(filter)}
export function parseJsonStat(d) {
  const ids = d.id, sizes = d.size, cats = {};
  ids.forEach((id, k) => {
    const c = d.dimension[id].category, idx = c.index, codes = Array.isArray(idx) ? idx : Object.keys(idx).sort((a, b) => idx[a] - idx[b]);
    cats[id] = { codes, label: c.label || {} };
  });
  const stride = []; let s = 1;
  for (let k = ids.length - 1; k >= 0; k--) { stride[k] = s; s *= sizes[k]; }
  const val = (sel) => {
    let i = 0;
    for (let k = 0; k < ids.length; k++) {
      const code = sel[ids[k]]; const p = cats[ids[k]].codes.indexOf(code);
      if (p < 0) return null; i += p * stride[k];
    }
    const v = d.value[i]; return v == null ? null : Number(v);
  };
  return { cats, val };
}

export async function loadRrf() {
  try {
    const r = await fetch(`${ES}/gov_rrf_use?format=JSON&lang=EN&unit=MIO_EUR`, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Eduskuntaseuranta/1.0" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const js = parseJsonStat(await r.json());
    const years = js.cats.time.codes;
    const rows = [];
    for (const geo of js.cats.geo.codes) {
      if (!GEO[geo]) continue;
      const sum = (na, ft) => { let t = 0, any = false; for (const y of years) { const v = js.val({ freq: "A", na_item: na, fin_typ: ft, unit: "MIO_EUR", geo, time: y }); if (v != null) { t += v; any = true; } } return any ? t : null; };
      const total = sum("TOTAL", "TOTAL"), grants = sum("TOTAL", "GRNT"), loans = sum("TOTAL", "LOAN");
      if (total != null) rows.push({ geo, name: GEO[geo], total, grants, loans, years: years.map(y => js.val({ freq: "A", na_item: "TOTAL", fin_typ: "TOTAL", unit: "MIO_EUR", geo, time: y })) });
    }
    rows.sort((a, b) => b.total - a.total);
    console.log(`RRF: maita ${rows.length}, vuodet ${years[0]}–${years[years.length - 1]}`);
    return rows.length ? { rows, years } : null;
  } catch (e) { console.log("RRF ohitettu:", e.message); return null; }
}

export function rahatPages({ shell, esc, rrf }) {
  const D = "https://cohesiondata.ec.europa.eu/resource/557j-pmg8.json";
  const rrfHtml = rrf ? `<h2>Elpymisrahasto (RRF)</h2><p>EU:n elpymis- ja palautumistukivälineen (RRF) varoja on käytetty vuosina ${esc(rrf.years[0])}–${esc(rrf.years[rrf.years.length - 1])} seuraavasti. Luvut ovat milj. euroa ja kuvaavat sitä, mitä valtiot ovat kirjanneet RRF-varojen käytöksi kansantalouden tilinpidossa (Eurostat). Ne eivät ole sama asia kuin EU:n maksamat summat.</p>
<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Maa</th><th style="text-align:right">Yhteensä</th><th style="text-align:right">Avustukset</th><th style="text-align:right">Lainat</th></tr></thead><tbody>${rrf.rows.map(r => `<tr><td>${esc(r.name)}</td><td style="text-align:right"><b>${nf.format(r.total)}</b></td><td style="text-align:right">${r.grants == null ? "–" : nf.format(r.grants)}</td><td style="text-align:right">${r.loans == null ? "–" : nf.format(r.loans)}</td></tr>`).join("")}</tbody></table></div>` : `<h2>Elpymisrahasto (RRF)</h2><p>Elpymisrahaston luvut eivät ole tällä hetkellä saatavilla. Ne haetaan Eurostatilta rakennuksen yhteydessä.</p>`;
  const JS = `<script>(function(){
var API=${JSON.stringify(D)},FI=${JSON.stringify(FI)};
var sel=document.getElementById("kc"),th=document.getElementById("kt"),kw=document.getElementById("kk"),out=document.getElementById("ko");
var TH={all:"",hous:"upper(category_label) like '%HOUSING%'",ren:"upper(category_label) like '%EXISTING HOUSING STOCK%'",pub:"upper(category_label) like '%RENOVATION OF PUBLIC INFRASTRUCTURE%'",energy:"upper(category_label) like '%ENERGY EFFICIENCY%'"};
var NOPERS="upper(operation_name_english) not like '%INDIVIDUAL%' AND upper(operation_name_english) not like '%TAX CODE%' AND upper(operation_name_english) not like '%CODICE FISCALE%'";
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function n(v){return new Intl.NumberFormat("fi-FI",{maximumFractionDigits:0}).format(Number(v)||0)}
function fi(c){return FI[c]||c}
function q(p){var u=API+"?"+Object.keys(p).map(function(k){return encodeURIComponent(k)+"="+encodeURIComponent(p[k])}).join("&");return fetch(u).then(function(r){if(!r.ok)throw new Error("Palvelu vastasi "+r.status);return r.json()})}
function where(c){var w=[NOPERS];if(c)w.push("country='"+c.replace(/'/g,"''")+"'");else w.push("country not like '%|%'");if(TH[th.value])w.push(TH[th.value]);var k=kw.value.trim().replace(/'/g,"''");if(k)w.push("upper(operation_name_english) like '%"+k.toUpperCase()+"%'");return w.join(" AND ")}
function run(){out.textContent="Haetaan…";var c=sel.value;
if(!c){q({"$select":"country,count(*) as n,sum(project_eu_budget) as eu","$where":where(""),"$group":"country","$order":"eu DESC","$limit":"60"}).then(function(r){
var tot=r.reduce(function(a,x){return a+Number(x.eu||0)},0);
out.innerHTML="<p class='meta'>Hankkeet 2014–2020, EU:n rahoitus maittain.</p><div style='overflow-x:auto'><table style='width:100%;border-collapse:collapse'><thead><tr><th style='text-align:left'>Maa</th><th style='text-align:right'>Hankkeita</th><th style='text-align:right'>EU-rahoitus €</th></tr></thead><tbody>"+r.map(function(x){return"<tr><td>"+e(fi(x.country))+"</td><td style='text-align:right'>"+n(x.n)+"</td><td style='text-align:right'><b>"+n(x.eu)+"</b></td></tr>"}).join("")+"</tbody></table></div><p class='meta'>Yhteensä "+n(tot)+" €.</p>"}).catch(err)}
else{Promise.all([q({"$select":"count(*) as n,sum(project_eu_budget) as eu","$where":where(c)}),q({"$select":"operation_unique_identifier,operation_name_english,region,fund_name,category_label,project_eu_budget,operation_start_date","$where":where(c),"$order":"project_eu_budget DESC","$limit":"25"})]).then(function(a){
var s=a[0][0]||{},r=a[1];
var h="<p><b>"+e(fi(c))+"</b>: "+n(s.n)+" hanketta, EU-rahoitus yhteensä <b>"+n(s.eu)+" €</b>.</p>";
if(!r.length)h+="<p>Ei hankkeita tällä haulla.</p>";
else h+="<h3>Suurimmat hankkeet</h3>"+r.map(function(x){var u=x.operation_unique_identifier&&x.operation_unique_identifier.url;return"<div class='card'><b>"+e(x.operation_name_english)+"</b><br><span class='meta'>"+[e(x.region),e(x.fund_name),x.operation_start_date?x.operation_start_date.slice(0,4):""].filter(Boolean).join(" · ")+" · EU-rahoitus <b>"+n(x.project_eu_budget)+" €</b></span>"+(u?"<br><a class='meta' href='"+e(u)+"' rel='noopener'>Hankkeen tiedot</a>":"")+"</div>"}).join("");
out.innerHTML=h}).catch(err)}}
function err(x){out.textContent="Haku epäonnistui: "+x.message+". Yritä hetken päästä uudelleen."}
document.getElementById("kf").onsubmit=function(ev){ev.preventDefault();run()};
sel.onchange=th.onchange=run;
q({"$select":"country,count(*) as n","$where":"country not like '%|%'","$group":"country","$order":"country","$limit":"60"}).then(function(r){
sel.innerHTML="<option value=''>Kaikki maat (vertailu)</option>"+r.map(function(x){return"<option value='"+e(x.country)+"'>"+e(fi(x.country))+"</option>"}).join("");run()}).catch(err)
})()</script>`;
  const SEL = "width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:6px 0;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)";
  const body = `<h1>EU:n rahavirrat</h1><p>Mihin EU:n rahaa on mennyt? Valitse maa ja aihe ja katso, kuinka paljon EU-rahoitusta hankkeisiin on osoitettu ja mitkä ovat suurimmat.</p>
<div class="note"><b>Mistä tiedot ovat</b><br>Koheesiorahat: Euroopan komission koheesiodata (cohesiondata.ec.europa.eu), ohjelmakausi 2014–2020, hankekohtaiset tiedot jäsenmaiden ilmoittamina. Kauden 2021–2027 hanketiedot eivät ole vielä mukana. Elpymisrahasto: Eurostat. Summat ovat EU:n osuutta hankkeen budjetista. Maiden välisiä yhteishankkeita (Interreg) ei ole mukana maakohtaisissa luvuissa. Yksityishenkilöiden tukia ei näytetä.</div>
<h2>Koheesiorahat</h2><p class="meta">Aluekehitys- ja sosiaalirahasto sekä koheesiorahasto, esimerkiksi asuntojen ja rakennusten korjaukset, energiatehokkuus ja infrastruktuuri.</p>
<form id="kf"><select id="kc" style="${SEL}"><option value="">Ladataan…</option></select>
<select id="kt" style="${SEL}"><option value="all">Kaikki aiheet</option><option value="hous" selected>Asuminen (asuntojen rakentaminen ja korjaus)</option><option value="ren">Asuntojen energiaremontit</option><option value="pub">Julkisten rakennusten energiaremontit</option><option value="energy">Energiatehokkuus (kaikki)</option></select>
<input id="kk" type="search" placeholder="Hae hankkeen nimestä (englanniksi), esim. school" style="${SEL}"><button type="submit" style="padding:12px 18px;font-size:16px;border-radius:10px;border:0;background:var(--accent,#1a5fb4);color:#fff">Hae</button></form>
<div id="ko" aria-live="polite" style="margin-top:12px"></div>
<p class="meta">Aihe perustuu hankkeen EU:n luokitteluun. Joissain hankkeissa yhdistyy useita luokkia, joten esimerkiksi asumisen alla voi olla myös koulu- tai energiahankkeita.</p>
${rrfHtml}${JS}<p><a href="/eu/">EU</a></p>`;
  const pages = [{ path: "/eu/rahat/", html: shell({ title: "EU:n rahavirrat: koheesio- ja elpymisrahat | Eduskuntaseuranta", desc: "Mihin EU:n rahaa on mennyt? Koheesiorahat ja elpymisrahasto maittain, esimerkiksi asuntojen remontit Italiassa ja Espanjassa.", path: "/eu/rahat/", body }) }];
  console.log("Rahat: sivu rakennettu, RRF " + (rrf ? rrf.rows.length + " maata" : "ei dataa"));
  return pages;
}
