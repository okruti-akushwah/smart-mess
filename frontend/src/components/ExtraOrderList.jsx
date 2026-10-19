import {useEffect,useState,useCallback} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from '../i18n/useTranslation';
import api,{errorMessage} from '../services/api';
import ExtraLines from './ExtraLines';
import Icon from './Icon';
import './a-la-carte.css';

export default function ExtraOrderList({owner=false}){
  const t=useTranslation(),[orders,setOrders]=useState(null),[error,setError]=useState('');
  const load=useCallback(async()=>{try{const {data}=await api.get(owner?'/owner/a-la-carte/orders':'/customer/a-la-carte/orders');if(!Array.isArray(data))throw new Error('Could not load extra orders. Please retry.');setOrders(data);setError('');}catch(e){setError(errorMessage(e));}},[owner]);
  useEffect(()=>{const first=setTimeout(load,0),timer=setInterval(load,owner?5000:15000);window.addEventListener('extras-updated',load);return()=>{clearTimeout(first);clearInterval(timer);window.removeEventListener('extras-updated',load);};},[owner,load]);
  return <section className="management-card extras-orders"><h2>{t(owner?'Extra orders to prepare':'Your extra orders')}</h2>
    {error&&<div className="alert error" role="alert"><p>{t(error)}</p><button type="button" className="btn btn-outline" onClick={load}>{t('Retry')}</button></div>}
    {orders===null&&!error&&<p role="status">{t('Loading extras…')}</p>}{orders?.length===0&&<p>{t('No extra orders yet.')}</p>}
    <div className="extras-order-list">{orders?.map(order=><article className="extras-order" key={order.id}>
      <header className="extras-order-heading">
        <div><h3>{owner?order.customer_name:t('Extra order')} <span className="extras-order-id">#{order.id}</span></h3>
          <p className="extras-order-meal"><Icon name="calendar" size={16}/><time dateTime={order.date}>{new Date(`${order.date}T00:00:00`).toLocaleDateString(t.locale,{day:'numeric',month:'short',year:'numeric'})}</time><span>·</span><span>{t(order.meal_type)}</span></p>
        </div>
        <span className="extras-order-status"><Icon name="check" size={16}/>{t('Confirmed')}</span>
      </header>
      <ExtraLines lines={order.lines} compact/>
      <div className="extras-order-total"><span>{t('Extra order total')}</span><strong>₹{Number(order.total).toLocaleString(t.locale,{minimumFractionDigits:2})}</strong></div>
      {owner?<div className="extras-order-delivery">
        <div className="extras-order-address"><Icon name="location" size={18}/><div><strong>{t('Delivery address:')}</strong><p>{order.address}</p></div></div>
        {order.instructions&&<p className="extras-order-instructions">{order.instructions}</p>}
        <a className="extras-order-phone" href={`tel:${order.customer_phone}`}>{t('Phone:')} {order.customer_phone}</a>
      </div>:order.bill_id&&<Link className="extras-order-bill" to={`/customer/checkout?bill=${order.bill_id}`}>{t('View booking bill')} <Icon name="arrow" size={16}/></Link>}
    </article>)}</div>
  </section>;
}
