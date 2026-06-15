// ============================================================
//  mentor_evaluatie.js
//  Competentie-evaluatie per student invullen via rubrics
// ============================================================

let alleStudenten     = [];
let huidigStudent     = null;
let competenties      = [];       // rubric-definitie van de API
let scores            = {};       // { competentie_id: { score, feedback } }
let evaluatieType     = 'tussentijds'; // 'tussentijds' | 'milestone'

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['mentor', 'administrator'])) return;
  laadStudenten();
});

// ── 1. Studenten laden ───────────────────────────────────────
async function laadStudenten() {
  verbergError();

  try {
    const studenten   = await apiFetch('/mentor/studenten');
    alleStudenten     = Array.isArray(studenten) ? studenten : [];
    toonStudentSelectie(alleStudenten);

    // Direct laden als ?student_id= in URL staat
    const params = new URLSearchParams(window.location.search);
    const urlId  = params.get('student_id');

    if (urlId) {
      const gevonden = alleStudenten.find(s =>
        String(s.stage_id || s.id) === String(urlId)
      );
      if (gevonden) selecteerStudent(gevonden);
    }

  } catch (err) {
    console.error('Fout bij laden studenten:', err);
    toonError(err.message);
  }
}

// ── 2. Studenten renderen ────────────────────────────────────
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
            ${naam}
            <span style="color:#94a3b8; font-size:12px; font-weight:400; margin-left:4px;">
              ${bedrijf}
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ── 3. Student selecteren ────────────────────────────────────
async function selecteerStudent(student) {
  huidigStudent = student;
  scores        = {};

  // Actieve knop markeren
  document.querySelectorAll('[id^="student-btn-"]').forEach(b => {
    b.classList.remove('btn--primary');
    b.classList.add('btn--ghost');
  });
  const knop = document.getElementById(`student-btn-${student.stage_id || student.id}`);
  if (knop) { knop.classList.remove('btn--ghost'); knop.classList.add('btn--primary'); }

  // Student header
  const naam    = student.studentnaam  || student.naam    || '—';
  const bedrijf = student.bedrijfsnaam || student.bedrijf || '—';
  const opleiding = student.opleiding  || 'Toegepaste Informatica';

  stel('student-naam',   naam);
  stel('student-meta',   `${opleiding} · ${bedrijf}`);
  stel('student-avatar', naam.charAt(0).toUpperCase());

  // Detail tonen, lege staat verbergen
  const detail    = document.getElementById('evaluatie-detail');
  const noStudent = document.getElementById('no-student');
  if (detail)    detail.classList.remove('hidden');
  if (noStudent) noStudent.classList.add('hidden');

  // Competenties + bestaande evaluatie laden
  try {
    const stageId = student.stage_id || student.id;

    // Haal rubric-definitie op
    const comp = await apiFetch('/evaluatie/competenties');
    competenties = Array.isArray(comp) ? comp : [];

    // Haal eventuele bestaande evaluatie op voor deze student
    const bestaand = await apiFetch(`/evaluatie/stage/${stageId}`).catch(() => null);

    if (bestaand && Array.isArray(bestaand.scores)) {
      bestaand.scores.forEach(s => {
        scores[s.competentie_id] = {
          score:    s.score,
          feedback: s.feedback || ''
        };
      });
    }

    toonCompetentieFormulier();

  } catch (err) {
    console.error('Fout bij laden competenties:', err);
    toonError(err.message);
  }
}

// ── 4. Evaluatietype wisselen ────────────────────────────────
function switchEvaluatieType(type) {
  evaluatieType = type;

  document.getElementById('tab-tussentijds').classList.toggle('active', type === 'tussentijds');
  document.getElementById('tab-milestone').classList.toggle('active',   type === 'milestone');

  toonCompetentieFormulier();
}

