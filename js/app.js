import { mountLayout, showToast } from './ui.js';
import { wireAuthHeader, handleLoginSubmit, handleRegisterSubmit } from './auth.js';
import { hasSupabaseConfig } from './supabase.js';

const page = document.body?.dataset?.page ?? 'home';

function showConfigBanner () {
  const el = document.getElementById('config-banner');
  if (!el) return;
  el.hidden = hasSupabaseConfig;
}

async function main () {
  mountLayout(page);
  if (page !== 'contact') showConfigBanner();
  await wireAuthHeader();

  switch (page) {
    case 'home': {
      const mod = await import('./services.js');
      await mod.initHomeServicesPreview();
      break;
    }
    case 'services': {
      const mod = await import('./services.js');
      await mod.initServicesPage({ fullList: true });
      break;
    }
    case 'pricing': {
      const mod = await import('./services.js');
      await mod.initPricingPage();
      break;
    }
    case 'booking': {
      const mod = await import('./booking.js');
      await mod.initBookingPage();
      break;
    }
    case 'dashboard': {
      const mod = await import('./dashboard.js');
      await mod.initDashboardPage();
      break;
    }
    case 'login': {
      const form = document.getElementById('login-form');
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLoginSubmit(form);
      });
      break;
    }
    case 'register': {
      const form = document.getElementById('register-form');
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleRegisterSubmit(form);
      });
      break;
    }
    case 'contact': {
      initContactPage();
      break;
    }
    default:
      break;
  }
}

function initContactPage () {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const message = String(fd.get('message') || '').trim();
    if (!name) {
      showToast('Ime je obavezno.', 'error');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Unesite ispravan email.', 'error');
      return;
    }
    if (!message || message.length < 5) {
      showToast('Poruka je prekratka.', 'error');
      return;
    }
    const subject = encodeURIComponent(`Upit od ${name}`);
    const body = encodeURIComponent(`${message}\n\n---\nEmail: ${email}`);
    window.location.href = `mailto:info@barbershop-savonja.hr?subject=${subject}&body=${body}`;
    showToast('Otvoren je email klijent.', 'info');
  });
}

main().catch((err) => {
  console.error(err);
  showToast('Greška pri pokretanju aplikacije.', 'error');
});
