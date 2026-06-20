// ============================================================
//  mentor_dashboard.js
//  Dashboard: laadt statistieken, logboeken en stagiairs
// ============================================================

let alleStudenten = [];

document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function') {
    if (!requireAuth(['mentor', 'stagementor', 'docent', 'administrator'])) return;
  }
  laadDashboard();

  const zoekInput = document.getElementById('student-zoeken');
  if (zoekInput) {
    zoekInput.addEventListener('input', filterStudenten);
  }
});

// ── Hoofdlaad ──────────────────────────────────────────────
async function laadDashboard() {
  verbergError();

  try {
    const [studenten, logboeken, evaluaties, contracten] = await Promise.all([
      apiFetch('/mentors/studenten'),
      apiFetch('/mentors/logboeken/pending'),
      apiFetch('/mentors/evaluaties/open'),
      apiFetch('/mentors/contracten')
    ]);

    alleStudenten = Array.isArray(studenten) ? studenten : [];
    const openLogboeken = Array.isArray(logboeken) ? logboeken : [];
    const openEvaluaties = Array.isArray(evaluaties) ? evaluaties : [];
    const alleContracten = Array.isArray(contracten) ? contracten : [];

    // Stat cards bijwerken
    stel('stat-studenten', alleStudenten.length);
    stel('stat-logboeken', openLogboeken.length);
    stel('stat-evaluaties', openEvaluaties.length);

    // Lijsten tonen
    toonLogboeken(openLogboeken.slice(0, 5));
    toonStudenten(alleStudenten);
    toonContracten(alleContracten);

  } catch (err) {
    toonError(err.message || 'Kan dashboard niet laden.');
  }
}

// ── Logboeken tonen (top 5) ────────────────────────────────
function toonLogboeken(lijst) {
  const container = document.getElementById('logboek-list');
  if (!container) return;

  if (!lijst || lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen logboeken in beoordeling.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${lijst.map(log => {
        const naam = log.studentnaam || log.naam || '—';
        const week = log.week_nr || '?';
        const status = log.status || 'pending';

        let statusClass = 'status-badge--blue';
        let statusText = 'Te beoordelen';

        if (status === 'late') {
          statusClass = 'status-badge--red';
          statusText = 'Te laat ingediend';
        }

        return `
          <div class="student-item status-${status}">
            <div>
              <p class="student-name">${naam}</p>
              <p class="student-meta">Week ${week}</p>
            </div>
            <span class="status-badge ${statusClass}">${statusText}</span>
            <a href="mentor_logboeken.html?stage_id=${log.stage_id}&week=${week}" class="btn btn--secondary" style="margin-left:12px">Beoordelen →</a>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Stagiairs tonen ───────────────────────────────────────
function toonStudenten(lijst) {
  const container = document.getElementById('student-list');
  if (!container) return;

  if (!lijst || lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen stagiairs gevonden.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${lijst.map(s => {
        const naam = s.studentnaam || s.naam || '—';
        const bedrijf = s.bedrijfsnaam || s.bedrijf || '—';
        const opleiding = s.opleiding || '';

        return `
          <div class="student-item">
            <div class="student-avatar">${naam.charAt(0).toUpperCase()}</div>
            <div style="flex: 1;">
              <p class="student-name">${naam}</p>
              <p class="student-meta">${opleiding ? opleiding + ' · ' : ''}${bedrijf}</p>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}


// ── Contracten tonen ──────────────────────────────────────
function toonContracten(lijst) {
  const container = document.getElementById('contract-list');
  if (!container) return;

  if (!lijst || lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen contracten gevonden.</p>';
    return;
  }

  container.innerHTML = lijst.map(c => {
    if (c.mentor_getekend) {
      return `<div class="student-item">
        <div style="flex:1">
          <p class="student-name">${c.studentnaam}</p>
          <p class="student-meta">${c.bedrijfsnaam || '—'}</p>
        </div>
        <span style="font-size:13px;color:#15803D;font-weight:600;">✓ Getekend</span>
      </div>`;
    }
    if (!c.student_getekend) {
      return `<div class="student-item">
        <div style="flex:1">
          <p class="student-name">${c.studentnaam}</p>
          <p class="student-meta">${c.bedrijfsnaam || '—'}</p>
        </div>
        <span style="font-size:13px;color:#9CA3AF;">Wacht op student</span>
      </div>`;
    }
    return `<div class="student-item">
      <div style="flex:1">
        <p class="student-name">${c.studentnaam}</p>
        <p class="student-meta">${c.bedrijfsnaam || '—'} · Student heeft getekend</p>
      </div>
      <a href="${c.teken_url}" style="background:#D1193E;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">✎ Teken</a>
    </div>`;
  }).join('');
}

// ── Filter stagiairs ───────────────────────────────────────
function filterStudenten() {
  const zoekterm = (document.getElementById('student-zoeken')?.value || '').toLowerCase();
  const gefilterd = alleStudenten.filter(s => {
    const naam = (s.studentnaam || s.naam || '').toLowerCase();
    const bedrijf = (s.bedrijfsnaam || s.bedrijf || '').toLowerCase();
    const opleiding = (s.opleiding || '').toLowerCase();

    return naam.includes(zoekterm) ||
           bedrijf.includes(zoekterm) ||
           opleiding.includes(zoekterm);
  });

  toonStudenten(gefilterd);
}

// ── Hulpfuncties ───────────────────────────────────────────
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
  window.location.href = 'index.html';
}