// ── 5. Rubric-formulier renderen ─────────────────────────────
function toonCompetentieFormulier() {
  const container = document.getElementById('competenties-container');
  if (!container) return;

  if (competenties.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:24px;">Geen competenties gevonden.</p>';
    return;
  }

  // Filter op type als de API dat veld heeft
  const gefilterd = competenties.filter(c => {
    if (!c.type) return true;
    return c.type === evaluatieType;
  });

  if (gefilterd.length === 0) {
    container.innerHTML = `<p class="empty-state" style="padding:24px;">Geen ${evaluatieType}-competenties gevonden.</p>`;
    return;
  }

  container.innerHTML = gefilterd.map(comp => {
    const id      = comp.competentie_id || comp.id;
    const huidige = scores[id] || {};

    // Rubric niveaus: haal uit comp.niveaus of bouw standaard op
    const niveaus = comp.niveaus || [
      { code: 'O', label: 'Onvoldoende', score: 1, omschrijving: 'Student haalt het verwachte niveau niet.' },
      { code: 'V', label: 'Voldoende',   score: 2, omschrijving: 'Student haalt het minimale niveau.' },
      { code: 'G', label: 'Goed',        score: 3, omschrijving: 'Student presteert boven het minimum.' },
      { code: 'UG', label: 'Uitstekend', score: 4, omschrijving: 'Student overtreft alle verwachtingen.' }
    ];

    const huidigeScore = huidige.score || null;

    return `
      <div class="rubric-card" id="rubric-${id}">
        <div class="rubric-card__header">
          <div>
            <p class="rubric-card__title">${comp.naam || comp.name || 'Competentie'}</p>
            ${comp.beschrijving ? `<p style="font-size:12px; color:#6b7280; margin-top:2px;">${comp.beschrijving}</p>` : ''}
          </div>
          <span class="rubric-card__score ${huidigeScore ? '' : 'rubric-card__score--low'}" id="score-label-${id}">
            ${huidigeScore ? `Score: ${huidigeScore}` : 'Nog niet beoordeeld'}
          </span>
        </div>

        <div class="rubric-options" style="grid-template-columns: repeat(${niveaus.length}, 1fr);">
          ${niveaus.map(n => `
            <div
              class="rubric-option ${huidigeScore === n.score ? (n.score <= 1 ? 'rubric-option--selected-bad' : 'rubric-option--selected') : ''}"
              id="opt-${id}-${n.score}"
              onclick="kiesScore(${id}, ${n.score}, ${niveaus.length})"
            >
              <p class="rubric-option__label">${n.label}</p>
              <p class="rubric-option__desc">${n.omschrijving || ''}</p>
            </div>
          `).join('')}
        </div>

        <div class="rubric-feedback">
          <input
            type="text"
            class="rubric-feedback__input"
            id="feedback-${id}"
            placeholder="Optioneel: toelichting bij deze competentie…"
            value="${huidige.feedback || ''}"
            oninput="slaFeedbackOp(${id})"
          />
        </div>
      </div>
    `;
  }).join('');

  updateTotaalScore();
}

// ── 6. Score kiezen ──────────────────────────────────────────
function kiesScore(compId, score, aantalNiveaus) {
  // Score opslaan
  if (!scores[compId]) scores[compId] = { score: null, feedback: '' };
  scores[compId].score = score;

  // Alle opties resetten
  for (let i = 1; i <= aantalNiveaus + 1; i++) {
    const opt = document.getElementById(`opt-${compId}-${i}`);
    if (opt) {
      opt.classList.remove('rubric-option--selected', 'rubric-option--selected-bad');
    }
  }

  // Gekozen optie markeren
  const gekozen = document.getElementById(`opt-${compId}-${score}`);
  if (gekozen) {
    gekozen.classList.add(score <= 1 ? 'rubric-option--selected-bad' : 'rubric-option--selected');
  }

  // Score label bijwerken
  const label = document.getElementById(`score-label-${compId}`);
  if (label) {
    label.textContent = `Score: ${score}`;
    label.className   = score <= 1 ? 'rubric-card__score rubric-card__score--low' : 'rubric-card__score';
  }

  updateTotaalScore();
}

// ── 7. Feedback per competentie bijhouden ────────────────────
function slaFeedbackOp(compId) {
  const input = document.getElementById(`feedback-${compId}`);
  if (!input) return;
  if (!scores[compId]) scores[compId] = { score: null, feedback: '' };
  scores[compId].feedback = input.value;
}

// ── 8. Totaalscore berekenen en tonen ────────────────────────
function updateTotaalScore() {
  const waarden = Object.values(scores).filter(s => s.score !== null);
  const totaal  = waarden.reduce((som, s) => som + (s.score || 0), 0);
  const max     = competenties.length * 4;

  const el = document.getElementById('totaal-score');
  if (el) el.textContent = `Totaal: ${totaal} / ${max} ptn`;
}

// ── 9. Concept opslaan ───────────────────────────────────────
async function slaConceptOp() {
  await verstuurEvaluatie(false);
}

// ── 10. Definitief opslaan ───────────────────────────────────
async function slaEvaluatieOp() {
  // Controleer of alle competenties beoordeeld zijn
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

// ── 11. API-call versturen ───────────────────────────────────
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
  window.location.href = 'login.html';
}

// ── Hulpfuncties ──────────────────────────────────────────────
function stel(id, tekst) {
  const el = document.getElementById(id);
  if (el) el.textContent = tekst;
}

function toonError(bericht) {
  const el = document.getElementById('error-banner');
  if (el) { el.textContent = `Fout: ${bericht}`; el.classList.remove('hidden'); }
}

function verbergError() {
  const el = document.getElementById('error-banner');
  if (el) el.classList.add('hidden');
}
