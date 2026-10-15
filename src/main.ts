import {Plugin} from 'obsidian';
import {ReweaveView,VIEW_TYPE} from './view';
export default class ReweavePlugin extends Plugin {
  async onload(){
    this.registerView(VIEW_TYPE,leaf=>new ReweaveView(leaf));
    const open=async()=>{const existing=this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];const leaf=existing??this.app.workspace.getLeaf('tab');if(!existing)await leaf.setViewState({type:VIEW_TYPE,active:true});await this.app.workspace.revealLeaf(leaf);};
    this.addRibbonIcon('brain','Abrir Reweave',()=>{void open();});
    this.addCommand({id:'open-brain',name:'Abrir cérebro',callback:()=>{void open();}});
  }
  onunload(){this.app.workspace.detachLeavesOfType(VIEW_TYPE);}
}
