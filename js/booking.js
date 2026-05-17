import { supabase } from './supabase.js';
import { formatDateHR, formatTime, showToast, showBigToast, showConfirmModal } from './ui.js';

function escapeHtml (str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pad2 (n) {
  return String(n).padStart(2, '0');
}

export function localISODate (d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseISODate (s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function timeToMinutes (t) {
  const p = String(t).split(':');
  return Number(p[0] || 0) * 60 + Number(p[1] || 0);
}

function minutesToTime (mins) {
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return `${pad2(hh)}:${pad2(mm)}:00`;
}

function overlaps (a0, a1, b0, b1) {
  return a0 < b1 && a1 > b0;
}

function dayBoundsMinutes (dateStr) {
  const d = parseISODate(dateStr);
  const dow = d.getDay();
  if (dow === 0) return { open: null, close: null, closed: true };
  if (dow === 6) return { open: 9 * 60, close: 14 * 60, closed: false };
  return { open: 9 * 60, close: 18 * 60, closed: false };
}

function monthRange (year, monthIndex0) {
  const first = new Date(year, monthIndex0, 1);
  const last = new Date(year, monthIndex0 + 1, 0);
  return { start: localISODate(first), end: localISODate(last) };
}

let state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selectedDate: null,
  selectedBarberId: null,
  selectedServiceId: null,
  barbers: [],
  services: [],
  busy: [],
  blocked: new Set(),
};

export async function initBookingPage () {
  const { assertSupabase } = await import('./auth.js');
  if (!assertSupabase()) return;

  const barberRoot = document.getElementById('booking-barbers');
  const serviceSelect = document.getElementById('booking-service');
  const calRoot = document.getElementById('booking-calendar');
  const slotsRoot = document.getElementById('booking-slots');
  const summary = document.getElementById('booking-summary');
  const prevBtn = document.querySelector('[data-cal-prev]');
  const nextBtn = document.querySelector('[data-cal-next]');

  if (!barberRoot || !serviceSelect || !calRoot || !slotsRoot) return;

  const [{ data: barbers, error: eb }, { data: svc, error: es }] = await Promise.all([
    supabase.from('barbers').select('*').eq('active', true).order('sort_order').order('name'),
    supabase.from('services').select('*').eq('active', true).order('name'),
  ]);

  if (eb) {
    showToast(eb.message, 'error');
    return;
  }
  if (es) {
    showToast(es.message, 'error');
    return;
  }

  state.barbers = barbers || [];
  state.services = svc || [];

  renderBarberPicker(barberRoot);
  serviceSelect.innerHTML =
    `<option value="">Odaberite uslugu</option>` +
    state.services
      .map(
        (s) =>
          `<option value="${s.id}">${escapeHtml(s.name)} — ${Number(s.duration_minutes)} min</option>`
      )
      .join('');

  const params = new URLSearchParams(location.search);
  const presetBarber = params.get('barber');
  const presetService = params.get('service');
  if (presetBarber && state.barbers.some((b) => String(b.id) === String(presetBarber))) {
    selectBarber(Number(presetBarber), barberRoot);
  }
  if (presetService && state.services.some((s) => String(s.id) === String(presetService))) {
    serviceSelect.value = String(presetService);
    state.selectedServiceId = Number(presetService);
  }

  serviceSelect.addEventListener('change', () => {
    state.selectedServiceId = serviceSelect.value ? Number(serviceSelect.value) : null;
    state.selectedDate = null;
    slotsRoot.innerHTML = '';
    if (summary) summary.hidden = true;
    renderCalendar(calRoot, slotsRoot, summary);
  });

  prevBtn?.addEventListener('click', () => {
    state.month -= 1;
    if (state.month < 0) {
      state.month = 11;
      state.year -= 1;
    }
    bumpLoad(calRoot, slotsRoot, summary);
  });
  nextBtn?.addEventListener('click', () => {
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    bumpLoad(calRoot, slotsRoot, summary);
  });

  await bumpLoad(calRoot, slotsRoot, summary);
}

function renderBarberPicker (root) {
  if (!state.barbers.length) {
    root.innerHTML = `<p class="muted">Barberi nisu dostupni.</p>`;
    return;
  }
  root.innerHTML = `
    <div class="barber-grid" role="list">
      ${state.barbers
        .map((b) => {
          const selected = String(b.id) === String(state.selectedBarberId);
          const img = b.photo_url
            ? `<img class="barber-card__img" src="${escapeHtml(b.photo_url)}" alt="" loading="lazy" width="80" height="80" />`
            : `<div class="barber-card__img barber-card__img--ph" aria-hidden="true"></div>`;
          return `
          <button type="button" class="barber-card${selected ? ' is-selected' : ''}" role="listitem"
            data-barber-id="${b.id}" aria-pressed="${selected}">
            ${img}
            <span class="barber-card__name">${escapeHtml(b.name)}</span>
          </button>`;
        })
        .join('')}
    </div>`;

  root.querySelectorAll('[data-barber-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectBarber(Number(btn.getAttribute('data-barber-id')), root);
      const calRoot = document.getElementById('booking-calendar');
      const slotsRoot = document.getElementById('booking-slots');
      const summary = document.getElementById('booking-summary');
      if (calRoot && slotsRoot) bumpLoad(calRoot, slotsRoot, summary);
    });
  });
}

