import './customerJourney.css';
import PurchaseSteps from './PurchaseSteps';

// A presentation boundary keeps customer styles out of the shared owner tools.
export default function CustomerPage({ className = '', children, showJourney = true }) {
  return <main className={`dashboard customer-page ${className}`.trim()}>{showJourney && <PurchaseSteps />}{children}</main>;
}
