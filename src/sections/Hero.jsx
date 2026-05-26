import React from 'react';
import PulseGlyph from '../components/PulseGlyph.jsx';
import { identity } from '../data/identity.js';

export default function Hero() {
  return (
    <section id="home" className="section hero">
      <div className="hero__col-text">
        <h1 className="hero__brand">orbit</h1>
        <p className="hero__tagline">
          the agent memory<br />and infrastructure layer<br />for github <em>repositories</em>.
        </p>
        <p className="hero__desc">{identity.description}</p>
        <p className="hero__motto">built to outlive its founder.</p>
        <div className="hero__chips">
          <span className="chip">memory</span>
          <span className="chip">permissions</span>
          <span className="chip">capabilities</span>
          <span className="chip">receipts</span>
        </div>
      </div>

      <div className="hero__col-glyph">
        <PulseGlyph size={360} />
      </div>
    </section>
  );
}
