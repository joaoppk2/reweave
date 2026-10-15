export interface Vec3 { x:number; y:number; z:number; }
export interface MeshNode extends Vec3 { legacy:number; group:number; u:number; v:number; side:number; }
export interface Mesh { nodes:MeshNode[]; edges:[number,number][]; folds:Vec3[][]; }

// Formato do cérebro visto de cima: superfície paramétrica fixa e malha determinística (semente 71).
export function point(u:number,v:number,side:number):Vec3 {
  const sv=Math.sin(v),cv=Math.cos(v);
  const fold=1+.035*Math.sin(19*u+3*Math.sin(5*v))+.025*Math.cos(23*v+4*Math.sin(6*u));
  let x=side*(.095+.70*Math.pow(Math.abs(Math.cos(u)),.8)*sv)*fold,y=1.02*cv*fold,z=.91*Math.sin(u)*sv*fold;
  if(y<-.55){z-=.08;x*=.88;}
  return {x,y,z};
}

export function region(p:Vec3):number {
  if(p.y<-.63)return 6;
  if(p.z<-.27)return p.x<0?1:2;
  if(p.y>.40)return p.x<0?0:3;
  if(p.z>.35)return p.x<0?4:5;
  return p.x<0?0:5;
}

export function makeMesh(pt:(u:number,v:number,side:number)=>Vec3=point,nU=24,nV=17):Mesh {
  let seed=71;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const nodes:MeshNode[]=[],edges:[number,number][]=[],folds:Vec3[][]=[];
  for(const side of [-1,1]){
    for(let k=0;k<700;k++){
      const u=-Math.PI/2+rand()*Math.PI,v=.12+rand()*(Math.PI-.24),p=pt(u,v,side);
      rand(); // sorteio descartado de propósito: manter a mesma sequência preserva as posições dos pontos
      nodes.push({...p,legacy:region(p),group:-1,u,v,side});
    }
    for(let j=0;j<nU;j++){const line:Vec3[]=[];for(let k=0;k<65;k++){const u=-Math.PI/2+k/64*Math.PI,v=.16+j/(nU-1)*(Math.PI-.32)+.045*Math.sin(u*7+j);line.push(pt(u,v,side));}folds.push(line);}
    for(let j=0;j<nV;j++){const line:Vec3[]=[];for(let k=0;k<65;k++){const v=.12+k/64*(Math.PI-.24),u=-1.5+j/(nV-1)*3+.06*Math.sin(v*9+j);line.push(pt(u,v,side));}folds.push(line);}
  }
  for(let i=0;i<nodes.length;i++){
    const closest:{j:number;d:number}[]=[];
    for(let j=i+1;j<nodes.length;j++){const d=dist2(nodes[i],nodes[j]);if(d<.035)closest.push({j,d});}
    closest.sort((a,b)=>a.d-b.d);
    for(const e of closest.slice(0,2))edges.push([i,e.j]);
  }
  return {nodes,edges,folds};
}

export function hash(s:string):number {let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function dist2(a:Vec3,b:Vec3):number {return (a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;}
export function centroid(pool:Vec3[]):Vec3 {const c={x:0,y:0,z:0};for(const p of pool){c.x+=p.x/pool.length;c.y+=p.y/pool.length;c.z+=p.z/pool.length;}return c;}

export interface Point2 { x:number; y:number; }
export function bezierControls(a:Point2,b:Point2):[number,number,number,number,number,number] {
  const dx=b.x-a.x,dy=b.y-a.y;
  return [a.x+dx*.3-dy*.16,a.y+dy*.3+dx*.16,a.x+dx*.7+dy*.12,a.y+dy*.7-dx*.12,b.x,b.y];
}
export function bezierPoint(a:Point2,b:Point2,t:number):Point2 {
  const [c1x,c1y,c2x,c2y]=bezierControls(a,b),u=1-t;
  return {x:u*u*u*a.x+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*b.y};
}

// Formatos anatômicos (visão lateral). Usam o mesmo (u,v,side) de point(): cada ponto do cérebro visto de cima
// tem um ponto correspondente aqui, então regiões e notas ficam nos mesmos lugares ao trocar de visualizador.
export function anatomicalPoint(u:number,v:number,side:number):Vec3 {
  const sv=Math.sin(v),cv=Math.cos(v);
  const fold=1+.05*Math.sin(17*u+3*Math.sin(5*v))+.035*Math.cos(21*v+4*Math.sin(6*u));
  const x=1.15*Math.sin(u)*sv;let y=.92*cv,z=side*(.07+.52*Math.pow(Math.abs(Math.cos(u)),.8)*sv);
  if(y<0){
    const cap=.40+.32*Math.exp(-Math.pow((x+.02)/.48,2))+.30*Math.exp(-Math.pow((x-.78)/.28,2));
    y*=cap/.92;
    z*=1+.10*Math.exp(-Math.pow((x+.02)/.5,2));
  }
  if(x<-.5){const t=(-.5-x)/.65;z*=1-.22*t*t;y*=1-.10*t*t;}
  const sylvian=Math.exp(-Math.pow((y-(-.10+.20*(x+.35)))/.06,2))*Math.max(0,Math.min(1,(x+.7)/.3))*Math.max(0,Math.min(1,(.7-x)/.3));
  const central=Math.exp(-Math.pow((x-.12-.18*y)/.045,2))*Math.max(0,Math.min(1,(y+.1)/.25));
  z*=1-.16*sylvian-.08*central;
  return {x:x*fold,y:y*fold,z:z*fold};
}
export function anatomicalPoint2(u:number,v:number,side:number):Vec3 {
  const sv=Math.sin(v),cv=Math.cos(v);
  const fold=1+.02*Math.sin(17*u+3*Math.sin(5*v))+.014*Math.cos(21*v+4*Math.sin(6*u));
  const x=1.15*Math.sin(u)*sv;let y=.92*cv,z=side*(.07+.52*Math.pow(Math.abs(Math.cos(u)),.8)*sv);
  if(y<0){
    const temporal=Math.exp(-Math.pow((x+.05)/.46,2)),cere=Math.exp(-Math.pow((x-.80)/.26,2)),stem=Math.exp(-Math.pow((x-.42)/.10,2));
    y*=(.40+.42*temporal+.30*cere+.22*stem)/.92;
    z*=1+.26*temporal-.55*stem*Math.min(1,-y/.45);
  }
  if(x<-.5){const t=(-.5-x)/.65;z*=1-.22*t*t;y*=1-.10*t*t;}
  const sylvian=Math.exp(-Math.pow((y-(-.10+.20*(x+.35)))/.06,2))*Math.max(0,Math.min(1,(x+.7)/.3))*Math.max(0,Math.min(1,(.7-x)/.3));
  const central=Math.exp(-Math.pow((x-.12-.18*y)/.045,2))*Math.max(0,Math.min(1,(y+.1)/.25));
  z*=1-.28*sylvian-.10*central;
  return {x:x*fold,y:y*fold,z:z*fold};
}
// Aproxima o ponto anatômico pelo ponto equivalente da vista de cima, para reaproveitar region() e as cores das regiões.
export function topEquivalent(p:Vec3):Vec3 { return {x:p.z<0?-1:1,y:p.y/.92*1.02,z:p.x*.791}; }
