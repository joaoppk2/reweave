import { makeMesh, bezierControls, bezierPoint, type Vec3, type Point2 } from './brain-geometry';
import { assignRegions, notePosition, type RegionState, type RegionInfo, type Positioned } from './brain-regions';
import { forceTargets, defaultForces, type ForceSettings } from './brain-forces';
import { emptyGraph, type BrainGraph, type BrainNote } from './brain-data';
import { compileExpression } from './expression';

type Note = BrainNote & Positioned;
type Projection = Point2 & { z:number };
type Camera = { angle:number; tilt:number; scale:number; panX:number; panY:number };
type Signal = { a:string; b:string; delay:number };
export class BrainCanvas {
  private readonly ctx:CanvasRenderingContext2D;
  private readonly mesh=makeMesh();
  private data:BrainGraph=emptyGraph();
  private state:RegionState=assignRegions(this.mesh.nodes,[]);
  private notes:Note[]=[];
  private visible:Note[]=[];
  private byPath=new Map<string,Note>();
  private colors=new Map<string,string>();
  private predicate:(n:BrainNote)=>boolean=()=>true;
  private rules:{ test:(n:BrainNote)=>boolean; color:string }[]=[];
  private baseline:Map<string,number>|null=null;
  private pulses=new Map<string,number>();
  private signals:Signal[]=[];
  private animation=false;
  private signalStart=0;
  private selected=-1;
  private chosen:string|null=null;
  private camera:Camera={angle:-.18,tilt:.1,scale:1,panX:0,panY:0};
  private width=0;
  private height=0;
  private frame=0;
  private destroyed=false;
  private time=0;
  private prev=0;
  private pointer:{id:number;x:number;y:number;startX:number;startY:number;moved:boolean}|null=null;
  private display={arrows:false,labelThreshold:2.5,nodeSize:1,linkWidth:1};
  private forces:ForceSettings={...defaultForces};
  private layout:{start:number;from:Vec3[];to:Vec3[]}|null=null;
  private readonly resizeObserver:ResizeObserver;
  private readonly themeObserver:MutationObserver;
  private readonly motion:MediaQueryList;
  private palette={node:'#999999',line:'#3f3f3f',tag:'#a8c373',attachment:'#999999',text:'#cccccc'};
  private readonly cleanups:(()=>void)[]=[];
  private readonly originalTouchAction:string;

  constructor(private readonly canvas:HTMLCanvasElement,private readonly choose:(n:BrainNote,restore:()=>void)=>void,private readonly hover:(n:BrainNote,event:PointerEvent)=>void=()=>{}) {
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Canvas 2D indisponível.');
    this.ctx=context;
    this.originalTouchAction=canvas.style.touchAction;
    canvas.style.touchAction='none';
    this.motion=canvas.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
    this.resizeObserver=new ResizeObserver(()=>{this.resize();this.redraw();});
    this.resizeObserver.observe(canvas);
    this.themeObserver=new MutationObserver(()=>{this.resolveColors();this.redraw();});
    for(let element:HTMLElement|null=canvas;element;element=element.parentElement)this.themeObserver.observe(element,{attributes:true,attributeFilter:['class','style']});
    this.listen('pointerdown',this.pointerDown);
    this.listen('pointermove',this.pointerMove);
    this.listen('pointerup',this.pointerUp);
    this.listen('pointercancel',this.pointerCancel);
    this.listen('lostpointercapture',this.pointerCancel);
    this.listen('wheel',this.wheel,{passive:false});
    this.listen('keydown',event=>{if(event.key==='Escape'){this.chosen=null;canvas.title='';this.redraw();}});
    this.resize();
    this.resolveColors();
    this.redraw();
  }
  get graph():BrainGraph{return this.data;}
  get regions():RegionInfo[]{return this.state.regions;}
  getRegions():RegionInfo[]{return this.state.regions;}

