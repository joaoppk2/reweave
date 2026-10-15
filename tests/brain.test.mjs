import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeMesh,point,hash,anatomicalPoint,anatomicalPoint2,topEquivalent} from '../.test-build/brain-geometry.js';
import {assignRegions,notePosition,fillLegacy,poolOf} from '../.test-build/brain-regions.js';
import {forceTargets} from '../.test-build/brain-forces.js';
import {compileExpression,matchesGroupQuery,derivedName} from '../.test-build/expression.js';
import {inFolders,readSettings} from '../.test-build/settings.js';
const colors=['#ffff00','#0000ff','#00ff00','#ff3f00','#8000ff','#ff8000','#ff0000'];
const groups=()=>colors.map((color,legacy)=>({name:'Grupo '+legacy,color,legacy,text:'',notes:1}));
test('malha do cérebro: determinística, 1400 pontos e 82 linhas',()=>{const a=makeMesh(),b=makeMesh();assert.deepEqual(a,b);assert.equal(a.nodes.length,1400);assert.equal(a.folds.length,82);assert.ok(a.nodes.every(p=>Object.values(p).every(Number.isFinite)));for(const side of [-1,1])for(let i=0;i<20;i++)assert.ok(Object.values(point(i/20,1,side)).every(Number.isFinite));});
test('7 regiões mantêm os pontos e as posições originais',()=>{const mesh=makeMesh(),s=assignRegions(mesh.nodes,groups());assert.ok(mesh.nodes.every(p=>p.group===p.legacy));for(let g=0;g<7;g++){const n={path:'projetos/'+g+'.md',region:g},pos=notePosition(n,mesh.nodes,s),pool=mesh.nodes.filter(p=>p.legacy===g),p=pool[hash(n.path)%pool.length];assert.deepEqual(pos.anchor,{x:p.x,y:p.y,z:p.z});}});
test('grupo novo cria região; apagar grupo não deixa pontos sem região',()=>{const mesh=makeMesh(),list=groups();list.push({name:'Novo',color:'#00ffff',legacy:null,text:'',notes:5});const s=assignRegions(mesh.nodes,list);assert.ok(s.pools[7].length>0);assert.ok(s.pools.slice(0,7).every(p=>p.length>0));const removed=assignRegions(mesh.nodes,list.filter((_,i)=>i!==3));assert.ok(mesh.nodes.every(p=>p.group>=0));assert.equal(removed.pools.length,7);});
test('forças terminam na malha da própria região e zero restaura âncoras',()=>{const mesh=makeMesh(),s=assignRegions(mesh.nodes,groups()),notes=Array.from({length:20},(_,i)=>notePosition({path:'n'+i,region:i%7},mesh.nodes,s));const zero=forceTargets(notes,[],mesh.nodes,s,{center:0,repel:0,link:0,distance:250});assert.deepEqual(zero,notes.map(n=>n.anchor));const moved=forceTargets(notes,[[notes[0].path,notes[1].path]],mesh.nodes,s,{center:.5,repel:10,link:1,distance:250},.2);assert.ok(moved.every((p,i)=>poolOf(notes[i],mesh.nodes,s).some(q=>q.x===p.x&&q.y===p.y&&q.z===p.z)));});
test('expressões: termos, OR, negação, etiqueta hierárquica e erro',()=>{const n={path:'projetos/Ação.md',title:'Ação',tags:['video/curto'],frontmatter:{status:'pausado'}};for(const q of ['acao','file:acao path:projetos','tag:video','file:nao OR tag:video','-file:outro'])assert.ok(compileExpression(q)(n));for(const q of ['OR','a OR','"aberto','file:','-'])assert.throws(()=>compileExpression(q));assert.ok(matchesGroupQuery('[status:pausado] OR file:outro',n));assert.equal(derivedName('path:"negocios/loja-x"'),'Loja X');});
test('filtro de pastas usa fronteira de diretório e configurações são validadas',()=>{assert.ok(inFolders('Tudo/a.md',[]));assert.ok(inFolders('projetos/a.md',['projetos']));assert.ok(!inFolders('projetos-privados/a.md',['projetos']));assert.deepEqual(readSettings({folders:[' /projetos/ '],colorRules:[{expression:'x',color:'#123456'},{expression:'x',color:'red'}]}).folders,['projetos']);assert.equal(readSettings({colorRules:[{expression:'x',color:'red'}]}).colorRules.length,0);});
test('áreas automáticas são únicas e válidas',()=>{const list=fillLegacy([{name:'A',color:'',text:'',legacy:null,notes:0},{name:'B',color:'',text:'',legacy:0,notes:0},{name:'C',color:'',text:'',legacy:0,notes:0}]);assert.equal(new Set(list.map(r=>r.legacy)).size,3);});
test('formatos anatômicos: finitos, mesma origem (u,v,side) da vista de cima e notas guardam essa origem',()=>{
  const mesh=makeMesh();
  assert.ok(mesh.nodes.every(p=>Number.isFinite(p.u)&&Number.isFinite(p.v)&&[-1,1].includes(p.side)));
  for(const p of mesh.nodes.slice(0,200)){assert.deepEqual(point(p.u,p.v,p.side),{x:p.x,y:p.y,z:p.z});for(const fn of [anatomicalPoint,anatomicalPoint2]){const a=fn(p.u,p.v,p.side);assert.ok(Object.values(a).every(Number.isFinite));assert.equal(Math.sign(a.z),p.side);}}
  const s=assignRegions(mesh.nodes,groups()),n=notePosition({path:'projetos/x.md',region:2},mesh.nodes,s);
  assert.ok(Number.isFinite(n.u)&&Number.isFinite(n.v)&&[-1,1].includes(n.side));
  const fast=makeMesh(anatomicalPoint2,2,2);assert.equal(fast.nodes.length,1400);assert.equal(fast.folds.length,8);
  assert.ok(Object.values(topEquivalent(anatomicalPoint(.3,1.2,-1))).every(Number.isFinite));
});
test('configurações guardam o visualizador escolhido e rejeitam valores desconhecidos',()=>{assert.equal(readSettings({}).mode,'top');assert.equal(readSettings({mode:'network'}).mode,'network');assert.equal(readSettings({mode:'fibers'}).mode,'fibers');assert.equal(readSettings({mode:'anat4'}).mode,'network');assert.equal(readSettings({mode:'anat'}).mode,'fibers');assert.equal(readSettings({mode:'qualquer'}).mode,'top');});
