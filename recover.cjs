const fs = require('fs');
const log = fs.readFileSync('C:\\Users\\Ge.W\\.gemini\\antigravity\\brain\\2ebb9172-d61d-436f-9167-60c36e073e33\\.system_generated\\logs\\overview.txt', 'utf8');

const targetStr = 'File Path: `file:///d:/Projects/YiziView/src/App.jsx`';
const splits = log.split(targetStr);
const lastSplit = splits[splits.length - 1];

const contentSplit = lastSplit.split('The above content does NOT show')[0].split('The above content shows')[0];

const lines = contentSplit.split('\n');
const cleanLines = lines.filter(l => /^\d+: /.test(l)).map(l => l.replace(/^\d+: /, ''));

fs.writeFileSync('d:\\Projects\\YiziView\\src\\App.jsx', cleanLines.join('\n'));
console.log('Successfully recovered with ' + cleanLines.length + ' lines');
