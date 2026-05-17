import { supabase } from './supabase.js';
import { formatPriceEUR, setSkeleton, showToast } from './ui.js';

function serviceCard (s, { cta = true } = {}) {
  const img = s.image_url
    ? `<img class="card__img" src="${s.image_url}" alt="${escapeHtml(s.name)}" loading="lazy" width="640" height="400" />`
    : `<div class="card__img card__img--ph" aria-hidden="true"></div>`;
  const book = cta
    ? `<a class="btn btn--primary" href="${bookingHref(s.id)}">Rezerviraj</a>`
    : '';
  return `
    <article class="card service-card">
      ${img}
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(s.name)}</h3>
        <p class="card__text">${escapeHtml(s.description || '')}</p>
        <dl class="meta">
          <div><dt>Trajanje</dt><dd>${Number(s.duration_minutes)} min</dd></div>
          <div><dt>Cijena</dt><dd>${formatPriceEUR(s.price)}</dd></div>
        </dl>
        <div class="card__actions">${book}</div>
      </div>
    </article>
  `;
}

function bookingHref (serviceId) {
  const inPages = location.pathname.includes('/pages/');
  const base = inPages ? 'booking.html' : 'pages/booking.html';
  const q = serviceId ? `?service=${encodeURIComponent(String(serviceId))}` : '';
  return `${base}${q}`;
}

function escapeHtml (str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function fetchActiveServices () {
  if (!supabase) return { data: [], error: new Error('missing_config') };
  return supabase.from('services').select('*').eq('active', true).order('name', { ascending: true });
}

export async function initHomeServicesPreview () {
  const root = document.getElementById('home-services');
  if (!root) return;
  setSkeleton(root, true);
  const { data, error } = await fetchActiveServices();
  setSkeleton(root, false);
  if (error) {
    root.innerHTML = `<p class="muted">Usluge trenutačno nisu dostupne.</p>`;
    return;
  }
  const slice = (data || []).slice(0, 3);
  root.innerHTML = slice.map((s) => serviceCard(s)).join('') || `<p class="muted">Nema aktivnih usluga.</p>`;
}

export async function initServicesPage ({ fullList = true } = {}) {
  const root = document.getElementById('services-grid');
  if (!root) return;
  setSkeleton(root, true);
  const { data, error } = await fetchActiveServices();
  setSkeleton(root, false);
  if (error) {
    showToast(error.message || 'Greška pri dohvatu usluga.', 'error');
    root.innerHTML = `<p class="muted">Ne možemo učitati usluge.</p>`;
    return;
  }
  const list = fullList ? data || [] : (data || []).slice(0, 6);
  root.innerHTML = list.map((s) => serviceCard(s)).join('') || `<p class="muted">Nema aktivnih usluga.</p>`;
}

export async function initPricingPage () {
  const tbody = document.querySelector('[data-pricing-tbody]');
  if (!tbody) return;
  setSkeleton(tbody.closest('section') || tbody, true);
  const { data, error } = await fetchActiveServices();
  setSkeleton(tbody.closest('section') || tbody, false);
  if (error) {
    showToast(error.message || 'Greška pri dohvatu cjenika.', 'error');
    tbody.innerHTML = `<tr><td colspan="3">Podaci nisu dostupni.</td></tr>`;
    return;
  }
  tbody.innerHTML = (data || [])
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${Number(s.duration_minutes)} min</td>
        <td>${formatPriceEUR(s.price)}</td>
      </tr>`
    )
    .join('');
}
