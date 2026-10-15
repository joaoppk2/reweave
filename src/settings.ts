export interface ColorRule { expression:string; color:string; }
export interface RegionOverride { name:string; text:string; legacy:number|null; }
export type Visualizer = 'top' | 'anat' | 'anat4';
export const VISUALIZERS:Visualizer[] = ['top', 'anat', 'anat4'];
export interface ReweaveSettings { folders:string[]; regions:Record<string,RegionOverride>; colorRules:ColorRule[]; mode:Visualizer; }

export function defaultSettings():ReweaveSettings {
  return {folders:[],regions:{},colorRules:[],mode:'top'};
}

export function readSettings(value:unknown):ReweaveSettings {
  const result=defaultSettings();
  if(!value||typeof value!=='object')return result;
  const raw=value as Record<string,unknown>;
  if(typeof raw.mode==='string'&&(VISUALIZERS as string[]).includes(raw.mode))result.mode=raw.mode as Visualizer;
  if(Array.isArray(raw.folders))result.folders=raw.folders.filter((p):p is string=>typeof p==='string').map(p=>p.trim().replace(/^\/+|\/+$/g,'')).filter(Boolean);
  if(Array.isArray(raw.colorRules))for(const item of raw.colorRules){
    if(item&&typeof item==='object'&&typeof item.expression==='string'&&item.expression.length<=500&&typeof item.color==='string'&&/^#[0-9a-f]{6}$/i.test(item.color))result.colorRules.push({expression:item.expression,color:item.color});
  }
  if(raw.regions&&typeof raw.regions==='object')for(const [key,value] of Object.entries(raw.regions)){
    if(!value||typeof value!=='object')continue;
    const r=value as Record<string,unknown>;
    if(typeof r.name!=='string'||typeof r.text!=='string')continue;
    result.regions[key]={name:r.name,text:r.text,legacy:typeof r.legacy==='number'&&Number.isInteger(r.legacy)&&r.legacy>=0&&r.legacy<7?r.legacy:null};
  }
  return result;
}

export function inFolders(path:string,folders:string[]):boolean {
  return !folders.length||folders.some(folder=>path===folder||path.startsWith(folder+'/'));
}
