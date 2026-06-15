// ============================================================
//  mentor_logboeken.js
//  Logboeken bekijken en goedkeuren per student + week
// ============================================================

let alleStudenten   = [];
let huidigStudent   = null;
let alleLogboeken   = [];   // alle weken voor huidige student
let huidigWeekIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['mentor', 'administrator'])) return;
  laadStudenten();
});

// ── 1. Studenten laden in de keuzelijst ─────────────────────
async function laadStudenten() {
  verbergError();

  try {
    const studenten = await apiFetch('/mentor/studenten');
    alleStudenten = Array.isArray(studenten) ? studenten : [];
    toonStudentSelectie(alleStudenten);

    // Als er een ?student_id= in de URL staat, direct laden
    const params   = new URLSearchParams(window.location.search);
    const urlId    = params.get('student_id');
    const logboekId = params.get('logboek_id');

    if (urlId) {
      const gevonden = alleStudenten.find(s =>
        String(s.stage_id || s.id) === String(urlId)
      );
      if (gevonden) selecteerStudent(gevonden, logboekId);
    }

  } catch (err) {
    console.error('Fout bij laden studenten:', err);
    toonError(err.message);
  }
}

// ── 2. Studentenlijst renderen ───────────────────────────────
function toonStudentSelectie(lijst) {
  const container = document.getElementById('student-select');
  if (!container) return;

  if (lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen stagiairs gevonden.</p>';
    return;
  }

  container.innerHTML = `
    <div style="padding:16px; display:flex; flex-wrap:wrap; gap:10px;">
      ${lijst.map(s => {
        const naam    = s.studentnaam  || s.naam    || '—';
        const bedrijf = s.bedrijfsnaam || s.bedrijf || '—';
        const id      = s.stage_id     || s.id      || '';
        return `
          <button
            class="btn btn--ghost"
            onclick="selecteerStudent(${JSON.stringify(s).replace(/"/g, '&quot;')})"
            id="student-btn-${id}"
          >
            ${naam} <span style="color:#94a3b8; font-weight:400; font-size:12px; margin-left:4px;">${bedrijf}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ── 3. Student selecteren en logboeken laden ─────────────────
async function selecteerStudent(student, doelLogboekId = null) {
  huidigStudent = student;

  // Actieve knop markeren
  document.querySelectorAll('[id^="student-btn-"]').forEach(b => b.classList.remove('btn--primary'));
  const knop = document.getElementById(`student-btn-${student.stage_id || student.id}`);
  if (knop) { knop.classList.remove('btn--ghost'); knop.classList.add('btn--primary'); }

  // Student info tonen in header
  const naam    = student.studentnaam  || student.naam    || '—';
  const bedrijf = student.bedrijfsnaam || student.bedrijf || '—';
  stel('student-naam',   naam);
  stel('student-meta',   `${bedrijf}${student.opleiding ? ' · ' + student.opleiding : ''}`);
  stel('student-avatar', naam.charAt(0).toUpperCase());

  // Logboek detail tonen
  const detail   = document.getElementById('logboek-detail');
  const noStudent = document.getElementById('no-student');
  if (detail)    detail.classList.remove('hidden');
  if (noStudent) noStudent.classList.add('hidden');

  // Logboeken ophalen
  try {
    const stageId = student.stage_id || student.id;
    const logs    = await apiFetch(`/logboek/stage/${stageId}`);
    alleLogboeken = Array.isArray(logs) ? logs : [];

    if (alleLogboeken.length === 0) {
      document.getElementById('logboek-dagen').innerHTML =
        '<tr><td colspan="4" class="empty-state">Nog geen logboeken ingediend.</td></tr>';
      stel('week-label',   'Geen weken');
      stel('uren-totaal',  '0 uur gelogd');
      stel('logboek-status-badge', 'Geen data');
      document.getElementById('btn-vorige').disabled   = true;
      document.getElementById('btn-volgende').disabled = true;
      return;
    }

    // Ga naar het gevraagde logboek of de eerste week
    if (doelLogboekId) {
      const idx = alleLogboeken.findIndex(l =>
        String(l.logboek_id || l.id) === String(doelLogboekId)
      );
      huidigWeekIndex = idx >= 0 ? idx : 0;
    } else {
      huidigWeekIndex = 0;
    }

    toonWeek(huidigWeekIndex);

  } catch (err) {
    console.error('Fout bij laden logboeken:', err);
    toonError(err.message);
  }
}

