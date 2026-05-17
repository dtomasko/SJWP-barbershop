import { supabase } from './supabase.js';
import { formatDateHR, formatTime, setSkeleton, showToast, showBigToast, showConfirmModal } from './ui.js';

function escapeHtml (str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function initDashboardPage () {
  const { guardDashboardPage } = await import('./auth.js');
  const ok = await guardDashboardPage();
  if (!ok) return;

  const root = document.getElementById('dashboard-appointments');
  if (!root) return;

  await refresh(root);
}

async function refresh (root) {
  setSkeleton(root, true);
  const { data: appts, error } = await supabase
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, service_id, barber_id')
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });
  setSkeleton(root, false);

  if (error) {
    showToast(error.message, 'error');
    root.innerHTML = `<p class="muted">Ne možemo učitati rezervacije.</p>`;
    return;
  }

  const rows = appts || [];
  if (!rows.length) {
    root.innerHTML = `<p class="muted">Još nemate rezervacija.</p>`;
    return;
  }

  const serviceIds = [...new Set(rows.map((r) => r.service_id).filter(Boolean))];
  const barberIds = [...new Set(rows.map((r) => r.barber_id).filter(Boolean))];

  const [{ data: svcRows }, { data: barberRows }] = await Promise.all([
    serviceIds.length
      ? supabase.from('services').select('id,name').in('id', serviceIds)
      : Promise.resolve({ data: [] }),
    barberIds.length
      ? supabase.from('barbers').select('id,name').in('id', barberIds)
      : Promise.resolve({ data: [] }),
  ]);

  const serviceById = Object.fromEntries((svcRows || []).map((s) => [String(s.id), s.name]));
  const barberById = Object.fromEntries((barberRows || []).map((b) => [String(b.id), b.name]));

  root.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Barber</th>
            <th>Usluga</th>
            <th>Datum</th>
            <th>Vrijeme</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((a) => {
              const barber = escapeHtml(barberById[String(a.barber_id)] || '—');
              const service = escapeHtml(serviceById[String(a.service_id)] || 'Usluga');
              const canCancel = a.status === 'pending' || a.status === 'confirmed';
              return `
              <tr data-appt="${a.id}">
                <td>${barber}</td>
                <td>${service}</td>
                <td>${escapeHtml(formatDateHR(a.appointment_date))}</td>
                <td>${escapeHtml(formatTime(a.start_time))}</td>
                <td><span class="pill" data-status="${escapeHtml(a.status)}">${escapeHtml(a.status)}</span></td>
                <td>
                  ${
                    canCancel
                      ? `<button class="btn btn--ghost" type="button" data-cancel="${a.id}">Otkaži</button>`
                      : `<span class="muted">—</span>`
                  }
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  root.querySelectorAll('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-cancel'));
      if (!id) return;
      const ok = await showConfirmModal({
        title: 'Otkazivanje rezervacije',
        body: 'Jeste li sigurni da želite otkazati ovu rezervaciju?',
        confirmLabel: 'Otkaži',
        cancelLabel: 'Zadrži',
        danger: true,
      });
      if (!ok) return;
      const { error: e2 } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
      if (e2) {
        showToast(e2.message, 'error');
        return;
      }
      showBigToast('Rezervacija je otkazana.', 'error');
      await refresh(root);
    });
  });
}
