// ============================================================
//  mentor_dashboard.js
//  Laadt statistieken, logboeken te checken en stagiairslijst
// ============================================================

let alleStudenten = [];   // volledige lijst (voor zoekfilter)

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['mentor', 'administrator'])) return;
  laadDashboard();

  // Live zoeken in stagiairslijst
  const zoekInput = document.getElementById('student-zoeken');
  if (zoekInput) zoekInput.addEventListener('input', filterStudenten);
});

// ── Hoofdlaadfunctie ────────────────────────────────────────
async function laadDashboard() {
  verbergError();

  try {
    // Haal alle studenten op die aan deze mentor gekoppeld zijn
    const studenten = await apiFetch('/mentor/studenten');
    alleStudenten = Array.isArray(studenten) ? studenten : [];

    // Haal alle logboeken op die nog gecheckt moeten worden
    const logboeken = await apiFetch('/mentor/logboeken/pending');
    const openLogboeken = Array.isArray(logboeken) ? logboeken : [];

    // Tel openstaande evaluaties (studenten zonder ingevulde evaluatie)
    const evaluaties = await apiFetch('/mentor/evaluaties/open');
    const openEvaluaties = Array.isArray(evaluaties) ? evaluaties : [];

    // ── Stat cards ──
    stel('stat-studenten',  alleStudenten.length);
    stel('stat-logboeken',  openLogboeken.length);
    stel('stat-evaluaties', openEvaluaties.length);

    // ── Welkomsttitel ──
    const profiel = await apiFetch('/auth/me').catch(() => null);
    if (profiel) {
      stel('welkom-titel', `Welkom, ${profiel.naam || profiel.voornaam || 'Mentor'}`);
    }

    // ── Te beoordelen logboeken ──
    toonLogboeken(openLogboeken);

    // ── Stagiairslijst ──
    toonStudenten(alleStudenten);

  } catch (err) {
    console.error('Dashboard laad-fout:', err);
    toonError(err.message);
  }
}

// ── Logboeken renderen ───────────────────────────────────────
function toonLogboeken(logboeken) {
  const container = document.getElementById('logboek-list');
  if (!container) return;

  if (logboeken.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen logboeken te beoordelen. 🎉</p>';
    return;
  }

  container.innerHTML = logboeken.map(log => {
    const student  = log.studentnaam  || log.student_naam  || '—';
    const week     = log.week_nummer  || log.weeknummer    || '?';
    const ingediend = log.ingediend_op || log.datum         || '';
    const id       = log.logboek_id   || log.id            || '';
    const stageId  = log.stage_id     || '';

    return `
      <div class="logboek-item">
        <div class="logboek-item__info">
          <p class="logboek-item__name">${student}</p>
          <p class="logboek-item__meta">
            Week ${week}
            ${ingediend ? ' · Ingediend op ' + formatDatum(ingediend) : ''}
          </p>
        </div>
        <span class="badge badge--pending">Te beoordelen</span>
        <a
          href="mentor_logboeken.html?student_id=${stageId}&logboek_id=${id}"
          class="btn btn--sm btn--primary"
          style="margin-left:12px;"
        >
          Bekijken →
        </a>
      </div>
    `;
  }).join('');
}

// ── Stagiairslijst renderen ──────────────────────────────────
function toonStudenten(lijst) {
  const container = document.getElementById('student-list');
  if (!container) return;

  if (lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen stagiairs gevonden.</p>';
    return;
  }

  container.innerHTML = `<ul class="student-list">${lijst.map(s => {
    const naam     = s.studentnaam  || s.naam  || '—';
    const bedrijf  = s.bedrijfsnaam || s.bedrijf || '—';
    const stageId  = s.stage_id     || s.id     || '';
    const initiaal = naam.charAt(0).toUpperCase();

    return `
      <li class="student-list__item">
        <div class="student-list__avatar">${initiaal}</div>
        <div style="flex:1;">
          <p class="student-list__name">${naam}</p>
          <p class="student-list__sub">${bedrijf}</p>
        </div>
        <a
          href="mentor_logboeken.html?student_id=${stageId}"
          class="btn btn--sm btn--ghost"
        >
          Logboek →
        </a>
        <a
          href="mentor_evaluatie.html?student_id=${stageId}"
          class="btn btn--sm btn--ghost"
          style="margin-left:6px;"
        >
          Evaluatie →
        </a>
      </li>
    `;
  }).join('')}</ul>`;
}

// ── Live zoekfilter ──────────────────────────────────────────
function filterStudenten() {
  const zoekterm = document.getElementById('student-zoeken').value.toLowerCase().trim();
  if (!zoekterm) {
    toonStudenten(alleStudenten);
    return;
  }

  const gefilterd = alleStudenten.filter(s => {
    const naam    = (s.studentnaam  || s.naam    || '').toLowerCase();
    const bedrijf = (s.bedrijfsnaam || s.bedrijf || '').toLowerCase();
    return naam.includes(zoekterm) || bedrijf.includes(zoekterm);
  });

  toonStudenten(gefilterd);
}

// ── Modal ────────────────────────────────────────────────────
function sluitModal() {
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.add('hidden');
}

// ── Uitloggen ────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

// ── Hulpfuncties ─────────────────────────────────────────────
function stel(id, tekst) {
  const el = document.getElementById(id);
  if (el) el.textContent = tekst;
}

function formatDatum(datum) {
  if (!datum) return '—';
  return new Date(datum).toLocaleDateString('nl-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function toonError(bericht) {
  const el = document.getElementById('error-banner');
  if (el) {
    el.textContent = `Kan geen verbinding maken: ${bericht}`;
    el.classList.remove('hidden');
  }
}

function verbergError() {
  const el = document.getElementById('error-banner');
  if (el) el.classList.add('hidden');
}
