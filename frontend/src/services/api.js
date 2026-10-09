import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map(item => `${item.loc?.slice(1).join(".") || "Input"}: ${item.msg}`).join(" · ");
  return typeof detail === "string" ? detail : fallback;
}

api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !error.config?.url?.startsWith("/auth/")) {
    const loginPath = localStorage.getItem("role") === "owner" ? "/owner/login" : "/login";
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.assign(loginPath);
  }
  return Promise.reject(error);
});

export default api;

