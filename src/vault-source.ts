import { App, getAllTags } from 'obsidian';
import { derivedName, matchesGroupQuery } from './expression';
import { fillLegacy, type RegionInfo } from './brain-regions';
import { emptyGraph, type BrainGraph, type BrainNote, type GraphSettings } from './brain-data';
import { inFolders, type ReweaveSettings } from './settings';

interface RawGroup { query:string; rgb:number|null; }
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

export async function readGraphConfig(app:App):Promise<{groups:RawGroup[];forces:GraphSettings}> {
  const path=app.vault.configDir+'/graph.json';
  if(!await app.vault.adapter.exists(path))return {groups:[],forces:{}};
  let value:unknown;
  try{value=JSON.parse(await app.vault.adapter.read(path));}catch{return {groups:[],forces:{}};}
  const raw=object(value),groups:RawGroup[]=[];
  if(Array.isArray(raw.colorGroups))for(const value of raw.colorGroups){
    const g=object(value),rgb=object(g.color).rgb;
    if(typeof g.query!=='string')continue;
    groups.push({query:g.query,rgb:typeof rgb==='number'&&Number.isInteger(rgb)&&rgb>=0&&rgb<=0xffffff?rgb:null});
  }
  const forces:GraphSettings={};
  for(const k of ['centerStrength','repelStrength','linkStrength','linkDistance','scale'] as const){const v=raw[k];if(typeof v==='number'&&Number.isFinite(v))forces[k]=v;}
  return {groups,forces};
}

export async function readVault(app:App,settings:ReweaveSettings):Promise<BrainGraph> {
  const {groups,forces}=await readGraphConfig(app);
  const graph=emptyGraph();graph.graphSettings=forces;
  const regions:RegionInfo[]=groups.map((g,i)=>{
    const color=g.rgb===null?'':`#${g.rgb.toString(16).padStart(6,'0')}`;
    const override=settings.regions[g.query];
    return {name:override?.name||derivedName(g.query),color,text:override?.text||'',legacy:override?.legacy??null,notes:0};
  });
  graph.groups=fillLegacy(regions);
  const files=app.vault.getFiles().filter(f=>inFolders(f.path,settings.folders));
  for(const file of files){
    const markdown=file.extension==='md',cache=markdown?app.metadataCache.getFileCache(file):null;
    const n:BrainNote={path:file.path,title:file.basename,mtimeMs:file.stat.mtime,region:-1,type:markdown?'note':'attachment',
      color:'',colorVariable:markdown?'--graph-node':'--graph-node-attachment',tags:(cache?getAllTags(cache):null)?.map(t=>t.replace(/^#/,'').normalize('NFC').toLowerCase())??[],frontmatter:cache?.frontmatter};
    if(markdown){
      n.region=groups.findIndex(g=>matchesGroupQuery(g.query,n));
      if(n.region>=0){n.color=graph.groups[n.region].color;n.colorVariable=undefined;graph.groups[n.region].notes++;}
    }
    graph.nodes.push(n);
  }
  const known=new Set(graph.nodes.map(n=>n.path)),seen=new Set<string>();
  for(const [from,targets] of Object.entries(app.metadataCache.resolvedLinks)){
    if(!known.has(from))continue;
    for(const to of Object.keys(targets)){
      if(from===to||!known.has(to))continue;
      graph.directedEdges.push([from,to]);
      const pair=[from,to].sort() as [string,string],key=JSON.stringify(pair);
      if(!seen.has(key)){seen.add(key);graph.edges.push(pair);}
    }
  }
  const tags=new Map<string,BrainNote>();
  for(const n of graph.nodes.filter(n=>n.type==='note'))for(const tag of n.tags){
    const path='tag:'+tag;
    if(!tags.has(path))tags.set(path,{path,title:'#'+tag,mtimeMs:n.mtimeMs,region:n.region,type:'tag',color:'',colorVariable:'--graph-node-tag',tags:[tag]});
    graph.edges.push([n.path,path]);
  }
  graph.nodes.push(...tags.values());
  return graph;
}
