import {ItemView,WorkspaceLeaf} from 'obsidian';
import {BrainUI} from './sidebar';
import {readVault} from './vault-source';
import type {HoverPopover} from 'obsidian';
import type {ReweaveSettings} from './settings';
export const VIEW_TYPE='reweave-brain';
export class ReweaveView extends ItemView {
  private ui:BrainUI|null=null;
  private timer:number|undefined;
  private active=false;
  private generation=0;
  hoverPopover:HoverPopover|null=null;
  constructor(leaf:WorkspaceLeaf,private settings:ReweaveSettings,private save:()=>void){super(leaf);}
  getViewType(){return VIEW_TYPE;}
  getDisplayText(){return 'Reweave';}
  getIcon(){return 'brain';}
  async onOpen(){
    this.active=true;
    this.ui=new BrainUI(this.contentEl,n=>{
      if(n.type!=='tag')void this.app.workspace.openLinkText(n.path,'','tab');
    },this.settings,this.save,(n,event)=>{
      this.app.workspace.trigger('hover-link',{event,source:'reweave',hoverParent:this,targetEl:event.target,linktext:n.path,sourcePath:''});
    });
    const refresh=()=>{if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=window.setTimeout(()=>{this.timer=undefined;void this.refresh();},150);};
    this.registerEvent(this.app.vault.on('create',refresh));this.registerEvent(this.app.vault.on('modify',refresh));this.registerEvent(this.app.vault.on('delete',refresh));this.registerEvent(this.app.vault.on('rename',refresh));
    this.registerEvent(this.app.metadataCache.on('resolved',refresh));this.registerEvent(this.app.metadataCache.on('changed',refresh));this.registerEvent(this.app.workspace.on('css-change',()=>this.ui?.redraw()));
    this.app.workspace.onLayoutReady(()=>{if(this.active)refresh();});
    await this.refresh();
    this.registerInterval(window.setInterval(refresh,4000));
  }
  async refresh(){const generation=++this.generation;if(!this.active)return;const graph=await readVault(this.app,this.settings);if(this.active&&generation===this.generation)this.ui?.update(graph);}
  async onClose(){this.active=false;this.generation++;if(this.timer!==undefined)window.clearTimeout(this.timer);this.hoverPopover?.unload();this.hoverPopover=null;this.ui?.destroy();this.ui=null;}
}
