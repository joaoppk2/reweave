import {App,Plugin,PluginSettingTab,Setting} from 'obsidian';
import {ReweaveView,VIEW_TYPE} from './view';
import {defaultSettings,readSettings,type ReweaveSettings} from './settings';
import {readGraphConfig} from './vault-source';
import {derivedName} from './expression';
export default class ReweavePlugin extends Plugin {
  settings:ReweaveSettings=defaultSettings();
  async onload(){
    this.settings=readSettings(await this.loadData());
    this.registerHoverLinkSource('reweave',{display:'Reweave',defaultMod:false});
    this.registerView(VIEW_TYPE,leaf=>new ReweaveView(leaf,this.settings,()=>{void this.saveSettings();}));
    const open=async()=>{const existing=this.app.workspace.getLeavesOfType(VIEW_TYPE)[0],leaf=existing??this.app.workspace.getLeaf('tab');if(!existing)await leaf.setViewState({type:VIEW_TYPE,active:true});await this.app.workspace.revealLeaf(leaf);};
    this.addRibbonIcon('brain','Abrir Reweave',()=>{void open();});this.addCommand({id:'open-brain',name:'Abrir cérebro',callback:()=>{void open();}});
    this.addSettingTab(new ReweaveSettingsTab(this.app,this));
  }
  async saveSettings(){await this.saveData(this.settings);}
  refreshViews(){for(const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE))if(leaf.view instanceof ReweaveView)void leaf.view.refresh();}
  onunload(){this.app.workspace.detachLeavesOfType(VIEW_TYPE);}
}
class ReweaveSettingsTab extends PluginSettingTab {
  constructor(app:App,private plugin:ReweavePlugin){super(app,plugin);}
  display(){
    const root=this.containerEl;root.empty();
    new Setting(root).setName('Pastas incluídas').setDesc('Uma pasta por linha. Vazio mostra o vault inteiro. Nenhuma nota é alterada.').addTextArea(t=>t.setValue(this.plugin.settings.folders.join('\n')).onChange(value=>{this.plugin.settings.folders=value.split('\n').map(p=>p.trim().replace(/^\/+|\/+$/g,'')).filter(Boolean);void this.plugin.saveSettings();this.plugin.refreshViews();}));
    root.createEl('h3',{text:'Nomes das regiões'});
    const generation=root.createDiv();
    void readGraphConfig(this.app).then(({groups})=>{
      if(!generation.isConnected)return;
      groups.forEach((g,index)=>{
        const current=this.plugin.settings.regions[g.query]??{name:derivedName(g.query),text:'',legacy:index<7?index:null};
        const save=()=>{this.plugin.settings.regions[g.query]=current;void this.plugin.saveSettings();this.plugin.refreshViews();};
        new Setting(generation).setName(derivedName(g.query)).setDesc('Nome da região, sem alterar a regra do gráfico do Obsidian.').addText(t=>t.setValue(current.name).onChange(v=>{current.name=v;save();}));
        new Setting(generation).setName('Descrição').addText(t=>t.setValue(current.text).onChange(v=>{current.text=v;save();}));
      });
    });
  }
}
