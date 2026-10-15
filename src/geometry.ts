export type Vec3 = { x: number; y: number; z: number };
export type Part = 'cortex' | 'cerebellum' | 'stem';
export const TAU = Math.PI * 2;
/** One closed parameterization per anatomical part, never mirrored shells.
 * v reaches both poles; u is periodic. All corrugations vanish at poles. */
export function surface(part: Part, u: number, v: number): Vec3 {
  const s = Math.sin(v), c = Math.cos(v);
  if (part === 'stem') {
    const radius = .105 * s * (1 + .15 * c);
    return { x: .27 + .12 * (1-c) + radius * Math.cos(u), y: .48 + .39*(1-c), z: radius*.8*Math.sin(u) };
  }
  if (part === 'cerebellum') {
    const fold = 1 + .018 * s*s*Math.sin(30*v);
    return { x: .71 + .37*s*Math.cos(u)*fold, y: .62 + .29*c*fold, z: .27*s*Math.sin(u)*fold };
  }
  const fold = 1 + s*s*(.017*Math.sin(18*u + 3*Math.sin(5*v)) + .014*Math.cos(25*v + 3*Math.sin(4*u)));
  // Long frontal-to-occipital axis, rounded superior dome, tapered lower temporal pole.
  const x = 1.2*s*Math.cos(u)*fold;
  const lower = Math.max(0,c);
  return { x: x + .08*c, y: -.23 + .76*c*fold + .07*s*s*Math.cos(u), z: .55*s*Math.sin(u)*fold*(1-.14*lower) };
}
export interface Region { name:string; color:string; detail:string; }
export const defaultRegions:Region[]=['#ffff00','#0000ff','#00ff00','#ff4000','#8000ff','#ff8000','#ff0000'].map((color,i)=>({name:`Região ${i+1}`,color,detail:'Notas agrupadas por pasta; selecione uma nota para abrir.'}));
export function region(p:Vec3):number { if(p.y>.5)return 6;if(p.x<-.45)return p.y<-.25?1:2;if(p.x>.55)return 4;if(p.y<-.55)return 0;return p.x<0?5:3; }
export interface Geometry { lines: Vec3[][]; points: Vec3[]; edges:[number,number][]; }
export function makeGeometry(): Geometry {
  const lines:Vec3[][]=[],points:Vec3[]=[],edges:[number,number][]=[];
  let seed=71;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1400;i++){const part:Part=i<1110?'cortex':i<1330?'cerebellum':'stem';points.push(surface(part,rand()*TAU,Math.acos(2*rand()-1)));}
  for(let i=0;i<points.length;i++){const a=points[i];const nearby=[];for(let j=i+1;j<points.length;j++){const b=points[j],d=(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;if(d<.045)nearby.push({j,d});}nearby.sort((a,b)=>a.d-b.d);for(const n of nearby.slice(0,2))edges.push([i,n.j]);}
  // Sparse winding folds, not latitude/longitude grid.
  for(const part of ['cortex','cerebellum','stem'] as const){const count=part==='cortex'?12:part==='cerebellum'?8:3;for(let j=0;j<count;j++)lines.push(Array.from({length:97},(_,k)=>{const u=k/96*TAU;return surface(part,u,.22+j/count*(Math.PI-.44)+.045*Math.sin(u*7+j));}));}
  return {lines,points,edges};
}
const positionPool=makeGeometry().points;
export function hash(text: string): number { let h=2166136261; for(const c of text) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
export function notePosition(path: string, group?: string): Vec3 {
  const pool=positionPool, g=group===undefined?hash(path)%7:hash(group)%7;
  const candidates=pool.filter(p=>region(p)===g);
  return candidates[hash(path)%candidates.length];
}
export interface Camera { yaw:number; pitch:number; zoom:number; panX:number; panY:number; }
export const initialCamera = ():Camera=>({yaw:.22,pitch:-.09,zoom:1,panX:0,panY:0});
export function project(p:Vec3,c:Camera,w:number,h:number):Vec3 {
  const x=p.x*Math.cos(c.yaw)+p.z*Math.sin(c.yaw), z=-p.x*Math.sin(c.yaw)+p.z*Math.cos(c.yaw);
  const y=(p.y-.12)*Math.cos(c.pitch)-z*Math.sin(c.pitch), depth=(p.y-.12)*Math.sin(c.pitch)+z*Math.cos(c.pitch);
  const scale=Math.min(w/3.1,h/2.65)*c.zoom*5/(5-depth);
  return {x:w/2+c.panX+x*scale,y:h/2+c.panY+y*scale,z:depth};
}
