let stageId        = null;
let eindDatum      = null;
let evaluatieType  = 'tussentijds';
let competenties   = [];
let scores         = {};                       // { [competentie_id]: { score, feedback } }

const TYPES = [
    { key: 'tussentijds', label: 'Tussentijds' },
    { key: 'finaal',      label: 'Finaal' }
];

// Fallback als een competentie nog geen rubriek heeft
const NIVEAUS = [
    { punten: 1, omschrijving: 'Onvoldoende' },
    { punten: 2, omschrijving: 'Voldoende' },
    { punten: 3, omschrijving: 'Goed' },
    { punten: 4, omschrijving: 'Uitstekend' }
];

// Stage geëindigd? (voor de Finaal-blokkering)
function stageGeeindigd(einddatum) {
    if (!einddatum) return false;
    return new Date(einddatum) <= new Date();
}

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
        eindDatum = stage.einddatum;
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
    if (type === 'finaal' && !stageGeeindigd(eindDatum)) {
        alert('De finale evaluatie is nog niet beschikbaar — die kan pas ingevuld worden nadat de stage is afgelopen.');
        return;
    }
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
        const niveaus = (c.niveaus && c.niveaus.length) ? c.niveaus : NIVEAUS;
        const huidige = scores[id] || {};
        const huidigeScore = huidige.score ?? null;

        const optiesHtml = niveaus.map(optie => `
            <div class="optie ${optie.punten === huidigeScore ? 'selected' : ''}"
                 onclick="kiesScore(${id}, ${optie.punten})">
                <div class="optie-ptn">${optie.punten}</div>
                <div class="optie-desc">${optie.omschrijving || ''}</div>
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

function kiesScore(id, punten) {
    if (!scores[id]) scores[id] = { score: null, feedback: '' };
    scores[id].score = punten;
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
    let max = 0;
    competenties.forEach(c => {
        const niveaus = (c.niveaus && c.niveaus.length) ? c.niveaus : NIVEAUS;
        const s = scores[c.competentie_id];
        if (s && s.score) totaal += s.score;
        max += Math.max(...niveaus.map(n => n.punten));
    });
    document.getElementById('totaal').textContent = `Totaal: ${totaal} / ${max}`;
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