import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translateText } from './translate.js';
test('switches labels and restores English',()=>{
 assert.equal(translateText('Skip meal','hi'),'भोजन छोड़ें');
 assert.equal(translateText('Skip meal','en'),'Skip meal');
 assert.equal(translateText('Your public mess page','hi'),'आपकी मेस का सार्वजनिक पेज');
});
test('keeps amounts, entered content and non-text values unchanged',()=>{
 for(const value of ['Sharma Tiffin Centre','Paneer tikka, dal tadka',3000,null,false])assert.equal(translateText(value,'hi'),value);
 const element={type:'button'};assert.equal(translateText(element,'hi'),element);
});
test('localises messages, whitespace and join templates',()=>{
 assert.equal(translateText('  Check approval  ','hi'),'  मंज़ूरी जाँचें  ');
 assert.equal(translateText('Saving…','hi'),'सहेजा जा रहा है...');
 assert.equal(translateText('Join Sharma Mess','hi'),'Sharma Mess से जुड़ें');
 assert.equal(translateText('Monthly Plan · 7 days · ₹3000','hi'),'Monthly Plan · 7 दिन · ₹3000');
 assert.equal(translateText('Lunch already exists for 2026-10-08','hi'),'दोपहर का भोजन 2026-10-08 के लिए पहले से मौजूद है');
});