  update(graph:BrainGraph):void {
    if(this.destroyed)return;
    const previous=this.state.regions[this.selected];
    const now=performance.now(),next=new Map(graph.nodes.map(n=>[n.path,n.mtimeMs]));
    if(this.baseline)for(const [path,mtime] of next)if(this.baseline.get(path)!==mtime)this.pulses.set(path,now);
    for(const path of this.pulses.keys())if(!next.has(path))this.pulses.delete(path);
    this.baseline=next;
    this.data=graph;
    this.state=assignRegions(this.mesh.nodes,graph.groups);
    this.selected=previous?graph.groups.findIndex(r=>r.name===previous.name&&r.legacy===previous.legacy):-1;
    this.notes=graph.nodes.map(n=>notePosition(n,this.mesh.nodes,this.state));
    this.byPath=new Map(this.notes.map(n=>[n.path,n]));
    if(this.chosen&&!this.byPath.has(this.chosen))this.chosen=null;
    this.applyForces(false);
    this.cache();
    this.redraw();
  }
  setFilter(predicate:(n:BrainNote)=>boolean):void {this.predicate=predicate;this.cache();this.redraw();}
  setColorRules(rules:{expression:string;color:string}[]):void {
    this.rules=[];
    for(const rule of rules){if(!rule.expression.trim())continue;try{this.rules.push({test:compileExpression(rule.expression),color:rule.color});}catch{}}
    this.cache();this.redraw();
  }
  selectRegion(index:number):void {
    this.selected=Number.isInteger(index)&&this.state.regions[index]?index:-1;
    this.reset();
    if(this.selected>=0){
      const points=this.state.pools[this.selected].map(p=>this.project(p));
      if(points.length){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
        this.camera.scale=Math.max(1,Math.min(3,this.width*.75/Math.max(40,maxX-minX),this.height*.75/Math.max(40,maxY-minY)));
        this.camera.panX=(this.width/2-(minX+maxX)/2)*this.camera.scale;
        this.camera.panY=(this.height*.47-(minY+maxY)/2)*this.camera.scale;
      }
    }
    this.cache();this.redraw();
  }
  zoom(factor:number):void {if(Number.isFinite(factor)&&factor>0)this.camera.scale=Math.max(.4,Math.min(4,this.camera.scale*factor));this.redraw();}
  reset():void {this.camera={angle:-.18,tilt:.1,scale:1,panX:0,panY:0};this.redraw();}
  isAnimating():boolean {return this.animation;}
  toggleAnimation():boolean {this.animation=!this.animation;this.buildSignals();this.redraw();return this.animation;}
  setDisplay(settings:{arrows?:boolean;labelThreshold?:number;nodeSize?:number;linkWidth?:number}):void {
    if(settings.arrows!==undefined)this.display.arrows=settings.arrows;
    for(const key of ['labelThreshold','nodeSize','linkWidth'] as const){const v=settings[key];if(v!==undefined&&Number.isFinite(v)&&v>=0)this.display[key]=v;}
    this.redraw();
  }
  setForces(settings:ForceSettings):void {
    for(const key of ['center','repel','link','distance'] as const)if(Number.isFinite(settings[key]))this.forces[key]=Math.max(0,settings[key]);
    this.applyForces(true);this.redraw();
  }
  useObsidianForces():ForceSettings {
    const g=this.data.graphSettings;
    this.setForces({center:g.centerStrength??this.forces.center,repel:g.repelStrength??this.forces.repel,link:g.linkStrength??this.forces.link,distance:g.linkDistance??this.forces.distance});
    return {...this.forces};
  }
  redraw():void {if(!this.destroyed&&!this.frame)this.frame=requestAnimationFrame(this.draw);}
  destroy():void {
    if(this.destroyed)return;
    this.destroyed=true;cancelAnimationFrame(this.frame);this.frame=0;
    this.resizeObserver.disconnect();this.themeObserver.disconnect();
    for(const cleanup of this.cleanups)cleanup();
    if(this.pointer&&this.canvas.hasPointerCapture(this.pointer.id))this.canvas.releasePointerCapture(this.pointer.id);
    this.pointer=null;this.canvas.title='';this.canvas.style.touchAction=this.originalTouchAction;
    this.pulses.clear();this.signals=[];this.layout=null;
  }
  private listen<K extends keyof HTMLElementEventMap>(type:K,handler:(event:HTMLElementEventMap[K])=>void,options?:AddEventListenerOptions):void {
    this.canvas.addEventListener(type,handler,options);
    this.cleanups.push(()=>this.canvas.removeEventListener(type,handler,options));
  }
  private resize():void {
    const rect=this.canvas.getBoundingClientRect(),ratio=this.canvas.ownerDocument.defaultView?.devicePixelRatio||1;
    this.width=rect.width;this.height=rect.height;
    this.canvas.width=Math.round(rect.width*ratio);this.canvas.height=Math.round(rect.height*ratio);
    this.ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  private resolveColors():void {
    const style=this.canvas.ownerDocument.defaultView!.getComputedStyle(this.canvas);
    const read=(key:string,fallback:string)=>style.getPropertyValue(key).trim()||fallback;
    this.palette={node:read('--graph-node','#999999'),line:read('--graph-line','#3f3f3f'),tag:read('--graph-node-tag','#a8c373'),attachment:read('--graph-node-attachment','#999999'),text:read('--graph-text',read('--text-normal','#cccccc'))};
    this.cache();
  }
  private cache():void {
    this.visible=this.notes.filter(n=>(this.selected<0||n.groupIndex===this.selected)&&this.predicate(n));
    this.colors.clear();
    for(const n of this.notes){const fallback=n.colorVariable==='--graph-node-tag'?this.palette.tag:n.colorVariable==='--graph-node-attachment'?this.palette.attachment:n.colorVariable==='--graph-node'?this.palette.node:n.color||this.palette.node;
      this.colors.set(n.path,this.rules.find(r=>r.test(n))?.color||fallback);
    }
    this.buildSignals();
  }
  private buildSignals():void {
    this.signals=[];this.signalStart=performance.now();
    if(!this.animation)return;
    const visible=new Set(this.visible.map(n=>n.path)),links=this.data.edges.filter(([a,b])=>visible.has(a)&&visible.has(b));
    const adjacent=new Map<string,string[]>(),reached=new Map<string,number>();
    for(const [a,b] of links){if(!adjacent.has(a))adjacent.set(a,[]);if(!adjacent.has(b))adjacent.set(b,[]);adjacent.get(a)!.push(b);adjacent.get(b)!.push(a);}
    for(const root of adjacent.keys()){if(reached.has(root))continue;reached.set(root,0);const queue=[root];for(let i=0;i<queue.length;i++)for(const b of adjacent.get(queue[i])!){if(reached.has(b))continue;reached.set(b,reached.get(queue[i])!+1);queue.push(b);}}
    const max=Math.max(1,...reached.values());
    for(const [a,b] of links){const reverse=reached.get(a)!>reached.get(b)!;this.signals.push({a:reverse?b:a,b:reverse?a:b,delay:Math.min(reached.get(a)!,reached.get(b)!)/max*2800});}
  }
  private applyForces(animate:boolean):void {
    const to=forceTargets(this.notes,this.data.edges,this.mesh.nodes,this.state,this.forces,this.data.graphSettings.scale);
    if(animate&&!this.motion.matches)this.layout={start:performance.now(),from:this.notes.map(n=>({x:n.x,y:n.y,z:n.z})),to};
    else {this.notes.forEach((n,i)=>Object.assign(n,to[i]));this.layout=null;}
  }
  private project(p:Vec3):Projection {
    const {angle,tilt,scale,panX,panY}=this.camera;
    const x=p.x*Math.cos(angle)+p.z*Math.sin(angle);let z=-p.x*Math.sin(angle)+p.z*Math.cos(angle);
    const y=p.y*Math.cos(tilt)-z*Math.sin(tilt);z=p.y*Math.sin(tilt)+z*Math.cos(tilt);
    const s=scale*Math.min(this.width*.36,this.height*.39)*3.8/(3.8-z);
    return {x:this.width/2+panX+x*s,y:this.height*.47+panY-y*s,z};
  }
  private curve(a:Point2,b:Point2):void {this.ctx.bezierCurveTo(...bezierControls(a,b));}
  private circle(p:Point2,r:number):void {this.ctx.beginPath();this.ctx.arc(p.x,p.y,r,0,Math.PI*2);}
  private regionColor(group:number):string{return this.state.regions[group]?.color||this.palette.node;}
  private draw=(ts:number):void=>{
    this.frame=0;if(this.destroyed)return;
    this.time+=Math.min(50,ts-this.prev||16)*.001;this.prev=ts;
    const c=this.ctx,reduced=this.motion.matches;
    if(this.layout){const t=reduced?1:Math.min(1,(ts-this.layout.start)/700),e=t<.5?2*t*t:1-(-2*t+2)**2/2;
      this.notes.forEach((n,i)=>{const a=this.layout!.from[i],b=this.layout!.to[i];n.x=a.x+(b.x-a.x)*e;n.y=a.y+(b.y-a.y)*e;n.z=a.z+(b.z-a.z)*e;});if(t===1){this.notes.forEach((n,i)=>Object.assign(n,this.layout!.to[i]));this.layout=null;}}
    c.clearRect(0,0,this.width,this.height);
    const ps=this.mesh.nodes.map(p=>this.project(p));
    c.globalAlpha=1;c.lineWidth=.6;c.strokeStyle=this.palette.line;
    for(const line of this.mesh.folds){c.beginPath();line.forEach((p,i)=>{const q=this.project(p);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.stroke();}
    this.mesh.edges.forEach(([i,j],n)=>{const a=ps[i],b=ps[j],group=this.mesh.nodes[i].group,active=this.selected<0||group===this.selected;
      c.globalAlpha=active?.14:.025;c.strokeStyle=this.regionColor(group);c.beginPath();c.moveTo(a.x,a.y);this.curve(a,b);c.stroke();
      if(this.animation&&!reduced&&active&&n%4===0){const cycle=(this.time*.32+n*.618)%1;if(cycle<.3){const t=cycle/.3,q=bezierPoint(a,b,t),glow=Math.sin(t*Math.PI);c.fillStyle=this.regionColor(group);c.globalAlpha=.18*glow;this.circle(q,4);c.fill();c.globalAlpha=.85*glow;this.circle(q,1.5);c.fill();}}
    });
    ps.map((p,i)=>({...p,i})).sort((a,b)=>a.z-b.z).forEach(p=>{const n=this.mesh.nodes[p.i],active=this.selected<0||this.selected===n.group;c.globalAlpha=active?.28+(p.z+1)*.22:.055;c.fillStyle=this.regionColor(n.group);this.circle(p,active?1.2:.7);c.fill();});
    this.drawReal(ts,reduced);c.globalAlpha=1;c.shadowBlur=0;
    if(this.animation||this.pulses.size||this.layout)this.redraw();
  };
  private drawReal(now:number,reduced:boolean):void {
    const c=this.ctx,size=this.display.nodeSize,projected=new Map(this.visible.map(n=>[n.path,this.project(n)]));
    for(const [a,b] of this.data.edges){const p=projected.get(a),q=projected.get(b);if(!p||!q)continue;c.globalAlpha=.22;c.strokeStyle=this.colors.get(a)!;c.lineWidth=.8*this.display.linkWidth;c.beginPath();c.moveTo(p.x,p.y);this.curve(p,q);c.stroke();}
    if(this.display.arrows)for(const [a,b] of this.data.directedEdges){const p=projected.get(a),q=projected.get(b);if(!p||!q)continue;const dx=q.x-p.x,dy=q.y-p.y,theta=Math.atan2(dy*.3+dx*.12,dx*.3-dy*.12),x=q.x-Math.cos(theta)*4*size,y=q.y-Math.sin(theta)*4*size;
      c.globalAlpha=.8;c.fillStyle=this.colors.get(a)!;c.beginPath();c.moveTo(x,y);c.lineTo(x-7*Math.cos(theta-.45),y-7*Math.sin(theta-.45));c.lineTo(x-7*Math.cos(theta+.45),y-7*Math.sin(theta+.45));c.closePath();c.fill();}
    for(const [path,start] of this.pulses)if(now-start>=4000)this.pulses.delete(path);
    for(const n of this.visible){const p=projected.get(n.path)!,color=this.colors.get(n.path)!;c.globalAlpha=1;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=7;this.circle(p,(n.path===this.chosen?6:3.4)*size);c.fill();c.shadowBlur=0;
      if(this.camera.scale>=this.display.labelThreshold){c.font='12px Segoe UI, sans-serif';c.fillStyle=this.palette.text;c.fillText(n.title,p.x+6*size,p.y-6*size);}
      const start=this.pulses.get(n.path);if(start!==undefined){const age=(now-start)/1000;c.globalAlpha=1-age/4;c.strokeStyle=color;c.lineWidth=1;this.circle(p,(reduced?9:5+age*10)*size);c.stroke();}
    }
    const elapsed=(now-this.signalStart)%4200;
    for(const signal of this.signals){const t=(elapsed-signal.delay)/900,p=projected.get(signal.a),q=projected.get(signal.b);if(t<0||t>1.4||!p||!q)continue;const color=this.colors.get(signal.b)!;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=reduced?0:14;
      if(t<=1&&!reduced){c.globalAlpha=.9;this.circle(bezierPoint(p,q,t),2.8*size);c.fill();}
      if(t>=1){c.globalAlpha=Math.max(0,1-(t-1)/.4)*(reduced?.35:1);this.circle(q,7*size);c.fill();}
    }
  }
  private hit(x:number,y:number):Note|undefined {
    return this.visible.map(n=>({n,p:this.project(n)})).filter(a=>Math.hypot(a.p.x-x,a.p.y-y)<Math.max(12,6*this.display.nodeSize)).sort((a,b)=>b.p.z-a.p.z)[0]?.n;
  }
  private pointerDown=(event:PointerEvent):void=>{
    if(this.pointer||event.button!==0)return;
    this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
    this.canvas.setPointerCapture(event.pointerId);
  };
  private pointerMove=(event:PointerEvent):void=>{
    const p=this.pointer;
    if(p){if(p.id!==event.pointerId)return;const dx=event.clientX-p.x,dy=event.clientY-p.y;
      if(Math.hypot(event.clientX-p.startX,event.clientY-p.startY)>6)p.moved=true;
      if(event.shiftKey){this.camera.angle+=dx*.007;this.camera.tilt=Math.max(-1,Math.min(1,this.camera.tilt+dy*.005));}else{this.camera.panX+=dx;this.camera.panY+=dy;}
      p.x=event.clientX;p.y=event.clientY;this.canvas.title='';this.redraw();
    }else{const rect=this.canvas.getBoundingClientRect(),note=this.hit(event.clientX-rect.left,event.clientY-rect.top);this.canvas.title='';if(note&&note.type!=='tag')this.hover(note,event);}
  };
  private pointerUp=(event:PointerEvent):void=>{
    const start=this.pointer;if(!start||start.id!==event.pointerId)return;
    this.pointer=null;if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
    if(start.moved||Math.hypot(event.clientX-start.startX,event.clientY-start.startY)>6)return;
    const rect=this.canvas.getBoundingClientRect(),note=this.hit(event.clientX-rect.left,event.clientY-rect.top);if(!note)return;
    this.choose(note,()=>{});
  };
  private pointerCancel=(event:PointerEvent):void=>{if(this.pointer?.id===event.pointerId){this.pointer=null;if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);}this.canvas.title='';};
  private wheel=(event:WheelEvent):void=>{event.preventDefault();this.zoom(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.002));};
}
