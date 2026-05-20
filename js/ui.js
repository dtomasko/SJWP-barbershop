const TOAST_ID = "site-toast";

export function showToast(message, variant = "info") {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.className = "toast";
  el.textContent = message;
  el.dataset.variant = variant;
  el.hidden = false;
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.hidden = true;
  }, 4200);
}

export function showBigToast(message, variant = "info") {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    el.className = "toast toast--big";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.className = "toast toast--big";
  el.textContent = message;
  el.dataset.variant = variant;
  el.hidden = false;
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.hidden = true;
  }, 5000);
}

export function showBanner({ icon = "✉️", title, text, buttonLabel = "U redu" }) {
  const existing = document.getElementById("site-banner-alert");
  if (existing) existing.remove();
  const existingOverlay = document.getElementById("site-banner-overlay");
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement("div");
  overlay.id = "site-banner-overlay";
  overlay.className = "banner-overlay";

  const banner = document.createElement("div");
  banner.id = "site-banner-alert";
  banner.className = "banner-alert";
  banner.setAttribute("role", "alertdialog");
  banner.setAttribute("aria-modal", "true");
  banner.innerHTML = `
    <div class="banner-alert__icon" aria-hidden="true">${icon}</div>
    <h2 class="banner-alert__title">${title}</h2>
    <p class="banner-alert__text">${text}</p>
    <button class="btn btn--primary banner-alert__close" type="button">${buttonLabel}</button>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(banner);

  const closeBtn = banner.querySelector(".banner-alert__close");
  const close = () => { overlay.remove(); banner.remove(); };
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
  closeBtn.focus();
}

export function showConfirmModal({ title, body, confirmLabel = "Potvrdi", cancelLabel = "Odustani", danger = false }) {
  return new Promise((resolve) => {
    const existing = document.getElementById("site-modal");
    if (existing) existing.remove();
    const existingOverlay = document.getElementById("site-modal-overlay");
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement("div");
    overlay.id = "site-modal-overlay";
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.id = "site-modal";
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const confirmCls = danger ? "btn btn--danger" : "btn btn--primary";

    modal.innerHTML = `
      <h2 class="modal__title">${title}</h2>
      <p class="modal__body">${body}</p>
      <div class="modal__actions">
        <button class="btn btn--ghost" type="button" data-modal-cancel>${cancelLabel}</button>
        <button class="${confirmCls}" type="button" data-modal-confirm>${confirmLabel}</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const cleanup = () => { overlay.remove(); modal.remove(); };
    modal.querySelector("[data-modal-confirm]").addEventListener("click", () => { cleanup(); resolve(true); });
    modal.querySelector("[data-modal-cancel]").addEventListener("click", () => { cleanup(); resolve(false); });
    overlay.addEventListener("click", () => { cleanup(); resolve(false); });

    modal.querySelector("[data-modal-confirm]").focus();
  });
}


export function setSkeleton(root, active) {
  if (!root) return;
  root.classList.toggle("is-skeleton", Boolean(active));
}

function basePath() {
  return location.pathname.includes("/pages/") ? ".." : ".";
}

function navHref(page) {
  const inPages = location.pathname.includes("/pages/");
  if (page === "home") return inPages ? "../index.html" : "./index.html";
  const file = `${page}.html`;
  return inPages ? file : `pages/${file}`;
}

function closeMobileNav() {
  const btn = document.querySelector("[data-nav-toggle]");
  const nav = document.getElementById("site-nav");
  if (!btn || !nav) return;
  btn.setAttribute("aria-expanded", "false");
  nav.classList.remove("is-open");
  document.body.classList.remove("nav-open");
}

export function mountLayout(activePage) {
  const headerMount = document.getElementById("site-header");
  const footerMount = document.getElementById("site-footer");
  if (!headerMount || !footerMount) return;

  const items = [
    { id: "home", label: "Početna" },
    { id: "services", label: "Usluge" },
    { id: "pricing", label: "Cjenik" },
    { id: "booking", label: "Rezervacija" },
    { id: "contact", label: "Kontakt" },
  ];

  const navLinks = items
    .map((it) => {
      const href = it.id === "home" ? navHref("home") : navHref(it.id);
      const current = it.id === activePage;
      return `<a class="nav__link${current ? " is-active" : ""}" href="${href}" ${current ? 'aria-current="page"' : ""}>${it.label}</a>`;
    })
    .join("");

  headerMount.className = "site-header";
  headerMount.innerHTML = `
    <div class="shell header__bar">
      <a class="brand" href="${navHref("home")}" aria-label="Početna — barbershop Savonja">
        <img class="brand__logo" src="${basePath()}/assets/logo/logo.svg" width="70" height="70" alt="" />
        <span class="brand__text">
          <span class="brand__name">barbershop Savonja</span>
          <span class="brand__tag">Studio za šišanje</span>
        </span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
        <span class="nav-toggle__bar" aria-hidden="true"></span>
        <span class="nav-toggle__bar" aria-hidden="true"></span>
        <span class="nav-toggle__bar" aria-hidden="true"></span>
        <span class="visually-hidden">Izbornik</span>
      </button>
    </div>
    <nav class="nav" id="site-nav" aria-label="Glavna navigacija">
      <div class="nav__panel shell">
        <div class="nav__links">${navLinks}</div>
        <div class="nav__actions">
          <a class="btn btn--ghost" data-auth-login href="${navHref("login")}">Prijava</a>
          <a class="btn btn--ghost" data-auth-dashboard hidden href="${navHref("dashboard")}">Moj račun</a>
          <button class="btn btn--primary" type="button" data-action="logout" hidden>Odjava</button>
        </div>
      </div>
    </nav>
  `;

  footerMount.innerHTML = `
    <div class="shell footer__grid">
      <div>
        <p class="footer__title">barbershop Savonja</p>
        <p class="footer__muted">Rezerviraj termin online — brzo i jednostavno.</p>
      </div>
      <div>
        <p class="footer__title">Radno vrijeme</p>
        <p class="footer__muted">Pon–Pet: 09:00–18:00<br />Sub: 09:00–14:00<br />Ned: zatvoreno</p>
      </div>
      <div>
        <p class="footer__title">Kontakt</p>
        <p class="footer__muted">
          <a href="mailto:info@barbershop-savonja.hr">info@barbershop-savonja.hr</a><br />
          <a href="tel:+385911234567">+385 91 123 4567</a>
        </p>
      </div>
      <div>
        <p class="footer__title">Društvene mreže</p>
        <p class="footer__social">
          <a href="https://www.instagram.com/barbershop_savonja/" rel="noopener noreferrer" target="_blank" aria-label="Instagram">Instagram</a>
          <a href="https://www.tiktok.com/@barbershop_savonja" rel="noopener noreferrer" target="_blank" aria-label="TikTok">TikTok</a>
        </p>
      </div>
    </div>
    <div class="shell footer__bottom">
      <p>© ${new Date().getFullYear()} barbershop Savonja. Sva prava pridržana.</p>
    </div>
  `;

  wireNavToggle();
}

function wireNavToggle() {
  const btn = document.querySelector("[data-nav-toggle]");
  const nav = document.getElementById("site-nav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
    document.body.classList.toggle("nav-open", !open);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileNav();
  });
}

export function formatPriceEUR(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
  }).format(x);
}

export function formatTime(t) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

export function formatDateHR(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("hr-HR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
