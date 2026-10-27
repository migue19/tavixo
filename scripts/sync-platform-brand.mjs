import {readFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const source='marketing/marca/tavixo';
await mkdir('apps/web/public/fonts',{recursive:true});
await mkdir('apps/web/public/branding',{recursive:true});
for(const [from,to] of [
 ['assets/logo-color.svg','branding/tavixo-logo.svg'],
 ['assets/icon.svg','branding/tavixo-icon.svg'],
 ['assets/favicon.svg','favicon.svg'],
 ['fonts/Manrope-Variable.ttf','fonts/Manrope-Variable.ttf'],
 ['fonts/OFL.txt','fonts/Manrope-OFL.txt'],
])await copyFile(`${source}/${from}`,`apps/web/public/${to}`);
const icon=await readFile(`${source}/assets/icon.svg`,'utf8');
for(const size of [192,512])await sharp(Buffer.from(icon)).resize(size,size).png().toFile(`apps/web/public/icon-${size}.png`);
if(!icon.includes('rx="28"')||!icon.includes('translate(16 16) scale(1.5)'))throw Error('Revisar geometría del icono maestro');
// Full-bleed background; symbol fits within the central 80%-diameter safe circle.
const maskable=icon.replace('rx="28"','rx="0"').replace('translate(16 16) scale(1.5)','translate(22.4 22.4) scale(1.3)');
await sharp(Buffer.from(maskable)).resize(512,512).png().toFile('apps/web/public/icon-maskable-512.png');
await sharp(Buffer.from(maskable)).resize(180,180).png().toFile('apps/web/public/apple-touch-icon.png');
await sharp(`${source}/assets/favicon.svg`).resize(32,32).png().toFile('apps/web/public/favicon-32.png');
console.log('Activos públicos de Tavixo sincronizados desde los maestros aprobados.');
