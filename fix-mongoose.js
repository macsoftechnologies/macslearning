const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('c:/Shanmukha/lms_react_node/backend-nestjs/src');
let changedFiles = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  // Replace { new: true }
  newContent = newContent.replace(/\{\s*new\s*:\s*true\s*\}/g, "{ returnDocument: 'after' }");
  
  // Replace { new: true, upsert: true }
  newContent = newContent.replace(/\{\s*new\s*:\s*true\s*,\s*upsert\s*:\s*true\s*\}/g, "{ returnDocument: 'after', upsert: true }");
  
  // Replace { upsert: true, new: true }
  newContent = newContent.replace(/\{\s*upsert\s*:\s*true\s*,\s*new\s*:\s*true\s*\}/g, "{ upsert: true, returnDocument: 'after' }");
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
  }
});

console.log('Fixed Mongoose deprecation warnings in ' + changedFiles + ' files.');
