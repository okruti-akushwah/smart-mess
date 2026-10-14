import fs from 'node:fs';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
import {dictionary} from '../src/i18n/hi.js';
import {extraHindi} from '../src/i18n/extraHindi.js';
const traverse=typeof traverseModule === "function" ? traverseModule : traverseModule.default;
const normalise=value=>value.replace(/\s+/g,' ').trim().replace(/[’‘]/g,"'").replace(/…/g,'...');
const known=new Set(Object.keys({...dictionary,...extraHindi}).map(normalise));
const missing=[];
for(const directory of ['src/pages','src/components'])for(const file of fs.readdirSync(directory).filter(name=>name.endsWith('.jsx')&&!name.endsWith('.test.jsx'))){
 const ast=parse(fs.readFileSync(`${directory}/${file}`,'utf8'),{sourceType:'module',plugins:['jsx']});
 traverse(ast,{CallExpression(path){
  if(path.node.callee.name==='translate'&&path.node.arguments[0]?.type==='StringLiteral'){
   const value=normalise(path.node.arguments[0].value);
   if(/[a-z]{2}/i.test(value)&&!known.has(value))missing.push(`${file}: ${value}`);
  }
 },JSXText(path){const text=normalise(path.node.value);if(/[a-z]{2}/i.test(text))missing.push(`${file}: unlocalized UI text: ${text}`);}});
}
if(missing.length){process.stderr.write([...new Set(missing)].join('\n')+'\n');process.exitCode=1;}
else process.stdout.write('Static UI translation coverage passed.\n');
