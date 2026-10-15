import { createEngine } from './gl-engine';
import { makeMesh, region, anatomicalPoint, anatomicalPoint2, topEquivalent, type Vec3, type Mesh } from './brain-geometry';
import { assignRegions, notePosition, LEGACY_AREAS, type RegionState, type RegionInfo, type Positioned } from './brain-regions';
import { defaultForces, type ForceSettings } from './brain-forces';
import { emptyGraph, type BrainGraph, type BrainNote } from './brain-data';
import { compileExpression } from './expression';

export type GLMode = 'fibers' | 'network';
export interface DisplaySettings { arrows?:boolean; labelThreshold?:number; nodeSize?:number; linkWidth?:number; }
// O que a barra lateral precisa de qualquer renderizador (vista de cima em Canvas 2D ou os visualizadores WebGL).
export interface Renderer {
  update(graph:BrainGraph):void;
  setFilter(predicate:(n:BrainNote)=>boolean):void;
  setColorRules(rules:{expression:string;color:string}[]):void;
  selectRegion(index:number):void;
  zoom(factor:number):void;
  reset():void;
  toggleAnimation():boolean;
  isAnimating():boolean;
  setDisplay(settings:DisplaySettings):void;
  setForces(settings:ForceSettings):void;
  useObsidianForces():ForceSettings;
  redraw():void;
  destroy():void;
}

type Note = BrainNote & Positioned;
type RGB = [number, number, number];
type PointFn = (u:number, v:number, side:number) => Vec3;
interface Config { pt:PointFn; fit:(aspect:number)=>number; spread:number; tail:number; haze:number; cascade:number; cycle:number; sgain:number; cableMode:number; yaw:number; pitch:number; }

const GAP = .07;
const clamp = (x:number) => Math.max(0, Math.min(1, x));
const inward = (p:Vec3, d:number):Vec3 => ({ x:p.x*d, y:p.y*d, z:(p.z-Math.sign(p.z)*GAP)*d+Math.sign(p.z)*GAP });
const CONFIG:Record<GLMode,Config> = {
  fibers:  { pt:anatomicalPoint,  fit:a=>.66+.14*clamp((a-.6)/.6), spread:5, tail:1,   haze:0, cascade:0, cycle:14, sgain:1,    cableMode:3, yaw:-.35, pitch:.10 },
  network: { pt:anatomicalPoint2, fit:a=>.66+.38*clamp((a-.6)/.6), spread:8, tail:.28, haze:1, cascade:1, cycle:22, sgain:1.35, cableMode:5, yaw:-.08, pitch:.08 }
};
// Opções do visualizador "Anatômico (rede)", iguais às aprovadas no laboratório.
const GRAPH_OPTIONS = { bundles:0, strands:7, pathPts:80, shellAlpha:1, branches:0, motes:500, moteDepth:.9, beadSteps:3, grayMix:0, signalTone:null, cells:0, fissure:false, fiberAlpha:.14, cellAlpha:.3, dotSize:2.0, graph:true, graphNodes:300, graphReach:.27 };
const CASCADE_OPTIONS = { ...GRAPH_OPTIONS, motes:0, cascade:true, cascades:14, cycle:22, depthMin:.88, depthSpan:.06, pathBase:.3, maxHops:6, dendrites:4, dendLen:.7, bokeh:false };

// Os 3D somam luz (brilho aditivo): cores puras do gráfico, como #ff0000 ou #00ff00, estouram e viram néon quando se cruzam.
// Mantém o matiz de cada região, mas limita a saturação e a luminosidade para ficarem suaves e legíveis.
export function soften(c:RGB, saturation = .72, lightness = .5):RGB {
  const [r, g, b] = c, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 1e-6) return [lightness, lightness, lightness];
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const q = lightness < .5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation, p = 2 * lightness - q;
  const f = (t:number) => { t = (t + 360) % 360 / 360; return t < 1/6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; };
  return [f(h + 120), f(h), f(h - 120)];
}
export function parseColor(css:string, fallback:RGB):RGB {
  const s = css.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) { const n = parseInt(m[1], 16); return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255]; }
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) { const h = m[1]; return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255]; }
  const r = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
  if (r) return [Number(r[1])/255, Number(r[2])/255, Number(r[3])/255];
  return fallback;
}

