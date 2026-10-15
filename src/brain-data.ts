import type { RegionInfo } from './brain-regions';
import type { Matchable } from './expression';

export interface BrainNote extends Matchable {
  mtimeMs:number;
  region:number;
  type:'note'|'attachment'|'tag';
  color:string;
  colorVariable?:'--graph-node'|'--graph-node-attachment'|'--graph-node-tag';
}
export interface GraphSettings { centerStrength?:number; repelStrength?:number; linkStrength?:number; linkDistance?:number; scale?:number; }
export interface BrainGraph {
  nodes:BrainNote[];
  edges:[string,string][];
  directedEdges:[string,string][];
  groups:RegionInfo[];
  graphSettings:GraphSettings;
}
export const emptyGraph=():BrainGraph=>({nodes:[],edges:[],directedEdges:[],groups:[],graphSettings:{}});
