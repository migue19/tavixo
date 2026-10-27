import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),fontkit=require('fontkit'),sharp=require('sharp');
const root=path.resolve('marketing/marca/tavixo'),out=path.resolve('outputs/marca-tavixo');
const font=fontkit.openSync(path.join(root,'fonts/Manrope-Variable.ttf'));
const C={barro:'#A3432F',hover:'#873524',ink:'#24211F',cream:'#FAF6EF',maize:'#EAB766',muted:'#70665F',white:'#FFFFFF',line:'#DED6CC',soft:'#F2E3D9'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const fonts=new Map();
function getFont(weight){if(!fonts.has(weight))fonts.set(weight,font.getVariation({wght:weight}));return fonts.get(weight);}
function text(s,x,y,size=20,fill=C.ink,weight=500){const f=getFont(weight),run=f.layout(s);let advance=0;return `<g aria-label="${esc(s)}" fill="${fill}" transform="translate(${x} ${y}) scale(${size/f.unitsPerEm} ${-size/f.unitsPerEm})">${run.glyphs.map((g,i)=>{const p=run.positions[i];const svg=`<path transform="translate(${advance+p.xOffset} ${p.yOffset})" d="${g.path.toSVG()}"/>`;advance+=p.xAdvance;return svg;}).join('')}</g>`;}
function width(s,size=20,weight=500){return getFont(weight).layout(s).positions.reduce((v,p)=>v+p.xAdvance,0)/font.unitsPerEm*size;}
function lines(s,x,y,max=650,size=20,fill=C.muted,weight=500,lineHeight=size*1.5){let row='',result='',n=0;for(const word of s.split(' ')){if(row&&width(row+' '+word,size,weight)>max){result+=text(row,x,y+n++*lineHeight,size,fill,weight);row=word;}else row+=(row?' ':'')+word;}return result+text(row,x,y+n*lineHeight,size,fill,weight);}
const rect=(x,y,w,h,fill,rx=20,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
function symbol(main=C.barro,accent=C.ink){return `<g fill="none" stroke-width="12" stroke-linecap="round"><path stroke="${main}" d="M12 12 24 24M52 12 40 24M12 52 24 40"/><path stroke="${accent}" d="M40 40 52 52"/></g>`;}
function logo(main=C.barro,name=C.ink,accent=C.ink){return `<g transform="translate(0 5) scale(1.3)">${symbol(main,accent)}</g>${text('tavixo',99.2,78,90,name,800)}`;}
const svg=(w,h,body,title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title>${body}</svg>`;
function write(name,content){fs.writeFileSync(path.join(root,'assets',name),content);}
const variants={
 'logo-color.svg':logo(),
 'logo-reverse.svg':logo(C.cream,C.cream,C.maize),
 'logo-white.svg':logo(C.white,C.white,C.white),
 'logo-mono.svg':logo(C.ink,C.ink,C.ink),
 'logo-terracotta.svg':logo(C.barro,C.barro,C.barro),
 'logo-green-comparison.svg':logo('#123C35','#24211F','#123C35'),
 'logo-amber-comparison.svg':logo('#24211F','#24211F','#8A531A')
};
for(const [name,body]of Object.entries(variants))write(name,svg(386,96,body,'Tavixo · '+name.replace('.svg','')));
write('symbol.svg',svg(64,64,symbol(),'Tavixo · símbolo X abierta'));
write('symbol-mono.svg',svg(64,64,symbol(C.ink,C.ink),'Tavixo · símbolo monocromo'));
write('icon.svg',svg(128,128,rect(0,0,128,128,C.barro,28)+`<g transform="translate(16 16) scale(1.5)">${symbol(C.cream,C.maize)}</g>`,'Tavixo · icono de aplicación'));
// Small icon uses a continuous cross so its central gap does not disappear unpredictably.
write('favicon.svg',svg(32,32,rect(0,0,32,32,C.barro,7)+`<path d="m9 9 14 14M23 9 9 23" stroke="${C.cream}" stroke-width="4.5" stroke-linecap="round"/>`,'Tavixo · favicon simplificado'));
let grid='';for(let i=0;i<=8;i++){grid+=`<path d="M${i*8} 0V64M0 ${i*8}H64" stroke="${C.line}" stroke-width=".25"/>`;}
const construction=svg(640,520,rect(0,0,640,520,C.cream,0)+text('Construcción · módulo u = 8',40,45,23,C.ink,700)+`<g transform="translate(156 100) scale(5)">${grid}${symbol()}<rect x="-8" y="-8" width="80" height="80" fill="none" stroke="${C.barro}" stroke-width=".35" stroke-dasharray="1.5 1.5"/></g>`+text('Retícula 64 × 64 · trazo 12 · extremos redondos',40,502,18,C.muted),'Tavixo · retícula de construcción y protección');
write('construction.svg',construction);
let b=rect(0,0,1440,4060,C.cream,0);
b+=rect(0,0,1440,580,C.ink,0);
b+=text('IDENTIDAD DE MARCA / VERSIÓN 01',80,60,15,C.maize,700)+text('27 OCT 2026',1200,60,15,C.cream,600);
b+=`<g transform="translate(80 100) scale(1.25)">${logo(C.cream,C.cream,C.maize)}</g>`;
b+=text('Tu restaurante,',80,345,88,C.cream,800)+text('en sincronía.',80,445,88,C.cream,800);
b+=text('Una operación conectada. Una marca con calidez.',84,520,23,'#D3C6BA',500);
b+=`<g transform="translate(1030 180) scale(4.4)">${symbol('#B75A40',C.maize)}</g>`;
// Name and purpose: an editorial brand interpretation, not an invented etymology.
const purpose=rect(80,610,1280,380,C.white,20,C.line)+text('01 / NOMBRE Y PROPÓSITO',108,650,15,C.barro,800)
 +text('¿Por qué Tavixo?',108,699,34,C.ink,800)+text('Nuestro objetivo',790,699,34,C.ink,800)
 +lines('Un nombre de marca creado: breve, moderno y abierto al crecimiento de la plataforma.',108,747,560,22,C.muted,500,33)
 +lines('La X expresa el encuentro de mesa, cocina, caja y gestión. Su significado nace de lo que hacemos.',108,870,560,21,C.muted,500,32)
 +lines('Ayudar a los restaurantes a trabajar con más orden, visibilidad y confianza, desde la primera comanda hasta el cierre de caja.',790,747,530,22,C.ink,600,33)
 +text('Tu restaurante, en sincronía.',790,930,23,C.barro,800);
b+=purpose+'<g transform="translate(0 440)">';
const story=svg(1440,450,rect(0,0,1440,450,C.cream,0)+`<g transform="translate(0 -590)">${purpose}</g>`,'Tavixo · por qué nos llamamos así y nuestro objetivo');
write('brand-story.svg',story);
await sharp(Buffer.from(story)).png().toFile(path.join(out,'Nombre-y-proposito-Tavixo.png'));
// Comparison
b+=text('02 / DIRECCIÓN CROMÁTICA',80,644,15,C.barro,800)+text('Calidez para servir. Claridad para operar.',80,697,37,C.ink,800);
const routes=[['Terracota · recomendada','Cálida, sobria y distinta de Tepahti.',C.barro,logo()],['Verde · ruta anterior','Legible; aquí se parece más a Tepahti.','#123C35',logo('#123C35',C.ink,'#123C35')],['Carbón + ámbar','Más sobria; alternativa con menos color.',C.ink,logo(C.ink,C.ink,'#8A531A')]];
routes.forEach(([title,desc,color,mark],i)=>{let x=80+i*435;b+=rect(x,730,410,213,C.white,18,i===0?C.barro:C.line)+rect(x+1,731,408,7,color,0)+`<g transform="translate(${x+26} 758) scale(.66)">${mark}</g>`+text(title,x+26,866,21,C.ink,800)+lines(desc,x+26,900,355,17,C.muted,500,24);});
// Variants
b+=text('03 / SISTEMA DE LOGOTIPO',80,1014,15,C.barro,800)+text('Una X que conecta la operación.',80,1068,37,C.ink,800);
const vs=[[C.white,logo(),'Principal · fondo claro',C.ink],[C.ink,logo(C.cream,C.cream,C.maize),'Invertido · fondo oscuro',C.cream],[C.barro,logo(C.white,C.white,C.white),'Blanco · fondo terracota',C.white],[C.white,logo(C.ink,C.ink,C.ink),'Una tinta · impresión',C.ink]];
vs.forEach(([bg,mark,label,color],i)=>{let x=80+i*330;b+=rect(x,1104,300,190,bg,18,C.line)+`<g transform="translate(${x+24} 1134) scale(.65)">${mark}</g>`+text(label,x+24,1260,16,color,600);});
b+=rect(80,1318,1280,124,C.soft,18)+`<g transform="translate(108 1344) scale(1.1)">${symbol()}</g>`+text('Mesa, cocina, caja y gestión en un mismo punto.',214,1368,23,C.ink,800)+text('La referencia nace de la X de Tavixo; cada brazo representa una parte de la operación.',214,1408,18,C.muted,500);
// Construction
b+=text('04 / CONSTRUCCIÓN Y LEGIBILIDAD',80,1514,15,C.barro,800);
b+=rect(80,1545,450,390,C.white,18,C.line)+`<g transform="translate(176 1598) scale(4)">${grid}${symbol()}<rect x="-8" y="-8" width="80" height="80" fill="none" stroke="${C.barro}" stroke-width=".4" stroke-dasharray="2 2"/></g>`;
b+=text('u = 8 · retícula de 64 × 64',107,1920,18,C.muted,600);
b+=text('Geometría simple, reproducible.',590,1594,29,C.ink,800)+lines('Cuatro diagonales de 12 unidades de grosor, con extremos redondos. El centro queda abierto: un espacio común alrededor del que se coordina el servicio.',590,1642,720,22,C.muted,500,34);
b+=text('Protección',590,1774,18,C.barro,800)+text('Deja al menos 1u libre alrededor del símbolo.',590,1808,20,C.ink,500)+text('Mínimos',590,1854,18,C.barro,800)+text('Logo 120 px · símbolo 24 px · favicon propio de 16 px.',590,1888,20,C.ink,500);
// Colors
b+=text('05 / PALETA Y CONTRASTE',80,1982,15,C.barro,800)+text('El color acompaña. Los datos mandan.',80,2036,37,C.ink,800);
const swatches=[['Barro',C.barro,'Acción y marca'],['Carbón',C.ink,'Texto y navegación'],['Crema',C.cream,'Fondo general'],['Maíz',C.maize,'Acento puntual'],['Piedra',C.muted,'Texto secundario'],['Blanco',C.white,'Tarjetas y campos']];
swatches.forEach(([name,color,role],i)=>{let x=80+i*218;b+=rect(x,2070,190,106,color,14,C.line)+text(name,x,2210,21,C.ink,800)+text(color,x,2240,17,C.muted,600)+text(role,x,2270,15,C.muted,500);});
b+=rect(80,2301,1280,76,C.white,14,C.line)+text('Contraste calculado',104,2333,18,C.ink,800)+text('Barro / blanco 6.17:1     Carbón / crema 14.85:1     Piedra / crema 5.19:1',410,2333,19,C.ink,500)+text('Maíz es un acento; no usar letras blancas sobre él. Los estados mantienen etiqueta e icono propios.',104,2360,16,C.muted,500);
// Type
b+=text('06 / TIPOGRAFÍA',80,2446,15,C.barro,800)+text('Manrope',80,2534,74,C.ink,800)+text('Aa 0123',80,2644,74,C.barro,600)+text('200–800 · licencia OFL',84,2694,18,C.muted,500);
b+=text('Todo listo para servir.',650,2500,40,C.ink,800)+text('Ventas claras, decisiones más fáciles.',650,2552,26,C.ink,700)+lines('Una familia para títulos, instrucciones y cifras. Usa números tabulares en ventas y cortes; el cuerpo debe ser cómodo durante todo el turno.',650,2600,680,21,C.muted,500,32)+text('Cuerpo 16/25 · etiquetas 14/20 · controles ≥ 44 px',650,2740,18,C.barro,700);
// Product mockup
b+=text('07 / PRODUCTO Y PERSONALIZACIÓN',80,2820,15,C.barro,800);
b+=rect(80,2855,805,440,C.white,22,C.line)+text('REPORTE DE VENTAS',108,2904,14,C.muted,700)+text('Tu día, de un vistazo.',108,2948,28,C.ink,800)+text('Aplicación conceptual · datos de ejemplo',108,2978,15,C.muted,500);
b+=rect(108,3008,223,95,C.cream,12)+text('VENTAS',126,3037,12,C.muted,700)+text('$4,260.00',126,3079,30,C.ink,800)+rect(350,3008,223,95,C.cream,12)+text('CUENTAS COBRADAS',368,3037,12,C.muted,700)+text('24',368,3079,30,C.ink,800)+rect(592,3008,265,95,C.barro,12)+text('VER REPORTE',614,3066,17,C.white,800);
[61,88,47,101,132,95,148].forEach((h,i)=>b+=rect(130+i*87,3252-h,45,h,i===6?C.barro:C.soft,7));
b+=text('L',145,3277,13,C.muted,600)+text('M',232,3277,13,C.muted,600)+text('M',319,3277,13,C.muted,600)+text('J',406,3277,13,C.muted,600)+text('V',493,3277,13,C.muted,600)+text('S',580,3277,13,C.muted,600)+text('D',667,3277,13,C.muted,600);
b+=text('La marca del restaurante, primero.',936,2900,25,C.ink,800)+lines('Dentro de cada cuenta se conserva el logo y la paleta del negocio. Tavixo identifica la plataforma; no sustituye la personalidad del restaurante.',936,2948,420,21,C.muted,500,33)+lines('El verde sigue disponible como estado de éxito. Terracota identifica acciones, no cancelaciones ni alertas.',936,3105,420,20,C.muted,500,31);
// Closing applications
b+=rect(80,3342,1280,215,C.ink,22)+`<g transform="translate(113 3372) scale(.58)">${logo(C.cream,C.cream,C.maize)}</g>`+text('Menos vueltas.',113,3480,34,C.cream,800)+text('Más control en cada turno.',113,3526,34,C.cream,800)+text('Redes · sitio comercial · demos',850,3406,18,C.maize,700)+lines('En la operación diaria, la información conserva el protagonismo. En comunicación, la marca puede hablar más fuerte.',850,3450,440,20,C.cream,500,31);
b+=text('IDENTIDAD V1 · DIRECCIÓN APROBADA · SVG EDITABLES Y FUENTE INCLUIDOS',80,3600,13,C.muted,700);
b+='</g>';
write('brand-board.svg',svg(1440,4060,b,'Tavixo · guía visual de identidad: terracota, carbón y crema'));
await sharp(path.join(root,'assets/brand-board.svg')).png().toFile(path.join(out,'Tavixo-identidad-v1.png'));
for(const name of ['logo-color','logo-reverse','logo-white','logo-mono','icon','construction']){
 const size=name==='icon'?1024:name==='construction'?1280:1544;
 await sharp(path.join(root,`assets/${name}.svg`)).resize({width:size}).png().toFile(path.join(out,`${name}.png`));
}
const smallFavicon=rect(0,0,32,32,C.barro,7)+`<path d="m9 9 14 14M23 9 9 23" stroke="${C.cream}" stroke-width="4.5" stroke-linecap="round"/>`;
const contact=svg(1200,240,rect(0,0,1200,240,C.cream,0)+[16,24,32,48,64].map((n,i)=>`<g transform="translate(${40+i*140} 80) scale(${n/(i===0?32:64)})">${i===0?smallFavicon:symbol()}</g>`+text(i===0?'16 px · favicon':`${n} px`,40+i*140,190,i===0?13:16,C.muted)).join('')+`<g transform="translate(790 70) scale(.8)">${logo()}</g>`,'Prueba de tamaños de logo Tavixo');
await sharp(Buffer.from(contact)).png().toFile(path.join(out,'Prueba-tamanos.png'));
fs.copyFileSync(path.join(root,'assets/construction.svg'),path.join(out,'Construccion-logo.svg'));
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({name:'Tavixo',version:'1.0',date:'2026-10-27',status:'Dirección aprobada y publicada en Tavixo el 27 de octubre de 2026',colors:C,typeface:'Manrope 200–800',fontLicense:'fonts/OFL.txt',fontSource:'https://github.com/google/fonts/tree/main/ofl/manrope',logo:'assets/logo-color.svg',icon:'assets/icon.svg',generator:'scripts/generate-tavixo-brand.mjs'},null,2));
const cover=svg(1200,630,rect(0,0,1200,630,C.cream,0)+rect(0,0,1200,425,C.ink,0)+text('TAVIXO / IDENTIDAD DE MARCA 01',60,48,14,C.maize,700)+`<g transform="translate(60 92) scale(1.4)">${logo(C.cream,C.cream,C.maize)}</g>`+text('Tu restaurante,',60,302,67,C.cream,800)+text('en sincronía.',60,379,67,C.cream,800)+`<g transform="translate(888 154) scale(3.3)">${symbol('#B75A40',C.maize)}</g>`+text('TERRACOTA · CARBÓN · CREMA',60,477,16,C.barro,800)+text('Una operación conectada. Una marca con calidez.',60,518,23,C.ink,600)+[C.barro,C.ink,C.cream,C.maize].map((c,i)=>rect(60+i*66,550,50,28,c,8,C.line)).join('')+text('Logo vectorial · tipografía · construcción · aplicaciones',375,574,16,C.muted,500),'Tavixo · propuesta de logo y paleta cálida');
await sharp(Buffer.from(cover)).png().toFile(path.join(out,'Presentacion-logo-Tavixo.png'));
for(const size of [16,32])await sharp(path.join(root,'assets/favicon.svg')).resize(size,size).png().toFile(path.join(out,`favicon-${size}.png`));
for(const size of [192,512])await sharp(path.join(root,'assets/icon.svg')).resize(size,size).png().toFile(path.join(out,`icon-${size}.png`));
await sharp(path.join(root,'assets/symbol.svg')).resize(512,512).png().toFile(path.join(out,'symbol.png'));
const lum=h=>{const v=h.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
const contrastChecks=[[C.barro,C.white],[C.barro,C.cream],[C.ink,C.cream],[C.ink,C.maize],[C.muted,C.cream]].map(([foreground,background])=>{const a=lum(foreground),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return {foreground,background,ratio,display:ratio.toFixed(2),passesNormalText:ratio>=4.5};});
if(contrastChecks.some(c=>!c.passesNormalText))throw Error('Insufficient text contrast');
fs.writeFileSync(path.join(root,'contrast-checks.json'),JSON.stringify(contrastChecks,null,2));
fs.copyFileSync(path.join(root,'contrast-checks.json'),path.join(out,'contrastes.json'));
const social=svg(1080,1080,rect(0,0,1080,1080,C.cream,0)+rect(0,0,1080,610,C.ink,0)+`<g transform="translate(70 78) scale(1.15)">${logo(C.cream,C.cream,C.maize)}</g>`+text('Tu restaurante,',70,350,80,C.cream,800)+text('en sincronía.',70,448,80,C.cream,800)+text('Una operación conectada.',74,535,30,C.maize,600)+text('Mesas. Cocina. Caja.',70,720,48,C.ink,800)+lines('Coordina tu servicio y revisa tus ventas en un mismo lugar.',74,789,650,29,C.muted,500,44)+`<g transform="translate(790 785) scale(2.7)">${symbol()}</g>`+text('TAVIXO · GESTIÓN PARA RESTAURANTES',74,1005,19,C.barro,800),'Tavixo · plantilla conceptual para publicación social');
write('social-post.svg',social);
await sharp(Buffer.from(social)).png().toFile(path.join(out,'Tavixo-post-cuadrado.png'));
console.log('Generados SVG, PNG, retícula, iconos y lámina visual de Tavixo.');
