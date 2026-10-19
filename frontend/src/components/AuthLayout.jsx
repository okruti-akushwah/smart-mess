import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './Icon';
import './auth-layout.css';

export default function AuthLayout({ title, description, features, children }) {
  const translate = useTranslation();
  return <main className="auth-layout auth-page">
    <section className="auth-form-side">
      <Link className="auth-home-link" to="/"><Icon name="meal" />{translate('Smart Mess')}</Link>
      <div className="auth-card">{children}</div>
    </section>
    <aside className="auth-hero"><div className="auth-hero-content">
      <p className="auth-hero-kicker">{translate('Fresh meals. Less waste.')}</p>
      <h2>{title}</h2><p>{description}</p>
      {features && <div className="hero-features">{features.map(feature => <span key={feature}><Icon name="check" />{feature}</span>)}</div>}
      <p className="auth-image-note">{translate('Illustrative meal photo')}</p>
    </div></aside>
  </main>;
}
