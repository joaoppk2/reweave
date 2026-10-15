import {filterNotes,type Filter,type Graph,type Note,type Period} from './data';
import {defaultRegions,hash,type Region} from './geometry';
import {BrainRenderer} from './render';
export class BrainUI {
  private renderer:BrainRenderer;private filter:Filter={query:'',group:'',period:'all'};private active=-1;
  private graph:Graph={notes:[],edges:[]};private list:HTMLElement;private status:HTMLElement;private preview:HTMLElement;private chosen:Note|null=null;
  private buttons:HTMLButtonElement[]=[];private title:HTMLElement;private detail:HTMLElement;private cleanups:(()=>void)[]=[];
  constructor(private host:HTMLElement,choose:(n:Note,restore:()=>void)=>void,private regions:Region[]=defaultRegions){
    host.classList.add('reweave');
    const el=<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,text='',cls='')=>{const node=document.createElement(tag);node.textContent=text;node.className=cls;parent.append(node);return node;};
    const stage=el('section',host,'','reweave-stage'),aside=el('aside',host,'','reweave-aside');el('h2',stage,'Reweave');
    const canvas=el('canvas',stage);canvas.setAttribute('aria-label','Cérebro lateral 3D de fios. Notas acessíveis na lista.');
    const controls=el('div',stage,'','reweave-controls');el('p',stage,'Arraste para mover · Shift + arraste para girar · Role para aproximar','reweave-caption');
    const select=(n:Note)=>{const camera=this.renderer.snapshot();this.chosen=n;this.showPreview(select);this.renderer.focus(n);choose(n,()=>this.renderer.restore(camera));};
    this.renderer=new BrainRenderer(canvas,select);this.renderer.regions=regions;
    for(const [label,action]of [['Aproximar',()=>this.renderer.zoom(1.25)],['Afastar',()=>this.renderer.zoom(.8)],['Vista inicial',()=>this.renderer.reset()]] as const)el('button',controls,label).onclick=action;
    el('h3',aside,'Regiões');const regional=el('nav',aside,'','reweave-regions');
    this.title=el('h3',aside,'Todas as regiões');this.detail=el('p',aside,'Selecione uma nota abaixo para abrir no Obsidian.');
    const apply=(i:number)=>{this.active=i;this.renderer.frameRegion(i);this.title.textContent=i<0?'Todas as regiões':regions[i].name;this.detail.textContent=i<0?'Selecione uma nota abaixo para abrir no Obsidian.':regions[i].detail;this.buttons.forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));this.render(select);};
    regions.forEach((r,i)=>{const b=el('button',regional);const dot=el('i',b);dot.style.background=r.color;el('span',b,r.name);b.setAttribute('aria-pressed','false');b.onclick=()=>apply(i);this.buttons.push(b);});el('button',aside,'Ver tudo').onclick=()=>apply(-1);
    const search=el('input',aside);search.type='search';search.placeholder='Buscar notas';search.setAttribute('aria-label','Buscar notas');search.oninput=()=>{this.filter.query=search.value;this.render(select);};
    const period=el('select',aside);period.setAttribute('aria-label','Atividade');for(const [value,text]of [['all','Todo o período'],['today','Hoje'],['week','Esta semana']]){const option=el('option',period,text);option.value=value;}period.onchange=()=>{this.filter.period=period.value as Period;this.render(select);};
    this.status=el('p',aside);this.status.setAttribute('role','status');this.list=el('div',aside,'','reweave-notes');this.preview=el('section',aside,'','reweave-preview');this.preview.hidden=true;
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){this.chosen=null;this.showPreview(select);}};host.addEventListener('keydown',escape);this.cleanups.push(()=>host.removeEventListener('keydown',escape));
    this.update=graph=>{this.graph=graph;if(this.chosen&&!graph.notes.some(n=>n.path===this.chosen!.path))this.chosen=null;this.render(select);};
  }
  update:(graph:Graph)=>void=()=>{};
  private render(choose:(n:Note)=>void){const notes=filterNotes(this.graph.notes,this.filter).filter(n=>this.active<0||hash(n.group)%7===this.active);this.renderer.setData(this.graph,notes);this.status.textContent=`${notes.length} de ${this.graph.notes.length} notas · ${this.graph.edges.length} vínculos`;this.list.replaceChildren();for(const n of notes){const b=document.createElement('button');b.textContent=n.title;b.title=n.path;b.setAttribute('aria-pressed',String(this.chosen?.path===n.path));b.onclick=()=>choose(n);b.onfocus=()=>{this.chosen=n;this.showPreview(choose);};this.list.append(b);}if(!notes.length)this.list.textContent='Nenhuma nota encontrada.';this.showPreview(choose);}
  private showPreview(choose:(n:Note)=>void){this.preview.replaceChildren();this.preview.hidden=!this.chosen;if(!this.chosen)return;const n=this.chosen;for(const text of [n.title,n.path,'Modificada em '+new Date(n.mtime).toLocaleString()]){const p=document.createElement('p');p.textContent=text;this.preview.append(p);}const open=document.createElement('button');open.textContent='Abrir nota';open.onclick=()=>choose(n);const close=document.createElement('button');close.textContent='Fechar prévia';close.onclick=()=>{this.chosen=null;this.showPreview(choose);};this.preview.append(open,close);}
  redraw(){this.renderer.draw();}
  destroy(){this.renderer.destroy();this.cleanups.forEach(fn=>fn());this.host.replaceChildren();}
}
