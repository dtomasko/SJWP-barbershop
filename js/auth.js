import { supabase, hasSupabaseConfig } from './supabase.js';
import { showToast, showBanner, showConfirmModal } from './ui.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail (email) {
  const v = String(email || '').trim();
  if (!v) return 'Email je obavezan.';
  if (!EMAIL_RE.test(v)) return 'Unesite ispravan email.';
  return '';
}

export function validatePassword (password, { min = 8 } = {}) {
  const p = String(password || '');
  if (p.length < min) return `Lozinka mora imati najmanje ${min} znakova.`;
  return '';
}

export function validatePasswordConfirm (password, confirm) {
  const err = validatePassword(password);
  if (err) return err;
  if (password !== confirm) return 'Lozinke se ne podudaraju.';
  return '';
}

export function redirectToLogin (nextPath) {
  const next = encodeURIComponent(nextPath || `${location.pathname}${location.search}`);
  const loginBase = location.pathname.includes('/pages/') ? '' : 'pages/';
  location.href = `${loginBase}login.html?next=${next}`;
}

export async function requireSession () {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
}

export async function wireAuthHeader () {
  const logoutBtn = document.querySelector('[data-action="logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!supabase) return;
      const ok = await showConfirmModal({
        title: 'Odjava',
        body: 'Jeste li sigurni da se želite odjaviti?',
        confirmLabel: 'Odjavi se',
        cancelLabel: 'Odustani',
        danger: false,
      });
      if (!ok) return;
      await supabase.auth.signOut();
      showToast('Odjavljeni ste.', 'info');
      location.href = location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
    });
  }

  if (!supabase) return;

  const { data } = await supabase.auth.getSession();
  updateAuthChrome(data.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthChrome(session);
  });
}

function updateAuthChrome (session) {
  const loginLink = document.querySelector('[data-auth-login]');
  const dashLink = document.querySelector('[data-auth-dashboard]');
  const logoutBtn = document.querySelector('[data-action="logout"]');

  const authed = Boolean(session?.user);
  if (loginLink) loginLink.hidden = authed;
  if (dashLink) dashLink.hidden = !authed;
  if (logoutBtn) logoutBtn.hidden = !authed;
}

export function assertSupabase () {
  if (!hasSupabaseConfig || !supabase) {
    showToast('Nedostaje Supabase konfiguracija (js/config.local.js).', 'error');
    return false;
  }
  return true;
}

export async function handleRegisterSubmit (form) {
  if (!assertSupabase()) return;
  const fd = new FormData(form);
  const fullName = String(fd.get('full_name') || '').trim();
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');
  const confirm = String(fd.get('password_confirm') || '');

  const errs = [
    !fullName && 'Ime i prezime su obavezni.',
    validateEmail(email),
    validatePasswordConfirm(password, confirm),
  ].filter(Boolean);
  if (errs.length) {
    showToast(errs[0], 'error');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    showToast(error.message, 'error');
    return;
  }
  if (data.session) {
    showToast('Račun je kreiran. Dobrodošli!', 'success');
    location.href = location.pathname.includes('/pages/') ? 'dashboard.html' : 'pages/dashboard.html';
  } else {
    showBanner({
      icon: '✉️',
      title: 'Potvrdite svoju email adresu',
      text: 'Poslali smo vam email s linkom za potvrdu. Otvorite svoju poštu i kliknite na link kako biste aktivirali račun.',
      buttonLabel: 'Razumijem',
    });
  }
}

export async function handleLoginSubmit (form) {
  if (!assertSupabase()) return;
  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');

  const errs = [validateEmail(email), !password && 'Lozinka je obavezna.'].filter(Boolean);
  if (errs.length) {
    showToast(errs[0], 'error');
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message, 'error');
    return;
  }
  showToast('Prijava uspješna.', 'success');
  const params = new URLSearchParams(location.search);
  const raw = params.get('next');
  if (raw) {
    const path = decodeURIComponent(raw);
    if (!path.includes('://')) {
      location.href = path;
      return;
    }
  }
  location.href = location.pathname.includes('/pages/') ? 'dashboard.html' : 'pages/dashboard.html';
}

export async function guardDashboardPage () {
  if (!assertSupabase()) return false;
  const session = await requireSession();
  if (!session) {
    redirectToLogin(`${location.pathname}${location.search}`);
    return false;
  }
  return true;
}

export async function guardBookingPage () {
  if (!assertSupabase()) return false;
  const session = await requireSession();
  if (!session) {
    showToast('Za rezervaciju se morate prijaviti.', 'info');
    redirectToLogin(`${location.pathname}${location.search}`);
    return false;
  }
  return true;
}