// ── 4. Week weergeven ────────────────────────────────────────
function toonWeek(index) {
  const log = alleLogboeken[index];
  if (!log) return;

  huidigWeekIndex = index;

  // Week label + navigatie
  stel('week-label', `Week ${log.week_nummer || index + 1} / ${alleLogboeken.length}`);
  document.getElementById('btn-vorige').disabled   = index === 0;
  document.getElementById('btn-volgende').disabled = index === alleLogboeken.length - 1;

  // Status badge
  const statusBadge = document.getElementById('logboek-status-badge');
  const status       = String(log.status || '').toLowerCase();

  if (status === 'goedgekeurd') {
    statusBadge.textContent  = 'Goedgekeurd ✓';
    statusBadge.className    = 'status-badge status-badge--approved';
  } else if (status === 'afgekeurd' || status === 'rejected') {
    statusBadge.textContent  = 'Afgekeurd';
    statusBadge.className    = 'status-badge status-badge--rejected';
  } else {
    statusBadge.textContent  = 'Wacht op goedkeuring';
    statusBadge.className    = 'status-badge status-badge--pending';
  }

  // Uren totaal
  const totaalUren = log.totaal_uren || log.uren || 0;
  stel('uren-totaal', `${totaalUren} uur gelogd`);

  // Bestaande feedback laden
  const feedbackVeld = document.getElementById('logboek-feedback');
  if (feedbackVeld) feedbackVeld.value = log.mentor_feedback || '';

  // ── Dag-rijen ──
  const tbody = document.getElementById('logboek-dagen');
  if (!tbody) return;

  // Dagen kunnen in log.dagen zitten of los in log.entries
  const dagen = log.dagen || log.entries || [];

  if (dagen.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state" style="padding:16px;">
          Geen dagentries gevonden voor deze week.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = dagen.map(dag => {
    const datum        = dag.datum         ? formatDatum(dag.datum)    : '—';
    const uren         = dag.uren          || dag.aantal_uren           || '—';
    const omschrijving = dag.omschrijving  || dag.taakomschrijving      || dag.taak || '—';
    const reflectie    = dag.reflectie     || dag.leerpunten            || '';

    return `
      <tr>
        <td style="padding:10px 14px; font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6;">${datum}</td>
        <td style="padding:10px 14px; font-size:13px; font-weight:600; text-align:center; border-bottom:1px solid #f3f4f6;">${uren}u</td>
        <td style="padding:10px 14px; font-size:13px; color:#111827; border-bottom:1px solid #f3f4f6;">${omschrijving}</td>
        <td style="padding:10px 14px; font-size:13px; color:#6b7280; border-bottom:1px solid #f3f4f6;">${reflectie}</td>
      </tr>
    `;
  }).join('');
}

// ── 5. Week-navigatie ────────────────────────────────────────
function vorigeWeek() {
  if (huidigWeekIndex > 0) toonWeek(huidigWeekIndex - 1);
}

function volgendeWeek() {
  if (huidigWeekIndex < alleLogboeken.length - 1) toonWeek(huidigWeekIndex + 1);
}

// ── 6. Goedkeuren ────────────────────────────────────────────
async function keurGoed() {
  const log     = alleLogboeken[huidigWeekIndex];
  const feedback = document.getElementById('logboek-feedback').value.trim();

  if (!log) return;

  try {
    const logId = log.logboek_id || log.id;

    await apiFetch(`/logboek/${logId}/goedkeuren`, {
      method: 'PUT',
      body: JSON.stringify({ mentor_feedback: feedback })
    });

    // Status lokaal bijwerken
    log.status           = 'goedgekeurd';
    log.mentor_feedback  = feedback;
    toonWeek(huidigWeekIndex);

    toonSucces('Logboek goedgekeurd en feedback opgeslagen.');

  } catch (err) {
    console.error('Goedkeuren mislukt:', err);
    alert(`Fout bij goedkeuren: ${err.message}`);
  }
}

// ── 7. Alleen feedback opslaan ───────────────────────────────
async function slaFeedbackOp() {
  const log      = alleLogboeken[huidigWeekIndex];
  const feedback = document.getElementById('logboek-feedback').value.trim();

  if (!log) return;

  try {
    const logId = log.logboek_id || log.id;

    await apiFetch(`/logboek/${logId}/feedback`, {
      method: 'PUT',
      body: JSON.stringify({ mentor_feedback: feedback })
    });

    log.mentor_feedback = feedback;
    toonSucces('Feedback opgeslagen.');

  } catch (err) {
    console.error('Feedback opslaan mislukt:', err);
    alert(`Fout: ${err.message}`);
  }
}

// ── Modal ─────────────────────────────────────────────────────
function toonSucces(bericht) {
  stel('modal-msg', bericht);
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.remove('hidden');
}

function sluitModal() {
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.add('hidden');
}

// ── Uitloggen ─────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

// ── Hulpfuncties ──────────────────────────────────────────────
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
  if (el) { el.textContent = `Fout: ${bericht}`; el.classList.remove('hidden'); }
}

function verbergError() {
  const el = document.getElementById('error-banner');
  if (el) el.classList.add('hidden');
}
