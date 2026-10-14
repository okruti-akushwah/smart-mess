import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { returnTo } from "../services/authRouting";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
import "../components/customerJourney.css";

export default function CustomerAddress() {
  const navigate = useNavigate();
  const location = useLocation();
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api.get("/delivery/address").then(r => { if (live) { setAddress(r.data.address); setInstructions(r.data.instructions); } })
      .catch(e => { if (live) setError(errorMessage(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  async function save(e) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.put("/delivery/address", { address, instructions }); navigate(returnTo(location, "/customer/choose"), { replace: true }); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <><Navbar title="Delivery address" /><main className="dashboard journey-page"><section className="management-card address-card"><p className="eyebrow">STEP 1 OF 3 · DELIVERY</p><h1>Where should we bring your food?</h1><p className="muted">Save your delivery address, then choose a plan or taste a single meal first.</p>{error && <p className="alert error" role="alert">{error}</p>}{loading ? <p role="status">Loading your address…</p> : <form onSubmit={save} className="journey-form"><label className="form-field">Full delivery address<textarea required minLength={10} maxLength={500} rows={4} placeholder="House / flat number, building, street, area, city and PIN code" value={address} onChange={e => setAddress(e.target.value)} /></label><label className="form-field">Delivery instructions <span className="muted">(optional)</span><input maxLength={250} placeholder="Landmark, gate or floor details" value={instructions} onChange={e => setInstructions(e.target.value)} /></label><p className="muted">Confirm that your address is within your mess owner's delivery area before paying.</p><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save address & choose food →"}</button></form>}</section></main></>;
}
