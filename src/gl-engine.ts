// @ts-nocheck
// Motor WebGL portado do laboratório visual (reweave-visual-lab/app.js).
// Mantido de propósito igual ao laboratório para que os visualizadores fiquem idênticos aos aprovados;
// por isso este arquivo não passa pelo verificador de tipos. A integração tipada está em brain-gl.ts.
export function createEngine(gl:WebGLRenderingContext,background:[number,number,number]=[28/255,28/255,28/255]){
  const vertex=`precision highp float;
attribute vec3 position;attribute vec3 color;attribute vec3 info;
uniform vec4 view;uniform vec4 camera;uniform float time;uniform float signal;uniform float pixelRatio;uniform float spread;uniform float tail;uniform float haze;uniform float cascade;uniform float cycle;uniform float hops;uniform float sgain;
varying vec3 tint;varying float opacity;varying float heat;
void main(){
 float cy=cos(view.x),sy=sin(view.x),cx=cos(view.y),sx=sin(view.y);
 vec3 p=vec3(position.x*cy+position.z*sy,position.y,-position.x*sy+position.z*cy);
 p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);
 float perspective=3.8/(3.8-p.z);
 gl_Position=vec4((p.xy*view.z*perspective+camera.xy)*vec2(camera.z,1.),0.,1.);
 float depth=clamp((p.z+1.5)/3.,0.,1.);
 float pulse=1.;
 if(signal>.5){float head=cascade>.5?mod(time-info.y,cycle)*info.z:fract(time*info.z*.5+info.y)*spread;if(hops>.5){float hq=head*hops;head=(floor(hq)+smoothstep(.15,.85,fract(hq)))/hops;}float behind=head-info.x;pulse=behind<0.?0.:exp(-behind*tail*(signal>2.5?4.5:signal>1.5?5.:14.));if(signal>5.5){float after=head-1.;pulse=after<0.?0.:exp(-after*3.2)*(1.+.22*sin(time*9.));}}
 heat=signal>.5?pulse:0.;
 opacity=(signal>.5 ? pulse*.85 : info.y)*mix(.32+.68*depth,pow(depth,2.2)*1.25+.05,signal>.5?haze*.3:haze);
 if(signal>.5)opacity*=sgain;
 tint=color;
 gl_PointSize=(signal>.5?sgain:1.)*(signal>5.5 ? 8.+54.*pulse : signal>4.5 ? 1.6+4.*pulse : signal>3.5 ? 5.+13.*pulse : signal>2.5 ? 1.6+4.5*pulse : signal>.5 ? 2.5+5.*pulse : info.x)*pixelRatio*perspective;
}`;
  const fragment=`precision highp float;varying vec3 tint;varying float opacity;varying float heat;uniform float dots;uniform float signal;
void main(){float a=opacity;vec3 c=tint;if(dots<.5&&signal>1.5){c=mix(tint,vec3(1.,.97,.9),heat*heat);}if(dots>.5){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float halo=exp(-r*r*5.);float core=exp(-r*r*65.);a*=halo;c=mix(tint,vec3(1.),core*(signal>5.5?1.:signal>2.5?.35:.9));if(signal>5.5)a*=1.5;else if(signal>4.5)a*=1.1;else if(signal>3.5)a*=.09;else if(signal>2.5)a*=.3;else if(signal>.5)a*=1.2;}gl_FragColor=vec4(c,a);}`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const attributes=['position','color','info'].map(n=>gl.getAttribLocation(program,n));
  const uniforms={};for(const n of ['view','camera','time','signal','dots','pixelRatio','spread','tail','haze','cascade','cycle','hops','sgain'])uniforms[n]=gl.getUniformLocation(program,n);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
  function add(array,p,c,a,b=0,d=0){array.push(p.x,p.y,p.z,c[0],c[1],c[2],a,b,d);}
  function buffer(data,mode){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return {b,count:data.length/9,mode};}
  function build(pt,tn,gap,axisZ,mesh,opt={}){
  const R=Object.assign({bundles:30,strands:7,layerStep:.085,pathPts:90,shellAlpha:1,branches:1,reach:1,motes:2400,moteDepth:.3,beadSteps:4,grayMix:0,signalTone:null,cells:0,cellGap:.2,cellR:.16,fissure:false,fiberAlpha:1,cellAlpha:.24,cellDots:.34,dotSize:1.7,cascade:false,cascades:10,cycle:14,depthMin:.55,depthSpan:.35,stagger:false,pathBase:.085,graph:false,graphNodes:300,graphGap:.14,graphReach:.32,graphK:3,callosal:.12,nodeDepth:.95,maxHops:6,dendrites:7,dendLen:1},opt),P=R.pathPts;
  const gray=[.6,.6,.6],lt=p=>{const c=tn(p);return c.map((v,i)=>v*(1-R.grayMix)+gray[i]*R.grayMix);},sg=R.signalTone||tn;
  function segmentL(array,a,b,alpha){add(array,a,lt(a),1,alpha);add(array,b,lt(b),1,alpha);}
  function segment(array,a,b,alpha){add(array,a,tn(a),1,alpha);add(array,b,tn(b),1,alpha);}
  const surface=[],nodes=[];
  if(!R.graph)for(const line of mesh.folds)for(let i=1;i<line.length;i++)segmentL(surface,line[i-1],line[i],.14*R.shellAlpha);
  if(!R.graph)for(const [a,b] of mesh.edges)segmentL(surface,mesh.nodes[a],mesh.nodes[b],.16*R.shellAlpha);
  if(!R.graph)for(const p of mesh.nodes)add(nodes,p,tn(p),3.2,.65);
  const cellDots=[];
  if(R.cells){
    // Cortical "cobblestone" web: irregular overlapping rings packed over the surface, with bright dots on the junctions.
    const cr=(()=>{let s=20261015;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();
    for(const side of [-1,1]){
      const seeds=[];
      for(let tries=0;tries<R.cells*9&&seeds.length<R.cells;tries++){
        const u=-1.45+cr()*2.9,v=.2+cr()*2.75;let ok=true;
        for(const s of seeds){const du=(u-s.u)*Math.max(.35,Math.sin((v+s.v)/2))*1.05,dv=(v-s.v)*.95;if(du*du+dv*dv<R.cellGap*R.cellGap){ok=false;break;}}
        if(ok)seeds.push({u,v,r:R.cellR*(.8+.5*cr()),ph:cr()*6.28});
      }
      for(const s of seeds){
        const sv=Math.max(.35,Math.sin(s.v)),ring=[];
        for(let k=0;k<=16;k++){
          const a=k/16*Math.PI*2,w=1+.28*Math.sin(3*a+s.ph)+.12*Math.sin(5*a+2*s.ph);
          ring.push(pt(Math.max(-1.53,Math.min(1.53,s.u+Math.cos(a)*s.r*w/sv)),Math.max(.13,Math.min(3.01,s.v+Math.sin(a)*s.r*w)),side));
        }
        for(let k=1;k<ring.length;k++)segmentL(surface,ring[k-1],ring[k],R.cellAlpha);
        for(let k=0;k<16;k++)if(cr()<R.cellDots){const p=ring[k],c=tn(p);add(cellDots,p,[c[0]*.4+.6,c[1]*.4+.6,c[2]*.4+.6],R.dotSize+cr()*1.1,.55+cr()*.35);if(cr()<.07)add(cellDots,p,c,14,.07);}
      }
    }
  }
  let G=null;
  if(R.graph&&!R.realGraph){
    // The lines ARE the connections: nodes on the cortex joined to their nearest neighbours (plus callosal links).
    const gr=(()=>{let s=77031;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();
    const gIn=(p,d)=>axisZ?({x:p.x*d,y:p.y*d,z:(p.z-Math.sign(p.z)*gap)*d+Math.sign(p.z)*gap}):({x:(p.x-Math.sign(p.x)*gap)*d+Math.sign(p.x)*gap,y:p.y*d,z:p.z*d});
    const nodesG=[];
    for(const side of [-1,1]){
      const seeds=[];
      for(let tries=0;tries<R.graphNodes*14&&seeds.length<R.graphNodes;tries++){
        const u=-1.45+gr()*2.9,v=.2+gr()*2.75;let ok=true;
        for(const s of seeds){const du=(u-s.u)*Math.max(.35,Math.sin((v+s.v)/2))*1.05,dv=(v-s.v)*.95;if(du*du+dv*dv<R.graphGap*R.graphGap){ok=false;break;}}
        if(ok)seeds.push({u,v,side});
      }
      for(const s of seeds){s.pos=gIn(pt(s.u,s.v,side),R.nodeDepth);nodesG.push(s);}
    }
    const dd=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2,edgesG=[],has=new Set();
    const addEdge=(i,j,path,callosal)=>{const key=i<j?i+'_'+j:j+'_'+i;if(has.has(key))return;has.add(key);let len=0;for(let k=1;k<path.length;k++)len+=Math.sqrt(dd(path[k-1],path[k]));edgesG.push({i,j,path,len,callosal});};
    nodesG.forEach((a,i)=>{
      const near=[];
      nodesG.forEach((b,j)=>{if(j!==i&&b.side===a.side){const d=dd(a.pos,b.pos);if(d<R.graphReach*R.graphReach)near.push({j,d});}});
      near.sort((x,y)=>x.d-y.d);
      for(const {j} of near.slice(0,R.graphK)){
        const b=nodesG[j],path=[];
        for(let k=0;k<=12;k++){const f=k/12;path.push(gIn(pt(a.u+(b.u-a.u)*f,a.v+(b.v-a.v)*f,a.side),R.nodeDepth));}
        addEdge(i,j,path,false);
      }
    });
    nodesG.forEach((a,i)=>{
      if(a.side!==-1||gr()>R.callosal)return;
      let best=-1,bd=1e9;
      nodesG.forEach((b,j)=>{if(b.side===1){const d=dd({x:a.pos.x,y:a.pos.y,z:-a.pos.z},b.pos);if(d<bd){bd=d;best=j;}}});
      if(best<0||bd>.09)return;
      const b=nodesG[best],lift=.08+gr()*.1,path=[];
      for(let k=0;k<=24;k++){const f=k/24;path.push({x:a.pos.x+(b.pos.x-a.pos.x)*f,y:a.pos.y+(b.pos.y-a.pos.y)*f+lift*Math.sin(f*Math.PI),z:a.pos.z+(b.pos.z-a.pos.z)*f});}
      addEdge(i,best,path,true);
    });
    if(R.ghostLines!==false){
      for(const e of edgesG)for(let k=1;k<e.path.length;k++)segmentL(surface,e.path[k-1],e.path[k],e.callosal?R.cellAlpha*.55:R.cellAlpha);
      for(const n of nodesG){const c=tn(n.pos);add(cellDots,n.pos,[c[0]*.4+.6,c[1]*.4+.6,c[2]*.4+.6],R.dotSize+gr()*1.1,.6);}
    }
    G={nodes:nodesG,edges:edgesG};
  }
  if(R.realGraph)G=R.realGraph;
  if(R.fissure){
    // Sylvian fissure drawn as a brighter line: best surface point per x-bin along y = -.10+.20(x+.35).
    for(const side of [-1,1]){
      const best=new Array(61).fill(null);
      for(let i=0;i<=200;i++)for(let j=0;j<=200;j++){
        const p=pt(-1.5+3*i/200,.1+2.9*j/200,side);
        if(Math.abs(p.x)>=.62||Math.abs(p.z)<.25)continue;
        const b=Math.round((p.x+.62)/1.24*60),e=Math.abs(p.y-(-.10+.20*(p.x+.35)));
        if(e<.03&&(!best[b]||e<best[b].e))best[b]={p,e};
      }
      const line=best.filter(Boolean).map(b=>b.p);
      for(let k=1;k<line.length;k++)segmentL(surface,line[k-1],line[k],.55);
    }
  }
  const shell=buffer(surface,gl.LINES),soma=buffer(nodes,gl.POINTS);
  // Interior fibers follow the approved folded parameterization at nested depths.
  // Seeded, coherent bundles and shared branch origins, not a spherical random cloud.
  let seed=3976387481;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const fibers=[],signals=[],trails=[],motes=[],beads=[],bursts=[],dend=[];let pathCount=0;
  for(const v of cellDots)motes.push(v);
  const inward=axisZ?(p,d)=>({x:p.x*d,y:p.y*d,z:(p.z-Math.sign(p.z)*gap)*d+Math.sign(p.z)*gap}):(p,d)=>({x:(p.x-Math.sign(p.x)*gap)*d+Math.sign(p.x)*gap,y:p.y*d,z:p.z*d});
  function emit(path,phase,speed,brightness,arc0=0,arc1=1,forceLive=false){
    const live=forceLive||!R.cascade;
    const arc=i=>arc0+(arc1-arc0)*i/(path.length-1);
    for(let i=1;i<path.length;i++)segment(fibers,path[i-1],path[i],brightness*R.fiberAlpha);
    if(!live){pathCount++;return;}
    for(let i=0;i<path.length;i++)add(signals,path[i],sg(path[i]),arc(i),phase,speed);
    // Same path again as a continuous glowing trail (lines), so each firing reads as one travelling impulse.
    for(let i=1;i<path.length;i++){
      add(trails,path[i-1],sg(path[i-1]),arc(i-1),phase,speed);
      add(trails,path[i],sg(path[i]),arc(i),phase,speed);
    }
    // Dense beads along the path: overlapping glow sprites read as a thick bright cable.
    for(let i=1;i<path.length;i++)for(let s=0;s<R.beadSteps;s++){
      const f=s/R.beadSteps,a=path[i-1],b=path[i],q={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f};
      add(beads,q,sg(q),arc(i-1)+(arc(i)-arc(i-1))*f,phase,speed);
    }
    pathCount++;
  }
  for(const side of [-1,1])for(let bundle=0;bundle<R.bundles;bundle++){
    const u0=-1.4+random()*2.8,v0=.25+random()*2.55;
    const du=(random()-.5)*1.5*R.reach,dv=(random()-.5)*1.7*R.reach;
    for(let strand=0;strand<R.strands;strand++){
      const layer=.32+strand*R.layerStep+random()*.025,offset=(strand-3)*.012;
      const path=[];
      for(let k=0;k<=P;k++){
        const t=k/P,arc=Math.sin(t*Math.PI);
        const u=Math.max(-1.53,Math.min(1.53,u0+du*t+arc*.16+offset));
        const v=Math.max(.13,Math.min(3.01,v0+dv*t+arc*.13+offset));
        const depth=layer+.05*Math.sin(t*Math.PI*2+bundle);
        path.push(inward(pt(u,v,side),depth));
      }
      const phase=random(),speed=.065+random()*.08;
      emit(path,phase,speed,.09+strand*.011);
      // Small bifurcations begin exactly on the parent and inherit its signal timing.
      if(strand%3<R.branches){
        const start=Math.round(P*(.45+.15*(strand%3))),s=start/P,parent=path[start],branch=[];
        for(let k=0;k<=36;k++){
          const t=k/36,u=Math.max(-1.53,Math.min(1.53,u0+du*s+offset+(du*(1-s)+(strand%2?.22:-.22))*t));
          const v=Math.max(.13,Math.min(3.01,v0+dv*s+offset+(dv*(1-s)+.28)*t));
          const target=inward(pt(u,v,side),layer);
          branch.push({x:parent.x+(target.x-parent.x)*t,y:parent.y+(target.y-parent.y)*t,z:parent.z+(target.z-parent.z)*t});
        }
        emit(branch,phase,speed,.07,s,1);
      }
    }
  }
  if(R.cascade){
    // Cascade: impulse runs along an axon, flashes at the terminal (synapse), then triggers the next fibres.
    // Callosal links join homologous points of the two hemispheres through the midline.
    const clampU=x=>Math.max(-1.5,Math.min(1.5,x)),clampV=x=>Math.max(.15,Math.min(3.0,x));
    const intra=(side,u,v,depth)=>{
      const du=(random()<.5?-1:1)*(.45+random()*.6),dv=(random()-.5)*1.3,path=[];
      for(let k=0;k<=46;k++){const t=k/46,arc=Math.sin(t*Math.PI);path.push(inward(pt(clampU(u+du*t+arc*.12),clampV(v+dv*t+arc*.10),side),depth+.012*Math.sin(t*6.28)));}
      return {type:'intra',path,end:{side,u:clampU(u+du),v:clampV(v+dv),depth}};
    };
    const callosal=(side,u,v,depth)=>{
      const u2=clampU(u+(random()-.5)*.25),v2=clampV(v+(random()-.5)*.25),d2=Math.max(R.depthMin,Math.min(R.depthMin+R.depthSpan,depth+(random()-.5)*.1));
      const A=inward(pt(u,v,side),depth),B=inward(pt(u2,v2,-side),d2),lift=.10+random()*.14,path=[];
      for(let k=0;k<=40;k++){const t=k/40;path.push({x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t+lift*Math.sin(t*Math.PI),z:A.z+(B.z-A.z)*t});}
      return {type:'callosal',path,end:{side:-side,u:u2,v:v2,depth:d2}};
    };
    const norm=v=>{const l=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/l,y:v.y/l,z:v.z/l};};
    const burstC=p=>tn(p).map(v=>Math.min(1,v*.8+.2));
    const gn=P=>norm({x:P.x/1.32,y:P.y/.85,z:P.z/.36});   // approximate outward normal of the ellipsoid-like cortex
    const tangentDir=P=>{const n=gn(P);let d=norm({x:random()-.5,y:random()-.5,z:random()-.5});const k=d.x*n.x+d.y*n.y+d.z*n.z;if(k>0)d=norm({x:d.x-n.x*k*1.15,y:d.y-n.y*k*1.15,z:d.z-n.z*k*1.15});return d;};
    function addNode(P,arrival){
      // Soma glow (always faintly visible) and dendrites that light up from the soma outward after the impulse arrives.
      const c=tn(P),hotC=c.map(v=>Math.min(1,v*.9+.1));add(motes,P,[c[0]*.5+.5,c[1]*.5+.5,c[2]*.5+.5],8+random()*3,.30);add(motes,P,c,22,.07);
      for(let d=0;d<R.dendrites;d++){
        const dir=tangentDir(P),pa=tangentDir(P),L=(.1+random()*.09)*R.dendLen,pts=[];
        for(let k=0;k<=5;k++){const s=k/5;pts.push({x:P.x+dir.x*L*s+pa.x*.35*L*s*s,y:P.y+dir.y*L*s+pa.y*.35*L*s*s,z:P.z+dir.z*L*s+pa.z*.35*L*s*s});}
        const fork=pts.slice(3),pb=norm({x:dir.x+(random()-.5)*1.4,y:dir.y+(random()-.5)*1.4,z:dir.z+(random()-.5)*1.4});
        for(let k=1;k<=2;k++){const s=k/2;fork.push({x:pts[3].x+pb.x*L*.4*s,y:pts[3].y+pb.y*L*.4*s,z:pts[3].z+pb.z*L*.4*s});}
        const lines=[[pts,0],[fork.slice(0,1).concat(fork.slice(3)),.6]];
        for(const [pl,a0] of lines)for(let k=1;k<pl.length;k++){
          const a=a0+(1-a0)*(k-1)/(pl.length-1),b=a0+(1-a0)*k/(pl.length-1);
          segment(fibers,pl[k-1],pl[k],.16);
          add(dend,pl[k-1],hotC,a,arrival,1/.8);add(dend,pl[k],hotC,b,arrival,1/.8);
        }
      }
    }
    function simulateGraph(){
      // Impulses only travel along real edges: a node that fires sends the signal down up to 3 of its connections,
      // each target fires when the impulse arrives, and the chain fades out after a few hops.
      const adj=G.nodes.map(()=>[]);
      G.edges.forEach((e,k)=>{adj[e.i].push({to:e.j,k,fwd:true});adj[e.j].push({to:e.i,k,fwd:false});});
      const sources=G.nodes.map((_,i)=>i).filter(i=>adj[i].length);
      if(!sources.length)return;
      for(let s=0;s<R.cascades;s++){
        const t0=.6+s*((R.cycle-12.5)/Math.max(1,R.cascades-1))+random()*.3,src=sources[Math.floor(random()*sources.length)],fired=new Set([src]),queue=[{n:src,t:t0,lvl:0}];
        addNode(G.nodes[src].pos,t0-.6);
        while(queue.length){
          queue.sort((a,b)=>a.t-b.t);const cur=queue.shift();
          if(cur.lvl>=R.maxHops)continue;
          const opts=adj[cur.n].filter(o=>!fired.has(o.to)).sort(()=>random()-.5),prob=cur.lvl===0?1:Math.max(.3,.85-.14*cur.lvl);
          let count=0;
          for(const o of opts){
            if(count>=3)break;if(random()>prob)continue;count++;
            const e=G.edges[o.k],path=o.fwd?e.path:e.path.slice().reverse(),dur=.45+e.len*(e.callosal?2.6:3.2),arr=cur.t+dur,end=path[path.length-1];
            emit(path,cur.t,1/dur,R.pathBase,0,1,true);
            add(bursts,end,burstC(end),1,cur.t,1/dur);
            addNode(end,arr);fired.add(o.to);queue.push({n:o.to,t:arr+.12,lvl:cur.lvl+1});
          }
        }
      }
    }
    function fire(f,start,level){
      const dur=f.type==='callosal'?1.0+random()*.5:1.2+random()*.9;
      emit(f.path,start,1/dur,R.pathBase,0,1,true);
      add(bursts,f.path[f.path.length-1],burstC(f.path[f.path.length-1]),1,start,1/dur);
      addNode(f.path[f.path.length-1],start+dur);if(level===0)addNode(f.path[0],start-.6);
      for(let k=0;k<f.path.length;k+=4)add(motes,f.path[k],tn(f.path[k]),2.8,.32);
      const e=f.end,next=start+dur+.1;
      if(f.type==='callosal'){if(level<3){fire(intra(e.side,e.u,e.v,e.depth),next,level+1);fire(intra(e.side,e.u,e.v,e.depth),next+.15,level+1);}}
      else if(level===0){fire(intra(e.side,e.u,e.v,e.depth),next,1);fire(callosal(e.side,e.u,e.v,e.depth),next+.1,1);}
      else if(level===1)fire(callosal(e.side,e.u,e.v,e.depth),next,2);
    }
    if(R.graph)simulateGraph();
    else for(let c=0;c<R.cascades;c++){
      const side=random()<.5?-1:1,depth=R.depthMin+random()*R.depthSpan,t0=R.stagger?.6+c*((R.cycle-10.5)/Math.max(1,R.cascades-1))+random()*.3:random()*(R.cycle-9.5);
      fire(intra(side,-1.2+random()*2.4,.6+random()*2,depth),t0,0);
    }
  }
  // Fine white motes scattered through the volume, plus a few large soft ones for depth.
  for(let k=0;k<R.motes;k++){
    const side=random()<.5?-1:1,p=inward(pt(-1.5+random()*3,.15+random()*2.85,side),R.moteDepth+random()*(1-R.moteDepth));
    const t=tn(p);add(motes,p,[t[0]*.45+.55,t[1]*.45+.55,t[2]*.45+.55],2.1+random()*1.2,.38+random()*.3);
  }
  // Out-of-focus bokeh: some inside the volume, some floating in front of it like a shallow depth of field.
  if(R.bokeh!==false)for(let k=0;k<26;k++){
    const a=random()*Math.PI*2,r=.5+random()*.7,p={x:Math.cos(a)*r*(axisZ?1.25:.8),y:Math.sin(a)*r*(axisZ?.8:1.05),z:1+random()*.6};
    add(motes,p,tn({x:p.x,y:p.y,z:p.z}),36+random()*34,.05);
  }
  if(R.bokeh!==false)for(let k=0;k<45;k++){
    const side=random()<.5?-1:1,p=inward(pt(-1.5+random()*3,.15+random()*2.85,side),.5+random()*.5);
    add(motes,p,tn(p),14+random()*10,.11);
  }
  const interior=buffer(fibers,gl.LINES),sparks=buffer(signals,gl.POINTS),glow=buffer(trails,gl.LINES),cable=buffer(beads,gl.POINTS),dust=buffer(motes,gl.POINTS);
  return {shell,soma,interior,sparks,glow,cable,dust,burst:buffer(bursts,gl.POINTS),dend:buffer(dend,gl.LINES)};
  }

  gl.clearColor(background[0],background[1],background[2],1);
  function drawBuffer(b,dots,signal){
    gl.bindBuffer(gl.ARRAY_BUFFER,b.b);
    for(let i=0;i<3;i++){gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],3,gl.FLOAT,false,36,i*12);}
    gl.uniform1f(uniforms.dots,dots);gl.uniform1f(uniforms.signal,signal);gl.drawArrays(b.mode,0,b.count);
  }
  function freeScene(scene){if(!scene)return;for(const k of Object.keys(scene)){const b=scene[k];if(b&&b.b)gl.deleteBuffer(b.b);}}
  function dispose(){gl.deleteProgram(program);}
  return {gl,add,buffer,build,drawBuffer,freeScene,dispose,uniforms};
}
