# Reweave

## Português

### Estado do projeto

Protótipo em desenvolvimento, ainda não pronto para distribuição. A referência visual aprovada é o cérebro original da demonstração local na porta 8766, incluindo formato, fios, cores e controles. Essa referência ainda precisa ser incorporada ao plugin desta pasta. A geometria lateral da prévia 5187 não foi escolhida para a versão final.

A interface desta pasta contém alterações parciais de barra lateral e os bundles locais podem estar desatualizados. O trabalho atual da barra ocorre na demonstração de referência, separada deste pacote. Não interpretar a prévia abaixo como a versão final aprovada.

Plugin Obsidian independente: notas Markdown e vínculos em um cérebro lateral 3D de fios finos e pontos luminosos. A prévia usa **somente 64 notas sintéticas**; não lê nenhum vault. Não há telemetria, serviço remoto ou preparação de arquivos.

### Desenvolvimento

Node.js 22+ e npm. Dentro desta pasta:

```sh
npm ci
npm run typecheck
npm test
npm run preview
```

Abra `http://127.0.0.1:5187`. O servidor só escuta em loopback e só serve quatro arquivos conhecidos. Ctrl+C encerra. `npm run build` gera `main.js`, `preview.js` e módulos temporários de testes. `npm test` recompila antes dos testes Node. Não execute `prepare.py`; não é parte deste projeto.

### Instalação manual futura, apenas em vault de teste

Nenhuma instalação é feita pelo build. Depois de revisar, copie **main.js, manifest.json e styles.css** para `.obsidian/plugins/reweave/` de um vault descartável; habilite em Plugins da comunidade e execute “Reweave: Abrir cérebro”. Não use primeiro seu vault real.

Arrastar move; Shift + arrastar gira; roda do mouse e botões controlam zoom; Vista inicial restaura a câmera. Busca ignora acentos, região filtra pela primeira pasta e Hoje/Esta semana usam modificação local (semana começa segunda-feira). Clique numa nota na lista ou no canvas centraliza e abre modal; Abrir nota original usa a API do Obsidian. A lista é a alternativa de teclado ao canvas. O tema e as fontes seguem os tokens CSS do host; a prévia tem seu próprio botão de tema.

### Arquitetura e privacidade

- `src/main.ts`, `view.ts`: plugin, ItemView, eventos de vault/cache/CSS e descarte.
- `src/vault-source.ts`: `vault.getMarkdownFiles()` e `metadataCache.resolvedLinks`, sem varrer disco externo.
- `src/data.ts`: filtros e arestas resolvidas, removendo auto-links e duplicados.
- `src/note-modal.ts`: leitura somente ao abrir; MarkdownRenderer do host e Component com unload. Não injeta HTML manualmente. Markdown/embeds continuam sujeitos às regras do Obsidian e aos plugins instalados; não é um sandbox de conteúdo hostil.
- `src/geometry.ts`, `render.ts`, `ui.ts`: compartilhados pelo plugin e preview.

A forma é uma interpretação artística: uma superfície periódica fechada para cada parte (córtex, cerebelo e um único tronco fino), com polos colapsados e relevo suave. Não há cascas 2D espelhadas, sólido ou modelo médico. As três partes se sobrepõem nas junções; não são uma malha anatômica soldada. Posições são determinísticas por caminho/pasta; pastas são agrupadas em sete regiões estáveis por hash, podendo compartilhar região. Este protótipo usa sete cores regionais; nomes/cores/detalhes são configuráveis pelo array de regiões passado ao BrainUI (defaults em geometry.ts). Botões nomeados e lista evitam depender só da cor. São 1400 pontos determinísticos, até dois fios locais de saída por ponto e dobras discretas, sem grade dominante. Região enquadra/destaca; Ver tudo restaura. O modal salva a câmera antes do foco e restaura ao fechar, inclusive Escape. O tema nativo controla fontes e superfícies, não substitui cores regionais.

