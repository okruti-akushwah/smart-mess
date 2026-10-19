import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import Dialog from './ui/Dialog';
import {useTranslation} from '../i18n/useTranslation';
import api,{errorMessage} from '../services/api';
import './a-la-carte.css';

export default function MealExtras({meal,onUpdate}) {
  const t=useTranslation();
  const [open,setOpen]=useState(false),[catalogue,setCatalogue]=useState(null),[quantities,setQuantities]=useState({});
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(null),[uncertain,setUncertain]=useState(false);
  const request=useRef(null);
  const name=item=>t.locale==='hi-IN' && item.name_hi?.trim() ? item.name_hi : item.name;
  const money=value=>Number(value).toLocaleString(t.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
  async function load() {
    setLoading(true);setError('');
    try {const {data}=await api.get('/customer/a-la-carte/items',{params:{meal_id:meal.id}});setCatalogue(data);setQuantities({});}
    catch(e){setCatalogue(null);setError(errorMessage(e));}finally{setLoading(false);}
  }
  const selected=(catalogue?.items || []).filter(item=>Number(quantities[item.id])>0);
  const total=selected.reduce((sum,item)=>sum+Number(item.price)*Number(quantities[item.id]),0);
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');
    if (!request.current) request.current={meal_id:meal.id,plan_id:catalogue.plan_id,purchase_key:crypto.randomUUID(),lines:selected.map(item=>({item_id:item.id,quantity:Number(quantities[item.id]),expected_unit_price:Number(item.price).toFixed(2)}))};
    try {const {data}=await api.post('/customer/a-la-carte/orders',request.current);setSuccess(data);setUncertain(false);request.current=null;onUpdate?.();window.dispatchEvent(new Event('extras-updated'));}
    catch(e){setError(errorMessage(e));if(e.response?.status>=400 && e.response.status<500){request.current=null;setUncertain(false);}else setUncertain(true);}
    finally{setBusy(false);}
  }
  return <><button className="btn btn-outline" type="button" onClick={()=>{setOpen(true);if(!request.current){setSuccess(null);load();}}}>{t('Add extras')}</button>
    {open && <Dialog open title={t('Add something extra')} busy={busy} onClose={()=>setOpen(false)}><p>{t(meal.meal_type)} · {meal.date}</p>
      {success ? <div role="status"><p>{t('Extra order confirmed. Your booking bill has been updated.')}</p><p>{t('Extra order total')}: ₹{money(success.total)}</p><Link className="btn btn-primary" to={`/customer/checkout?bill=${success.bill_id}`}>{t('Pay extra balance')}</Link></div> : <>
        <p>{t('Extras are charged separately from your regular meal. Confirmed orders require contacting your owner for changes.')}</p>
        {loading && <p role="status">{t('Loading extras…')}</p>}
        {!loading && catalogue && !catalogue.items.length && <p role="status">{t('No extras available for this meal.')}</p>}
        {catalogue?.items.length>0 && <form onSubmit={submit}><div className="extras-item-list">{catalogue.items.map(item=><div className="extras-item" key={item.id}><div><strong>{name(item)}</strong><p>{t.locale==='hi-IN' && item.description_hi?.trim()?item.description_hi:item.description}</p><p>₹{money(item.price)}</p></div><label>{t('Quantity')}<input aria-label={name(item)} type="number" min="0" max="100" step="1" value={quantities[item.id]??0} disabled={busy||uncertain} onChange={e=>setQuantities(previous=>({...previous,[item.id]:e.target.value}))}/></label></div>)}</div>
          <div className="bill-total" data-testid="extras-total"><span>{t('Extra order total')}</span><strong>₹{money(total)}</strong></div><button className="btn btn-primary" type="submit" disabled={busy||!selected.length}>{t(busy?'Saving…':'Confirm extra order')}</button>
        </form>}
        {uncertain && <p role="status">{t('The order result is uncertain. Retry this same order to check it without charging twice.')}</p>}
        <button className="btn btn-outline" type="button" disabled={loading||busy||uncertain} onClick={load}>{t('Refresh items')}</button>
      </>}{error&&<p className="alert error" role="alert">{t(error)}</p>}
    </Dialog>}
  </>;
}
