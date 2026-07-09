const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/modules/**/*.ts');
for (const file of files) {
  if (!file.endsWith('.module.ts') && !file.endsWith('.processor.ts')) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  content = content.replace(/import\s+\{\s*([A-Za-z]+)\s*,\s*([A-Za-z]+)(?:Schema|Document)\s*\}\s+from\s+'\.\/schemas\/([^']+)\.schema';/g, (match, p1, p2, p3) => {
    changed = true;
    let entityFile = p3;
    if (p3 === 'org') entityFile = 'org';
    if (p3 === 'lessonProgress') entityFile = 'lessonProgress';
    if (p3 === 'video-quiz-answer') entityFile = 'videoQuizAnswer';
    return `import { ${p1} } from './entities/${entityFile}.entity';`;
  });
  if (changed) fs.writeFileSync(file, content);
}
