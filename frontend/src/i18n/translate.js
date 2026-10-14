import i18n, { normalise } from "./i18n.js";
export function translateText(value, language) {
  if(language !== 'hi' || typeof value !== 'string' || !value.trim()) return value;
  const key=normalise(value);
  const legacyMemberKey=key.replace(/\bmembers?\b/gi, word => ({ Member: "Customer", Members: "Customers", member: "customer", members: "customers", MEMBER: "CUSTOMER", MEMBERS: "CUSTOMERS" })[word] || word);
  const translated = i18n.exists(key, {lng:'hi', fallbackLng:false}) ? i18n.t(key, {lng:'hi'})
    : i18n.exists(legacyMemberKey, {lng:'hi', fallbackLng:false}) ? i18n.t(legacyMemberKey, {lng:'hi'}) : null;
  if(translated !== null) return value.match(/^\s*/)[0]+translated.replace(/ग्राहक/g, "सदस्य")+value.match(/\s*$/)[0];
  const patterns=[
    [/^([^:]+): (.+)$/, match => `${translateText(match[1], 'hi')}: ${translateText(match[2], 'hi')}`],
    [/^Value error, (.+)$/, match => translateText(match[1], 'hi')],
    [/^String should have at least (\d+) characters$/, match => `कम से कम ${match[1]} अक्षर दर्ज करें`],
    [/^String should have at most (\d+) characters$/, match => `अधिकतम ${match[1]} अक्षर दर्ज करें`],
    [/^String should match pattern .+$/, () => 'सही प्रारूप में विवरण दर्ज करें'],
    [/^Input should be greater than (.+)$/, match => `${match[1]} से बड़ी राशि दर्ज करें`],
    [/^Input should be greater than or equal to (.+)$/, match => `${match[1]} या उससे बड़ी संख्या दर्ज करें`],

    [/^Join (.+)$/, match => `${match[1]} से जुड़ें`],
    [/^About (.+)$/, match => `${match[1]} के बारे में`],
    [/^Edit (.+)$/, match => `${translateText(match[1], 'hi')} बदलें`],
    [/^(.+) · (\d+) days · ₹(.+)$/, match => `${match[1]} · ${match[2]} दिन · ₹${match[3]}`],
    [/^(.+) already exists for (\d{4}-\d{2}-\d{2})$/, match => `${translateText(match[1], 'hi')} ${match[2]} के लिए पहले से मौजूद है`],
  ];
  for(const [pattern,replace] of patterns) { const match=key.match(pattern); if(match)return replace(match); }
  return value;
}
