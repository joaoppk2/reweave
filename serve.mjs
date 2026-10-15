import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files=new Map([['/','preview.html'],['/preview.html','preview.html'],['/preview.js','preview.js'],['/styles.css','styles.css'],['/ui','preview-ui.html'],['/preview-ui.html','preview-ui.html'],['/preview-ui.js','preview-ui.js']]);
const server=http.createServer(async(req,res)=>{const name=files.get(new URL(req.url,'http://localhost').pathname);if(!name){res.writeHead(404);res.end();return;}try{const data=await readFile(new URL(name,import.meta.url));res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript');res.end(data);}catch{res.writeHead(500);res.end('Build first: npm run build');}});
server.listen(5187,'127.0.0.1',()=>console.log('Synthetic preview: http://127.0.0.1:5187'));
