import {build} from 'esbuild';
await Promise.all([
 build({entryPoints:['src/main.ts'],bundle:true,external:['obsidian','electron'],format:'cjs',platform:'browser',target:'es2022',outfile:'main.js'}),
 build({entryPoints:['src/preview-ui.ts'],bundle:true,format:'iife',platform:'browser',target:'es2022',alias:{obsidian:'./src/stub-obsidian.ts'},outfile:'preview-ui.js'}),
 build({entryPoints:['src/data.ts','src/brain-geometry.ts','src/brain-regions.ts','src/brain-forces.ts','src/expression.ts','src/settings.ts'],bundle:true,format:'esm',platform:'node',target:'es2022',outdir:'.test-build'})
]);
