// ============================================================
//  evaluaties.js (student)
//  Eigen zelfevaluatie + ontvangen evaluaties.
//  Open/dicht wordt volledig bepaald door de docent-planning.
// ============================================================

let huidigType   = 'tussentijds';
let stageId      = null;
let planning     = { tussentijds_vanaf: null, finaal_vanaf: null };
let competenties = [];
let scores       = {};
let zelfDefinitief = false;

const NIVEAUS = [
    { punten: 1, omschrijving: 'Onvoldoende' },
    { punten: 2, omschrijving: 'Voldoende' },
    { punten: 3, omschrijving: 'Goed' },
    { punten: 4, omschrijving: 'Uitstekend' }
];

function evaluatieOpen(type) {
    const vanaf = type === 'finaal' ? planning.finaal_vanaf : planning.tussentijds_vanaf;
    if (!vanaf) return false;
    return new Date(vanaf) <= new Date();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof requireAuth === 'function') {
        if (!requireAuth('student')) return;
    }
    try {
        const stage = await apiFetch('/student/stage-info');
        stageId = stage.stage_id;
        try {
            planning = await apiFetch(`/evaluatie/planning?stage_id=${stageId}`);
        } catch (_) { /* geen planning */ }
    } catch (_) { /* geen stage */ }
    updateTabs();
    laadAlles();
});

function updateTabs() {
    const tt = document.getElementById('tab-tussentijds');
    const tf = document.getElementById('tab-finaal');
    if (tt) tt.textContent = 'Tussentijdse evaluatie' + (evaluatieOpen('tussentijds') ? '' : ' 🔒');
    if (tf) tf.textContent = 'Finale evaluatie' + (evaluatieOpen('finaal') ? '' : ' 🔒');
}

function switchTab(type) {
    if (!evaluatieOpen(type)) {
        alert(`De ${type === 'finaal' ? 'finale' : 'tussentijdse'} evaluatie is nog niet opengesteld door de docent.`);
        return;
    }
    huidigType = type;
    document.getElementById('tab-tussentijds').classList.toggle('active', type === 'tussentijds');
    document.getElementById('tab-finaal').classList.toggle('active', type === 'finaal');
    document.getElementById('self-form').classList.add('hidden');
    laadAlles();
}

async function laadAlles() {
    await Promise.all([laadFormData(), laadOntvangen()]);
    updateSelfStatus();
}

async function laadFormData() {
    scores = {};
    zelfDefinitief = false;
    if (!stageId) { competenties = []; return; }
    try {
        const data = await apiFetch(`/evaluatie/competenties?stage_id=${stageId}&type=${huidigType}`);
        competenties = Array.isArray(data) ? data : [];
        try {
            const concept = await apiFetch(`/evaluatie/concept?stage_id=${stageId}&type=${huidigType}`);
            if (concept && Array.isArray(concept.scores)) {
                concept.scores.forEach(s => { scores[s.competentie_id] = { score: s.score, feedback: s.feedback || '' }; });
            }
            if (concept && concept.evaluatie && concept.evaluatie.definitief === 1) zelfDefinitief = true;
        } catch (_) { /* geen concept */ }
    } catch (_) { competenties = []; }
}

function updateSelfStatus() {
    const status = document.getElementById('self-status');
    const toggle = document.getElementById('self-toggle');

    if (!stageId) {
        status.textContent = 'Geen actieve stage gevonden.';
        toggle.disabled = true;
        return;
    }
    if (!evaluatieOpen(huidigType)) {
        status.textContent = `De ${huidigType === 'finaal' ? 'finale' : 'tussentijdse'} evaluatie is nog niet opengesteld door de docent. 🔒`;
        toggle.disabled = true;
        return;
    }
    toggle.disabled = false;
    const ingevuld = Object.keys(scores).length;
    if (zelfDefinitief) {
        status.textContent = 'Definitief ingediend ✓ (niet meer wijzigbaar).';
        toggle.disabled = true;
    } else if (ingevuld > 0) {
        status.textContent = `Concept opgeslagen — ${ingevuld} competentie(s) ingevuld.`;
    } else {
        status.textContent = `Open — nog niet ingevuld voor de ${huidigType === 'finaal' ? 'finale' : 'tussentijdse'} evaluatie.`;
    }
}

