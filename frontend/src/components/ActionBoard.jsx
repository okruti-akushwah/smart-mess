import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './Icon';
import './action-board.css';

const actions = {
  customer: [
    ['/customer/choose?type=meal', 'Order a meal', "See what's cooking", 'meal', 'mint'],
    ['/customer/plans/browse', 'Browse plans', 'Find your everyday favourite', 'calendar', 'peach'],
    ['/customer/pause', 'Pause meals', 'Make room for your plans', 'pause', 'lilac'],
    ['/customer/bills', 'Bills & payments', 'Keep everything in view', 'bill', 'sky'],
  ],
  owner: [
    ['/owner/meals', 'Manage your menu', 'Bring your weekly menu to life', 'meal', 'mint'],
    ['/owner/customers', 'Members', 'Your food community', 'people', 'peach'],
    ['/owner/requests', 'Requests', 'See what needs your attention', 'inbox', 'lilac'],
    ['/owner/payments', 'Payments', 'Keep payment records clear', 'bill', 'sky'],
  ],
};

export default function ActionBoard({ role }) {
  const translate = useTranslation();
  return <nav className="action-board" aria-label={translate(role === 'owner' ? 'Your kitchen shortcuts' : 'Your meal shortcuts')}>
    {actions[role].map(([to, title, detail, icon, tone]) => <Link key={to} to={to} className={`action-tile action-${tone}`}>
      <span className="action-tile-icon"><Icon name={icon} size={24} /></span>
      <span className="action-tile-copy"><strong>{translate(title)}</strong><small>{translate(detail)}</small></span>
      <span className="action-tile-arrow"><Icon name="arrow" size={18} /></span>
    </Link>)}
  </nav>;
}
