import { useEffect, useState } from "react";
import api, { errorMessage } from "./api";

export default function useSignupSettings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get("/auth/signup/settings").then(({ data }) => {
      if (active) setSettings(data);
    }).catch(err => { if (active) setError(errorMessage(err, "Unable to load registration settings. Please refresh.")); });
    return () => { active = false; };
  }, []);
  return { settings, settingsError: error };
}
