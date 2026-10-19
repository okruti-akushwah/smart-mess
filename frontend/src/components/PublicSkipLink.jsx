import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';

export default function PublicSkipLink() {
  const { pathname } = useLocation();
  const translate = useTranslation();
  const publicPage = !/^\/(owner|customer)(\/|$)/.test(pathname);
  useEffect(() => {
    if (!publicPage) return;
    const main = document.querySelector('main');
    if (!main) return;
    const id = main.getAttribute('id'), tabIndex = main.getAttribute('tabindex');
    if (!id) main.id = 'page-content';
    main.tabIndex = -1;
    return () => {
      if (!id) main.removeAttribute('id');
      if (tabIndex === null) main.removeAttribute('tabindex');
      else main.setAttribute('tabindex', tabIndex);
    };
  }, [pathname, publicPage]);
  if (!publicPage) return null;
  return <a className="page-skip" href="#page-content" onClick={event => {
    const main = document.querySelector('main');
    if (main) { event.preventDefault(); main.focus(); main.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }
  }}>{translate('Skip to content')}</a>;
}
