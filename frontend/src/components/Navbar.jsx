import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { useTranslation } from "../i18n/useTranslation";
import BillNotification from "./BillNotification";
import NotificationSound from "./NotificationSound";
import Icon from "./Icon";
import { Link, useNavigate, useLocation } from "react-router-dom";

import Button from './ui/Button';
import Drawer from './ui/Drawer';
import './navbar.css';

const navIcon = label => ({ Dashboard: 'home', 'AI Advisor': 'wand', Members: 'people', 'My messes': 'people', Requests: 'inbox', Meals: 'meal', 'Order food': 'meal', Subscription: 'calendar', Subscriptions: 'calendar', 'Pause meals': 'pause', 'Skip meals': 'pause', Bills: 'bill', Payments: 'bill', 'Meal history': 'calendar', Reviews: 'star', Settings: 'settings', 'Public page': 'home' }[label] || 'home');

function Navbar({ title = "Dashboard" }) {
  const translate = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [openFor, setOpenFor] = useState(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [desktopNavigation, setDesktopNavigation] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1100px)').matches);
  const menuOpen = openFor === location.key;
  const mainRef = useRef(null);
  const menuTriggerRef = useRef(null);
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    mainRef.current = main;
    const previousId = main.getAttribute('id');
    const previousTabIndex = main.getAttribute('tabindex');
    if (!previousId) main.id = 'workspace-content';
    main.tabIndex = -1;
    return () => {
      if (!previousId) main.removeAttribute('id');
      if (previousTabIndex === null) main.removeAttribute('tabindex');
      else main.setAttribute('tabindex', previousTabIndex);
    };
  }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(min-width: 1100px)');
    const update = () => setDesktopNavigation(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    let lastY = window.scrollY;
    const updateHeader = () => {
      const nextY = window.scrollY;
      if (nextY < 24 || nextY < lastY) setHeaderVisible(true);
      else if (nextY > lastY + 8) setHeaderVisible(false);
      lastY = nextY;
    };
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);
  const role = localStorage.getItem('role');
  const isMessDirectory = location.pathname === '/customer/messes';
  const [messName, setMessName] = useState('');
  useEffect(() => {
    if (role !== 'customer' || isMessDirectory) return;
    let active = true;
    api.get('/customer/account').then(({ data }) => {
      if (active) setMessName(data.mess_name);
    }).catch(() => {});
    return () => { active = false; };
  }, [role, isMessDirectory]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('activeMessToken');
    navigate('/login');
  };

  const links = role === 'owner' ? [
    ['/owner', 'Dashboard'], ['/owner/requests', 'Requests'], ['/owner/customers', 'Members'],
    ['/owner/meals', 'Meals'], ['/owner/plans', 'Subscriptions'], ['/owner/payments', 'Payments'],
    ['/owner/bills', 'Bills'], ['/owner/reviews', 'Reviews'], ['/owner/kitchen-advisor', 'AI Advisor'],
    ['/owner/settings', 'Settings'],
  ] : [
    ['/customer/messes', 'My messes'], ['/customer', 'Dashboard'], ['/customer#skip-meals', 'Skip meals'], ['/customer/choose?type=meal', 'Order food'],
    ['/customer/plans', 'Subscriptions'], ['/customer/pause', 'Pause meals'],
    ['/customer/history', 'Meal history'], ['/customer/bills', 'Bills'], ['/customer/reviews', 'Reviews'],
  ];
  const primaryLabels = role === 'owner'
    ? ['Dashboard', 'Requests', 'Meals', 'Subscriptions']
    : ['My messes', 'Dashboard', 'Order food', 'Subscriptions'];
  const primaryLinks = links.filter(([, label]) => primaryLabels.includes(label));
  const secondaryLinks = links.filter(([, label]) => !primaryLabels.includes(label));
  const secondaryPage = !primaryLinks.some(([path]) => (path === '/customer#skip-meals' ? location.pathname === '/customer' && location.hash === '#skip-meals' : location.pathname === path.split(/[?#]/)[0] || (path === '/customer/plans' && location.pathname.startsWith('/customer/plans/'))));
  const navigation = (items = links) => items.map(([path, label]) => <Link key={path} to={path}
    aria-current={(path === '/customer#skip-meals' ? location.pathname === '/customer' && location.hash === '#skip-meals' : location.pathname === path.split(/[?#]/)[0] && !(label === 'Dashboard' && location.hash === '#skip-meals')) || (path === '/customer/plans' && location.pathname.startsWith('/customer/plans/')) ? 'page' : undefined}
    onClick={() => setOpenFor(null)}><Icon name={navIcon(label)} /><span>{translate(label)}</span></Link>);
  const tools = <div className="workspace-utility-tools">
    <div className="workspace-account-tools"><NotificationSound role={role} compact />{role === 'customer' && <BillNotification />}<Button variant="outline" className="workspace-logout" onClick={logout}>{translate('Logout')}</Button></div>
  </div>;

  return <header className={`workspace-shell ${role === 'owner' ? 'owner-shell' : 'customer-shell'}${headerVisible ? '' : ' workspace-shell-hidden'}`}>
    <a className="workspace-skip" href="#workspace-content" onClick={event => {
      const main = mainRef.current;
      if (main) { event.preventDefault(); main.focus(); main.scrollIntoView?.({ block: 'start' }); }
    }}>{translate('Skip to content')}</a>
    <div className="workspace-topbar">
      <Link className="workspace-brand" to={role === 'owner' ? '/owner' : role === 'customer' ? '/customer' : '/'}>
        <span className="workspace-mark" aria-hidden="true"><Icon name="meal" /></span>
        <span className="workspace-brand-copy"><strong>{isMessDirectory ? translate('Smart Mess') : messName || translate('Smart Mess')}</strong><small>{translate('Fresh meals. Less waste.')}</small></span>
      </Link>
      <nav className="workspace-desktop-nav" aria-label={translate('Main navigation')}>{navigation(primaryLinks)}</nav>
      <div className="workspace-top-actions">
        <div className={`workspace-navigation-control${secondaryPage ? ' workspace-navigation-control-active' : ''}`} role="group" aria-label={translate('Menu')}>
          <Button ref={menuTriggerRef} variant="outline" className="workspace-menu-toggle" aria-label={translate('More navigation')} aria-haspopup="dialog" aria-controls={menuOpen ? 'workspace-navigation' : undefined} aria-expanded={menuOpen} onClick={() => setOpenFor(location.key)}><Icon name="menu" /><span className="workspace-menu-label">{translate('Menu')}</span><span className="workspace-more-label" aria-hidden="true">{translate('More')}</span></Button>
        </div>
        {tools}
      </div>
    </div>
    <Drawer id="workspace-navigation" open={menuOpen} title={translate('More options')} onClose={() => setOpenFor(null)} className="workspace-menu-drawer" desktopPopover anchorRef={menuTriggerRef}>
      <p className="workspace-menu-context">{translate(title)}</p>
      <nav className="workspace-menu-nav" aria-label={translate(desktopNavigation ? 'More navigation' : 'Main navigation')}>{navigation(desktopNavigation ? secondaryLinks : links)}</nav>
    </Drawer>
  </header>;
}

export default Navbar;