function selectBarber (id, root) {
  state.selectedBarberId = id;
  state.selectedDate = null;
  const slotsRoot = document.getElementById('booking-slots');
  const summary = document.getElementById('booking-summary');
  if (slotsRoot) slotsRoot.innerHTML = '';
  if (summary) summary.hidden = true;
  renderBarberPicker(root);
}

async function bumpLoad (calRoot, slotsRoot, summary) {
  await loadMonthData();
  renderCalendar(calRoot, slotsRoot, summary);
}

async function loadMonthData () {
  const { start, end } = monthRange(state.year, state.month);
  const blockedPromise = supabase.rpc('blocked_dates_between', { p_start: start, p_end: end });

  if (!state.selectedBarberId) {
    const { data: blocked, error: e2 } = await blockedPromise;
    if (e2) showToast(e2.message, 'error');
    state.busy = [];
    state.blocked = new Set((blocked || []).map((r) => r.blocked_date));
    return;
  }

  const [{ data: busy, error: e1 }, { data: blocked, error: e2 }] = await Promise.all([
    supabase.rpc('busy_slots_between', {
      p_start: start,
      p_end: end,
      p_barber_id: state.selectedBarberId,
    }),
    blockedPromise,
  ]);
  if (e1) showToast(e1.message, 'error');
  if (e2) showToast(e2.message, 'error');
  state.busy = busy || [];
  state.blocked = new Set((blocked || []).map((r) => r.blocked_date));
}

function busyForDate (dateStr) {
  return state.busy.filter((r) => r.appointment_date === dateStr);
}

function isDayFullyBookedForService (dateStr, service) {
  if (!service || !state.selectedBarberId) return false;
  const dur = Number(service.duration_minutes);
  const bounds = dayBoundsMinutes(dateStr);
  if (bounds.closed) return true;
  return buildSlotsForDay(dateStr, dur, busyForDate(dateStr)).length === 0;
}

function renderCalendar (calRoot, slotsRoot, summary) {
  const label = document.querySelector('[data-cal-label]');
  if (label) {
    label.textContent = new Date(state.year, state.month, 1).toLocaleDateString('hr-HR', {
      month: 'long',
      year: 'numeric',
    });
  }

  const first = new Date(state.year, state.month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const todayStr = localISODate(new Date());

  const service = state.services.find((s) => String(s.id) === String(state.selectedServiceId)) || null;
  const noBarber = !state.selectedBarberId;
  const noService = !service;

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(`<div class="cal__cell cal__cell--empty" aria-hidden="true"></div>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${state.year}-${pad2(state.month + 1)}-${pad2(d)}`;
    const dt = parseISODate(dateStr);
    const dow = dt.getDay();
    const isPast = dateStr < todayStr;
    const isBlocked = state.blocked.has(dateStr);
    const isSunday = dow === 0;
    const fullyBusy = service && isDayFullyBookedForService(dateStr, service);
    const disabled = isPast || isBlocked || isSunday || noBarber || noService || fullyBusy;
    const cls = ['cal__cell', 'cal__day'];
    if (disabled) cls.push('is-disabled');
    if (state.selectedDate === dateStr) cls.push('is-selected');
    const labelD = dt.toLocaleDateString('hr-HR', { day: 'numeric' });
    cells.push(
      `<button type="button" class="${cls.join(' ')}" data-day="${dateStr}" ${
        disabled ? 'disabled' : ''
      } aria-label="Odaberi ${dateStr}"><span class="cal__num">${labelD}</span></button>`
    );
  }

  calRoot.innerHTML = `
    <div class="cal">
      <div class="cal__weekdays" aria-hidden="true">
        ${['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'].map((w) => `<div class="cal__wd">${escapeHtml(w)}</div>`).join('')}
      </div>
      <div class="cal__grid" aria-label="Kalendar mjeseca">${cells.join('')}</div>
    </div>`;

  calRoot.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.selectedDate = btn.getAttribute('data-day');
      renderCalendar(calRoot, slotsRoot, summary);
      await renderSlots(slotsRoot, summary);
    });
  });
}

