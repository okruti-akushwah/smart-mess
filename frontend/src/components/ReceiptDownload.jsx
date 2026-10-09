import { useState } from "react";
import api, { errorMessage } from "../services/api";
import { useTranslation } from "../i18n/useTranslation";

export default function ReceiptDownload({ receiptId }) {
  const translate = useTranslation();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await api.get(`/payments/receipts/${receiptId}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = `smart-mess-receipt-${receiptId}.html`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { setError(errorMessage(e, "Unable to download your receipt. Please try again.")); }
    finally { setBusy(false); }
  }
  return <div><button type="button" className="btn btn-outline" disabled={busy} onClick={download} aria-label={translate(`Download receipt #${receiptId}`)}>{translate(busy ? "Downloading…" : "Download receipt")}</button>{error && <p className="alert error" role="alert">{translate(error)}</p>}</div>;
}
