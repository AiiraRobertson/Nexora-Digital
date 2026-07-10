// Single source of truth for the services Nexora Digital offers.
// Consumed by GET /api/services and by /api/contact validation so the
// contact form's "service needed" field can never drift from the catalogue.

const services = [
  {
    slug: "web-mobile-development",
    title: "Web & Mobile Development",
    summary:
      "Responsive websites, customer portals, admin dashboards, mobile-first experiences, APIs, and launch-ready product builds.",
    highlights: [
      "Customer-facing web and mobile apps",
      "Admin dashboards and internal tools",
      "API design and third-party integration"
    ]
  },
  {
    slug: "full-stack-training",
    title: "Full-Stack Programming Training",
    summary:
      "Hands-on coaching in modern frontend, backend, databases, deployment, and software delivery practices for growing teams.",
    highlights: [
      "Frontend, backend, and database fundamentals",
      "Deployment and delivery workflows",
      "Team and individual coaching tracks"
    ]
  },
  {
    slug: "cloud-management",
    title: "Cloud Management",
    summary:
      "Hosting, monitoring, deployment pipelines, cost controls, backups, incident readiness, and performance tuning.",
    highlights: [
      "Hosting, monitoring, and backups",
      "CI/CD pipelines and cost controls",
      "Incident readiness and performance tuning"
    ]
  },
  {
    slug: "portfolio-setup",
    title: "Business Portfolio Setup",
    summary:
      "Professional web presence, company profiles, pitch pages, product decks, case studies, and digital credibility kits.",
    highlights: [
      "Company profiles and pitch pages",
      "Product decks and case studies",
      "Digital credibility kits"
    ]
  },
  {
    slug: "maintenance-qa",
    title: "Maintenance & QA Engineering",
    summary:
      "Bug fixing, automated and manual testing, release checks, accessibility reviews, security basics, and ongoing product care.",
    highlights: [
      "Automated and manual testing",
      "Release checks and accessibility reviews",
      "Ongoing maintenance and product care"
    ]
  },
  {
    slug: "career-design",
    title: "Career Management & Design",
    summary:
      "Career portfolio support, CV and profile positioning, graphics design, brand systems, social assets, and web/mobile visuals.",
    highlights: [
      "Career portfolios and profile positioning",
      "Graphics design and brand systems",
      "Social and product visuals"
    ]
  }
];

const serviceSlugs = services.map((service) => service.slug);
const serviceTitles = services.map((service) => service.title);

module.exports = { services, serviceSlugs, serviceTitles };
