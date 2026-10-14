import { tilastotPages as kela } from "./tilastot-kela.mjs";
import { videotPages } from "./videot.mjs";
import { kelaPages } from "./kela.mjs";
import { datapankkiPages } from "./datapankki.mjs";

export function tilastotPages(args) {
  const out = kela(args);
  for (const p of out) {
    if (p.path === "/tilastot/") p.html = p.html.replace("<h1>Tilastot</h1>", '<h1>Tilastot</h1><p><a href="/kela/"><b>Kela kunnassasi: paljonko Kela maksaa sinun kunnassasi?</b></a></p>');
  }
  try { out.push(...videotPages(args)); } catch (e) { console.log("Videot ohitettu:", e.message); }
  try { out.push(...kelaPages(args)); } catch (e) { console.log("Kela-sivu ohitettu:", e.message); }
  try { out.push(...datapankkiPages(args)); } catch (e) { console.log("Datapankki ohitettu:", e.message); }
  return out;
}
