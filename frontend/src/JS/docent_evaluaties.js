let studentenData   = [];
let actieveStageId  = null;
let evaluatieType   = 'tussentijds';
let vergelijking    = [];
let scores          = {};      // { [competentie_id]: { score, feedback } }
let planning        = { tussentijds_vanaf: null, finaal_vanaf: null };

const TYPES = [
    { key: 'tussentijds', label: 'Tussentijds' },
    { key: 'finaal',      label: 'Finaal' }
];

const STANDAARD_NIVEAUS = [
    { punten: 1, omschrijving: 'Onvoldoende' },
    { punten: 3, omschrijving: 'Goed' },
    { punten: 5, omschrijving: 'Uitstekend' }
];

// Is dit evaluatietype opengesteld (datum gezet én bereikt)?
function evaluatieOpen(type) {
    const vanaf = type === 'finaal' ? planning.finaal_vanaf : planning.tussentijds_vanaf;
    if (!vanaf) return false;
    return new Date(vanaf) <= new Date();
}

function formatDatum(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof requireAuth === 'function') {
        if (!requireAuth(['docent', 'administrator'])) return;
    }
    laadStudenten();
});

// ── 1. Studenten (incl. afgelopen stages via /docent/dossiers) ──
async function laadStudenten() {
    try {
        const data = await apiFetch('/docent/dossiers');
        const ruw = Array.isArray(data.studenten) ? data.studenten : [];
        const gezien = new Set();
        studentenData = ruw.filter(s => {
            if (gezien.has(s.stage_id)) return false;
            gezien.add(s.stage_id);
            return true;
        });
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

function studentNaam(s) { return s.student || s.student_naam || s.naam || '—'; }
function studentBedrijf(s) { return s.bedrijf || s.bedrijf_naam || ''; }

function renderStudentList() {
    const container = document.getElementById('student-items');
    container.innerHTML = studentenData.map(s => {
        const naam = studentNaam(s);
        const isActief = s.stage_id === actieveStageId;
        return `
        <div class="student-item ${isActief ? 'active' : ''}" onclick="selectStudent(${s.stage_id})">
            <div class="avatar ${isActief ? 'active' : ''}">${naam.charAt(0).toUpperCase()}</div>
            <div>
                <div class="student-naam">${naam}</div>
                <div class="student-meta">${studentBedrijf(s)}</div>
            </div>
        </div>`;
    }).join('');
}

// ── 2. Student selecteren ───────────────────────────────────
async function selectStudent(stageId) {
    actieveStageId = stageId;
    scores = {};
    renderStudentList();

    const s = studentenData.find(x => x.stage_id === stageId);
    if (s) {
        document.getElementById('eval-titel').textContent = `Samengebrachte score — ${studentNaam(s)}`;
    }

    await laadPlanning();
    renderTypeTabs();
    laadVergelijking();
}

// ── 3. Planning ─────────────────────────────────────────────
async function laadPlanning() {
    try {
        planning = await apiFetch(`/docent/evaluatie-planning?stage_id=${actieveStageId}`);
    } catch (_) {
        planning = { tussentijds_vanaf: null, finaal_vanaf: null };
    }
    document.getElementById('plan-tussentijds').value = planning.tussentijds_vanaf || '';
    document.getElementById('plan-finaal').value = planning.finaal_vanaf || '';
    updatePlanningSub();
}

function updatePlanningSub() {
    const t = planning.tussentijds_vanaf ? `vanaf ${formatDatum(planning.tussentijds_vanaf)}` : 'nog niet gepland';
    const f = planning.finaal_vanaf ? `vanaf ${formatDatum(planning.finaal_vanaf)}` : 'nog niet gepland';
    document.getElementById('planning-sub').textContent = `Tussentijds: ${t}  ·  Eindevaluatie: ${f}`;
}

async function opslaanPlanning() {
    if (!actieveStageId) { alert('Selecteer eerst een student.'); return; }
    const tussentijds_vanaf = document.getElementById('plan-tussentijds').value || null;
    const finaal_vanaf = document.getElementById('plan-finaal').value || null;
    try {
        await apiFetch('/docent/evaluatie-planning', {
            method: 'PUT',
            body: JSON.stringify({ stage_id: actieveStageId, tussentijds_vanaf, finaal_vanaf })
        });
        planning = { tussentijds_vanaf, finaal_vanaf };
        updatePlanningSub();
        renderTypeTabs();
        renderCompetenties();
        alert('Evaluatieplanning opgeslagen.');
    } catch (err) {
        alert(err.message || 'Kon de planning niet opslaan.');
    }
}

// ── 4. Type-tabs ────────────────────────────────────────────
function renderTypeTabs() {
    document.getElementById('week-tabs').innerHTML = TYPES.map(t => {
        const open = evaluatieOpen(t.key);
        return `<button class="week-tab ${t.key === evaluatieType ? 'active' : ''}"
                onclick="selectType('${t.key}')">${t.label}${open ? '' : ' 🔒'}</button>`;
    }).join('');
}

function selectType(type) {
    if (!evaluatieOpen(type)) {
        alert(`De ${type === 'finaal' ? 'finale' : 'tussentijdse'} evaluatie is nog niet opengesteld. Stel hierboven eerst een datum in (vandaag of eerder).`);
        return;
    }
    evaluatieType = type;
    scores = {};
    renderTypeTabs();
    laadVergelijking();
}

// ── 5. Vergelijking laden ───────────────────────────────────
async function laadVergelijking() {
    const container = document.getElementById('competenties-container');
    container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Laden...</div>`;
    try {
        vergelijking = await apiFetch(`/docent/evaluatie-vergelijking?stage_id=${actieveStageId}&type=${evaluatieType}`);
        vergelijking.forEach(c => {
            if (c.score_docent !== null && c.score_docent !== undefined) {
                scores[c.competentie_id] = { score: c.score_docent, feedback: c.commentaar_docent || '' };
            }
        });
        renderCompetenties();
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Kon de evaluatie niet laden.</div>`;
    }
}

// ── 6. Renderen ─────────────────────────────────────────────
function renderCompetenties() {
    const container = document.getElementById('competenties-container');

    if (!vergelijking || vergelijking.length === 0) {
        container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Geen competenties.</div>`;
        document.getElementById('totaal-badge').textContent = 'Totaal: — / —';
        zetSaveKnop();
        return;
    }

    container.innerHTML = vergelijking.map(c => {
        const id = c.competentie_id;
        const niveaus = (c.niveaus && c.niveaus.length) ? c.niveaus : STANDAARD_NIVEAUS;
        const huidige = scores[id] || {};
        const huidigeScore = huidige.score ?? c.score_docent ?? null;

        const optiesHtml = niveaus.map(optie => {
            const isSelected = optie.punten === huidigeScore;
            const isStudent = optie.punten === c.score_student;
            const isMentor = optie.punten === c.score_mentor;
            return `
                <div class="score-option ${isSelected ? 'selected' : ''}"
                     onclick="kiesScore(${id}, ${optie.punten})">
                    ${isStudent ? '<span class="score-dot student"></span>' : ''}
                    ${isMentor ? '<span class="score-dot mentor"></span>' : ''}
                    <div class="score-ptn">${optie.punten} ptn</div>
                    <div class="score-desc">${optie.omschrijving || ''}</div>
                </div>
            `;
        }).join('');

        const verschil = (c.score_student !== null && c.score_mentor !== null)
            ? Math.abs(c.score_student - c.score_mentor) : null;

        return `
            <div class="competentie-card" style="margin-bottom:16px">
                <div class="competentie-grid">
                    <div class="competentie-label">
                        <div class="competentie-naam">${c.naam}</div>
                        <div class="competentie-domeinen">${c.omschrijving || ''}</div>
                    </div>
                    <div class="score-options">${optiesHtml}</div>
                    <div class="competentie-totaal">
                        <div class="competentie-totaal-value">${huidigeScore ?? '—'}</div>
                    </div>
                </div>
                <div class="feedback-row">
                    <div>
                        <div class="feedback-label">Student${c.score_student !== null ? ` (${c.score_student})` : ''}</div>
                        <div class="feedback-tekst">${c.commentaar_student || '—'}</div>
                    </div>
                    <div>
                        <div class="feedback-label">Mentor${c.score_mentor !== null ? ` (${c.score_mentor})` : ''}</div>
                        <div class="feedback-tekst">${c.commentaar_mentor || '—'}</div>
                    </div>
                </div>
                ${verschil !== null && verschil >= 2
                    ? `<div style="margin-top:8px;font-size:12px;color:#B45309;background:#FEF3C7;padding:6px 10px;border-radius:6px">⚠️ Student en mentor verschillen ${verschil} punten — overweeg een gesprek.</div>`
                    : ''}
                <textarea id="docent-feedback-${id}"
                          style="width:100%;margin-top:10px;border:1px solid #E5E7EB;border-radius:8px;padding:8px;font-family:inherit;font-size:13px;min-height:40px"
                          placeholder="Toelichting van de docent (optioneel)..."
                          oninput="slaFeedbackOp(${id})">${huidige.feedback || c.commentaar_docent || ''}</textarea>
            </div>
        `;
    }).join('');

    updateTotaal();
    zetSaveKnop();
}

function zetSaveKnop() {
    const btn = document.getElementById('btn-opslaan');
    const open = evaluatieOpen(evaluatieType);
    btn.disabled = !open;
    btn.textContent = open ? 'Opslaan score' : 'Nog niet opengesteld 🔒';
}

// ── 7. Score kiezen ─────────────────────────────────────────
function kiesScore(id, score) {
    if (!scores[id]) scores[id] = { score: null, feedback: '' };
    scores[id].score = score;
    renderCompetenties();
}

function slaFeedbackOp(id) {
    const input = document.getElementById(`docent-feedback-${id}`);
    if (!input) return;
    if (!scores[id]) scores[id] = { score: null, feedback: '' };
    scores[id].feedback = input.value;
}

function updateTotaal() {
    let totaal = 0;
    let max = 0;
    vergelijking.forEach(c => {
        const niveaus = (c.niveaus && c.niveaus.length) ? c.niveaus : STANDAARD_NIVEAUS;
        const huidige = scores[c.competentie_id];
        if (huidige && huidige.score) totaal += huidige.score;
        max += Math.max(...niveaus.map(n => n.punten));
    });
    document.getElementById('totaal-badge').textContent = `Totaal: ${totaal} / ${max}`;
}

// ── 8. Opslaan ──────────────────────────────────────────────
async function opslaanScore() {
    if (!actieveStageId) { alert('Selecteer eerst een student.'); return; }
    if (!evaluatieOpen(evaluatieType)) {
        alert('Deze evaluatie is nog niet opengesteld.');
        return;
    }

    const scoreLijst = Object.entries(scores)
        .filter(([, d]) => d.score !== null && d.score !== undefined)
        .map(([competentie_id, d]) => ({
            competentie_id: Number(competentie_id),
            score: d.score,
            feedback: d.feedback || ''
        }));

    if (scoreLijst.length === 0) { alert('Er zijn geen scores om op te slaan.'); return; }

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
        setTimeout(() => { zetSaveKnop(); }, 1500);
        laadVergelijking();
    } catch (err) {
        alert(err.message || 'Kon de scores niet opslaan.');
        zetSaveKnop();
    }
}

// ── 9. Zoeken ───────────────────────────────────────────────
function filterStudents() {
    const q = document.querySelector('.search').value.toLowerCase();
    document.querySelectorAll('.student-item').forEach((item, i) => {
        const naam = studentNaam(studentenData[i]).toLowerCase();
        item.style.display = naam.includes(q) ? '' : 'none';
    });
}