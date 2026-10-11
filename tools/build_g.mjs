// Data for the Google Maps version: everything in lon/lat (no projected coordinates).
import fs from "node:fs";
const here = p => new URL(p, import.meta.url);
import { geoMercator } from "d3-geo";
const D = JSON.parse(fs.readFileSync(here("mapdata.json"), "utf8"));
const proj = geoMercator().scale(D.roadNet.proj.scale).translate(D.roadNet.proj.translate);
const r4 = v => Math.round(v * 1e4) / 1e4;
const toLL = xy => proj.invert(xy).map(r4);
const stops = Object.fromEntries(Object.entries(D.stops).map(([k, s]) => { const { xy, ...rest } = s; return [k, rest]; }));
const days = D.days.map(d => {
  const { polys, spur, ...rest } = d;
  return { ...rest, polysLL: polys.map(pl => pl.map(toLL)), spurLL: spur ? spur.map(toLL) : null };
});
const labels = D.labels.filter(l => l.cls.startsWith("city")).map(l => ({ t: l.t, ll: l.ll }));
const net = { ll: D.roadNet.ll, edges: D.roadNet.edges, stopNode: D.roadNet.stopNode, main: D.roadNet.main };
const out = { stops, days, courses: D.courses, labels, net, flightMin: D.flightMin };
fs.writeFileSync(here("../src/data/gdata.json"), JSON.stringify(out));
console.log("gdata bytes", fs.statSync(here("../src/data/gdata.json")).size);