export class BrainGL implements Renderer {
  private readonly gl:WebGLRenderingContext;
  private readonly engine:any;
  private readonly topMesh:Mesh = makeMesh();
  private data:BrainGraph = emptyGraph();
  private state:RegionState = assignRegions(this.topMesh.nodes, []);
  private notes:Note[] = [];
  private visible:Note[] = [];
  private byPath = new Map<string, Note>();
  private positions = new Map<string, Vec3>();
  private colors = new Map<string, RGB>();
  private predicate:(n:BrainNote)=>boolean = () => true;
  private rules:{ test:(n:BrainNote)=>boolean; color:string }[] = [];
  private baseline:Map<string, number>|null = null;
  private pulses = new Map<string, number>();
  private animation = false;
  private selected = -1;
  private chosen:string|null = null;
  private mode:GLMode = 'fibers';
  private cam = { yaw:-.35, pitch:.10, zoom:1, panX:0, panY:0 };
  private clock = 3.8;
  private last = 0;
  private frame = 0;
  private destroyed = false;
  private width = 1;
  private height = 1;
  private statics:Partial<Record<GLMode, any>> = {};
  private staticKey = '';
  private cascadeLayer:any = null;
  private cascadeDirty = true;
  private realLinks:any = null;
  private realNodes:any = null;
  private realEdges:{ a:Note; b:Note; path:Vec3[]; len:number; callosal:boolean }[] = [];
  private pulseBuffer:WebGLBuffer|null;
  private legacyColors:RGB[] = [];
  private palette = { node:'#999999', tag:'#a8c373', attachment:'#999999' };
  private fallback:RGB = [.6, .6, .6];
  private display = { nodeSize:1, linkWidth:1 };
  private forces:ForceSettings = { ...defaultForces };
  private pointer:{ id:number; x:number; y:number; startX:number; startY:number; moved:boolean; rotate:boolean }|null = null;
  private readonly resizeObserver:ResizeObserver;
  private readonly themeObserver:MutationObserver;
  private readonly motion:MediaQueryList;
  private readonly cleanups:(()=>void)[] = [];
  private readonly originalTouchAction:string;

