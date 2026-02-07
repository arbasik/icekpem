
import fs from 'fs';
const path = 'c:/Users/home/Desktop/ice/src/pages/Warehouse.tsx';

try {
    const content = fs.readFileSync(path, 'utf8');
    // Simple check for balanced braces as a heuristic since we can't easily compile TS in this environment without setup
    let openBraces = 0;
    let errors = [];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let char of line) {
            if (char === '{') openBraces++;
            if (char === '}') openBraces--;
        }
        if (openBraces < 0) {
            errors.push(`Line ${i + 1}: Extra closing brace found`);
            openBraces = 0; // Reset to avoid cascading errors? No, just report.
        }
    }

    if (openBraces !== 0) {
        errors.push(`File ends with ${openBraces} unclosed braces`);
    }

    if (errors.length > 0) {
        console.log("Syntax Errors Found:");
        errors.forEach(e => console.log(e));
    } else {
        console.log("Basic Brace Check Passed");
    }
} catch (e) {
    console.error("Error reading file:", e.message);
}
