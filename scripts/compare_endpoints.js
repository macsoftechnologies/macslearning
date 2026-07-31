const fs = require('fs');
const glob = require('glob');

function normalize(p){ return p.replace(/\/+/g,'/').replace(/(^\/|\/$)/g,'/'); }

const controllerFiles = glob.sync('src/**/*.controller.ts');
const controllers = [];
for(const file of controllerFiles){
  const src = fs.readFileSync(file, 'utf8');
  const ctrlMatch = src.match(/@Controller\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/m);
  const prefix = ctrlMatch ? ctrlMatch[1] : '';
  const lines = src.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const l = lines[i].trim();
    const m = l.match(/@(Get|Post|Patch|Put|Delete)\(\s*['"`]?([^'"`]*)['"`]?\s*\)/);
    if(m){
      const method = m[1];
      const route = m[2] || '';
      let full = `/${prefix}/${route}`.replace(/\/+/g,'/');
      // collapse multiple slashes
      full = full.replace(/\/+/g, '/');
      // ensure single leading slash and no trailing slash
      full = '/' + full.split('/').filter(Boolean).join('/');
      controllers.push({ method: method.toUpperCase(), path: full, file });
    }
  }
}

const col = JSON.parse(fs.readFileSync('postman_collection.json','utf8'));
const collReqs = [];
function extract(items){
  for(const it of items||[]){
    if(it.request && it.request.url){
      const url = it.request.url;
      let pathArr = [];
      if(Array.isArray(url.path)) pathArr = url.path;
      else if(typeof url.raw === 'string') pathArr = url.raw.split('/').filter(Boolean);
      if(pathArr.length) collReqs.push({ method: (it.request.method||'GET').toUpperCase(), path: '/' + pathArr.join('/') });
    }
    if(it.item) extract(it.item);
  }
}
extract(col.item);

const ctrlSet = new Set(controllers.map(c=>`${c.method}|${normalize(c.path)}`));
const collSet = new Set(collReqs.map(c=>`${c.method}|${normalize(c.path)}`));

const missingInCollection = [...ctrlSet].filter(k=>!collSet.has(k));
const extraInCollection = [...collSet].filter(k=>!ctrlSet.has(k));

console.log(JSON.stringify({ controllerCount: controllers.length, collectionCount: collReqs.length, missingInCollection, extraInCollection }, null, 2));