### Validação e limites

Os testes não foram executados novamente nesta revisão documental. Não há testes automatizados de integração nativa, interface ou mobile neste pacote. O suporte mobile e a versão mínima declarados no manifest ainda precisam de validação. O plugin não implementa chamadas próprias de rede, mas embeds renderizados pelo Obsidian podem carregar recursos externos; funcionamento offline depende do conteúdo e das configurações do host.

### Antes de publicar

Revisar os arquivos efetivamente selecionados para o commit. Não incluir vaults, notas reais, credenciais, logs, dumps, capturas ou vídeos com conteúdo pessoal. A prévia sintética pode demonstrar o protótipo, mas não comprova a integração nativa nem a aparência final. Regras do `.gitignore` não removem arquivos já rastreados. A publicação e a instalação no vault pessoal não fazem parte dos comandos de desenvolvimento.

### Cobertura disponível

Há 12 testes Node definidos para verificar costuras/polos, continuidade, profundidade, largura do tronco, projeção e filtros (incluindo segunda-feira, datas futuras, busca acentuada e links ausentes). Typecheck e build disponíveis. Prévia navegável não substitui teste nativo Obsidian; este projeto **não foi instalado/testado no Obsidian**. Canvas transparente mostra fios traseiros intencionalmente; não há oclusão sólida. Desempenho de vaults enormes, embeds complexos e gestos multitoque precisa de validação no host. Não há sincronização, persistência de câmera, animação contínua nem gravação de notas.

## English

### Project status

Development prototype, not a release-ready plugin. The approved visual reference is the original local demonstration on port 8766, including its brain shape, wires, colors, and controls. It has not yet been incorporated into this plugin. The lateral geometry shown on port 5187 was not selected for the final version.

This source tree contains incomplete sidebar changes; existing local bundles may be stale. Current sidebar development takes place in the separate reference demonstration. The preview below is not the approved final product.

Independent Obsidian plugin showing local Markdown notes and resolved links as a thin-wire lateral brain. The browser preview uses synthetic fixtures only and never reads a vault. No telemetry or remote service.

Use Node.js 22+: `npm ci`, `npm run typecheck`, `npm test`, then `npm run preview`; open `http://127.0.0.1:5187`. `npm run build` creates the plugin and preview bundles. Build does not install anything. For a future disposable test vault, manually copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/reweave/`, enable it, and run “Reweave: Abrir cérebro”.

Drag pans, Shift-drag rotates, wheel/buttons zoom, reset restores the camera. Search is accent-insensitive; regions use top-level folders; activity filters use local modification dates, with Monday as week start. Clicking a note focuses it and opens a host-rendered Markdown modal. Notes are also keyboard-accessible through the list. Host CSS tokens control colors/fonts. Vault/cache/theme events refresh the view; observers, listeners, timers, and modal components are disposed on teardown.

Shared geometry uses one closed periodic surface per anatomical part rather than mirrored shells. It is an artistic interpretation, not a medical model or welded manifold. Folder hashes share seven stable regions with seven regional colors (configurable through BrainUI's regions argument). The shared renderer uses 1400 deterministic points, two local outgoing curved wires per point at most, and sparse folds. Region selection frames/highlights its bounds; modal close including Escape restores the pre-focus camera. Twelve Node tests are defined for geometry, perspective, data and filters; they were not rerun during this documentation review. There are no automated native integration, UI, or mobile tests in this package. Mobile support and the minimum host version declared in the manifest remain unverified. The plugin has no custom network requests, but host-rendered Markdown embeds can load external resources; offline behavior depends on note content and host settings. Native Obsidian behavior has **not** been tested; large vault performance, complex Markdown embeds, and multitouch require host testing. Rendering is wire-only, with no solid occlusion. Markdown follows Obsidian's own security and plugin policies, not a custom hostile-content sandbox.

License: MIT. No commit, push, publication, or real-vault installation is required by these commands.
