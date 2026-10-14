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
test('localises password policy and throttle feedback',()=>{
 assert.equal(translateText('New passwords must contain at least 8 characters.','hi'),'नए पासवर्ड में कम से कम 8 अक्षर होने चाहिए।');
 assert.equal(translateText('Existing accounts can use their current password.','hi'),'मौजूदा खाते अपना वर्तमान पासवर्ड इस्तेमाल कर सकते हैं।');
 assert.equal(translateText('Too many login attempts. Please try again later.','hi'),'लॉगिन के बहुत अधिक प्रयास हुए हैं। कृपया कुछ समय बाद फिर कोशिश करें।');
});
test('localises pending payment review labels',()=>{
 assert.equal(translateText('Awaiting owner confirmation','hi'),'मालिक की पुष्टि का इंतज़ार');
 assert.equal(translateText('Payment submitted for confirmation: ₹','hi'),'पुष्टि के लिए भुगतान भेजा गया: ₹');
 assert.equal(translateText('Your balance changes after approval.','hi'),'मंज़ूरी के बाद आपकी बाकी राशि अपडेट होगी।');
});
test('uses member terminology in Hindi labels',()=>{
 assert.equal(translateText('Member','hi'),'सदस्य');
 assert.equal(translateText('Member login','hi'),'सदस्य लॉग इन');
 assert.equal(translateText('Upload your own payment QR. Members can scan it. Record the payment after you receive it.','hi'),'अपना भुगतान QR जोड़ें। सदस्य इसे स्कैन कर सकते हैं। पैसे मिलने के बाद भुगतान दर्ज करें।');
});

test('new UI text, statuses, validation and brands use correct Hindi fallback',()=>{
 assert.equal(translateText('Order food','hi'),'भोजन ऑर्डर करें');
 assert.equal(translateText('pending_payment','hi'),'भुगतान लंबित');
 assert.equal(translateText('phone: String should match pattern abc','hi'),'फ़ोन नंबर: सही प्रारूप में विवरण दर्ज करें');
 assert.equal(translateText('Smart Mess','hi'),'Smart Mess');
 assert.equal(translateText('New content not in resources','hi'),'New content not in resources');
});