function buildSlotsForDay (dateStr, durationMinutes, busyRows) {
  const bounds = dayBoundsMinutes(dateStr);
  if (bounds.closed) return [];
  const step = 30;
  const out = [];
  for (let m = bounds.open; m < bounds.close; m += step) {
    const end = m + durationMinutes;
    if (end > bounds.close) break;
    const startT = minutesToTime(m);
    const stMin = timeToMinutes(startT);
    const enMin = timeToMinutes(minutesToTime(end));
    let clash = false;
    for (const row of busyRows) {
      if (overlaps(stMin, enMin, timeToMinutes(row.start_time), timeToMinutes(row.end_time))) {
        clash = true;
        break;
      }
    }
    if (!clash) out.push(startT);
  }
  return out;
}

async function renderSlots (slotsRoot, summary) {
  if (summary) summary.hidden = true;
  slotsRoot.innerHTML = '';
  if (!state.selectedBarberId) {
    slotsRoot.innerHTML = `<p class="muted">Prvo odaberite barbera.</p>`;
    return;
  }
  if (!state.selectedDate || !state.selectedServiceId) {
    slotsRoot.innerHTML = `<p class="muted">Odaberite uslugu i datum.</p>`;
    return;
  }
  const service = state.services.find((s) => String(s.id) === String(state.selectedServiceId));
  if (!service) return;

  const slots = buildSlotsForDay(
    state.selectedDate,
    Number(service.duration_minutes),
    busyForDate(state.selectedDate)
  );

  slotsRoot.innerHTML = `
    <div class="slot-grid" role="list">
      ${slots
        .map(
          (t) => `
        <button type="button" class="btn btn--slot" role="listitem" data-slot="${t}">
          ${formatTime(t)}
        </button>`
        )
        .join('')}
    </div>
    ${slots.length ? '' : '<p class="muted">Nema slobodnih termina za ovaj dan.</p>'}`;

  slotsRoot.querySelectorAll('[data-slot]').forEach((btn) => {
    btn.addEventListener('click', () => confirmBooking(btn.getAttribute('data-slot'), service, summary));
  });
}

async function confirmBooking (startTime, service, summaryEl) {
  const { requireSession, redirectToLogin } = await import('./auth.js');
  const session = await requireSession();
  if (!session) {
    showToast('Prijavite se za dovršetak rezervacije.', 'info');
    redirectToLogin(`${location.pathname}${location.search}`);
    return;
  }

  const barber = state.barbers.find((b) => String(b.id) === String(state.selectedBarberId));
  const barberName = barber?.name || 'Barber';

  const ok = await showConfirmModal({
    title: 'Potvrditi rezervaciju?',
    body: `Barber: ${barberName}\nUsluga: ${service.name}\nDatum: ${formatDateHR(state.selectedDate)}\nVrijeme: ${formatTime(startTime)}`,
    confirmLabel: 'Rezerviraj',
    cancelLabel: 'Odustani',
    danger: false,
  });
  if (!ok) return;

  const { data, error } = await supabase.rpc('book_appointment', {
    p_barber_id: state.selectedBarberId,
    p_service_id: service.id,
    p_appointment_date: state.selectedDate,
    p_start_time: startTime,
  });

  if (error) {
    const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    const friendly = msg.includes('SLOT_UNAVAILABLE') || msg.includes('appointments_unique_active_slot')
      ? 'Termin je već zauzet.'
      : msg.includes('DATE_BLOCKED')
        ? 'Odabrani datum nije dostupan.'
        : msg.includes('PAST_DATE')
          ? 'Ne možete rezervirati prošlost.'
          : msg.includes('NOT_AUTHENTICATED')
            ? 'Morate biti prijavljeni.'
            : msg.includes('INVALID_BARBER')
              ? 'Neispravan barber.'
              : msg.includes('OUTSIDE_BUSINESS_HOURS')
                ? 'Izvan radnog vremena.'
                : msg.includes('SATURDAY_SHORT_HOURS')
                  ? 'Subotom su termini do 14:00.'
                  : msg.includes('CLOSED_SUNDAY')
                    ? 'Nedjeljom smo zatvoreni.'
                    : msg.includes('INVALID_SERVICE')
                      ? 'Neispravna usluga.'
                      : error.message || 'Rezervacija nije uspjela.';
    showBigToast(friendly, 'error');
    return;
  }

  showBigToast('Rezervacija je potvrđena!', 'success');
  if (summaryEl) {
    summaryEl.hidden = false;
    summaryEl.innerHTML = `
      <div class="callout callout--success">
        <p><strong>Termin je rezerviran.</strong> Broj: <code>${escapeHtml(String(data))}</code></p>
        <p class="muted">Upravljajte terminima u <a href="dashboard.html">Moj račun</a>.</p>
      </div>`;
  }
  await loadMonthData();
  const calRoot = document.getElementById('booking-calendar');
  const slotsRoot = document.getElementById('booking-slots');
  if (calRoot && slotsRoot) {
    renderCalendar(calRoot, slotsRoot, summaryEl);
    await renderSlots(slotsRoot, summaryEl);
  }
}
