let stageId        = null;
let evaluatieType  = 'tussentijds';
let competenties   = [];
let scores         = {};                       // { [competentie_id]: { score, feedback } }

const TYPES = [
    { key: 'tussentijds', label: 'Tussentijds' },
    { key: 'finaal',      label: 'Finaal' }
];

const NIVEAUS = [
    { score: 1, label: 'Onvoldoende', beschrijving: 'Haal het niveau nog niet.' },
    { score: 2, label: 'Voldoende',   beschrijving: 'Haal het minimale niveau.' },
    { score: 3, label: 'Goed',        beschrijving: 'Presteer boven het minimum.' },
    { score: 4, label: 'Zeer goed',   beschrijving: 'Overtref de verwachtingen.' },
    { score: 5, label: 'Uitstekend',  beschrijving: 'Buitengewoon presteren, coacht anderen.' }
];
const MAX_PER_COMP = 5;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof requireAuth === 'function') {
        if (!requireAuth('student')) return;
    }
    init();
});

async function init() {
    try {
        const stage = await apiFetch('/student/stage-info');
        stageId = stage.stage_id;
        document.getElementById('stage-titel').textContent =
            `Stage: ${stage.titel || '—'} — beoordeel jezelf per competentie.`;
    } catch (err) {
        document.getElementById('stage-titel').textContent =
            'Geen actieve stage gevonden — je kunt nog geen zelfevaluatie invullen.';
        return;
    }
    renderTypeTabs();
    laadCompetenties();
}

function renderTypeTabs() {
    document.getElementById('type-tabs').innerHTML = TYPES.map(t => `
        <div class="type-tab ${t.key === evaluatieType ? 'active' : ''}"
             onclick="selectType('${t.key}')">${t.label}</div>
    `).join('');
}

function selectType(type) {
    evaluatieType = type;
    scores = {};
    renderTypeTabs();
    laadCompetenties();
}

async function laadCompetenties() {
    const container = document.getElementById('competenties-container');
    container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Laden...</div>`;

    try {
        const data = await apiFetch(`/evaluatie/competenties?stage_id=${stageId}&type=${evaluatieType}`);
        competenties = Array.isArray(data) ? data : [];

        try {
            const concept = await apiFetch(`/evaluatie/concept?stage_id=${stageId}&type=${evaluatieType}`);
            if (concept && Array.isArray(concept.scores)) {
                concept.scores.forEach(s => {
                    scores[s.competentie_id] = { score: s.score, feedback: s.feedback || '' };
                });
            }
        } catch (_) {
            // geen concept — prima
        }

        renderCompetenties();
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Kon competenties niet laden.</div>`;
    }
}

function renderCompetenties() {
    const container = document.getElementById('competenties-container');

    if (!competenties.length) {
        container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Geen competenties gevonden.</div>`;
        document.getElementById('totaal').textContent = 'Totaal: — / —';
        return;
    }

    container.innerHTML = competenties.map(c => {
        const id = c.competentie_id;
        const huidige = scores[id] || {};
        const huidigeScore = huidige.score ?? null;

        const optiesHtml = NIVEAUS.map(optie => `
            <div class="optie ${optie.score === huidigeScore ? 'selected' : ''}"
                 onclick="kiesScore(${id}, ${optie.score})">
                <div class="optie-ptn">${optie.score}</div>
                <div class="optie-label">${optie.label}</div>
                <div class="optie-desc">${optie.beschrijving}</div>
            </div>
        `).join('');

        return `
            <div class="comp-card">
                <div class="comp-naam">${c.naam}</div>
                <div class="comp-desc">${c.omschrijving || ''}</div>
                <div class="opties">${optiesHtml}</div>
                <textarea class="feedback" id="feedback-${id}"
                          placeholder="Optionele toelichting bij je score..."
                          oninput="slaFeedbackOp(${id})">${huidige.feedback || ''}</textarea>
            </div>
        `;
    }).join('');

    updateTotaal();
}

function kiesScore(id, score) {
    if (!scores[id]) scores[id] = { score: null, feedback: '' };
    scores[id].score = score;
    renderCompetenties();
}

function slaFeedbackOp(id) {
    const input = document.getElementById(`feedback-${id}`);
    if (!input) return;
    if (!scores[id]) scores[id] = { score: null, feedback: '' };
    scores[id].feedback = input.value;
}

function updateTotaal() {
    let totaal = 0;
    Object.values(scores).forEach(s => { if (s.score) totaal += s.score; });
    document.getElementById('totaal').textContent =
        `Totaal: ${totaal} / ${competenties.length * MAX_PER_COMP}`;
}

async function opslaan(definitief) {
    if (!stageId) { alert('Geen stage gevonden.'); return; }

    const scoreLijst = Object.entries(scores)
        .filter(([, d]) => d.score !== null && d.score !== undefined)
        .map(([competentie_id, d]) => ({
            competentie_id: Number(competentie_id),
            score: d.score,
            feedback: d.feedback || ''
        }));

    if (definitief && scoreLijst.length < competenties.length) {
        alert('Beoordeel eerst alle competenties voordat je definitief indient.');
        return;
    }
    if (scoreLijst.length === 0) {
        alert('Er zijn nog geen scores om op te slaan.');
        return;
    }

    try {
        await apiFetch('/evaluatie/opslaan', {
            method: 'POST',
            body: JSON.stringify({
                stage_id: stageId,
                type: evaluatieType,
                definitief: definitief,
                scores: scoreLijst
            })
        });
        alert(definitief ? 'Zelfevaluatie definitief ingediend!' : 'Concept opgeslagen.');
        laadCompetenties();
    } catch (err) {
        alert(err.message || 'Kon de zelfevaluatie niet opslaan.');
    }
}