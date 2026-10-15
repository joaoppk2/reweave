import { App } from 'obsidian';
import { graphFromRecords, type Graph } from './data';
export function readVault(app:App):Graph {
  return graphFromRecords(app.vault.getMarkdownFiles().map(file=>({path:file.path,title:file.basename,group:file.parent?.path==='/'?'Raiz':file.path.includes('/')?file.path.split('/')[0]:'Raiz',mtime:file.stat.mtime})),app.metadataCache.resolvedLinks);
}
