import api from './api';
const cache = new Map();
let queue = [], scheduled = false;
async function flush() {
  scheduled=false;
  const items=queue.splice(0,20);
  if(queue.length){scheduled=true;queueMicrotask(flush);}
  try {
    const {data}=await api.post('/translations',{language:'hi',records:items.map(item=>item.record)},{timeout:20000});
    items.forEach((item,index)=>{
      const result=data.translations[index];
      const text=result?.translated && result.source===item.source ? result.text : item.source;
      cache.set(item.key,{text,expires:Date.now()+(result?.translated?86400000:5000)});
      item.resolve(text);
    });
  } catch {items.forEach(item=>{cache.delete(item.key);item.resolve(item.source);});}
}
export function translateSaved(record,source) {
  const key=JSON.stringify([api.defaults.baseURL,record,source]);
  const found=cache.get(key);
  if(found?.pending)return found.pending;
  if(found?.expires>Date.now())return Promise.resolve(found.text);
  const pending=new Promise(resolve=>queue.push({key,record,source,resolve}));
  cache.set(key,{pending});
  if(cache.size>1000){for(const [oldKey,value] of cache){if(!value.pending){cache.delete(oldKey);break;}}}
  if(!scheduled){scheduled=true;queueMicrotask(flush);}
  return pending;
}
