import {BrainUI} from './ui';
import {graphFromRecords} from './data';
const host=document.getElementById('app')!;
const dialog=document.createElement('dialog');const title=document.createElement('h2'),body=document.createElement('p'),close=document.createElement('button');close.textContent='Fechar';close.onclick=()=>dialog.close();dialog.append(title,body,close);document.body.append(dialog);
let restoreCamera:(()=>void)|null=null;
dialog.addEventListener('close',()=>{restoreCamera?.();restoreCamera=null;});
const ui=new BrainUI(host,(n,restore)=>{restoreCamera=restore;title.textContent=n.title;body.textContent=`Nota sintética: ${n.path}. A prévia não lê arquivos nem usa o Obsidian.`;dialog.showModal();});
// One generic folder per spatial region, deterministic and wholly synthetic.
import {hash} from './geometry';
const groups=Array.from({length:7},(_,region)=>{for(let i=1;;i++){const name=`Pasta ${i}`;if(hash(name)%7===region)return name;}});
const now=Date.now();const notes=Array.from({length:64},(_,i)=>({path:`${groups[i%7]}/Nota ${i+1}.md`,title:`Nota ${i+1}`,group:groups[i%7],mtime:now-(i%12)*86400000}));
const links:Record<string,Record<string,number>>={};for(let i=0;i<notes.length-1;i++)links[notes[i].path]={[notes[i+1].path]:1};ui.update(graphFromRecords(notes,links));
document.getElementById('theme')!.onclick=()=>{document.body.classList.toggle('light');ui.redraw();};
window.addEventListener('pagehide',()=>ui.destroy(),{once:true});
