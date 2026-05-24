import React, { useEffect, useState } from 'react';
import Nav from './components/Nav.jsx';
import BackgroundOrbit from './components/BackgroundOrbit.jsx';
import CursorMoon from './components/CursorMoon.jsx';
import Footer from './components/Footer.jsx';
import Hero from './sections/Hero.jsx';
import Live from './sections/Live.jsx';
import Roadmap from './sections/Roadmap.jsx';
import Inspect from './sections/Inspect.jsx';

const SECTION_FOR_PATH = {
  '/': 'home',
  '/home': 'home',
  '/live': 'live',
  '/roadmap': 'roadmap',
  '/inspect': 'inspect',
};

function sectionFromPath(pathname) {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return SECTION_FOR_PATH[trimmed] || 'home';
}

const PANELS = {
  home: Hero,
  live: Live,
  roadmap: Roadmap,
  inspect: Inspect,
};

export default function App() {
  const [section, setSection] = useState(() =>
    typeof window === 'undefined' ? 'home' : sectionFromPath(window.location.pathname)
  );

  useEffect(() => {
    const onPop = () => setSection(sectionFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);

    const onClick = (e) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[data-path]');
      if (!a) return;
      const path = a.getAttribute('data-path');
      if (!path) return;
      e.preventDefault();
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
      }
      setSection(sectionFromPath(path));
    };
    document.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const Panel = PANELS[section] || Hero;

  return (
    <div className="app">
      <BackgroundOrbit />
      <CursorMoon />
      <Nav active={section} />
      <main className="stage" key={section}>
        <Panel />
      </main>
      <Footer />
    </div>
  );
}
