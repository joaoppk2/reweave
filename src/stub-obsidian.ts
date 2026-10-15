// Substitui o pacote "obsidian" só na prévia de navegador (preview-ui.html), para testar a barra lateral sem o Obsidian.
export function setIcon(el:HTMLElement, name:string):void { el.textContent = name === 'x' ? '×' : '⚙'; }
export class Notice { constructor(public message:string) { console.warn('Notice:', message); } }
export class ToggleComponent {
  private input:HTMLInputElement;
  constructor(parent:HTMLElement) { this.input = document.createElement('input'); this.input.type = 'checkbox'; parent.append(this.input); }
  setValue(value:boolean):this { this.input.checked = value; return this; }
  setTooltip(text:string):this { this.input.title = text; return this; }
  onChange(change:(value:boolean)=>void):this { this.input.onchange = () => change(this.input.checked); return this; }
}
