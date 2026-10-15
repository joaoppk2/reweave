import {Notice,setIcon,ToggleComponent} from 'obsidian';
import {BrainCanvas} from './brain-canvas';
import {BrainGL,type Renderer} from './brain-gl';
import {periodStart,normalize,type Period} from './data';
import {compileExpression} from './expression';
import type {BrainGraph,BrainNote} from './brain-data';
import type {ReweaveSettings,Visualizer} from './settings';
import type {ForceSettings} from './brain-forces';

export class BrainUI {
  private top:BrainCanvas;
  private gl:BrainGL|null=null;
  private canvas2d:HTMLCanvasElement;
  private glCanvas:HTMLCanvasElement;
  private caption:HTMLElement;
  private mode:Visualizer='top';
  private animating=false;
  private displayState={arrows:false,labelThreshold:2.5,nodeSize:1,linkWidth:1};
  private modeButtons:[Visualizer,HTMLButtonElement][]=[];
  private get renderer():Renderer{return this.mode!=='top'&&this.gl?this.gl:this.top;}
  private graph:BrainGraph|null=null;
  private list:HTMLElement;
  private status:HTMLElement;
  private regions:HTMLElement;
  private query='';
  private period:Period='all';
  private selected=-1;
  private tags=false;
  private attachments=false;
  private orphans=true;
  private connected=new Set<string>();
  private forceInputs=new Map<keyof ForceSettings,HTMLInputElement>();
  constructor(private host:HTMLElement,private choose:(n:BrainNote,restore:()=>void)=>void,private settings:ReweaveSettings,private save:()=>void,private hover:(n:BrainNote,event:PointerEvent)=>void=()=>{}){
    host.classList.add('reweave');
    const el=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;parent.append(n);return n;};
    const stage=el('section',host,'','reweave-stage'),canvas=el('canvas',stage);canvas.setAttribute('aria-label','Cérebro de notas e vínculos');
    this.canvas2d=canvas;this.glCanvas=el('canvas',stage);this.glCanvas.setAttribute('aria-label','Cérebro de notas e vínculos (visualizador 3D)');this.glCanvas.hidden=true;
    this.top=new BrainCanvas(canvas,choose,hover);
    this.caption=el('p',stage,'Arraste para mover · Clique com a roda e arraste para girar · Role a roda para aproximar','reweave-caption');
    const aside=el('aside',host),toggle=el('button',aside,'','clickable-icon reweave-panel-toggle'),body=el('div',aside);
    toggle.type='button';body.id='reweave-panel-'+crypto.randomUUID();toggle.setAttribute('aria-controls',body.id);
    const updateToggle=()=>{const label=body.hidden?'Abrir painel':'Recolher painel';toggle.setAttribute('aria-label',label);toggle.setAttribute('aria-expanded',String(!body.hidden));toggle.title=label;setIcon(toggle,body.hidden?'settings':'x');};
    updateToggle();toggle.onclick=()=>{body.hidden=!body.hidden;host.classList.toggle('reweave-collapsed',body.hidden);updateToggle();};
    const section=(name:string,open=false)=>{const d=el('details',body);d.open=open;el('summary',d,name);return el('div',d,'','reweave-section');};
    const visual=section('Visualizador',true);
    for(const [id,text] of [['top','Vista de cima'],['fibers','Anatômico (fibras)'],['network','Anatômico (rede)']] as const){const b=el('button',visual,text);b.type='button';b.setAttribute('aria-pressed',String(id==='top'));b.onclick=()=>this.setMode(id);this.modeButtons.push([id,b]);}
    el('small',visual,'Compare os visualizadores. Forças e texto das notas valem só na vista de cima. Em todos: role a roda para aproximar e clique com a roda e arraste para girar.');
    const groups=section('Grupos');this.regions=el('div',groups,'','reweave-regions');
    el('button',groups,'Ver tudo').onclick=()=>{this.selected=-1;this.renderer.selectRegion(-1);this.refresh();};
    el('h3',groups,'Grupos de cor');el('small',groups,'A primeira expressão correspondente define a cor. Salvo nas configurações do plugin.');
    const rules=el('div',groups);
    const addRule=(rule:{expression:string;color:string})=>{
      const row=el('div',rules,'','reweave-rule'),input=el('input',row),color=el('input',row),remove=el('button',row,'Remover'),error=el('small',row);
      input.value=rule.expression;input.placeholder='Expressão do grupo';input.setAttribute('aria-label','Expressão do grupo');color.type='color';color.value=rule.color;color.setAttribute('aria-label','Cor do grupo');
      input.oninput=()=>{try{compileExpression(input.value);rule.expression=input.value;error.textContent='';this.renderer.setColorRules(this.settings.colorRules);this.save();}catch(e){error.textContent=(e as Error).message;}};
      color.oninput=()=>{rule.color=color.value;this.renderer.setColorRules(this.settings.colorRules);this.save();};
      remove.onclick=()=>{this.settings.colorRules=this.settings.colorRules.filter(r=>r!==rule);row.remove();this.renderer.setColorRules(this.settings.colorRules);this.save();};
    };
    this.settings.colorRules.forEach(addRule);el('button',groups,'Adicionar grupo').onclick=()=>{const r={expression:'',color:'#999999'};this.settings.colorRules.push(r);addRule(r);this.save();};
    this.renderer.setColorRules(settings.colorRules);
    const filters=section('Filtros',true),search=el('input',filters);search.type='search';search.placeholder='Buscar nota';search.setAttribute('aria-label','Buscar nota');search.oninput=()=>{this.query=normalize(search.value.trim());this.refresh();};
    const period=el('select',filters);period.setAttribute('aria-label','Notas modificadas');for(const [value,text] of [['all','Todas as datas'],['today','Hoje'],['week','Esta semana']]){const o=el('option',period,text);o.value=value;}period.onchange=()=>{this.period=period.value as Period;this.refresh();};
    const check=(parent:HTMLElement,text:string,value:boolean,change:(v:boolean)=>void)=>{const row=el('div',parent,'','reweave-check');el('span',row,text);new ToggleComponent(row).setValue(value).setTooltip(text).onChange(change);};
    check(filters,'Etiquetas',false,v=>{this.tags=v;this.refresh();});check(filters,'Anexos',false,v=>{this.attachments=v;this.refresh();});check(filters,'Incluir órfãos',true,v=>{this.orphans=v;this.refresh();});
    el('small',filters,'Somente arquivos existentes nas pastas incluídas. Datas indicam modificação, não progresso.');
    const display=section('Tela'),animate=el('button',display,'Animar');animate.setAttribute('aria-pressed','false');this.animateButton=animate;animate.onclick=()=>{const active=this.renderer.toggleAnimation();this.animating=active;this.showAnimation();};
    el('small',display,'Sinapses ilustrativas, não atividade real. Pulsos de alterações continuam ativos.');
    el('button',display,'Vista inicial').onclick=()=>this.renderer.reset();el('button',display,'Aproximar').onclick=()=>this.renderer.zoom(1.25);el('button',display,'Afastar').onclick=()=>this.renderer.zoom(.8);
    check(display,'Setas dos vínculos',false,v=>this.setDisplay({arrows:v}));
    const slider=(parent:HTMLElement,text:string,min:number,max:number,step:number,value:number,change:(v:number)=>void)=>{const label=el('label',parent,text),output=el('output',label,String(value)),input=el('input',label);input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);input.setAttribute('aria-label',text);input.oninput=()=>{output.value=input.value;change(Number(input.value));};return input;};
    slider(display,'Texto a partir do zoom',.4,4.1,.1,2.5,v=>this.setDisplay({labelThreshold:v}));slider(display,'Tamanho dos nódulos',.5,2.5,.1,1,v=>this.setDisplay({nodeSize:v}));slider(display,'Grossura dos vínculos',.5,3,.1,1,v=>this.setDisplay({linkWidth:v}));
    const forces=section('Forças');el('small',forces,'Adaptação: notas permanecem na malha da própria região.');
    const force:ForceSettings={center:0,repel:0,link:0,distance:250};
    for(const [key,text,min,max,step,value] of [['center','Força central',0,1,.01,0],['repel','Repulsão',0,20,1,0],['link','Força dos vínculos',0,1,.01,0],['distance','Distância dos vínculos',30,500,10,250]] as const){const input=slider(forces,text,min,max,step,value,v=>{force[key]=v;this.renderer.setForces({...force});});this.forceInputs.set(key,input);}
    const updateForces=(v:ForceSettings)=>{Object.assign(force,v);for(const [key,input] of this.forceInputs){input.value=String(v[key]);input.dispatchEvent(new Event('input'));}};
    el('button',forces,'Usar valores do meu Obsidian').onclick=()=>updateForces(this.renderer.useObsidianForces());el('button',forces,'Posições originais').onclick=()=>updateForces({center:0,repel:0,link:0,distance:250});
    const notes=section('Notas');this.status=el('p',notes);this.status.setAttribute('role','status');this.list=el('div',notes,'','reweave-notes');
    this.renderer.setFilter(n=>this.matches(n));
    if(settings.mode!=='top')this.setMode(settings.mode);
  }
  private animateButton!:HTMLButtonElement;
  private showAnimation(){this.animateButton.textContent=this.animating?'Parar animação':'Animar';this.animateButton.setAttribute('aria-pressed',String(this.animating));}
  private setDisplay(settings:{arrows?:boolean;labelThreshold?:number;nodeSize?:number;linkWidth?:number}){Object.assign(this.displayState,settings);this.renderer.setDisplay(settings);}
  private setMode(requested:Visualizer){
    let mode=requested;
    if(mode!=='top'&&!this.gl){
      try{this.gl=new BrainGL(this.glCanvas,this.choose,this.hover,()=>{new Notice('O WebGL foi interrompido. Voltando para a vista de cima.');this.setMode('top');});}
      catch{new Notice('WebGL indisponível neste computador. Mantendo a vista de cima.');mode='top';}
    }
    this.mode=mode;this.settings.mode=mode;this.save();
    this.canvas2d.hidden=mode!=='top';this.glCanvas.hidden=mode==='top';
    if(this.gl&&mode!=='top')this.gl.setMode(mode);
    for(const [id,b] of this.modeButtons)b.setAttribute('aria-pressed',String(id===mode));
    this.caption.textContent='Arraste para mover · Clique com a roda e arraste para girar · Role a roda para aproximar';
    const r=this.renderer;
    r.setColorRules(this.settings.colorRules);r.setFilter(n=>this.matches(n));r.setDisplay(this.displayState);
    if(r.isAnimating()!==this.animating)r.toggleAnimation();
    this.showAnimation();
    if(this.graph)r.update(this.graph);
    r.selectRegion(this.selected);r.redraw();
  }
  private matches(n:BrainNote){return(n.type!=='tag'||this.tags)&&(n.type!=='attachment'||this.attachments)&&(this.orphans||this.connected.has(n.path))&&(this.selected<0||n.region===this.selected)&&normalize(n.title+' '+n.path).includes(this.query)&&(this.period==='all'||n.mtimeMs>=periodStart(this.period)&&n.mtimeMs<=Date.now());}
  update(graph:BrainGraph){this.graph=graph;this.connected=new Set(graph.edges.filter(([a,b])=>!a.startsWith('tag:')&&!b.startsWith('tag:')).flat());if(this.selected>=graph.groups.length)this.selected=-1;this.renderer.update(graph);this.regions.replaceChildren();graph.groups.forEach((r,i)=>{const b=document.createElement('button'),dot=document.createElement('i');dot.style.background=r.color||'var(--graph-node)';b.append(dot,document.createTextNode(r.name));b.setAttribute('aria-pressed',String(this.selected===i));b.onclick=()=>{this.selected=i;this.renderer.selectRegion(i);this.refresh();};this.regions.append(b);});this.refresh();}
  private refresh(){this.renderer.setFilter(n=>this.matches(n));this.list.replaceChildren();const notes=this.graph?.nodes.filter(n=>this.matches(n))??[];this.status.textContent=`${notes.length} itens encontrados`;for(const n of notes){const b=document.createElement('button');b.textContent=n.title;b.onclick=()=>this.choose(n,()=>{});this.list.append(b);}}
  redraw(){this.renderer.redraw();}
  destroy(){this.top.destroy();this.gl?.destroy();this.gl=null;this.host.replaceChildren();this.host.classList.remove('reweave','reweave-collapsed');}
}
