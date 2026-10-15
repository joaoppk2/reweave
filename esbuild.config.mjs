import {build} from 'esbuild';
await Promise.all([
 build({entryPoints:['src/main.ts'],bundle:true,external:['obsidian','electron'],format:'cjs',platform:'browser',target:'es2022',outfile:'main.js'}),
 build({entryPoints:['src/preview.ts'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'preview.js'}),
 build({entryPoints:['src/geometry.ts','src/data.ts'],bundle:true,format:'esm',platform:'node',target:'es2022',outdir:'.test-build'})
]);