  constructor(private readonly canvas:HTMLCanvasElement, private readonly choose:(n:BrainNote, restore:()=>void)=>void, private readonly hover:(n:BrainNote, event:PointerEvent)=>void = () => {}, private readonly onLost:()=>void = () => {}) {
    const gl = canvas.getContext('webgl', { alpha:false, antialias:true, powerPreference:'high-performance' });
    if (!gl) throw new Error('WebGL indisponível.');
    this.gl = gl;
    this.engine = createEngine(gl, this.background());
    this.pulseBuffer = gl.createBuffer();
    this.originalTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    this.motion = canvas.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
    this.resizeObserver = new ResizeObserver(() => { this.resize(); this.redraw(); });
    this.resizeObserver.observe(canvas);
    this.themeObserver = new MutationObserver(() => { this.resolveColors(); this.redraw(); });
    for (let element:HTMLElement|null = canvas; element; element = element.parentElement) this.themeObserver.observe(element, { attributes:true, attributeFilter:['class', 'style'] });
    this.listen('pointerdown', this.pointerDown);
    this.listen('pointermove', this.pointerMove);
    this.listen('pointerup', this.pointerUp);
    this.listen('pointercancel', this.pointerCancel);
    this.listen('lostpointercapture', this.pointerCancel);
    this.listen('wheel', this.wheel, { passive:false });
    this.listen('contextmenu', event => event.preventDefault());
    this.listen('mousedown', event => { if (event.button === 1) event.preventDefault(); });   // evita o autoscroll do clique com a roda
    this.listen('keydown', event => { if (event.key === 'Escape') { this.chosen = null; this.rebuildReal(); this.redraw(); } });
    const lost = (event:Event) => { event.preventDefault(); this.onLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    this.cleanups.push(() => canvas.removeEventListener('webglcontextlost', lost));
    this.resolveColors();
    this.resize();
    this.redraw();
  }

  get graph():BrainGraph { return this.data; }
  get regions():RegionInfo[] { return this.state.regions; }
  getRegions():RegionInfo[] { return this.state.regions; }
  isAnimating():boolean { return this.animation; }

  setMode(mode:GLMode):void {
    if (this.destroyed || mode === this.mode) return;
    this.mode = mode;
    this.resetView();
    this.cascadeDirty = true;
    this.cache();
    this.redraw();
  }
  update(graph:BrainGraph):void {
    if (this.destroyed) return;
    const now = performance.now(), next = new Map(graph.nodes.map(n => [n.path, n.mtimeMs] as [string, number]));
    if (this.baseline) for (const [path, mtime] of next) if (this.baseline.get(path) !== mtime) this.pulses.set(path, now);
    for (const path of this.pulses.keys()) if (!next.has(path)) this.pulses.delete(path);
    this.baseline = next;
    this.data = graph;
    this.state = assignRegions(this.topMesh.nodes, graph.groups);
    this.notes = graph.nodes.map(n => notePosition(n, this.topMesh.nodes, this.state));
    this.byPath = new Map(this.notes.map(n => [n.path, n]));
    if (this.chosen && !this.byPath.has(this.chosen)) this.chosen = null;
    this.resolveLegacyColors();
    this.cache();
    this.redraw();
  }
  setFilter(predicate:(n:BrainNote)=>boolean):void { this.predicate = predicate; this.cache(); this.redraw(); }
  setColorRules(rules:{ expression:string; color:string }[]):void {
    this.rules = [];
    for (const rule of rules) { if (!rule.expression.trim()) continue; try { this.rules.push({ test:compileExpression(rule.expression), color:rule.color }); } catch { /* regra inválida é ignorada */ } }
    this.cache(); this.redraw();
  }
  selectRegion(index:number):void {
    this.selected = Number.isInteger(index) && this.state.regions[index] ? index : -1;
    this.resetView();
    this.cache(); this.redraw();
  }
  zoom(factor:number):void { if (Number.isFinite(factor) && factor > 0) this.cam.zoom = Math.max(.4, Math.min(3, this.cam.zoom * factor)); this.redraw(); }
  reset():void { this.resetView(); this.redraw(); }
  toggleAnimation():boolean {
    this.animation = !this.animation;
    this.last = 0;
    this.cascadeDirty = true;
    this.redraw();
    return this.animation;
  }
  setDisplay(settings:DisplaySettings):void {
    for (const key of ['nodeSize', 'linkWidth'] as const) { const v = settings[key]; if (v !== undefined && Number.isFinite(v) && v >= 0) this.display[key] = v; }
    this.rebuildReal(); this.redraw();
  }
  setForces(settings:ForceSettings):void { for (const key of ['center', 'repel', 'link', 'distance'] as const) if (Number.isFinite(settings[key])) this.forces[key] = Math.max(0, settings[key]); }
  useObsidianForces():ForceSettings {
    const g = this.data.graphSettings;
    this.setForces({ center:g.centerStrength ?? this.forces.center, repel:g.repelStrength ?? this.forces.repel, link:g.linkStrength ?? this.forces.link, distance:g.linkDistance ?? this.forces.distance });
    return { ...this.forces };
  }
  redraw():void { if (!this.destroyed && !this.frame) this.frame = requestAnimationFrame(this.draw); }
  destroy():void {
    if (this.destroyed) return;
    this.destroyed = true; cancelAnimationFrame(this.frame); this.frame = 0;
    this.resizeObserver.disconnect(); this.themeObserver.disconnect();
    for (const cleanup of this.cleanups) cleanup();
    if (this.pointer && this.canvas.hasPointerCapture(this.pointer.id)) this.canvas.releasePointerCapture(this.pointer.id);
    this.pointer = null; this.canvas.title = ''; this.canvas.style.touchAction = this.originalTouchAction;
    this.freeAll();
    if (this.pulseBuffer) this.gl.deleteBuffer(this.pulseBuffer);
    this.engine.dispose();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // ---- internals
  private listen<K extends keyof HTMLElementEventMap>(type:K, handler:(event:HTMLElementEventMap[K])=>void, options?:AddEventListenerOptions):void {
    this.canvas.addEventListener(type, handler, options);
    this.cleanups.push(() => this.canvas.removeEventListener(type, handler, options));
  }
  private resetView():void { const c = CONFIG[this.mode]; this.cam = { yaw:c.yaw, pitch:c.pitch, zoom:1, panX:0, panY:0 }; }
  private background():RGB {
    const style = this.canvas.ownerDocument.defaultView!.getComputedStyle(this.canvas);
    const rgb = parseColor(style.getPropertyValue('--background-primary'), [28/255, 28/255, 28/255]);
    // Os visualizadores usam brilho aditivo: sobre tema claro ficam invisíveis, então o fundo continua escuro.
    return .2126*rgb[0] + .7152*rgb[1] + .0722*rgb[2] > .35 ? [28/255, 28/255, 28/255] : rgb;
  }
  private resize():void {
    const rect = this.canvas.getBoundingClientRect(), ratio = Math.min(this.canvas.ownerDocument.defaultView?.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio)); this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.ratio = ratio;
  }
  private ratio = 1;
  private resolveColors():void {
    const style = this.canvas.ownerDocument.defaultView!.getComputedStyle(this.canvas);
    const read = (key:string, fallback:string) => style.getPropertyValue(key).trim() || fallback;
    this.palette = { node:read('--graph-node', '#999999'), tag:read('--graph-node-tag', '#a8c373'), attachment:read('--graph-node-attachment', '#999999') };
    const bg = this.background();
    this.gl.clearColor(bg[0], bg[1], bg[2], 1);
    this.fallback = parseColor(this.palette.node, [.6, .6, .6]);
    this.resolveLegacyColors();
    this.cache();
  }
  // As cores do casco são as mesmas das regiões da vista de cima: cada área desenhada herda a cor do grupo dono dela.
  private resolveLegacyColors():void {
    // Mesma regra da vista de cima: cada área desenhada tem a cor do grupo a que a maior parte dos seus pontos pertence.
    const votes = Array.from({ length:LEGACY_AREAS }, () => new Map<number, number>());
    for (const p of this.topMesh.nodes) votes[p.legacy].set(p.group, (votes[p.legacy].get(p.group) ?? 0) + 1);
    const next = votes.map(area => {
      let best = -1, most = 0;
      for (const [group, count] of area) if (count > most) { most = count; best = group; }
      const color = this.data.groups[best]?.color;
      return color ? soften(parseColor(color, this.fallback)) : this.fallback;
    });
    const key = this.mode + JSON.stringify(next);
    this.legacyColors = next;
    if (key !== this.staticKey) { this.staticKey = key; this.freeScenes(); }
  }
  private tone = (p:Vec3):number[] => this.legacyColors[region(topEquivalent(p))] ?? this.fallback;
  private pt():PointFn { return CONFIG[this.mode].pt; }
  private cache():void {
    this.visible = this.notes.filter(n => (this.selected < 0 || n.groupIndex === this.selected) && this.predicate(n));
    this.colors.clear();
    const pt = this.pt();
    this.positions.clear();
    for (const n of this.notes) {
      const fallback = n.colorVariable === '--graph-node-tag' ? this.palette.tag : n.colorVariable === '--graph-node-attachment' ? this.palette.attachment : n.colorVariable === '--graph-node' ? this.palette.node : n.color || this.palette.node;
      this.colors.set(n.path, soften(parseColor(this.rules.find(r => r.test(n))?.color || fallback, this.fallback), .7, .56));
      this.positions.set(n.path, inward(pt(n.u, n.v, n.side), .965));
    }
    this.rebuildReal();
    this.cascadeDirty = true;
  }
  private edgePath(a:Note, b:Note):{ path:Vec3[]; callosal:boolean } {
    const pt = this.pt(), depth = .96, path:Vec3[] = [];
    if (a.side === b.side) {
      for (let k = 0; k <= 12; k++) { const f = k/12; path.push(inward(pt(a.u + (b.u-a.u)*f, a.v + (b.v-a.v)*f, a.side), depth)); }
      return { path, callosal:false };
    }
    const A = inward(pt(a.u, a.v, a.side), depth), B = inward(pt(b.u, b.v, b.side), depth);
    for (let k = 0; k <= 24; k++) { const f = k/24; path.push({ x:A.x+(B.x-A.x)*f, y:A.y+(B.y-A.y)*f+.1*Math.sin(f*Math.PI), z:A.z+(B.z-A.z)*f }); }
    return { path, callosal:true };
  }
  private rebuildReal():void {
    const e = this.engine;
    e.freeScene({ a:this.realLinks, b:this.realNodes });
    const visible = new Set(this.visible.map(n => n.path)), links:number[] = [], nodes:number[] = [];
    this.realEdges = [];
    for (const [pa, pb] of this.data.edges) {
      if (!visible.has(pa) || !visible.has(pb)) continue;
      const a = this.byPath.get(pa)!, b = this.byPath.get(pb)!, { path, callosal } = this.edgePath(a, b);
      let len = 0;
      for (let k = 1; k < path.length; k++) len += Math.hypot(path[k].x-path[k-1].x, path[k].y-path[k-1].y, path[k].z-path[k-1].z);
      this.realEdges.push({ a, b, path, len, callosal });
      const color = this.colors.get(pa)!, alpha = Math.min(1, .26 * this.display.linkWidth);
      for (let k = 1; k < path.length; k++) { e.add(links, path[k-1], color, 1, alpha); e.add(links, path[k], color, 1, alpha); }
    }
    for (const n of this.visible) {
      const pos = this.positions.get(n.path)!, color = this.colors.get(n.path)!, size = (n.path === this.chosen ? 22 : 13) * this.display.nodeSize;
      e.add(nodes, pos, color, size, 1); e.add(nodes, pos, color, size * 2.6, .16);
    }
    this.realLinks = e.buffer(links, this.gl.LINES); this.realNodes = e.buffer(nodes, this.gl.POINTS);
  }
  private freeScenes():void {
    for (const key of Object.keys(this.statics) as GLMode[]) this.engine.freeScene(this.statics[key]);
    this.statics = {};
    this.engine.freeScene(this.cascadeLayer); this.cascadeLayer = null; this.cascadeDirty = true;
  }
  private freeAll():void { this.freeScenes(); this.engine.freeScene({ a:this.realLinks, b:this.realNodes }); this.realLinks = null; this.realNodes = null; }
  private ensureScenes():void {
    const e = this.engine;
    if (!this.statics[this.mode]) {
      this.statics[this.mode] = this.mode === 'fibers'
        ? e.build(anatomicalPoint, this.tone, GAP, true, makeMesh(anatomicalPoint))
        : e.build(anatomicalPoint2, this.tone, GAP, true, makeMesh(anatomicalPoint2, 2, 2), { ...GRAPH_OPTIONS, cascade:false });
    }
    if (this.mode === 'network' && this.animation && (this.cascadeDirty || !this.cascadeLayer)) {
      e.freeScene(this.cascadeLayer);
      // Com poucos vínculos reais o disparo usa a rede de fundo (ilustrativa); com vínculos suficientes, só andam por eles.
      const index = new Map(this.visible.map((n, i) => [n.path, i] as [string, number]));
      const edges = this.realEdges.map(r => ({ i:index.get(r.a.path)!, j:index.get(r.b.path)!, path:r.path, len:r.len, callosal:r.callosal }));
      const options:any = { ...CASCADE_OPTIONS };
      if (edges.length >= 6) options.realGraph = { nodes:this.visible.map(n => ({ pos:this.positions.get(n.path)! })), edges };
      else options.ghostLines = false;
      this.cascadeLayer = e.build(anatomicalPoint2, this.tone, GAP, true, { nodes:[], edges:[], folds:[] }, options);
      this.cascadeDirty = false;
    }
  }
  private scale(aspect:number):number { return Math.min(.70, aspect * .98) * this.cam.zoom * CONFIG[this.mode].fit(aspect); }
  private draw = (ts:number):void => {
    this.frame = 0; if (this.destroyed) return;
    const gl = this.gl, e = this.engine, cfg = CONFIG[this.mode], u = e.uniforms, reduced = this.motion.matches;
    const dt = this.last ? Math.min(.05, (ts - this.last) / 1000) : 0; this.last = ts;
    if (this.animation) { this.clock += dt; if (!this.pointer && !reduced) this.cam.yaw += dt * .12; }
    this.ensureScenes();
    const aspect = this.width / this.height, scene = this.statics[this.mode], layer = this.cascadeLayer, anim = this.animation;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(u.view, this.cam.yaw, this.cam.pitch, this.scale(aspect), 0);
    gl.uniform4f(u.camera, this.cam.panX, this.cam.panY, 1/aspect, 0);
    gl.uniform1f(u.time, this.clock); gl.uniform1f(u.pixelRatio, this.ratio);
    gl.uniform1f(u.spread, cfg.spread); gl.uniform1f(u.tail, cfg.tail); gl.uniform1f(u.haze, cfg.haze);
    gl.uniform1f(u.cascade, cfg.cascade); gl.uniform1f(u.cycle, cfg.cycle); gl.uniform1f(u.hops, 0); gl.uniform1f(u.sgain, cfg.sgain);
    e.drawBuffer(scene.shell, 0, 0);
    if (anim) { e.drawBuffer(scene.interior, 0, 0); e.drawBuffer(scene.dust, 1, 0); }
    e.drawBuffer(scene.soma, 1, 0);
    if (anim && this.mode === 'fibers') { e.drawBuffer(scene.glow, 0, 2); e.drawBuffer(scene.cable, 1, cfg.cableMode); e.drawBuffer(scene.sparks, 1, 1); }
    if (anim && this.mode === 'network' && layer) {
      e.drawBuffer(layer.interior, 0, 0); e.drawBuffer(layer.dust, 1, 0); e.drawBuffer(layer.glow, 0, 2); e.drawBuffer(layer.cable, 1, cfg.cableMode);
      e.drawBuffer(layer.dend, 0, 2); e.drawBuffer(layer.dend, 0, 2); e.drawBuffer(layer.dend, 0, 2); e.drawBuffer(layer.burst, 1, 6); e.drawBuffer(layer.sparks, 1, 1);
    }
    gl.uniform1f(u.haze, 0);   // as notas do vault não escurecem com a profundidade do casulo
    e.drawBuffer(this.realLinks, 0, 0);
    e.drawBuffer(this.realNodes, 1, 0);
    this.drawPulses(ts, reduced);
    if (anim || this.pulses.size) this.redraw();
  };
  private drawPulses(now:number, reduced:boolean):void {
    for (const [path, start] of this.pulses) if (now - start >= 4000) this.pulses.delete(path);
    if (!this.pulses.size || !this.pulseBuffer) return;
    const data:number[] = [];
    for (const n of this.visible) {
      const start = this.pulses.get(n.path); if (start === undefined) continue;
      const age = (now - start) / 1000;
      this.engine.add(data, this.positions.get(n.path)!, this.colors.get(n.path)!, (reduced ? 30 : 14 + age * 40) * this.display.nodeSize, Math.max(0, 1 - age / 4) * .8);
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pulseBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
    this.engine.drawBuffer({ b:this.pulseBuffer, count:data.length / 9, mode:gl.POINTS }, 1, 0);
  }
  // Mesma projeção do vertex shader, para saber onde cada nota aparece na tela (cliques e hover).
  private project(p:Vec3):{ x:number; y:number; z:number } {
    const { yaw, pitch, panX, panY } = this.cam, aspect = this.width / this.height;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    const x1 = p.x*cy + p.z*sy, z1 = -p.x*sy + p.z*cy, y2 = p.y*cx - z1*sx, z2 = p.y*sx + z1*cx;
    const persp = 3.8 / (3.8 - z2), s = this.scale(aspect);
    const nx = (x1*s*persp + panX) / aspect, ny = y2*s*persp + panY;
    return { x:(nx*.5 + .5) * this.width, y:(1 - (ny*.5 + .5)) * this.height, z:z2 };
  }
  private hit(x:number, y:number):Note|undefined {
    let best:{ n:Note; z:number }|undefined;
    const radius = Math.max(12, 6 * this.display.nodeSize);
    for (const n of this.visible) {
      const s = this.project(this.positions.get(n.path)!);
      if (Math.hypot(s.x - x, s.y - y) < radius && (!best || s.z > best.z)) best = { n, z:s.z };
    }
    return best?.n;
  }
  private pointerDown = (event:PointerEvent):void => {
    if (this.pointer || event.button > 2) return;
    if (event.button !== 0) event.preventDefault();
    this.pointer = { id:event.pointerId, x:event.clientX, y:event.clientY, startX:event.clientX, startY:event.clientY, moved:false, rotate:event.button !== 0 };
    this.canvas.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event:PointerEvent):void => {
    const p = this.pointer;
    if (p) {
      if (p.id !== event.pointerId) return;
      const dx = event.clientX - p.x, dy = event.clientY - p.y;
      if (Math.hypot(event.clientX - p.startX, event.clientY - p.startY) > 6) p.moved = true;
      if (p.rotate) { this.cam.yaw += dx * .008; this.cam.pitch = Math.max(-1.4, Math.min(1.4, this.cam.pitch + dy * .008)); }
      else { this.cam.panX += dx / this.height * 2; this.cam.panY -= dy / this.height * 2; }
      p.x = event.clientX; p.y = event.clientY; this.canvas.title = ''; this.redraw();
    } else {
      const rect = this.canvas.getBoundingClientRect(), note = this.hit(event.clientX - rect.left, event.clientY - rect.top);
      this.canvas.title = ''; if (note && note.type !== 'tag') this.hover(note, event);
    }
  };
  private pointerUp = (event:PointerEvent):void => {
    const start = this.pointer; if (!start || start.id !== event.pointerId) return;
    this.pointer = null; if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (start.rotate || start.moved || Math.hypot(event.clientX - start.startX, event.clientY - start.startY) > 6) return;
    const rect = this.canvas.getBoundingClientRect(), note = this.hit(event.clientX - rect.left, event.clientY - rect.top); if (!note) return;
    this.chosen = note.path; this.rebuildReal(); this.redraw();
    this.choose(note, () => {});
  };
  private pointerCancel = (event:PointerEvent):void => {
    if (this.pointer?.id === event.pointerId) { this.pointer = null; if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); }
    this.canvas.title = '';
  };
  // Roda para a frente aproxima, para trás afasta; girar é clicar com a roda (ou o botão direito) e arrastar. Nenhum atalho com Shift ou Ctrl.
  private wheel = (event:WheelEvent):void => {
    event.preventDefault();
    const k = event.deltaMode === 1 ? 16 : 1;
    this.cam.zoom = Math.max(.4, Math.min(3, this.cam.zoom * Math.exp(-event.deltaY * k * .001)));
    this.redraw();
  };
}
