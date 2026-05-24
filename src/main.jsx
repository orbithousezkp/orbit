import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import ProofInspector from './ProofInspector.jsx';
import './index.css';

function routeFor(hash) {
  if (hash === '#brand') return 'brand';
  if (hash === '#inspect' || hash === '#proof' || hash.startsWith('#inspect?') || hash.startsWith('#proof?')) {
    return 'inspect';
  }
  return 'dashboard';
}

function Root() {
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const route = routeFor(hash);
  if (route === 'brand') return <App />;
  if (route === 'inspect') return <ProofInspector />;
  return <Dashboard />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
