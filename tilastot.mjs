import { tilastotPages as kela } from "./tilastot-kela.mjs";
import { videotPages } from "./videot.mjs";

export function tilastotPages(args) {
  const out = kela(args);
  try { out.push(...videotPages(args)); } catch (e) { console.log("Videot ohitettu:", e.message); }
  return out;
}
