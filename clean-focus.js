const fs = require('fs');

const file = 'src/components/Dashboard.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Process line by line for better control
let output = [];
let skipUntilClose = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Skip the focusMode state declaration
  if (line.includes('const [focusMode, setFocusMode]')) {
    console.log(`Line ${i+1}: Skipping focusMode state`);
    continue;
  }
  
  // Remove focusMode toggle button section
  if (line.includes('{sortedQuests.length > 3 &&') && lines[i+1].includes('<button')) {
    console.log(`Line ${i+1}: Skipping focus toggle button`);
    // Skip until we find the closing })}
    let braceCount = 1;
    i++;
    while (i < lines.length && braceCount > 0) {
      if (lines[i].includes('{')) braceCount++;
      if (lines[i].includes('}')) braceCount--;
      i++;
    }
    i--; // back up one since the loop will increment
    continue;
  }
  
  // Fix focusMode ternary in title
  if (line.includes('focusMode ? "EXTREME FOCUS" : "DAILY QUESTS"')) {
    output.push(line.replace(/focusMode \? "EXTREME FOCUS" : "DAILY QUESTS"/, '"DAILY QUESTS"'));
    continue;
  }
  
  // Remove {!focusMode && conditions
  if (line.includes('{!focusMode &&')) {
    // Remove the !focusMode && part but keep structure
    const modified = line.replace(/{!focusMode && \(/g, '{');
    output.push(modified);
    continue;
  }
  
  output.push(line);
}

fs.writeFileSync(file, output.join('\n'), 'utf8');
console.log('Dashboard cleaned successfully!');
