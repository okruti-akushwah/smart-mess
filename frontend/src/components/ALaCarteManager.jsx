import {useEffect,useState} from 'react';
import {useTranslation} from '../i18n/useTranslation';
import api,{errorMessage} from '../services/api';
import './a-la-carte.css';

const empty=()=>({name:'',name_hi:'',description:'',description_hi:'',price:'',available:true,meal_types:['lunch','dinner']});
export default function ALaCarteManager(){
  const t=useTranslation();
  const [items,setItems]=useState(null),[form,setForm]=useState(empty),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function load(){try{const {data}=await api.get('/owner/a-la-carte/items');setItems(data);setError('');}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{let active=true;api.get('/owner/a-la-carte/items').then(({data})=>{if(active)setItems(data);}).catch(e=>{if(active)setError(errorMessage(e));});return()=>{active=false;};},[]);
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{const payload={...form,price:Number(form.price).toFixed(2)};if(editing)await api.put(`/owner/a-la-carte/items/${editing}`,payload);else await api.post('/owner/a-la-carte/items',payload);setForm(empty());setEditing(null);setMessage('Extra item saved.');await load();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  return <section className="management-card" id="a-la-carte-catalogue"><h2>{t('À la carte menu')}</h2><p>{t('Offer extra dishes alongside booked meals. Unavailable items remain in past order records.')}</p>
    {items===null&&!error&&<p role="status">{t('Loading extras…')}</p>}
    {items?.length===0&&<p>{t('No extra items yet. Add your first item below.')}</p>}
    {items?.map(item=><article className="extras-item" key={item.id}><div><h3>{t.locale==='hi-IN'&&item.name_hi?.trim()?item.name_hi:item.name}</h3><p>₹{Number(item.price).toLocaleString(t.locale,{minimumFractionDigits:2})} · {item.meal_types.map(t).join(' · ')}</p><span className="status-badge">{t(item.available?'Available':'Unavailable')}</span></div><button className="btn btn-outline" type="button" disabled={busy} aria-label={`${t('Edit extra item')}: ${item.name}`} onClick={()=>{setEditing(item.id);setForm({...item});setMessage('');}}>{t('Edit')}</button></article>)}
    <form className="meal-form" onSubmit={save}><h3 className="form-wide">{t(editing?'Edit extra item':'Add extra item')}</h3>
      {['name','name_hi','description','description_hi'].map((field,index)=><label className="form-field" key={field}>{t(['Item name (English)','Item name (Hindi, optional)','Description (English, optional)','Description (Hindi, optional)'][index])}<input required={field==='name'} disabled={busy} maxLength={field.startsWith('description')?500:100} value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}/></label>)}
      <label className="form-field">{t('Price per item (₹)')}<input type="number" required min="0.01" max="10000" step="0.01" disabled={busy} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>
      <fieldset className="form-wide"><legend>{t('Available with these meals')}</legend><div className="form-actions">{['breakfast','lunch','dinner'].map(type=><label key={type}><input type="checkbox" disabled={busy} checked={form.meal_types.includes(type)} onChange={e=>setForm({...form,meal_types:e.target.checked?[...form.meal_types,type]:form.meal_types.filter(v=>v!==type)})}/>{t(type)}</label>)}</div></fieldset>
      <label className="form-wide"><input type="checkbox" disabled={busy} checked={form.available} onChange={e=>setForm({...form,available:e.target.checked})}/>{t('Available for ordering')}</label>
      {!form.meal_types.length&&<p className="form-wide" role="status">{t('Choose at least one meal type.')}</p>}
      <div className="form-actions"><button className="btn btn-primary" disabled={busy||!form.meal_types.length}>{t(busy?'Saving…':'Save extra item')}</button>{editing&&<button className="btn btn-outline" type="button" disabled={busy} onClick={()=>{setEditing(null);setForm(empty());}}>{t('Cancel')}</button>}</div>
    </form>{error&&<div className="alert error" role="alert"><p>{t(error)}</p><button className="btn btn-outline" type="button" disabled={busy} onClick={load}>{t('Retry')}</button></div>}{message&&<p role="status">{t(message)}</p>}
  </section>;
}
