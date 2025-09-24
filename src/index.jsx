// src/index.jsx
const saved = localStorage.getItem('theme')
const osPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const theme = saved || (osPrefersDark ? 'dark' : 'light')
document.documentElement.classList.add(theme)

import React       from "react";
import ReactDOM    from "react-dom/client";
import "./styles/Global.module.css";

import App from "./components/App";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import reportWebVitals from "./reportWebVitals";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Elemento com id 'root' não encontrado");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

reportWebVitals();
