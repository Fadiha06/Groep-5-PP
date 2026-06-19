let studentenData   = [];
let actieveStageId  = null;
let evaluatieType   = 'tussentijds';            // 'tussentijds' | 'finaal'
let competenties    = [];
let scores          = {};                       // { [competentie_id]: { score, feedback } }

const TYPES = [
    { key: 'tussentijds', label: 'Tussentijds' },
    { key: 'finaal',      label: 'Finaal' }
];

// Standaardniveaus (RUBRIEK is niet gevuld, dus vaste schaal zoals bij de mentor)
const NIVEAUS = [
    { score: 1, label: 'Onvoldoende', beschrijving: 'Haalt het verwachte niveau niet.' },
    { score: 2, label: 'Voldoende',   beschrijving: 'Haalt het minimale niveau.' },
    { score: 3, label: 'Goed',        beschrijving: 'Presteert boven het minimum.' },
    { score: 4, label: 'Uitstekend',  beschrijving: 'Overtreft alle verwachtingen.' }
];
const MAX_PER_COMP = 4;

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (typeof requireAuth === 'function') {
        if (!requireAuth(['docent', 'administrator'])) return;
    }
    laadStudenten();
});

// ── 1. Studenten ophalen ────────────────────────────────────
async function laadStudenten() {
    try {
        const data = await apiFetch('/docent/studenten');
        studentenData = Array.isArray(data.studenten) ? data.studenten : [];
        renderStudentList();

        if (studentenData.length > 0) {
            selectStudent(studentenData[0].stage_id);
        } else {
            document.getElementById('student-items').innerHTML =
                '<div style="padding:16px;font-size:12px;color:#9CA3AF">Geen studenten gevonden.</div>';
        }
    } catch (err) {
        console.error('Kon studenten niet laden:', err);
        document.getElementById('student-items').innerHTML =
            '<div style="padding:16px;font-size:12px;color:#EF4444">Fout bij laden van studenten.</div>';
    }
}

function renderStudentList() {
    const container = document.getElementById('student-items');
    container.innerHTML = studentenData.map(s => {
        const naam = s.student || s.naam || '—';
        const isActief = s.stage_id === actieveStageId;
        return `
        <div class="student-item ${isActief ? 'active' : ''}" onclick="selectStudent(${s.stage_id})">
            <div class="avatar ${isActief ? 'active' : ''}">${naam.charAt(0).toUpperCase()}</div>
            <div>
                <div class="student-naam">${naam}</div>
                <div class="student-meta">${s.bedrijf || ''}</div>
            </div>
        </div>`;
    }).join('');
}

// ── 2. Student selecteren ───────────────────────────────────
function selectStudent(stageId) {
    actieveStageId = stageId;
    scores = {};
    renderStudentList();
    renderTypeTabs();

    const s = studentenData.find(x => x.stage_id === stageId);
    if (s) {
        document.getElementById('eval-titel').textContent =
            `Beoordeling — ${s.student || s.naam || ''}`;
    }

    laadEvaluatie();
}

// ── 3. Type-tabs (tussentijds / finaal) ─────────────────────
function renderTypeTabs() {
    const container = document.getElementById('week-tabs');
    container.innerHTML = TYPES.map(t => `
        <button class="week-tab ${t.key === evaluatieType ? 'active' : ''}"
                onclick="selectType('${t.key}')">${t.label}</button>
    `).join('');
}

function selectType(type) {
    evaluatieType = type;
    scores = {};
    renderTypeTabs();
    laadEvaluatie();
}

// ── 4. Competenties + bestaand concept laden ────────────────
async function laadEvaluatie() {
    const container = document.getElementById('competenties-container');
    container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Laden...</div>`;

    try {
        const data = await apiFetch(`/evaluatie/competenties?stage_id=${actieveStageId}&type=${evaluatieType}`);
        competenties = Array.isArray(data) ? data : [];

        // Bestaand concept ophalen (mag ontbreken)
        try {
            const concept = await apiFetch(`/evaluatie/concept?stage_id=${actieveStageId}&type=${evaluatieType}`);
            if (concept && Array.isArray(concept.scores)) {
                concept.scores.forEach(s => {
                    scores[s.competentie_id] = {
                        score: s.score,
                        feedback: s.feedback || ''
                    };
                });
            }
        } catch (_) {
            // Geen concept aanwezig — prima
        }

        renderCompetenties(competenties);
    } catch (err) {
        console.error('Kon evaluatie niet laden:', err);
        container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Kon evaluatie niet laden.</div>`;
    }
}

