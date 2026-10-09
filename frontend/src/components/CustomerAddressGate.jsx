import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api, { errorMessage } from "../services/api";

export default function CustomerAddressGate({ children }) {
  const { pathname } = useLocation();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    api.get("/delivery/address").then(r => { if (live) setState({ path: pathname, ready: Boolean(r.data.address?.trim()) }); })
      .catch(e => { if (live) setState({ path: pathname, error: errorMessage(e) }); });
    return () => { live = false; };
  }, [pathname]);
  if (pathname === "/customer/address") return children;
  if (state.path !== pathname) return <main className="dashboard"><p role="status">Checking your delivery details…</p></main>;
  if (state.error) return <main className="dashboard"><p className="alert error" role="alert">{state.error}</p><button className="btn btn-outline" onClick={() => window.location.reload()}>Try again</button></main>;
  if (state.loading) return <main className="dashboard"><p role="status">Checking your delivery details…</p></main>;
  if (!state.ready) return <Navigate to="/customer/address" replace />;
  return children;
}
