import { makeGeometry, notePosition, project, initialCamera, region, hash, defaultRegions, type Region, type Camera, type Vec3 } from './geometry';
import type { Graph, Note } from './data';
/** Shared, demand-rendered canvas. No background animation or vault access. */
export class BrainRenderer {
  camera:Camera=initialCamera();
  activeRegion=-1;
  regions:Region[]=defaultRegions.map(r=>({...r}));
  snapshot():Camera{return {...this.camera};}
  restore(camera:Camera){this.camera={...camera};this.selected='';this.draw();}
  frameRegion(group:number){this.activeRegion=group;this.camera=initialCamera();if(group<0){this.draw();return;}const points=this.geometry.points.filter(p=>region(p)===group).map(p=>project(p,this.camera,this.width,this.height));if(!points.length)return;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);this.camera.zoom=Math.max(1,Math.min(3,this.width*.75/Math.max(40,maxX-minX),this.height*.75/Math.max(40,maxY-minY)));this.camera.panX=(this.width/2-(minX+maxX)/2)*this.camera.zoom;this.camera.panY=(this.height/2-(minY+maxY)/2)*this.camera.zoom;this.draw();}
  private geometry=makeGeometry(); private graph:Graph={notes:[],edges:[]};
  private visible=new Set<string>(); private selected=''; private width=0;private height=0;
  private cleanups:(()=>void)[]=[];private observer:ResizeObserver;
  private drag:{x:number;y:number;startX:number;startY:number;moved:boolean}|null=null;
  private projected=new Map<string,Vec3>();
  constructor(private canvas:HTMLCanvasElement,private choose:(note:Note)=>void) {
    const on=<K extends keyof HTMLElementEventMap>(type:K,fn:(event:HTMLElementEventMap[K])=>void,options?:AddEventListenerOptions)=> {
      canvas.addEventListener(type,fn,options);this.cleanups.push(()=>canvas.removeEventListener(type,fn,options));
    };
    on('wheel',e=>{e.preventDefault();this.zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.002));},{passive:false});
    on('pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
    on('pointermove',e=>{
      const d=this.drag;
      if(d){const dx=e.clientX-d.x,dy=e.clientY-d.y;d.moved ||= Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>6;
        if(!e.shiftKey){this.camera.panX+=dx;this.camera.panY+=dy;}else{this.camera.yaw+=dx*.007;this.camera.pitch=Math.max(-1.4,Math.min(1.4,this.camera.pitch+dy*.005));}
        d.x=e.clientX;d.y=e.clientY;this.draw();
      } else {canvas.title=this.hit(e.clientX,e.clientY)?.title??'';}
    });
    on('pointerup',e=>{const click=this.drag&&!this.drag.moved;this.drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(click){const n=this.hit(e.clientX,e.clientY);if(n)this.choose(n);}});
    on('pointercancel',()=>{this.drag=null;});on('lostpointercapture',()=>{this.drag=null;});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  }
  setData(graph:Graph,visible:Note[]){this.graph=graph;this.visible=new Set(visible.map(n=>n.path));this.draw();}
  zoom(f:number){this.camera.zoom=Math.max(.4,Math.min(4,this.camera.zoom*f));this.draw();}
  reset(){this.camera=initialCamera();this.selected='';this.draw();}
  focus(note:Note){this.selected=note.path;this.camera.zoom=Math.max(2,this.camera.zoom);this.camera.panX=this.camera.panY=0;const p=project(notePosition(note.path,note.group),this.camera,this.width,this.height);this.camera.panX=this.width/2-p.x;this.camera.panY=this.height/2-p.y;this.draw();}
  private hit(x:number,y:number):Note|undefined {
    const r=this.canvas.getBoundingClientRect();return this.graph.notes.filter(n=>this.visible.has(n.path)).map(n=>({n,p:this.projected.get(n.path)!})).filter(({p})=>p&&Math.hypot(p.x-x+r.left,p.y-y+r.top)<12).sort((a,b)=>b.p.z-a.p.z)[0]?.n;
  }
  private resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;const dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.draw();}
  draw(){
    const ctx=this.canvas.getContext('2d');if(!ctx||!this.width||!this.height)return;
    const css=getComputedStyle(this.canvas),ink=css.getPropertyValue('--text-normal').trim()||'#ddd',accent=css.getPropertyValue('--interactive-accent').trim()||'#8b9dff';
    const dpr=Math.min(window.devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
    const p=(v:Vec3)=>project(v,this.camera,this.width,this.height);
    ctx.strokeStyle=ink;ctx.lineWidth=.55;ctx.globalAlpha=.17;
    for(const line of this.geometry.lines){ctx.beginPath();line.forEach((v,i)=>{const q=p(v);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();}
    const curve=(a:Vec3,b:Vec3)=>{const dx=b.x-a.x,dy=b.y-a.y;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(a.x+dx*.3-dy*.16,a.y+dy*.3+dx*.16,a.x+dx*.7+dy*.12,a.y+dy*.7-dx*.12,b.x,b.y);ctx.stroke();};
    const ps=this.geometry.points.map(p);ctx.lineWidth=.6;
    for(const [i,j] of this.geometry.edges){const g=region(this.geometry.points[i]),active=this.activeRegion<0||g===this.activeRegion;ctx.globalAlpha=active?.14:.025;ctx.strokeStyle=this.regions[g].color;curve(ps[i],ps[j]);}
    ps.map((q,i)=>({q,i})).sort((a,b)=>a.q.z-b.q.z).forEach(({q,i})=>{const g=region(this.geometry.points[i]),active=this.activeRegion<0||g===this.activeRegion;ctx.globalAlpha=active?Math.max(.15,.28+(q.z+1)*.22):.055;ctx.fillStyle=this.regions[g].color;ctx.beginPath();ctx.arc(q.x,q.y,active?1.2:.7,0,Math.PI*2);ctx.fill();});
    this.projected=new Map(this.graph.notes.map(n=>[n.path,p(notePosition(n.path,n.group))]));
    const byPath=new Map(this.graph.notes.map(n=>[n.path,n]));ctx.lineWidth=.8;
    for(const [a,b]of this.graph.edges){const x=this.projected.get(a),y=this.projected.get(b);if(!x||!y)continue;ctx.globalAlpha=this.visible.has(a)&&this.visible.has(b)?.22:.025;ctx.strokeStyle=this.regions[hash(byPath.get(a)!.group)%7].color;curve(x,y);}
    for(const {n,q} of this.graph.notes.map(n=>({n,q:this.projected.get(n.path)!})).sort((a,b)=>a.q.z-b.q.z)){
      const active=this.visible.has(n.path),color=this.regions[hash(n.group)%7].color;ctx.globalAlpha=active?1:.12;ctx.shadowColor=color;ctx.shadowBlur=active?7:0;ctx.fillStyle=color;ctx.beginPath();ctx.arc(q.x,q.y,n.path===this.selected?6:active?3.4:2,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  destroy(){this.observer.disconnect();this.cleanups.forEach(fn=>fn());this.cleanups=[];this.projected.clear();}
}
