import React from 'react';
import ReactDOM from 'react-dom/client';
import { startTrail } from './lib/trail.js';
import App from './App.jsx';
import './styles.css';

startTrail();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// רישום ה-service worker (רק בייצור - בפיתוח הוא היה מפריע לרענון החם)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* לא קריטי */ });
  });
}
