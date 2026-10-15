import { normalize } from './data';

export interface Matchable { path:string; title:string; tags:string[]; frontmatter?:Record<string,unknown>; }

const tagKey=(t:string)=>normalize(t).replace(/^#/,'');
const tagMatches=(tags:string[],value:string)=>tags.some(t=>tagKey(t)===value||tagKey(t).startsWith(value+'/'));

// Expressões dos grupos de cor criados na barra: termos, frases entre aspas, file:, path:, tag:, -negação e OR.
export function compileExpression(source:string):(n:Matchable)=>boolean {
  if(source.length>500)throw Error('Use até 500 caracteres.');
  if(source.split('"').length%2===0)throw Error('Feche as aspas.');
  const tokens=source.match(/(?:[^\s"]|"[^"]*")+/g)||[];
  const alternatives:((n:Matchable)=>boolean)[][]=[[]];
  for(const token of tokens){
    if(token==='OR'){if(!alternatives[alternatives.length-1].length)throw Error('Informe um termo antes de OR.');alternatives.push([]);continue;}
    const negative=token.startsWith('-'),raw=negative?token.slice(1):token;
    const field=raw.match(/^(file|path|tag):(.+)$/);
    if(!raw||(raw.includes(':')&&!field))throw Error('Use termos, file:, path: ou tag:.');
    const kind=field?.[1],value=normalize((field?.[2]??raw).replace(/^"|"$/g,''));
    if(!value)throw Error('Informe um valor para o termo.');
    alternatives[alternatives.length-1].push(n=>{
      const match=kind==='tag'?tagMatches(n.tags,value.replace(/^#/,'')):normalize(kind==='path'?n.path:kind==='file'?n.title:n.title+' '+n.path).includes(value);
      return negative?!match:match;
    });
  }
  if(tokens.length&&!alternatives[alternatives.length-1].length)throw Error('Informe um termo depois de OR.');
  return n=>alternatives.some(terms=>terms.every(test=>test(n)));
}

const key=(v:unknown)=>String(v).normalize('NFC').toLowerCase();
const values=(v:unknown):unknown[]=>Array.isArray(v)?v:v===undefined||v===null?[]:[v];

// Regras dos grupos de cor do gráfico do Obsidian (graph.json), no mesmo subconjunto que a referência 8766 entendia.
export function matchesGroupQuery(query:string,n:Matchable):boolean {
  return query.split(/\s+OR\s+/).some(term=>matchesTerm(term.trim(),n));
}
function matchesTerm(term:string,n:Matchable):boolean {
  let m=term.match(/^(file|path|tag):(?:"([^"]+)"|(\S+))$/);
  if(m){
    const raw=m[2]??m[3];
    if(m[1]==='file')return key(n.path.split('/').pop()!.replace(/\.[^.]+$/,'')).includes(key(raw));
    if(m[1]==='path')return key(n.path).includes(key(raw));
    return tagMatches(n.tags,key(raw).replace(/^#/,''));
  }
  m=term.match(/^\[\s*([^:\]]+):\s*([^\]]+)\]$/);
  if(!m)return false;
  const prop=m[1].trim().replace(/^"|"$/g,''),wanted=key(m[2].trim().replace(/^"|"$/g,''));
  return values(n.frontmatter?.[prop]).some(v=>key(v)===wanted);
}

// Nome legível tirado do primeiro termo da regra, para grupos que ainda não ganharam nome nas configurações.
export function derivedName(query:string):string {
  const first=query.trim()?query.trim().split(/\s+OR\s+/)[0]:'';
  const m=first.match(/^(?:file|path|tag):(?:"([^"]+)"|(\S+))$/)??first.match(/^\[\s*[^:\]]+:\s*"?([^\]"]+?)"?\s*\]$/);
  let value=m?(m.slice(1).find(Boolean)??''):first;
  value=value.replace(/^\/+|\/+$/g,'').split('/').pop()!.replace(/^#/,'');
  return value.split(/[-_\s]+/).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(' ')||'Grupo sem nome';
}
