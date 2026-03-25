const fs = require('fs');

const file = 'src/components/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove focusMode toggle button entirely
console.log('Removing focus mode toggle button...');
content = content.replace(/\s*{sortedQuests\.length > 3 && \(\s*<button[\s\S]*?<\/button>\s*\)\s*}/g, '');

// Remove {!focusMode &&  patterns at start of JSX blocks
console.log('Removing focusMode conditionals...');
content = content.replace(/{!focusMode && \(/g, '{');
content = content.replace(/{!focusMode && </g, '{<');

// Close the matching braces
content = content.replace(/\)\s*}/g, '}');

// Fix title
content = content.replace(/focusMode \? "EXTREME FOCUS" : "DAILY QUESTS"/g, '"DAILY QUESTS"');

// Fix the extra closing brace
content = content.replace(/<\/div>}/g, '</div>');

fs.writeFileSync(file, content, 'utf8');
console.log('Focus mode removed successfully!');
