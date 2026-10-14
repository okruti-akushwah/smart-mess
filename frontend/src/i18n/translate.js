import { dictionary } from "./hi.js";
const lookup = new Map(Object.entries(dictionary).map(([key,value]) => [normalise(key),value]));
function normalise(value) { return value.replace(/\s+/g, ' ').trim().replace(/[’‘]/g, "'").replace(/…/g, '...'); }
export function translateText(value, language) {
  if(language !== 'hi' || typeof value !== 'string' || !value.trim()) return value;
  const key=normalise(value);
  const legacyMemberKey=key.replace(/\bmembers?\b/gi, word => ({ Member: "Customer", Members: "Customers", member: "customer", members: "customers", MEMBER: "CUSTOMER", MEMBERS: "CUSTOMERS" })[word] || word);
  const translated=lookup.get(key) || lookup.get(legacyMemberKey);
  if(translated) return value.match(/^\s*/)[0]+translated.replace(/ग्राहक/g, "सदस्य")+value.match(/\s*$/)[0];
  const patterns=[
    [/^Join (.+)$/, match => `${match[1]} से जुड़ें`],
    [/^About (.+)$/, match => `${match[1]} के बारे में`],
    [/^Edit (.+)$/, match => `${translateText(match[1], 'hi')} बदलें`],
    [/^(.+) · (\d+) days · ₹(.+)$/, match => `${match[1]} · ${match[2]} दिन · ₹${match[3]}`],
    [/^(.+) already exists for (\d{4}-\d{2}-\d{2})$/, match => `${translateText(match[1], 'hi')} ${match[2]} के लिए पहले से मौजूद है`],
  ];
  for(const [pattern,replace] of patterns) { const match=key.match(pattern); if(match)return replace(match); }
  return value;
}
