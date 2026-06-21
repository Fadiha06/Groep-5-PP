// ============================================================
//  mentor_evaluaties.js
//  Laadt stagiairs, weken en slaat per-week competentiescores op
// ============================================================

let huidigStudent   = null;
let scores          = {};
let competenties    = [];
let alleStudenten   = [];
let alleWeken       = [];
let huidigWeekIndex = 0;

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function') {
    if (!requireAuth(['mentor', 'administrator'])) return;
  }
  laadStudenten();
});

// ── 1. Studenten ophalen ─────────────────────────────────────
async function laadStudenten() {
  verbergError();

  try {
    const data = await apiFetch('/mentor/studenten');
    alleStudenten = Array.isArray(data) ? data : [];
    toonStudentSelectie(alleStudenten);
  } catch (err) {
    toonError(err.message || 'Kan studenten niet laden.');
    document.getElementById('student-select').innerHTML =
      '<p class="empty-state">Fout bij laden van stagiairs.</p>';
  }
}

// ── 2. Studenten renderen ─────────────────────────────────────
function toonStudentSelectie(lijst) {
  const container = document.getElementById('student-select');
  if (!container) return;

  if (!lijst || lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen stagiairs gevonden.</p>';
    return;
  }

  container.innerHTML = `
    <div style="padding: 16px; display: flex; flex-wrap: wrap; gap: 10px;">
      ${lijst.map((s, idx) => {
        const naam    = s.studentnaam  || s.naam    || '—';
        const bedrijf = s.bedrijfsnaam || s.bedrijf || '—';
        const id      = s.stage_id     || s.id      || '';

        return `
          <button
            class="student-select-btn"
            id="student-btn-${id}"
            onclick="selecteerStudent(${idx})"
          >
            <span class="student-select-btn__name">${naam}</span>
            <span class="student-select-btn__bedrijf">${bedrijf}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ── 3. Student selecteren ─────────────────────────────────────
async function selecteerStudent(idx) {
  const student = alleStudenten[idx];
  if (!student) return;
  huidigStudent = student;
  scores        = {};

  // Actieve knop markeren
  document.querySelectorAll('.student-select-btn').forEach(b => b.classList.remove('active'));
  const id = student.stage_id || student.id || '';
  const btn = document.getElementById(`student-btn-${id}`);
  if (btn) btn.classList.add('active');

  // Student info invullen
  const naam    = student.studentnaam  || student.naam    || '—';
  const bedrijf = student.bedrijfsnaam || student.bedrijf || '—';
  const opleiding = student.opleiding  || '';

  stel('student-naam', naam);
  stel('student-meta', opleiding ? `${opleiding} · ${bedrijf}` : bedrijf);

  const avatar = document.getElementById('student-avatar');
  if (avatar) avatar.textContent = naam.charAt(0).toUpperCase();

  // Detail card tonen
  const detail = document.getElementById('evaluatie-detail');
  if (detail) detail.classList.remove('hidden');

  // Weken laden
  await laadWeken();
}

// ── 4. Weken ophalen ────────────────────────────────────────
async function laadWeken() {
  const stageId = huidigStudent.stage_id || huidigStudent.id;
  try {
    const data = await apiFetch(`/logboek/${stageId}/weken`);
    alleWeken = Array.isArray(data) ? data : [];
    huidigWeekIndex = Math.max(0, alleWeken.length - 1);
    await toonWeek(huidigWeekIndex);
  } catch (err) {
    alleWeken = [];
    document.getElementById('competenties-container').innerHTML =
      '<p class="empty-state">Geen logboekweken gevonden voor deze stagiair.</p>';
    stel('week-label', 'Geen weken');
  }
}

// ── 5. Week tonen ───────────────────────────────────────────
async function toonWeek(weekIdx) {
  huidigWeekIndex = weekIdx;
  const week = alleWeken[weekIdx];

  const btnVorige = document.getElementById('btn-vorige');
  const btnVolgende = document.getElementById('btn-volgende');
  if (btnVorige) btnVorige.disabled = weekIdx <= 0;
  if (btnVolgende) btnVolgende.disabled = weekIdx >= alleWeken.length - 1;

  if (!week) {
    stel('week-label', 'Geen weken beschikbaar');
    document.getElementById('competenties-container').innerHTML =
      '<p class="empty-state">Geen logboekweken gevonden voor deze stagiair.</p>';
    return;
  }

  stel('week-label', `Week ${week.weeknummer || weekIdx + 1} / ${alleWeken.length}`);

  // Status badge
  const badge = document.getElementById('status-badge');
  if (badge) {
    let badgeClass = 'status-badge--gray', badgeText = 'Concept';
    if (week.status === 'ingediend') { badgeClass = 'status-badge--blue'; badgeText = 'Ingediend'; }
    if (week.status === 'goedgekeurd') { badgeClass = 'status-badge--green'; badgeText = 'Goedgekeurd'; }
    badge.className = `status-badge ${badgeClass}`;
    badge.textContent = badgeText;
  }

  // Bestaande mentor-scores van deze week inladen
  scores = {};
  (week.mentor_scores || []).forEach(s => {
    scores[s.competentie_id] = { score: s.score, feedback: '' };
  });

  // Feedback-veld
  const feedbackEl = document.getElementById('week-feedback-input');
  if (feedbackEl) feedbackEl.value = week.mentor_feedback || '';

  const goedkeurenBtn = document.getElementById('btn-goedkeuren');
  if (goedkeurenBtn) goedkeurenBtn.disabled = week.status === 'goedgekeurd';

  await laadCompetenties();
}

// ── 6. Competenties ophalen ────────────────────────────────────
async function laadCompetenties() {
  const container = document.getElementById('competenties-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      Competenties laden...
    </div>
  `;

  try {
    const opleiding = huidigStudent.opleiding || '';
    const endpoint = opleiding ? `/competenties?opleiding=${encodeURIComponent(opleiding)}` : '/competenties';
    const data = await apiFetch(endpoint);
    competenties = Array.isArray(data?.competenties) ? data.competenties : (Array.isArray(data) ? data : []);

    toonCompetenties(competenties);
    updateTotaalScore();
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-error">
        Fout bij laden van competenties: ${err.message}
      </div>
    `;
  }
}

// ── 7. Competenties filteren ───────────────────────────────────
function filterCompetenties() {
  const zoekterm = (document.getElementById('competentie-zoeken')?.value || '').toLowerCase();
  const gefilterd = competenties.filter(c =>
    (c.naam || c.name || '').toLowerCase().includes(zoekterm) ||
    (c.beschrijving || '').toLowerCase().includes(zoekterm)
  );
  toonCompetenties(gefilterd);
}

// ── 8. Competenties renderen ───────────────────────────────────
function toonCompetenties(lijst) {
  const container = document.getElementById('competenties-container');
  if (!container) return;

  const teller = document.getElementById('eval-count');
  if (teller) teller.textContent = `${lijst.length} competentie${lijst.length !== 1 ? 's' : ''}`;

  if (lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen competenties gevonden.</p>';
    return;
  }

  container.innerHTML = lijst.map(comp => {
    const id      = comp.competentie_id || comp.id;
    const huidige = scores[id] || {};

    const niveaus = (comp.rubrieken || comp.niveaus || []).map(n => ({
      label:        labelVoorPunten(n.punten),
      score:        n.punten,
      omschrijving: n.omschrijving
    }));

    const huidigeScore = huidige.score || null;

    return `
      <div class="comp-kaart" id="rubric-${id}">

        <!-- Kaart header -->
        <div class="comp-kaart__head">
          <div>
            <span class="comp-kaart__naam">${comp.naam || comp.name || 'Competentie'} <span class="comp-kaart__max">(Max 5 ptn)</span></span>
            ${comp.beschrijving
              ? `<div class="comp-kaart__desc">${comp.beschrijving}</div>`
              : ''
            }
          </div>
          <span
            class="comp-kaart__score ${huidigeScore ? '' : 'comp-kaart__score--low'}"
            id="score-label-${id}"
          >
            Score: ${huidigeScore || '–'}/5
          </span>
        </div>

        <!-- Niveauvakken -->
        <div class="comp-kaart__niveaus">
          ${niveaus.map(n => {
            const isGekozen = huidigeScore === n.score;
            return `
              <div
                class="niveau-vak ${isGekozen ? (n.score <= 1 ? 'geselecteerd geselecteerd--bad' : 'geselecteerd') : ''}"
                data-punten="${n.score}"
                onclick="kiesScore(${id}, ${n.score})"
              >
                <div class="niveau-vak__titel">${n.score} ptn – ${n.label}</div>
                <div class="niveau-vak__desc">${n.omschrijving}</div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  }).join('');
}

function labelVoorPunten(p) {
  if (p <= 1) return 'Onvoldoende';
  if (p === 2) return 'Voldoende';
  if (p === 3) return 'Goed';
  if (p === 4) return 'Zeer goed';
  return 'Perfect';
}

// ── 9. Score kiezen ───────────────────────────────────────────
function kiesScore(compId, score) {
  if (!scores[compId]) scores[compId] = { score: null, feedback: '' };
  scores[compId].score = score;

  const kaart = document.getElementById(`rubric-${compId}`);
  if (kaart) {
    kaart.querySelectorAll('.niveau-vak').forEach(v => v.classList.remove('geselecteerd', 'geselecteerd--bad'));
    const gekozen = kaart.querySelector(`.niveau-vak[data-punten="${score}"]`);
    if (gekozen) gekozen.classList.add('geselecteerd', ...(score <= 1 ? ['geselecteerd--bad'] : []));
  }

  const label = document.getElementById(`score-label-${compId}`);
  if (label) {
    label.textContent = `Score: ${score}/5`;
    label.className   = 'comp-kaart__score';
  }

  updateTotaalScore();
}

// ── 10. Totaalscore berekenen ─────────────────────────────────
function updateTotaalScore() {
  const waarden = Object.values(scores).filter(s => s.score !== null);
  const totaal  = waarden.reduce((som, s) => som + (s.score || 0), 0);
  const max     = competenties.length * 5;

  const el = document.getElementById('totaal-score');
  if (el) el.textContent = `Totaal: ${totaal} / ${max} ptn`;
}

// ── 11. Week navigatie ────────────────────────────────────────
function vorigeWeek() {
  if (huidigWeekIndex > 0) toonWeek(huidigWeekIndex - 1);
}

function volgendeWeek() {
  if (huidigWeekIndex < alleWeken.length - 1) toonWeek(huidigWeekIndex + 1);
}

// ── 12. Scores + feedback opslaan (concept) ───────────────────
async function slaConceptOp() {
  await verstuurEvaluatie(false);
}

// ── 13. Goedkeuren ─────────────────────────────────────────────
async function keurGoed() {
  await verstuurEvaluatie(true);
}

// ── 14. API-calls ──────────────────────────────────────────────
async function verstuurEvaluatie(goedkeuren) {
  if (!huidigStudent) return;
  const week = alleWeken[huidigWeekIndex];
  if (!week) return;

  const stageId = huidigStudent.stage_id || huidigStudent.id;
  const weeknummer = week.weeknummer || huidigWeekIndex + 1;
  const feedback = (document.getElementById('week-feedback-input')?.value || '').trim();

  const scoreMap = {};
  Object.entries(scores).forEach(([compId, data]) => {
    if (data.score != null) scoreMap[compId] = data.score;
  });

  try {
    if (Object.keys(scoreMap).length > 0) {
      await apiFetch('/mentor/logboek/evaluatie', {
        method: 'POST',
        body: JSON.stringify({ stage_id: stageId, weeknummer, scores: scoreMap })
      });
    }

    await apiFetch('/mentor/logboek/feedback', {
      method: 'POST',
      body: JSON.stringify({ stage_id: stageId, weeknummer, feedback })
    });

    if (goedkeuren) {
      await apiFetch('/mentor/logboek/goedkeuren', {
        method: 'POST',
        body: JSON.stringify({ stage_id: stageId, weeknummer })
      });
      week.status = 'goedgekeurd';
    }

    week.mentor_feedback = feedback;
    week.mentor_scores = Object.entries(scoreMap).map(([compId, score]) => ({
      competentie_id: Number(compId),
      score,
      competentie_naam: competenties.find(c => c.competentie_id == compId)?.naam || ''
    }));

    toonWeek(huidigWeekIndex);
    toonSucces(goedkeuren ? 'Logboek goedgekeurd en feedback opgeslagen.' : 'Concept opgeslagen.');
  } catch (err) {
    console.error('Opslaan mislukt:', err);
    alert(`Fout bij opslaan: ${err.message}`);
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
  localStorage.removeItem('rol');
  localStorage.removeItem('userId');
  window.location.href = 'index.html';
}

// ── Hulpfuncties ──────────────────────────────────────────────
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
