import { App, Component, MarkdownRenderer, Modal, TFile } from 'obsidian';
import type { Note } from './data';
export class NoteModal extends Modal {
  private child:Component|null=null; private generation=0;
  constructor(app:App,private note:Note,private restore:()=>void=()=>{}){super(app);}
  async onOpen(){
    const generation=++this.generation;this.setTitle(this.note.title);
    const body=this.contentEl.createDiv({cls:'markdown-rendered'});body.textContent='Carregando…';
    const open=this.contentEl.createEl('button',{text:'Abrir nota original'});
    open.onclick=()=>{void this.app.workspace.openLinkText(this.note.path,'',false);this.close();};
    const file=this.app.vault.getAbstractFileByPath(this.note.path);
    if(!(file instanceof TFile)){body.textContent='A nota não existe mais.';return;}
    try {
      const text=await this.app.vault.cachedRead(file);if(generation!==this.generation)return;
      body.empty();this.child=new Component();this.child.load();
      // Host renderer, never innerHTML; Component owns embeds and renderer cleanup.
      await MarkdownRenderer.render(this.app,text,body,file.path,this.child);
    }catch {if(generation===this.generation)body.textContent='Não foi possível carregar a nota.';}
  }
  onClose(){this.generation++;this.child?.unload();this.child=null;this.contentEl.empty();this.restore();}
}
