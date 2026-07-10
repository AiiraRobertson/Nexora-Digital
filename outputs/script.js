const platformContent = {
  fintech: {
    kicker: "Fintech systems",
    title: "Launch secure wallets, payments, lending, and investment platforms.",
    copy:
      "Architecture, UX, API integration, reconciliation flows, KYC journeys, admin portals, analytics, cloud monitoring, and regression-safe release management.",
    points: [
      "Payment gateway and settlement workflow integration",
      "Identity, onboarding, and customer support dashboards",
      "Automated QA for transaction-heavy product releases"
    ]
  },
  saas: {
    kicker: "SaaS products",
    title: "Turn internal expertise into subscription-ready web and mobile products.",
    copy:
      "From MVP scope and pricing logic to onboarding, dashboards, permissions, billing, usage analytics, cloud operations, and continuous product discovery.",
    points: [
      "Role-based workspaces, billing, and account management",
      "Product roadmap, sprint rituals, and analytics setup",
      "Scalable cloud hosting with observability and support"
    ]
  },
  commerce: {
    kicker: "E-commerce growth",
    title: "Build storefronts and operations systems that can sell, fulfill, and scale.",
    copy:
      "Customer-facing commerce experiences, inventory workflows, payment flows, campaign graphics, admin tools, delivery integrations, and performance optimization.",
    points: [
      "Storefront UX, checkout, inventory, and admin controls",
      "Promotional design assets and conversion improvements",
      "Maintenance plans for peak traffic and campaign launches"
    ]
  },
  banking: {
    kicker: "Banking enablement",
    title: "Modernize digital channels with reliability, governance, and clear product ownership.",
    copy:
      "Customer portals, internal workflow tools, compliance-aware documentation, QA coverage, reporting dashboards, cloud migration support, and release governance.",
    points: [
      "Secure customer and staff portals",
      "Compliance-friendly product documentation and QA records",
      "Release management for regulated digital services"
    ]
  },
  mobility: {
    kicker: "Ride-hailing products",
    title: "Coordinate riders, drivers, dispatch, payments, and support in one product flow.",
    copy:
      "Booking journeys, mobile app screens, route visibility, support operations, fare logic, driver onboarding, notifications, and real-time operational dashboards.",
    points: [
      "Rider, driver, and dispatcher experience design",
      "Trip lifecycle, payment, rating, and support flows",
      "Monitoring and QA for high-volume mobile releases"
    ]
  },
  courier: {
    kicker: "Courier operations",
    title: "Digitize pickup, dispatch, tracking, delivery proof, and customer communication.",
    copy:
      "Courier portals, mobile dispatch workflows, order tracking, proof of delivery, client dashboards, cloud monitoring, and service quality reporting.",
    points: [
      "Pickup, sorting, dispatch, and proof-of-delivery workflows",
      "Customer tracking pages and notification flows",
      "Operational reporting for teams and business clients"
    ]
  }
};

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const canvas = document.querySelector("[data-network-canvas]");
const platformButtons = Array.from(document.querySelectorAll("[data-platform]"));
const playbook = document.querySelector("[data-playbook]");
const contactForm = document.querySelector("[data-contact-form]");
const supportForm = document.querySelector("[data-support-form]");
const supportResponse = document.querySelector("[data-support-response]");

function updateHeader() {
  header.classList.toggle("scrolled", window.scrollY > 8);
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
}

function setPlatform(platform) {
  const content = platformContent[platform];
  if (!content || !playbook) return;

  platformButtons.forEach((button) => {
    const isActive = button.dataset.platform === platform;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  playbook.querySelector("[data-playbook-kicker]").textContent = content.kicker;
  playbook.querySelector("[data-playbook-title]").textContent = content.title;
  playbook.querySelector("[data-playbook-copy]").textContent = content.copy;

  const list = playbook.querySelector("[data-playbook-list]");
  list.innerHTML = "";
  content.points.forEach((point) => {
    const item = document.createElement("li");
    item.textContent = point;
    list.appendChild(item);
  });
}

function setupNetworkCanvas() {
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let points = [];
  let frameId = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = rect.width < 700 ? 34 : 58;
    points = Array.from({ length: count }, (_, index) => ({
      x: (index * 137) % rect.width,
      y: (index * 71) % rect.height,
      vx: ((index % 5) - 2) * 0.12,
      vy: (((index + 2) % 5) - 2) * 0.1,
      radius: 1.4 + (index % 4) * 0.35
    }));
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);

    points.forEach((point, index) => {
      if (!prefersReducedMotion) {
        point.x += point.vx;
        point.y += point.vy;
      }

      if (point.x < 0 || point.x > rect.width) point.vx *= -1;
      if (point.y < 0 || point.y > rect.height) point.vy *= -1;

      for (let next = index + 1; next < points.length; next += 1) {
        const other = points[next];
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 150) {
          const alpha = 1 - distance / 150;
          context.strokeStyle = `rgba(245, 196, 94, ${alpha * 0.22})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }

      context.fillStyle = "rgba(255, 255, 255, 0.66)";
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fill();
    });

    if (!prefersReducedMotion) {
      frameId = window.requestAnimationFrame(draw);
    }
  }

  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(frameId);
    resize();
    draw();
  });

  resize();
  draw();
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

menuToggle.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("menu-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

platformButtons.forEach((button) => {
  button.addEventListener("click", () => setPlatform(button.dataset.platform));
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const status = contactForm.querySelector("[data-form-status]");
  const submitButton = contactForm.querySelector("button[type='submit']");

  status.textContent = "Sending your inquiry...";
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });

    const result = await response.json();
    status.textContent = result.message || "Your inquiry was received.";
    if (response.ok) {
      contactForm.reset();
    }
  } catch (error) {
    status.textContent = "We could not send your inquiry right now. Please try again.";
  } finally {
    submitButton.disabled = false;
  }
});

supportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(supportForm);
  const message = String(formData.get("message") || "").trim();

  if (!message) {
    supportResponse.textContent = "Please tell us what you need help with.";
    return;
  }

  supportResponse.textContent = "Thinking through your request...";

  try {
    const response = await fetch("/api/support", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const result = await response.json();
    supportResponse.textContent = result.reply || "We can help you shape a practical plan.";
  } catch (error) {
    supportResponse.textContent = "Support is temporarily unavailable. Please contact us directly.";
  }
});

setupNetworkCanvas();
