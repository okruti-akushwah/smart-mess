// import { useTranslation } from "../i18n/useTranslation";
// import { useState } from "react";
// import api, { errorMessage } from "../services/api";
// export default function CustomerRegistration({ onCreated }) {
//   const translate = useTranslation();
//   const [form, setForm] = useState({ name: "", phone: "", password: "", email: "" });
//   const [message, setMessage] = useState(""),[error, setError] = useState(""),[busy, setBusy] = useState(false);
//   async function submit(e) {
//     e.preventDefault();setBusy(true);setError("");setMessage("");
//     try {
//       const r = await api.post("/owner/customers", { ...form, email: form.email || null });
//       setMessage(`Customer #${r.data.id} created. Login ID: ${form.phone}. ${r.data.email_status === "sent" ? "Credentials emailed to the customer." : r.data.email_status === "failed" ? "Email delivery failed. Share credentials manually; the account was created." : r.data.email_status === "not_configured" ? "Email sender is not configured. Share credentials manually; the account was created." : "Share the password you entered with this customer."} Then assign their subscription below.`);
//       setForm({ name: "", phone: "", password: "", email: "" });onCreated();
//     } catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
//   }
//   return <section className="management-card"><h2>{translate("Register a customer")}</h2><p>{translate("The phone number is their login ID. Enter their email to automatically send their login credentials.")}</p>{message && <p className="alert success" role="status">{translate(message)}</p>}{error && <p className="alert error" role="alert">{translate(error)}</p>}<form className="meal-form" onSubmit={submit}>{[["name", "Customer name", "text"], ["phone", "Phone / login ID", "tel"], ["email", "Customer email (optional)", "email"], ["password", "Initial password", "password"]].map(([key, label, type]) => <label className="form-field" key={key}>{translate(label)}<input required={key !== "email"} type={type} value={form[key]} minLength={key === "password" ? 5 : undefined} maxLength={key === "phone" ? 10 : key === "password" ? 72 : key === "email" ? 254 : 100} pattern={key === "phone" ? "[0-9]{10}" : undefined} autoComplete={key === "password" ? "new-password" : "off"} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}<button className="btn btn-primary" disabled={busy}>{translate(busy ? "Creating…" : "Create customer login")}</button></form></section>;
// }
