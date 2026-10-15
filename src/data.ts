export interface Note { path:string; title:string; group:string; mtime:number; }
export interface Graph { notes:Note[]; edges:[string,string][]; }
export type Period='all'|'today'|'week';
export interface Filter { query:string; group:string; period:Period; }
export function normalize(s:string):string { return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
export function periodStart(period:Period,now=new Date()):number {
  if(period==='all') return -Infinity;
  const d=new Date(now); d.setHours(0,0,0,0);
  if(period==='week') d.setDate(d.getDate()-(d.getDay()+6)%7);
  return d.getTime();
}
export function filterNotes(notes:Note[],filter:Filter,now=new Date()):Note[] {
  const query=normalize(filter.query.trim()),start=periodStart(filter.period,now);
  return notes.filter(n=>(!filter.group||n.group===filter.group)&&normalize(n.title+' '+n.path).includes(query)&&(filter.period==='all'||(n.mtime>=start&&n.mtime<=now.getTime())));
}
export function graphFromRecords(notes:Note[],links:Record<string,Record<string,number>>):Graph {
  const known=new Set(notes.map(n=>n.path)),seen=new Set<string>(),edges:[string,string][]=[];
  for(const [from,targets] of Object.entries(links)) for(const to of Object.keys(targets)) {
    if(from===to||!known.has(from)||!known.has(to)) continue;
    const key=JSON.stringify([from,to].sort()); if(seen.has(key))continue;
    seen.add(key);edges.push([from,to]);
  }
  return {notes,edges};
}
