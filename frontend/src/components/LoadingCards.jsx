import './public-states.css';

export default function LoadingCards({ label, count = 3 }) {
  return <div className="public-loading" role="status" aria-busy="true"><span className="public-loading-label">{label}</span><div className="public-loading-grid" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div className="public-loading-card" key={index}><span /><span /><span /></div>)}</div></div>;
}
