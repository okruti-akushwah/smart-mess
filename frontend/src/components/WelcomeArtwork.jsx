import thali from '../assets/thali.png';
import Icon from './Icon';
import { useTranslation } from '../i18n/useTranslation';
import './action-board.css';

export default function WelcomeArtwork() {
  const translate = useTranslation();
  return <figure className="welcome-artwork"><span className="welcome-artwork-orbit" aria-hidden="true" /><img src={thali} alt="" width="800" height="696" /><figcaption><Icon name="meal" size={16} />{translate('Illustrative meal photo')}</figcaption></figure>;
}