function toggleForm() {
    if (!evaluatieOpen(huidigType)) {
        alert('Deze evaluatie is nog niet opengesteld door de docent.');
        return;
    }
    const form = document.getElementById('self-form');
    if (form.classList.contains('hidden')) {
        renderForm();
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
}

function renderForm() {
    const container = document.getElementById('self-competenties');
    if (!competenties.length) {
        container.innerHTML = '<div class="placeholder">Geen competenties gevonden.</div>';
        return;
    }
    container.innerHTML = competenties.map(c => {
        const id = c.competentie_id;
        const niveaus = (c.niveaus && c.niveaus.length) ? c.niveaus : NIVEAUS;
        const huidige = scores[id] || {};
        const huidigeScore = huidige.score ?? null;
        const opties = niveaus.map(o => `
            <div class="optie ${o.punten === huidigeScore ? 'selected' : ''}"
                 onclick="kiesScore(${id}, ${o.punten})">
                <div class="optie-ptn">${o.punten}</div>
                <div class="optie-desc">${o.omschrijving || ''}</div>
            </div>
        `).join('');
        return `
            <div class="comp-card">
                <div class="comp-naam">${c.naam}</div>
                <div class="comp-desc">${c.omschrijving || ''}</div>
                <div class="opties">${opties}</div>
                <textarea class="feedback" id="fb-${id}"
                          placeholder="Optionele toelichting..."
                          oninput="slaFeedbackOp(${id})">${huidige.feedback || ''}</textarea>
            </div>
        `;
    }).join('');
    updateTotaal();
}

function kiesScore(id, punten) {
    if (!scores[id]) scores[id] = { score: null, feedback: '' };
    scores[id].score = punten;
    renderForm();
}

function slaFeedbackOp(id) {
    const el = document.getElementById(`fb-${id}`);
    if (!el) return;
    if (!scores[id]) scores[id] = { score: null, feedback: '' };
    scores[id].feedback = el.value;
}

function updateTotaal() {
    let totaal = 0, max = 0;
    competenties.forEach(c => {
        const niveaus = (c.niveaus && c.niveaus.length) ? c.niveaus : NIVEAUS;
        const s = scores[c.competentie_id];
        if (s && s.score) totaal += s.score;
        max += Math.max(...niveaus.map(n => n.punten));
    });
    document.getElementById('self-totaal').textContent = `Totaal: ${totaal} / ${max}`;
}

async function opslaanZelf(definitief) {
    if (!stageId) { alert('Geen stage gevonden.'); return; }
    if (!evaluatieOpen(huidigType)) { alert('Deze evaluatie is nog niet opengesteld door de docent.'); return; }

    const lijst = Object.entries(scores)
        .filter(([, d]) => d.score !== null && d.score !== undefined)
        .map(([competentie_id, d]) => ({ competentie_id: Number(competentie_id), score: d.score, feedback: d.feedback || '' }));

    if (definitief && lijst.length < competenties.length) {
        alert('Beoordeel eerst alle competenties voordat je definitief indient.');
        return;
    }
    if (lijst.length === 0) { alert('Er zijn nog geen scores om op te slaan.'); return; }

    try {
        await apiFetch('/evaluatie/opslaan', {
            method: 'POST',
            body: JSON.stringify({ stage_id: stageId, type: huidigType, definitief, scores: lijst })
        });
        alert(definitief ? 'Zelfevaluatie definitief ingediend!' : 'Concept opgeslagen.');
        document.getElementById('self-form').classList.add('hidden');
        laadAlles();
    } catch (err) {
        alert(err.message || 'Kon de zelfevaluatie niet opslaan.');
    }
}

// ── Ontvangen evaluaties ────────────────────────────────────
function rolLabel(rol) {
    if (rol === 'docent') return 'Verantwoordelijk docent';
    if (rol === 'student') return 'Jij — zelfevaluatie';
    return 'Stagementor';
}
function rolAvatar(rol) {
    if (rol === 'docent') return 'avatar-blauw';
    if (rol === 'student') return 'avatar-groen';
    return 'avatar-grijs';
}
function initialen(naam) {
    return (naam || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function formatDatum(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}
function scoreKlasse(score) {
    if (score >= 4) return 'score-5';
    if (score >= 2) return 'score-2';
    return 'score-1';
}

async function laadOntvangen() {
    const container = document.getElementById('ontvangen');
    try {
        const data = await apiFetch('/student/evaluaties');
        const blok = data[huidigType === 'finaal' ? 'finaal' : 'tussentijds'];
        renderOntvangen(blok, container);
    } catch (err) {
        container.innerHTML = `<div class="placeholder">Kon de ontvangen evaluaties niet laden.</div>`;
    }
}

function renderOntvangen(data, container) {
    if (!data || !data.evaluaties || data.evaluaties.length === 0) {
        container.innerHTML = `<div class="eval-card"><div class="eval-body placeholder">Nog geen ${huidigType === 'finaal' ? 'finale' : 'tussentijdse'} evaluatie ontvangen.</div></div>`;
        return;
    }
    const aantalComp = data.competenties ? data.competenties.length : 0;
    const metrics = `
        <div class="metrics">
            <div class="metric-card"><div class="metric-label">Evaluaties ontvangen</div><div class="metric-value">${data.evaluaties.length}</div></div>
            <div class="metric-card"><div class="metric-label">Competenties beoordeeld</div><div class="metric-value">${aantalComp}</div></div>
        </div>`;
    const kaarten = data.evaluaties.map(e => {
        const compRijen = (data.competenties || [])
            .filter(c => c.beoordelaar_rol === e.beoordelaar_rol)
            .map(c => `
                <div class="competentie-rij">
                    <div>
                        <div class="comp-naam">${c.competentie_naam}</div>
                        ${c.commentaar ? `<div class="comp-comment">"${c.commentaar}"</div>` : ''}
                    </div>
                    <div class="comp-score-wrap"><div class="comp-score ${scoreKlasse(c.score)}">${c.score}</div></div>
                </div>
            `).join('');
        return `
            <div class="eval-card">
                <div class="eval-header">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div class="eval-avatar ${rolAvatar(e.beoordelaar_rol)}">${initialen(e.beoordelaar_naam)}</div>
                        <div>
                            <div class="eval-naam">${e.beoordelaar_naam || ''}</div>
                            <div class="eval-rol">${rolLabel(e.beoordelaar_rol)} — Ingediend op ${formatDatum(e.datum)}</div>
                        </div>
                    </div>
                    <span class="badge-ontvangen">✓ Ontvangen</span>
                </div>
                <div class="eval-body">
                    ${e.feedback ? `<div class="feedback-quote">${e.feedback}</div>` : ''}
                    ${compRijen ? `<div class="competenties-label">Gedetailleerde competentiescores</div>${compRijen}` : ''}
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = metrics + kaarten;
}