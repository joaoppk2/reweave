import { centroid, dist2, hash, type MeshNode, type Vec3 } from './brain-geometry';

export interface RegionInfo { name:string; color:string; text:string; legacy:number|null; notes:number; }
export interface RegionState { regions:RegionInfo[]; pools:MeshNode[][]; basePools:MeshNode[][]; centers:Map<MeshNode[],Vec3>; }
export interface Positioned { x:number; y:number; z:number; groupIndex:number; anchor:Vec3; u:number; v:number; side:number; }

export const LEGACY_AREAS=7;

// Grupos sem área escolhida nas configurações herdam, na ordem, as áreas desenhadas que ainda estão livres.
export function fillLegacy(list:RegionInfo[]):RegionInfo[] {
  const used=new Set(list.map(r=>r.legacy).filter((l):l is number=>Number.isInteger(l)&&l!>=0&&l!<LEGACY_AREAS));
  const free=[...Array(LEGACY_AREAS).keys()].filter(l=>!used.has(l));
  const seen=new Set<number>();
  return list.map(r=>{
    if(Number.isInteger(r.legacy)&&r.legacy!>=0&&r.legacy!<LEGACY_AREAS&&!seen.has(r.legacy!)){seen.add(r.legacy!);return r;}
    const legacy=free.shift();
    if(legacy===undefined)return {...r,legacy:null};
    seen.add(legacy);return {...r,legacy};
  });
}

// Cada grupo vira uma região. Grupos com área desenhada ficam com ela; os demais ganham centro no ponto mais longe
// das regiões existentes e uma área que cresce de leve com as notas, sem tirar mais da metade de nenhuma vizinha.
export function assignRegions(nodes:MeshNode[],list:RegionInfo[]):RegionState {
  const legacyOwner=new Map<number,number>();
  list.forEach((r,i)=>{if(r.legacy!==null&&Number.isInteger(r.legacy)&&!legacyOwner.has(r.legacy))legacyOwner.set(r.legacy,i);});
  const owned=new Set(legacyOwner.values()),seeds:{i:number;c:Vec3}[]=[];
  for(const p of nodes)p.group=legacyOwner.get(p.legacy)??-1;
  for(const [legacy,i] of legacyOwner)seeds.push({i,c:centroid(nodes.filter(p=>p.legacy===legacy))});
  const counts=new Map<number,number>(),keep=new Map<number,number>();
  for(const p of nodes)counts.set(p.group,(counts.get(p.group)??0)+1);
  for(const [g,c] of counts)keep.set(g,Math.floor(c/2));
  const basePools:MeshNode[][]=list.map((r,i)=>r.legacy!==null&&legacyOwner.get(r.legacy)===i?nodes.filter(p=>p.legacy===r.legacy):[]);
  list.forEach((r,i)=>{
    if(owned.has(i))return;
    let center=nodes[0],far=-1;
    for(const p of nodes){const d=seeds.length?Math.min(...seeds.map(s=>dist2(p,s.c))):0;if(d>far){far=d;center=p;}}
    seeds.push({i,c:{x:center.x,y:center.y,z:center.z}});
    const size=Math.min(260,120+8*(r.notes||0)),area:MeshNode[]=[];
    for(const p of [...nodes].sort((a,b)=>dist2(a,center)-dist2(b,center))){
      if(area.length>=size)break;
      if(p.group>=0&&!owned.has(p.group)&&p.group!==i)continue;
      if(p.group>=0&&counts.get(p.group)!<=keep.get(p.group)!)continue;
      if(p.group>=0)counts.set(p.group,counts.get(p.group)!-1);
      p.group=i;area.push(p);
    }
    basePools[i]=area;
  });
  if(seeds.length)for(const p of nodes)if(p.group<0)p.group=seeds.reduce((a,b)=>dist2(p,a.c)<=dist2(p,b.c)?a:b).i;
  const pools=list.map((_,g)=>nodes.filter(p=>p.group===g));
  const centers=new Map<MeshNode[],Vec3>([[nodes,centroid(nodes)],...pools.filter(pool=>pool.length).map(pool=>[pool,centroid(pool)] as [MeshNode[],Vec3])]);
  return {regions:list,pools,basePools,centers};
}

// A nota fica num ponto fixo escolhido pelo caminho; se a região perdeu esse ponto, vai para o mais próximo que restou.
export function notePosition<T extends {path:string;region:number}>(n:T,nodes:MeshNode[],state:RegionState):T&Positioned {
  const g=Number.isInteger(n.region)&&state.pools[n.region]?.length?n.region:-1;
  const base=g<0?nodes:(state.basePools[g]?.length?state.basePools[g]:state.pools[g]);
  let p=base[hash(n.path)%base.length];
  if(g>=0&&p.group!==g){const from=p;p=state.pools[g].reduce((a,b)=>dist2(a,from)<=dist2(b,from)?a:b);}
  return {...n,x:p.x,y:p.y,z:p.z,groupIndex:g,anchor:{x:p.x,y:p.y,z:p.z},u:p.u,v:p.v,side:p.side};
}

export function poolOf(n:{groupIndex:number},nodes:MeshNode[],state:RegionState):MeshNode[] {
  return n.groupIndex<0||!state.pools[n.groupIndex]?.length?nodes:state.pools[n.groupIndex];
}
