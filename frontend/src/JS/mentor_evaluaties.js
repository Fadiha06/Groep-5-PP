// ============================================================
//  mentor_evaluaties.js
//  Laadt stagiairs, competenties en slaat evaluaties op.
//  Open/dicht wordt bepaald door de docent-planning (niet de einddatum).
// ============================================================

let huidigStudent   = null;
let scores          = {};
let competenties    = [];
let alleStudenten   = [];
let evaluatieType   = 'tussentijds';
let planning        = { tussentijds_vanaf: null, finaal_vanaf: null };

// Is dit evaluatietype opengesteld door de docent?
function evaluatieOpen(type) {
    const vanaf = type === 'finaal' ? planning.finaal_vanaf : planning.tussentijds_vanaf;
    if (!vanaf) return false;
    return new Date(vanaf) <= new Date();
}

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
                return `
                    <button
                        class="student-select-btn"
                        id="student-btn-${id}"
                        onclick="selecteerStudent('${id}')"
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
async function selecteerStudent(id) {
    const student = alleStudenten.find(s => String(s.stage_id || s.id) === String(id));
    if (!student) return;

    huidigStudent = student;
    scores        = {};

    document.querySelectorAll('.student-select-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`student-btn-${id}`);
    if (btn) btn.classList.add('active');

    const naam      = student.studentnaam  || student.naam    || '—';
    const bedrijf   = student.bedrijfsnaam || student.bedrijf || '—';
    const opleiding = student.opleiding    || '';

    stel('student-naam', naam);
    stel('student-meta', opleiding ? `${opleiding} · ${bedrijf}` : bedrijf);

    const avatar = document.getElementById('student-avatar');
    if (avatar) avatar.textContent = naam.charAt(0).toUpperCase();

    const detail = document.getElementById('evaluatie-detail');
    if (detail) detail.classList.remove('hidden');

    // Planning van deze student ophalen → bepaalt open/dicht
    await laadPlanning();
    updateEvalTabs();

    await laadCompetenties();
}

// ── Planning ophalen ────────────────────────────────────────
async function laadPlanning() {
    const stageId = huidigStudent.stage_id || huidigStudent.id;
    try {
        planning = await apiFetch(`/evaluatie/planning?stage_id=${stageId}`);
    } catch (_) {
        planning = { tussentijds_vanaf: null, finaal_vanaf: null };
    }
}

// Tabs visueel op slot zetten (🔒) als de docent het nog niet opengesteld heeft
function updateEvalTabs() {
    const tabs = document.querySelectorAll('.eval-tab');
    if (tabs[0]) tabs[0].innerHTML = `📊 Tussentijds${evaluatieOpen('tussentijds') ? '' : ' 🔒'}`;
    if (tabs[1]) tabs[1].innerHTML = `🎯 Eindevaluatie${evaluatieOpen('finaal') ? '' : ' 🔒'}`;
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

        try {
            const concept = await apiFetch(`/evaluatie/concept?stage_id=${stageId}&type=${evaluatieType}`);
            if (concept && concept.scores) {
                concept.scores.forEach(s => {
                    scores[s.competentie_id] = { score: s.score, feedback: s.feedback || '' };
                });
            }
        } catch (_) { /* geen concept */ }

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
        (c.omschrijving || '').toLowerCase().includes(zoekterm)
    );
    toonCompetenties(gefilterd);
}

// ── 6. Competenties renderen ───────────────────────────────────
function toonCompetenties(lijst) {
    const container = document.getElementById('competenties-container');
    if (!container) return;

    const teller = document.getElementById('eval-count');
    if (teller) teller.textContent = `${lijst.length} competentie${lijst.length !== 1 ? 's' : ''}`;

    if (lijst.length === 0) {
        container.innerHTML = '<p class="empty-state">Geen competenties gevonden.</p>';
        return;
    }

    const STANDAARD = [
        { punten: 1, omschrijving: 'Onvoldoende' },
        { punten: 2, omschrijving: 'Voldoende' },
        { punten: 3, omschrijving: 'Goed' },
        { punten: 4, omschrijving: 'Uitstekend' }
    ];

    container.innerHTML = lijst.map(comp => {
        const id = comp.competentie_id || comp.id;
        const huidige = scores[id] || {};
        const niveaus = (comp.niveaus && comp.niveaus.length) ? comp.niveaus : STANDAARD;
        const huidigeScore = huidige.score || null;
        const feedbackWaarde = huidige.feedback || '';

        return `
            <div class="rubric-card" id="rubric-${id}">
                <div class="rubric-card__header">
                    <div>
                        <p class="rubric-card__title">${comp.naam || 'Competentie'}</p>
                        ${comp.omschrijving ? `<p class="rubric-card__desc">${comp.omschrijving}</p>` : ''}
                    </div>
                    <span class="rubric-card__score ${huidigeScore ? '' : 'rubric-card__score--low'}" id="score-label-${id}">
                        ${huidigeScore ? `Score: ${huidigeScore}` : 'Nog niet beoordeeld'}
                    </span>
                </div>
                <div class="rubric-options">
                    ${niveaus.map(n => `
                        <button class="rubric-option ${huidigeScore === n.punten ? 'rubric-option--selected' : ''}"
                                id="opt-${id}-${n.punten}"
                                onclick="kiesScore(${id}, ${n.punten})">
                            <span class="rubric-option__code">${n.punten} ptn</span>
                            <span class="rubric-option__desc">${n.omschrijving}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="rubric-feedback">
                    <label for="feedback-${id}">Feedback voor deze competentie</label>
                    <textarea id="feedback-${id}"
                              placeholder="Optioneel: toelichting bij je beoordeling..."
                              oninput="slaFeedbackOp(${id})">${feedbackWaarde}</textarea>
                </div>
            </div>
        `;
    }).join('');
}

// ── 7. Evaluatietype wisselen ─────────────────────────────────
async function wisselType(type, tabEl) {
    if (type === evaluatieType) return;

    if (!evaluatieOpen(type)) {
        alert(`De ${type === 'finaal' ? 'finale' : 'tussentijdse'} evaluatie is nog niet opengesteld door de docent.`);
        return;
    }

    evaluatieType = type;

    document.querySelectorAll('.eval-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');

    scores = {};
    if (huidigStudent) await laadCompetenties();
}

// ── 8. Score kiezen ───────────────────────────────────────────
function kiesScore(compId, punten) {
    if (!scores[compId]) scores[compId] = { score: null, feedback: '' };
    scores[compId].score = punten;
    toonCompetenties(competenties);
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
    let totaal = 0;
    let max = 0;
    const STANDAARD_MAX = 4;
    competenties.forEach(c => {
        const id = c.competentie_id || c.id;
        if (scores[id] && scores[id].score) totaal += scores[id].score;
        max += (c.niveaus && c.niveaus.length)
            ? Math.max(...c.niveaus.map(n => n.punten))
            : STANDAARD_MAX;
    });
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

    if (!evaluatieOpen(evaluatieType)) {
        alert('Deze evaluatie is nog niet opengesteld door de docent.');
        return;
    }

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