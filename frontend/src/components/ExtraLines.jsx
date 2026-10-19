import {useTranslation} from '../i18n/useTranslation';
export default function ExtraLines({lines = [], compact = false}) {
  const t = useTranslation();
  if (!lines.length) return null;
  if (compact) return <div className="extra-lines extra-lines-compact"><strong>{t('À la carte items')}</strong><ul>{lines.map((line,index)=><li key={`${line.order_id}-${line.item_id}-${index}`}>
    <div><span className="extras-line-name">{t.locale === 'hi-IN' && line.name_hi?.trim() ? line.name_hi : line.name}</span><span className="extras-line-quantity">{line.quantity.toLocaleString(t.locale)} × ₹{Number(line.unit_price).toLocaleString(t.locale,{minimumFractionDigits:2})}</span></div>
    <strong>₹{Number(line.total).toLocaleString(t.locale,{minimumFractionDigits:2})}</strong>
  </li>)}</ul></div>;
  return <div className="extra-lines"><strong>{t('À la carte items')}</strong><ul>{lines.map((line,index) => <li key={`${line.order_id}-${line.item_id}-${index}`}>
    <span>{t.locale === 'hi-IN' && line.name_hi?.trim() ? line.name_hi : line.name}</span>{' · '}{line.quantity.toLocaleString(t.locale)} × ₹{Number(line.unit_price).toLocaleString(t.locale,{minimumFractionDigits:2})}{' = '}₹{Number(line.total).toLocaleString(t.locale,{minimumFractionDigits:2})}
  </li>)}</ul></div>;
}
