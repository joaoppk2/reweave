// Prévia de navegador da barra lateral + visualizadores com notas e vínculos fictícios (nada do vault é lido).
import { BrainUI } from './sidebar';
import { defaultSettings } from './settings';
import { fillLegacy } from './brain-regions';
import type { BrainGraph, BrainNote } from './brain-data';

const palette = ['#4a90e2', '#e28045', '#7cbd6a'];
const groups = fillLegacy(palette.map((color, i) => ({ name: ['Azul', 'Laranja', 'Verde'][i], color, text: '', legacy: null, notes: 0 })));
let seed = 12345;
const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const nodes:BrainNote[] = [];
for (let i = 0; i < 160; i++) {
  const region = i % 9 === 8 ? -1 : i % 3;
  if (region >= 0) groups[region].notes++;
  nodes.push({ path:`Nota ${i}.md`, title:`Nota ${i}`, mtimeMs:Date.now() - rand() * 864e5 * 10, region, type:'note', color:region >= 0 ? groups[region].color : '', colorVariable:region >= 0 ? undefined : '--graph-node', tags:[], frontmatter:undefined });
}
const edges:[string, string][] = [];
const seen = new Set<string>();
for (let i = 0; i < 260; i++) {
  const a = Math.floor(rand() * nodes.length), b = rand() < .7 ? (a + 1 + Math.floor(rand() * 6)) % nodes.length : Math.floor(rand() * nodes.length);
  if (a === b) continue;
  const key = a < b ? a + '_' + b : b + '_' + a;
  if (seen.has(key)) continue;
  seen.add(key); edges.push([nodes[a].path, nodes[b].path]);
}
const graph:BrainGraph = { nodes, edges, directedEdges:edges, groups, graphSettings:{} };
const host = document.getElementById('app')!;
const settings = defaultSettings();
const params = new URLSearchParams(location.search);
if (params.get('mode') === 'anat' || params.get('mode') === 'anat4') settings.mode = params.get('mode') as 'anat' | 'anat4';
const ui = new BrainUI(host, n => console.log('abrir', n.path), settings, () => {}, () => {});
ui.update(graph);
(window as unknown as { ui:BrainUI }).ui = ui;
