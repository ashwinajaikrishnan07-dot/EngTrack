const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = [
  { regex: /bg-\[#050505\]/g, replacement: 'bg-app' },
  { regex: /bg-\[#111111\]/g, replacement: 'bg-card' },
  { regex: /bg-\[#110a02\]/g, replacement: 'bg-input' },
  { regex: /bg-\[#1a1a1a\]/g, replacement: 'bg-card' }, // Alternate background
  { regex: /border-\[#1e2a38\]/g, replacement: 'border-subtle' },
  { regex: /text-\[#ffffff\]/g, replacement: 'text-primary' },
  { regex: /text-white(?!s*})/g, replacement: 'text-primary' }, // Be careful not to replace text-white in buttons if possible, but let's just do it
  { regex: /text-\[#8a9aaa\]/g, replacement: 'text-secondary' },
  { regex: /text-\[#7a8a9a\]/g, replacement: 'text-muted' },
  { regex: /text-\[#6b7280\]/g, replacement: 'text-muted' },
];

function processDirectory(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      replacements.forEach(({ regex, replacement }) => {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          changed = true;
        }
      });
      
      // Fix buttons getting text-primary instead of text-white
      content = content.replace(/className="btn([^"]*)text-primary"/g, 'className="btn$1text-white"');
      content = content.replace(/className="w-full bg-\[#4da6ff\] text-primary/g, 'className="w-full bg-[#4da6ff] text-white');
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  });
}

processDirectory(directoryPath);
console.log('Done.');
