import {mkdir,copyFile,readdir} from 'node:fs/promises';
await mkdir('dist/vendor/core',{recursive:true});await mkdir('dist/vendor/lang',{recursive:true});
for(const f of ['tesseract.min.js','worker.min.js','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])await copyFile('node_modules/tesseract.js/dist/'+f,'dist/vendor/'+f);
for(const f of await readdir('node_modules/tesseract.js-core'))if(/\.wasm(\.js)?$/.test(f))await copyFile('node_modules/tesseract.js-core/'+f,'dist/vendor/core/'+f);
for(const f of ['pdf.mjs','pdf.worker.mjs'])await copyFile('node_modules/pdfjs-dist/build/'+f,'dist/vendor/'+f);
for(const [pkg,name]of [['pdfjs-dist','PDFJS-LICENSE'],['tesseract.js','TESSERACT-LICENSE'],['tesseract.js-core','CORE-LICENSE']])await copyFile('node_modules/'+pkg+'/LICENSE','dist/vendor/'+name).catch(()=>{});

// Download the OCR model only during local setup, never upload patient data.
const {access,writeFile}=await import('node:fs/promises');
try{await access('dist/vendor/lang/eng.traineddata.gz');}catch{const response=await fetch('https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz');if(!response.ok)throw new Error('OCR model download failed');await writeFile('dist/vendor/lang/eng.traineddata.gz',new Uint8Array(await response.arrayBuffer()));}
