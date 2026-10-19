import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { useTranslation } from '../i18n/useTranslation';
import './action-board.css';

export default function PurchaseSteps() {
  const { pathname, search } = useLocation();
  const translate = useTranslation();
  if (!['/customer/address', '/customer/choose', '/customer/plans/browse', '/customer/checkout'].includes(pathname)) return null;
  const current = pathname === '/customer/address' ? 0 : pathname === '/customer/checkout' ? 2 : 1;
  const steps = [
    ['/customer/address', 'Delivery address', 'home'],
    [pathname === '/customer/plans/browse' ? pathname : '/customer/choose?type=meal', 'Choose your food', 'meal'],
    [pathname === '/customer/checkout' ? `${pathname}${search}` : null, 'Complete payment', 'bill'],
  ];
  return <nav className="purchase-steps" aria-label={translate('Your meal journey')}><ol>{steps.map(([to, label, icon], index) => {
    const content = <><span className="purchase-step-number">{index + 1}</span><Icon name={icon} size={18} /><span>{translate(label)}</span></>;
    return <li key={label}>{to ? <Link to={to} aria-current={index === current ? 'step' : undefined}>{content}</Link> : <span className="purchase-step-future">{content}</span>}</li>;
  })}</ol>{current < 2 && <p className="purchase-step-hint">{translate('Choose your food before proceeding to payment.')}</p>}</nav>;
}
