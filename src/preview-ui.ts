// Prévia de navegador da barra lateral + visualizadores com notas e vínculos fictícios (nada do vault é lido).
import { BrainUI } from './sidebar';
import { defaultSettings } from './settings';
import { fillLegacy } from './brain-regions';
import type { BrainGraph, BrainNote } from './brain-data';

// ?palette=vault usa os 7 grupos de cor do vault do autor (cores puras), para testar o visual com cores saturadas.
const useVault = new URLSearchParams(location.search).get('palette') === 'vault';
const palette = useVault ? ['#ff0000', '#0000ff', '#00ff00', '#ff3f00', '#7f00ff', '#ffff00', '#ff7f00'] : ['#4a90e2', '#e28045', '#7cbd6a'];
const names = useVault ? ['Pausados', 'Fatia de Ciência', 'Corte de Caixa', 'JStreet Wear', 'Ferramentas de vídeo', 'Cortado e Servido', 'Segundo Cérebro'] : ['Azul', 'Laranja', 'Verde'];
const groups = fillLegacy(palette.map((color, i) => ({ name:names[i], color, text:'', legacy:null, notes:0 })));
let seed = 12345;
const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const nodes:BrainNote[] = [];
for (let i = 0; i < 160; i++) {
  const region = i % 9 === 8 ? -1 : i % palette.length;
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
if (params.get('mode') === 'fibers' || params.get('mode') === 'network') settings.mode = params.get('mode') as 'fibers' | 'network';
// ?virtual=1: o tempo da página só avança quando window.__step(ms) é chamado, para gravar vídeos a 60 fps exatos.
if (params.has('virtual')) {
  let now = 0, next = 0;
  const queue = new Map<number, FrameRequestCallback>();
  performance.now = () => now;
  window.requestAnimationFrame = cb => { queue.set(++next, cb); return next; };
  window.cancelAnimationFrame = id => { queue.delete(id); };
  (window as unknown as { __step:(ms:number)=>void }).__step = ms => { now += ms; const callbacks = [...queue.values()]; queue.clear(); for (const cb of callbacks) cb(now); };
}
const ui = new BrainUI(host, n => console.log('abrir', n.path), settings, () => {}, () => {});
ui.update(graph);
(window as unknown as { ui:BrainUI }).ui = ui;
// Auxiliares só da prévia/gravação: legenda na tela e "edição" de notas (gera o pulso de atividade).
const caption = document.createElement('div');
caption.style.cssText = 'position:fixed;left:16px;top:14px;z-index:9;padding:8px 14px;border-radius:8px;background:rgba(0,0,0,.6);color:#fff;font:600 17px system-ui,sans-serif;pointer-events:none;display:none';
document.body.append(caption);
(window as unknown as { demo:unknown }).demo = {
  caption(text:string) { caption.textContent = text; caption.style.display = text ? 'block' : 'none'; },
  touch(count:number) { const now = Date.now(); for (let i = 0; i < count; i++) graph.nodes[(i * 7 + 3) % graph.nodes.length].mtimeMs = now + i; ui.update({ ...graph, nodes:graph.nodes.map(n => ({ ...n })) }); }
};
