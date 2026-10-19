import LoadingCards from './LoadingCards';
import Button from './ui/Button';
import './public-reviews.css';
import DynamicText from "../components/DynamicText";
import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';

export default function PublicReviews({ token }) {
  const translate = useTranslation();
  const [reviews, setReviews] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setReviews((await api.get('/public/reviews', { params: { mess_token: token } })).data); }
    catch (e) { setError(errorMessage(e, 'Could not load member reviews.')); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);
  const average = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;
  return <section className="mess-section mess-wrap public-reviews" id="reviews"><div className="section-heading"><div><p className="eyebrow">{translate('FROM OUR MEMBERS')}</p><h2>{translate('A taste of their experience.')}</h2>{average && <p className="review-summary"><strong>{average} / 5</strong> · {reviews.length} {translate('recent reviews')}</p>}</div><Button variant="outline" loading={loading} onClick={load}>{translate('Refresh reviews')}</Button></div>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {loading && !reviews.length ? <LoadingCards label={translate('Loading reviews…')} /> : !error && !reviews.length ? <p className="public-empty">{translate('No member reviews yet. Ratings will appear after members review their meals.')}</p> : <div className="public-review-grid">{reviews.map(review => <article className="public-review-card" key={review.id}><div className="review-stars" aria-label={translate(`${review.rating} out of 5 stars`)}><span aria-hidden="true">{'★'.repeat(review.rating)}<span className="empty-stars">{'☆'.repeat(5 - review.rating)}</span></span></div>{review.comment?.trim() ? <blockquote>{review.comment}</blockquote> : <p className="muted">{translate('Rated this meal')}</p>}<div className="review-person"><span className="review-avatar" aria-hidden="true">{review.name.charAt(0).toUpperCase()}</span><div><strong>{review.name}</strong><p><DynamicText kind="meal" id={review.meal_id || review.id} field="menu_description" source={review.menu} /></p></div></div></article>)}</div>}
  </section>;
}
