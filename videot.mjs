import { readFileSync } from "fs";

function lataa() {
  try { return JSON.parse(readFileSync(new URL("./data/videot.json", import.meta.url), "utf8")); } catch { return []; }
}

const JS = String.raw`<script>(function(){
var root=document.getElementById("vd");if(!root)return;
var tabs=root.querySelectorAll("button[data-t]"),cards=root.querySelectorAll("[data-k]"),em=root.querySelectorAll("[data-e]");
function show(k){tabs.forEach(function(b){b.className=b.getAttribute("data-t")===k?"on":""});cards.forEach(function(c){c.style.display=(k==="kaikki"||c.getAttribute("data-k")===k)?"":"none"});em.forEach(function(c){c.style.display=(c.getAttribute("data-e")===k||(k==="kaikki"&&c.getAttribute("data-e")==="kaikki"))?"":"none"})}
tabs.forEach(function(b){b.onclick=function(){show(b.getAttribute("data-t"))}});show("kaikki");
root.querySelectorAll("button[data-yt]").forEach(function(b){b.onclick=function(){var f=document.createElement("iframe");f.src="https://www.youtube-nocookie.com/embed/"+b.getAttribute("data-yt")+"?autoplay=1&rel=0";f.allow="autoplay; encrypted-media; picture-in-picture";f.allowFullscreen=true;f.style.cssText="width:100%;aspect-ratio:16/9;border:0;border-radius:10px";b.parentNode.replaceChild(f,b)}});
})()</script>`;

// Hyväksyy joko pelkän tunnisteen tai minkä tahansa YouTube-linkin (watch, youtu.be, shorts, embed).
export function ytId(x) {
  const t = String(x || "").trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : "";
}

export function videotPages({ shell, esc }) {
  const lista = lataa();
  const kortti = v => {
    v = { ...v, youtube: ytId(v.youtube) };
    const k = v.tyyppi === "kanta" ? "kanta" : v.tyyppi === "opas" ? "opas" : "datasta";
    let media = "";
    if (v.youtube) media = `<button data-yt="${esc(v.youtube)}" style="width:100%;aspect-ratio:16/9;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);font-size:16px;cursor:pointer">Katso video</button>`;
    else if (v.mp4) media = `<video controls playsinline preload="metadata" style="display:block;width:100%;max-width:340px;margin:8px auto;border-radius:10px" src="${esc(v.mp4)}"></video>`;
    const linkit = [v.tiktok ? `<a href="${esc(v.tiktok)}" rel="noopener">Katso TikTokissa</a>` : "", v.youtube ? `<a href="https://www.youtube.com/watch?v=${esc(v.youtube)}" rel="noopener">Avaa YouTubessa</a>` : "", v.sivu ? `<a href="${esc(v.sivu)}">Aiheen sivu</a>` : ""].filter(Boolean).join(" · ");
    return `<div class="card" data-k="${k}"><b>${esc(v.otsikko || "")}</b>${v.kuvaus ? `<p class="meta">${esc(v.kuvaus)}</p>` : ""}${media}<p class="meta">${esc(k === "kanta" ? "Omia kantoja" : k === "opas" ? "Opas" : "Datasta")}${v.pvm ? " · " + esc(v.pvm) : ""}${v.lahde ? " · Lähde: " + esc(v.lahde) : ""}</p>${linkit ? `<p>${linkit}</p>` : ""}</div>`;
  };
  const css = `<style>#vd .tb{display:flex;gap:6px;margin:12px 0}#vd button[data-t]{flex:1;font-size:16px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer}#vd button[data-t].on{border-color:var(--accent,#888);font-weight:700}</style>`;
  const tyhja = (k, t) => `<p class="meta" data-e="${k}" style="display:none">${t}</p>`;
  const body = `<h1>Videot</h1>
<p>Lyhyet videot Suomen julkisesta datasta ja politiikasta. <b>Datasta</b>-videoissa kerrotaan, mitä avoin data näyttää. <b>Kannat</b>-videoissa Miika kertoo omia mielipiteitään, ja ne ovat hänen omiaan, eivät sivuston kantoja. Sivuston luvut ja taulukot pysyvät puolueettomina.</p>
${css}<div id="vd"><div class="tb"><button data-t="kaikki">Kaikki</button><button data-t="datasta">Datasta</button><button data-t="kanta">Kannat</button><button data-t="opas">Opas</button></div>
${lista.map(kortti).join("\n")}
${lista.length ? "" : '<p class="meta" data-e="kaikki">Videoita tulossa pian.</p>'}
${lista.length ? tyhja("datasta", "Datasta-videoita tulossa pian.") + tyhja("kanta", "Kantavideoita tulossa pian.") + tyhja("opas", "Opasvideoita tulossa pian.") : ""}</div>${JS}`;
  return [{ path: "/videot/", html: shell({ title: "Videot | Eduskuntaseuranta", desc: "Lyhyet videot Suomen julkisesta datasta ja politiikasta.", path: "/videot/", body }) }];
}
