import { dist2, type MeshNode, type Vec3 } from './brain-geometry';
import { poolOf, type Positioned, type RegionState } from './brain-regions';

export interface ForceSettings { center:number; repel:number; link:number; distance:number; }
export const defaultForces:ForceSettings={center:0,repel:0,link:0,distance:250};

export function toBrainUnits(value:number,scale?:number):number {
  return scale&&Number.isFinite(scale)&&scale>0?value*scale/300:value/1000;
}

export function forceTargets<T extends Positioned&{path:string}>(list:T[],edges:[string,string][],nodes:MeshNode[],regions:RegionState,settings:ForceSettings,scale?:number):Vec3[] {
  const {center,repel,link}=settings,distance=toBrainUnits(settings.distance,scale);
  if(!center&&!repel&&!link)return list.map(n=>({...n.anchor}));
  const pos=list.map(n=>({...n.anchor})),index=new Map(list.map((n,i)=>[n.path,i]));
  const links:[number,number][]=[];
  for(const [a,b] of edges){const i=index.get(a),j=index.get(b);if(i!==undefined&&j!==undefined&&i!==j)links.push([i,j]);}
  for(let step=0;step<120;step++){
    const move=pos.map(()=>({x:0,y:0,z:0}));
    const add=(i:number,x:number,y:number,z:number,f:number)=>{move[i].x+=x*f;move[i].y+=y*f;move[i].z+=z*f;};
    list.forEach((n,i)=>{const c=regions.centers.get(poolOf(n,nodes,regions))!;add(i,c.x-pos[i].x,c.y-pos[i].y,c.z-pos[i].z,center*.02);});
    if(repel)for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++){
      const dx=pos[i].x-pos[j].x,dy=pos[i].y-pos[j].y,dz=pos[i].z-pos[j].z,d2=Math.max(4e-4,dx*dx+dy*dy+dz*dz),f=Math.min(.02,repel*2e-5/d2)/Math.sqrt(d2);
      add(i,dx,dy,dz,f);add(j,dx,dy,dz,-f);
    }
    if(link)for(const [a,b] of links){const dx=pos[b].x-pos[a].x,dy=pos[b].y-pos[a].y,dz=pos[b].z-pos[a].z,d=Math.max(1e-3,Math.hypot(dx,dy,dz)),f=(d-distance)*link*.05/d;add(a,dx,dy,dz,f);add(b,dx,dy,dz,-f);}
    pos.forEach((p,i)=>{const m=move[i],len=Math.hypot(m.x,m.y,m.z),k=len>.03?.03/len:1;p.x+=m.x*k;p.y+=m.y*k;p.z+=m.z*k;});
  }
  const used=new Set<MeshNode>();
  return list.map((n,i)=>{
    const pool=poolOf(n,nodes,regions);
    let best:MeshNode|undefined,bestD=Infinity;
    for(const p of pool){if(used.has(p))continue;const d=dist2(p,pos[i]);if(d<bestD){bestD=d;best=p;}}
    // Uma região cheia reutiliza o ponto mais próximo, sem deixar a nota fora da malha.
    if(!best)best=pool.reduce((a,b)=>dist2(a,pos[i])<=dist2(b,pos[i])?a:b);
    used.add(best);return {x:best.x,y:best.y,z:best.z};
  });
}
