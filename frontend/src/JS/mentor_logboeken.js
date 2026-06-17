// ============================================================
//  mentor_logboeken.js
//  Laadt en beoordeelt logboeken per week
// ============================================================

let alleLogboeken     = [];
let huidigLogboekIdx  = null;
let huidigWeekIndex   = 0;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function') {
    if (!requireAuth(['mentor', 'administrator'])) return;
  }
  laadLogboeken();
});

// ── 1. Logboeken ophalen ────────────────────────────────────
async function laadLogboeken() {
  verbergError();

  const container = document.getElementById('logboek-select');
  if (container) {
    container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        Logboeken laden...
      </div>
    `;
  }

  try {
    const data = await apiFetch('/mentor/logboeken');
    alleLogboeken = Array.isArray(data) ? data : [];
    toonLogboekSelectie(alleLogboeken);
  } catch (err) {
    toonError(err.message || 'Kan logboeken niet laden.');
    if (container) {
      container.innerHTML = '<p class="empty-state">Fout bij laden van logboeken.</p>';
    }
  }
}

// ── 2. Logboeken selectie renderen ─────────────────────────
function toonLogboekSelectie(lijst) {
  const container = document.getElementById('logboek-select');
  if (!container) return;

  if (!lijst || lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen logboeken gevonden.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
      ${lijst.map((log, idx) => {
        const naam = log.studentnaam || log.naam || '—';
        const week = log.week_nr || '?';
        const status = log.status || 'pending';

        return `
          <button
            class="logboek-select-btn"
            id="logboek-btn-${idx}"
            onclick="selecteerLogboek(${idx})"
          >
            <span class="logboek-select-btn__naam">${naam}</span>
            <span class="logboek-select-btn__week">Week ${week}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ── 3. Logboek selecteren ──────────────────────────────────
async function selecteerLogboek(idx) {
  huidigLogboekIdx = idx;
  huidigWeekIndex = 0;

  const log = alleLogboeken[idx];
  if (!log) return;

  // Button markeren
  document.querySelectorAll('.logboek-select-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`logboek-btn-${idx}`);
  if (btn) btn.classList.add('active');

  // Student info tonen
  const naam = log.studentnaam || log.naam || '—';
  const bedrijf = log.bedrijfsnaam || log.bedrijf || '—';

  stel('logboek-student-naam', naam);
  stel('logboek-student-meta', bedrijf + ' · Week 1 van ?');

  const avatar = document.getElementById('logboek-avatar');
  if (avatar) avatar.textContent = naam.charAt(0).toUpperCase();

  // Detail tonen
  const detail = document.getElementById('logboek-detail');
  if (detail) detail.classList.remove('hidden');

  // Eerste week laden
  try {
    await laadLogboekWeken(log);
    toonWeek(0);
  } catch (err) {
    toonError(err.message);
  }
}

// ── 4. Logboek weken ophalen ──────────────────────────────
async function laadLogboekWeken(log) {
  const logId = log.logboek_id || log.id;

  try {
    const data = await apiFetch(`/logboek/${logId}/weken`);
    const weken = Array.isArray(data) ? data : [];

    // Opslaan in huidge logboek
    alleLogboeken[huidigLogboekIdx].weken = weken;

    return weken;
  } catch (err) {
    console.error('Weken laden mislukt:', err);
    return [];
  }
}

// ── 5. Week tonen ──────────────────────────────────────────
async function toonWeek(weekIdx) {
  const log = alleLogboeken[huidigLogboekIdx];
  if (!log) return;

  huidigWeekIndex = weekIdx;
  const weken = log.weken || [];
  const week = weken[weekIdx];

  if (!week) {
    document.getElementById('logboek-dagen').innerHTML = '';
    return;
  }

  // Knoppen updaten
  const btnVorige = document.getElementById('btn-vorige');
  const btnVolgende = document.getElementById('btn-volgende');
  if (btnVorige) btnVorige.disabled = weekIdx === 0;
  if (btnVolgende) btnVolgende.disabled = weekIdx === weken.length - 1;

  // Label updaten
  stel('week-label', `Week ${weekIdx + 1}/${weken.length}`);

  // Status badge
  const badge = document.getElementById('logboek-status-badge');
  if (badge) {
    let badgeClass = 'status-badge--blue';
    let badgeText = 'Ingediend';

    if (week.status === 'pending') {
      badgeClass = 'status-badge--gray';
      badgeText = 'In behandeling';
    } else if (week.status === 'approved') {
      badgeClass = 'status-badge--green';
      badgeText = 'Goedgekeurd';
    }

    badge.className = `status-badge ${badgeClass}`;
    badge.textContent = badgeText;
  }

  // Tabel vullen
  const tbody = document.getElementById('logboek-dagen');
  if (!tbody) return;

  const dagen = week.dagen || [];
  if (dagen.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Geen dagen ingevuld.</td></tr>';
    return;
  }

  tbody.innerHTML = dagen.map(dag => `
    <tr>
      <td>${dag.datum || '—'}</td>
      <td style="text-align: center; font-weight: 600;">${dag.uren || 0}u</td>
      <td>${dag.omschrijving || '—'}</td>
      <td>${dag.reflectie || '—'}</td>
    </tr>
  `).join('');

  // Feedback inladen (als al goedgekeurd)
  const feedbackEl = document.getElementById('logboek-feedback');
  if (feedbackEl) {
    feedbackEl.value = week.mentor_feedback || '';
    feedbackEl.disabled = week.status === 'approved';
  }

  // Knop status
  const approveBtn = document.querySelector('.btn--approve');
  if (approveBtn) {
    approveBtn.disabled = week.status === 'approved';
  }
}

// ── 6. Week navigatie ──────────────────────────────────────
function vorigeWeek() {
  if (huidigWeekIndex > 0) toonWeek(huidigWeekIndex - 1);
}

function volgendeWeek() {
  const log = alleLogboeken[huidigLogboekIdx];
  const weken = log?.weken || [];
  if (huidigWeekIndex < weken.length - 1) toonWeek(huidigWeekIndex + 1);
}

// ── 7. Concept opslaan ─────────────────────────────────────
async function slaConceptOp() {
  const log = alleLogboeken[huidigLogboekIdx];
  if (!log || !log.weken) return;

  const week = log.weken[huidigWeekIndex];
  const feedback = document.getElementById('logboek-feedback').value.trim();

  try {
    const logId = log.logboek_id || log.id;

    await apiFetch(`/logboek/${logId}/feedback`, {
      method: 'PUT',
      body: JSON.stringify({
        week_nr: huidigWeekIndex + 1,
        mentor_feedback: feedback,
        status: 'draft'
      })
    });

    toonSucces('Feedback concept opgeslagen.');
  } catch (err) {
    console.error('Opslaan mislukt:', err);
    alert(`Fout: ${err.message}`);
  }
}

// ── 8. Goedkeuren ─────────────────────────────────────────
async function keurGoed() {
  const log = alleLogboeken[huidigLogboekIdx];
  if (!log || !log.weken) return;

  const week = log.weken[huidigWeekIndex];
  const feedback = document.getElementById('logboek-feedback').value.trim();

  try {
    const logId = log.logboek_id || log.id;

    await apiFetch(`/logboek/${logId}/goedkeuren`, {
      method: 'PUT',
      body: JSON.stringify({
        week_nr: huidigWeekIndex + 1,
        mentor_feedback: feedback,
        status: 'approved'
      })
    });

    // Status lokaal updaten
    week.status = 'approved';
    week.mentor_feedback = feedback;

    toonWeek(huidigWeekIndex);
    toonSucces('Logboek goedgekeurd en feedback opgeslagen.');

  } catch (err) {
    console.error('Goedkeuren mislukt:', err);
    alert(`Fout: ${err.message}`);
  }
}

// ── Modal ──────────────────────────────────────────────────
function toonSucces(bericht) {
  stel('modal-msg', bericht);
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.remove('hidden');
}

function sluitModal() {
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.add('hidden');
}

// ── Hulpfuncties ──────────────────────────────────────────
function stel(id, tekst) {
  const el = document.getElementById(id);
  if (el) el.textContent = tekst;
}

function toonError(bericht) {
  const el = document.getElementById('error-banner');
  if (el) {
    el.textContent = `Fout: ${bericht}`;
    el.classList.remove('hidden');
  }
}

function verbergError() {
  const el = document.getElementById('error-banner');
  if (el) el.classList.add('hidden');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('rol');
  localStorage.removeItem('userId');
  window.location.href = 'login.html';
}
