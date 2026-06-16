// ============================================================
//  mentor_evaluaties.js
//  Laadt stagiairs, competenties en slaat evaluaties op
// ============================================================

let huidigStudent   = null;
let scores          = {};
let competenties    = [];
let alleStudenten   = [];
let evaluatieType   = 'tussentijds';

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
      ${lijst.map(s => {
        const naam    = s.studentnaam  || s.naam    || '—';
        const bedrijf = s.bedrijfsnaam || s.bedrijf || '—';
        const id      = s.stage_id     || s.id      || '';
        const initiaal = naam.charAt(0).toUpperCase();

        return `
          <button
            class="student-select-btn"
            id="student-btn-${id}"
            onclick="selecteerStudent(${JSON.stringify(s).replace(/"/g, '"')})"
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
async function selecteerStudent(student) {
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

  // Competenties laden
  await laadCompetenties();
}

// ── 4. Competenties ophalen ────────────────────────────────────
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
    const stageId = huidigStudent.stage_id || huidigStudent.id;
    const data    = await apiFetch(`/evaluatie/competenties?stage_id=${stageId}&type=${evaluatieType}`);
    competenties  = Array.isArray(data) ? data : [];

    // Probeer bestaand concept laden
    try {
      const concept = await apiFetch(`/evaluatie/concept?stage_id=${stageId}&type=${evaluatieType}`);
      if (concept && concept.scores) {
        concept.scores.forEach(s => {
          scores[s.competentie_id] = {
            score:    s.score,
            feedback: s.feedback || ''
          };
        });
      }
    } catch (_) {
      // Geen concept – geen probleem
    }

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

// ── 5. Competenties filteren ───────────────────────────────────
function filterCompetenties() {
  const zoekterm = (document.getElementById('competentie-zoeken')?.value || '').toLowerCase();
  const gefilterd = competenties.filter(c =>
    (c.naam || c.name || '').toLowerCase().includes(zoekterm) ||
    (c.beschrijving || '').toLowerCase().includes(zoekterm)
  );
  toonCompetenties(gefilterd);
}

// ── 6. Competenties renderen ───────────────────────────────────
function toonCompetenties(lijst) {
  const container = document.getElementById('competenties-container');
  if (!container) return;

  // Teller bijwerken
  const teller = document.getElementById('eval-count');
  if (teller) teller.textContent = `${lijst.length} competentie${lijst.length !== 1 ? 's' : ''}`;

  if (lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen competenties gevonden.</p>';
    return;
  }

  container.innerHTML = lijst.map(comp => {
    const id      = comp.competentie_id || comp.id;
    const huidige = scores[id] || {};

    const niveaus = comp.niveaus || [
      { code: 'O',  label: 'Onvoldoende', score: 1, omschrijving: 'Student haalt het verwachte niveau niet.' },
      { code: 'V',  label: 'Voldoende',   score: 2, omschrijving: 'Student haalt het minimale niveau.' },
      { code: 'G',  label: 'Goed',        score: 3, omschrijving: 'Student presteert boven het minimum.' },
      { code: 'UG', label: 'Uitstekend',  score: 4, omschrijving: 'Student overtreft alle verwachtingen.' }
    ];

    const huidigeScore = huidige.score || null;
    const feedbackWaarde = huidige.feedback || '';

    return `
      <div class="rubric-card" id="rubric-${id}">

        <!-- Kaart header -->
        <div class="rubric-card__header">
          <div>
            <p class="rubric-card__title">${comp.naam || comp.name || 'Competentie'}</p>
            ${comp.beschrijving
              ? `<p class="rubric-card__desc">${comp.beschrijving}</p>`
              : ''
            }
          </div>
          <span
            class="rubric-card__score ${huidigeScore ? '' : 'rubric-card__score--low'}"
            id="score-label-${id}"
          >
            ${huidigeScore ? `Score: ${huidigeScore}` : 'Nog niet beoordeeld'}
          </span>
        </div>

        <!-- Niveauknoppen -->
        <div class="rubric-options">
          ${niveaus.map((n, idx) => {
            const optId    = `opt-${id}-${n.score}`;
            const isGekozen = huidigeScore === n.score;
            const extraClass = isGekozen
              ? (n.score <= 1 ? 'rubric-option--selected-bad' : 'rubric-option--selected')
              : '';

            return `
              <button
                class="rubric-option ${extraClass}"
                id="${optId}"
                onclick="kiesScore(${id}, ${n.score}, ${niveaus.length})"
              >
                <span class="rubric-option__code">${n.code}</span>
                <span class="rubric-option__label">${n.label}</span>
                <span class="rubric-option__desc">${n.omschrijving}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Feedback textarea -->
        <div class="rubric-feedback">
          <label for="feedback-${id}">Feedback voor deze competentie</label>
          <textarea
            id="feedback-${id}"
            placeholder="Optioneel: geef toelichting bij je beoordeling..."
            onchange="slaFeedbackOp(${id})"
            oninput="slaFeedbackOp(${id})"
          >${feedbackWaarde}</textarea>
        </div>

      </div>
    `;
  }).join('');
}

// ── 7. Evaluatietype wisselen ─────────────────────────────────
async function wisselType(type, tabEl) {
  if (type === evaluatieType) return;
  evaluatieType = type;

  // Tabs visueel bijwerken
  document.querySelectorAll('.eval-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');

  // Scores resetten en heropladen
  scores = {};
  if (huidigStudent) await laadCompetenties();
}

// ── 8. Score kiezen ───────────────────────────────────────────
function kiesScore(compId, score, aantalNiveaus) {
  if (!scores[compId]) scores[compId] = { score: null, feedback: '' };
  scores[compId].score = score;

  // Alle opties resetten
  for (let i = 1; i <= aantalNiveaus; i++) {
    const opt = document.getElementById(`opt-${compId}-${i}`);
    if (opt) {
      opt.classList.remove('rubric-option--selected', 'rubric-option--selected-bad');
    }
  }

  // Gekozen optie markeren
  const gekozen = document.getElementById(`opt-${compId}-${score}`);
  if (gekozen) {
    gekozen.classList.add(score <= 1
      ? 'rubric-option--selected-bad'
      : 'rubric-option--selected'
    );
  }

  // Score label bijwerken
  const label = document.getElementById(`score-label-${compId}`);
  if (label) {
    label.textContent = `Score: ${score}`;
    label.className   = score <= 1
      ? 'rubric-card__score rubric-card__score--low'
      : 'rubric-card__score';
  }

  updateTotaalScore();
}

// ── 9. Feedback opslaan ───────────────────────────────────────
function slaFeedbackOp(compId) {
  const input = document.getElementById(`feedback-${compId}`);
  if (!input) return;
  if (!scores[compId]) scores[compId] = { score: null, feedback: '' };
  scores[compId].feedback = input.value;
}

// ── 10. Totaalscore berekenen ─────────────────────────────────
function updateTotaalScore() {
  const waarden = Object.values(scores).filter(s => s.score !== null);
  const totaal  = waarden.reduce((som, s) => som + (s.score || 0), 0);
  const max     = competenties.length * 4;

  const el = document.getElementById('totaal-score');
  if (el) el.textContent = `Totaal: ${totaal} / ${max} ptn`;
}

// ── 11. Concept opslaan ───────────────────────────────────────
async function slaConceptOp() {
  await verstuurEvaluatie(false);
}

// ── 12. Definitief indienen ────────────────────────────────────
async function slaEvaluatieOp() {
  const onbeoordeeld = competenties.filter(c => {
    const id = c.competentie_id || c.id;
    return !scores[id] || scores[id].score === null;
  });

  if (onbeoordeeld.length > 0) {
    const namen = onbeoordeeld.map(c => c.naam || 'onbekend').join(', ');
    alert(`Beoordeel eerst alle competenties:\n${namen}`);
    return;
  }

  await verstuurEvaluatie(true);
}

// ── 13. API-call ──────────────────────────────────────────────
async function verstuurEvaluatie(definitief) {
  if (!huidigStudent) return;

  const stageId = huidigStudent.stage_id || huidigStudent.id;

  const payload = {
    stage_id:   stageId,
    type:       evaluatieType,
    definitief: definitief,
    scores:     Object.entries(scores).map(([compId, data]) => ({
      competentie_id: Number(compId),
      score:          data.score,
      feedback:       data.feedback || ''
    }))
  };

  try {
    await apiFetch('/evaluatie/opslaan', {
      method: 'POST',
      body:   JSON.stringify(payload)
    });

    toonSucces(
      definitief
        ? 'Evaluatie definitief opgeslagen en verzonden naar de docent.'
        : 'Concept opgeslagen. Je kan verder aanvullen.'
    );

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
  window.location.href = 'login.html';
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
