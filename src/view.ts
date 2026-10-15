import { ItemView, WorkspaceLeaf } from 'obsidian';
import { BrainUI } from './ui';
import { readVault } from './vault-source';
import { NoteModal } from './note-modal';
export const VIEW_TYPE='reweave-brain';
export class ReweaveView extends ItemView {
  private ui:BrainUI|null=null;private timer:number|undefined;private active=false;private modals=new Set<NoteModal>();
  constructor(leaf:WorkspaceLeaf){super(leaf);}
  getViewType(){return VIEW_TYPE;}
  getDisplayText(){return 'Reweave';}
  getIcon(){return 'brain';}
  async onOpen(){
    this.active=true;
    this.ui=new BrainUI(this.contentEl,(n,restore)=>{const modal=new NoteModal(this.app,n,restore);this.modals.add(modal);const close=modal.onClose.bind(modal);modal.onClose=()=>{close();this.modals.delete(modal);};modal.open();});
    const refresh=()=>{if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=window.setTimeout(()=>{this.timer=undefined;if(this.active)this.ui?.update(readVault(this.app));},150);};
    this.registerEvent(this.app.vault.on('create',refresh));
    this.registerEvent(this.app.vault.on('modify',refresh));
    this.registerEvent(this.app.vault.on('delete',refresh));
    this.registerEvent(this.app.vault.on('rename',refresh));
    this.registerEvent(this.app.metadataCache.on('resolved',refresh));
    this.registerEvent(this.app.workspace.on('css-change',()=>this.ui?.redraw()));
    this.app.workspace.onLayoutReady(()=>{if(this.active)refresh();});
    this.ui.update(readVault(this.app));
    // Time filters roll over even when the vault is idle.
    this.registerInterval(window.setInterval(refresh,60_000));
  }
  async onClose(){this.active=false;if(this.timer!==undefined)window.clearTimeout(this.timer);for(const modal of this.modals)modal.close();this.modals.clear();this.ui?.destroy();this.ui=null;}
}