// ── 5. Competenties renderen ────────────────────────────────
function renderCompetenties(lijst) {
    const container = document.getElementById('competenties-container');

    if (!lijst || lijst.length === 0) {
        container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Geen competenties gevonden.</div>`;
        document.getElementById('totaal-badge').textContent = 'Totaal: — / —';
        return;
    }

    container.innerHTML = lijst.map(c => {
        const id = c.competentie_id || c.id;
        const huidige = scores[id] || {};
        const huidigeScore = huidige.score ?? null;

        const optiesHtml = NIVEAUS.map(optie => {
            const isSelected = optie.score === huidigeScore;
            return `
                <div class="score-option ${isSelected ? 'selected' : ''}"
                     onclick="kiesScore(${id}, ${optie.score})">
                    <div class="score-ptn">${optie.score} ptn</div>
                    <div class="score-label">${optie.label}</div>
                    <div class="score-desc">${optie.beschrijving}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="competentie-card" style="margin-bottom:16px">
                <div class="competentie-grid">
                    <div class="competentie-label">
                        <div class="competentie-naam">${c.naam || 'Competentie'}</div>
                        <div class="competentie-domeinen">${c.omschrijving || ''}</div>
                    </div>
                    <div class="score-options">${optiesHtml}</div>
                    <div class="competentie-totaal">
                        <div class="competentie-totaal-value">${huidigeScore ?? '—'}</div>
                    </div>
                </div>
                <div class="feedback-row">
                    <div style="flex:1">
                        <div class="feedback-label">Feedback (optioneel)</div>
                        <textarea
                            id="feedback-${id}"
                            style="width:100%;min-height:48px;border:1px solid #E5E7EB;border-radius:8px;padding:8px;font-family:inherit;font-size:13px"
                            placeholder="Toelichting bij je beoordeling..."
                            oninput="slaFeedbackOp(${id})">${huidige.feedback || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateTotaal();
}

// ── 6. Score kiezen ─────────────────────────────────────────
function kiesScore(competentieId, score) {
    if (!scores[competentieId]) scores[competentieId] = { score: null, feedback: '' };
    scores[competentieId].score = score;
    renderCompetenties(competenties);
}

// ── 7. Feedback bijhouden ───────────────────────────────────
function slaFeedbackOp(competentieId) {
    const input = document.getElementById(`feedback-${competentieId}`);
    if (!input) return;
    if (!scores[competentieId]) scores[competentieId] = { score: null, feedback: '' };
    scores[competentieId].feedback = input.value;
}

// ── 8. Totaal berekenen ─────────────────────────────────────
function updateTotaal() {
    let totaal = 0;
    Object.values(scores).forEach(s => { if (s.score) totaal += s.score; });
    const max = competenties.length * MAX_PER_COMP;
    document.getElementById('totaal-badge').textContent = `Totaal: ${totaal} / ${max}`;
}

// ── 9. Opslaan ──────────────────────────────────────────────
async function opslaanScore() {
    if (!actieveStageId) {
        alert('Selecteer eerst een student.');
        return;
    }

    const scoreLijst = Object.entries(scores)
        .filter(([, data]) => data.score !== null && data.score !== undefined)
        .map(([competentie_id, data]) => ({
            competentie_id: Number(competentie_id),
            score: data.score,
            feedback: data.feedback || ''
        }));

    if (scoreLijst.length === 0) {
        alert('Er zijn geen scores om op te slaan.');
        return;
    }

    const btn = document.getElementById('btn-opslaan');
    btn.disabled = true;
    btn.textContent = 'Opslaan...';

    try {
        await apiFetch('/evaluatie/opslaan', {
            method: 'POST',
            body: JSON.stringify({
                stage_id: actieveStageId,
                type: evaluatieType,
                definitief: true,
                scores: scoreLijst
            })
        });

        btn.textContent = 'Opgeslagen ✓';
        setTimeout(() => { btn.textContent = 'Opslaan score'; btn.disabled = false; }, 1500);
        laadEvaluatie();
    } catch (err) {
        alert(err.message || 'Kon de scores niet opslaan.');
        btn.disabled = false;
        btn.textContent = 'Opslaan score';
    }
}

// ── 10. Zoeken ──────────────────────────────────────────────
function filterStudents() {
    const q = document.querySelector('.search').value.toLowerCase();
    document.querySelectorAll('.student-item').forEach((item, i) => {
        const naam = (studentenData[i].student || studentenData[i].naam || '').toLowerCase();
        item.style.display = naam.includes(q) ? '' : 'none';
    });
}