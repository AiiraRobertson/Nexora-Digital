import { useMemo, useState } from 'react';

const platformContent = {
  fintech: {
    kicker: 'Fintech systems',
    title: 'Launch secure wallets, payments, lending, and investment platforms.',
    copy: 'Architecture, UX, API integration, reconciliation flows, KYC journeys, admin portals, analytics, cloud monitoring, and regression-safe release management.',
    points: [
      'Payment gateway and settlement workflow integration',
      'Identity, onboarding, and customer support dashboards',
      'Automated QA for transaction-heavy product releases'
    ]
  },
  saas: {
    kicker: 'SaaS products',
    title: 'Turn internal expertise into subscription-ready web and mobile products.',
    copy: 'From MVP scope and pricing logic to onboarding, dashboards, permissions, billing, usage analytics, cloud operations, and continuous product discovery.',
    points: [
      'Role-based workspaces, billing, and account management',
      'Product roadmap, sprint rituals, and analytics setup',
      'Scalable cloud hosting with observability and support'
    ]
  },
  commerce: {
    kicker: 'E-commerce growth',
    title: 'Build storefronts and operations systems that can sell, fulfill, and scale.',
    copy: 'Customer-facing commerce experiences, inventory workflows, payment flows, campaign graphics, admin tools, delivery integrations, and performance optimization.',
    points: [
      'Storefront UX, checkout, inventory, and admin controls',
      'Promotional design assets and conversion improvements',
      'Maintenance plans for peak traffic and campaign launches'
    ]
  }
};

const services = [
  { title: 'Product strategy', description: 'Clear roadmaps, user journeys, and launch blueprints for ambitious teams.' },
  { title: 'Design systems', description: 'Refined interfaces and experience patterns that feel premium and practical.' },
  { title: 'Engineering', description: 'Fast, reliable web and mobile delivery with backend support from day one.' },
  { title: 'Operations', description: 'Monitoring, support, and continuous improvement after launch.' }
];

function App() {
  const [activePlatform, setActivePlatform] = useState('fintech');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ name: '', email: '', service: 'Product strategy', message: '' });

  const currentPlatform = useMemo(() => platformContent[activePlatform], [activePlatform]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('Sending your inquiry...');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const result = await response.json();
      setStatus(result.message || 'Your inquiry has been received.');
      if (response.ok) {
        setForm({ name: '', email: '', service: 'Product strategy', message: '' });
      }
    } catch (error) {
      setStatus('We could not send your inquiry right now. Please try again.');
    }
  };

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <nav className="topbar">
          <div className="brand">Nexora Digital</div>
          <div className="nav-links">
            <a href="#services">Services</a>
            <a href="#platforms">Platforms</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Consulting for digital businesses at every scale</p>
            <h1>Beautiful products, stronger operations, and calm execution.</h1>
            <p>We craft polished customer experiences, resilient backend systems, and growth-ready product operations for ambitious brands.</p>
            <div className="hero-actions">
              <a className="button primary" href="#contact">Book a consult</a>
              <a className="button secondary" href="#services">Explore services</a>
            </div>
          </div>

          <div className="hero-card">
            <div className="card-badge">Now booking</div>
            <h3>Launch with clarity</h3>
            <p>Strategy, product design, engineering, and support in one streamlined experience.</p>
            <ul>
              <li>Fast discovery workshops</li>
              <li>Premium UI/UX direction</li>
              <li>Reliable backend delivery</li>
            </ul>
          </div>
        </section>
      </header>

      <main>
        <section id="services" className="section">
          <div className="section-heading">
            <p className="eyebrow">Full-service capability</p>
            <h2>Designed for momentum.</h2>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.title}>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="platforms" className="section platform-section">
          <div className="section-heading">
            <p className="eyebrow">Platform expertise</p>
            <h2>Adaptable playbooks for modern digital teams.</h2>
          </div>

          <div className="platform-layout">
            <div className="platform-pills" role="tablist" aria-label="Industries">
              {Object.keys(platformContent).map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={platform === activePlatform ? 'pill active' : 'pill'}
                  onClick={() => setActivePlatform(platform)}
                >
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </button>
              ))}
            </div>

            <article className="playbook-card">
              <p className="eyebrow">{currentPlatform.kicker}</p>
              <h3>{currentPlatform.title}</h3>
              <p>{currentPlatform.copy}</p>
              <ul>
                {currentPlatform.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section id="contact" className="section contact-section">
          <div className="contact-card">
            <div>
              <p className="eyebrow">Let's build something great</p>
              <h2>Tell us what you're creating.</h2>
              <p>Share your goals and we'll shape a practical path from strategy through delivery.</p>
            </div>

            <form onSubmit={handleSubmit} className="contact-form">
              <input placeholder="Your name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <input type="email" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              <select value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })}>
                <option>Product strategy</option>
                <option>Design systems</option>
                <option>Engineering</option>
                <option>Operations</option>
              </select>
              <textarea placeholder="Describe your project" rows="4" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required />
              <button className="button primary" type="submit">Send inquiry</button>
              {status ? <p className="status-text">{status}</p> : null}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
