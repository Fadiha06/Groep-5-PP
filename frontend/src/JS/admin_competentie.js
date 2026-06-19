// ============================================================
//  admin_competenties.js
//  Admin beheert competenties (COMPETENTIE) + rubriek (RUBRIEK).
// ============================================================

let competenties   = [];
let bewerkId       = null;     // null = nieuw
let verwijderId    = null;
let huidigeNiveaus = [];       // [{ punten, omschrijving }]

document.addEventListener('DOMContentLoaded', () => {
    if (typeof requireAuth === 'function') {
        if (!requireAuth(['admin', 'administrator'])) return;
    }
    laadCompetenties();
});

async function laadCompetenties() {
    const body = document.getElementById('table-body');
    body.innerHTML = '<div class="placeholder">Laden...</div>';
    try {
        competenties = await apiFetch('/competenties');
        renderLijst(competenties);
    } catch (err) {
        body.innerHTML = `<div class="placeholder">Kon competenties niet laden: ${err.message}</div>`;
    }
}

function renderLijst(lijst) {
    const body = document.getElementById('table-body');
    document.getElementById('count-label').textContent =
        `${lijst.length} competentie${lijst.length !== 1 ? 's' : ''}`;

    if (!lijst.length) {
        body.innerHTML = '<div class="placeholder">Geen competenties gevonden.</div>';
        return;
    }

    body.innerHTML = lijst.map(c => `
        <div class="table-row">
            <div class="cel-naam">${esc(c.naam)}</div>
            <div class="cel-omschrijving">${esc(c.omschrijving || '')}</div>
            <div class="acties">
                <button class="btn-icon" onclick="openModal(${c.competentie_id})">Bewerk</button>
                <button class="btn-icon delete" onclick="openDeleteConfirm(${c.competentie_id})">Verwijder</button>
            </div>
        </div>
    `).join('');
}

function filterLijst() {
    const q = document.querySelector('.search').value.toLowerCase();
    const gefilterd = competenties.filter(c => (c.naam || '').toLowerCase().includes(q));
    renderLijst(gefilterd);
}

// ── Modal toevoegen / bewerken ──────────────────────────────
async function openModal(id = null) {
    bewerkId = id;
    const titel = document.getElementById('modal-title');

    if (id === null) {
        titel.textContent = 'Nieuwe competentie';
        document.getElementById('inp-naam').value = '';
        document.getElementById('inp-omschrijving').value = '';
        huidigeNiveaus = [
            { punten: 1, omschrijving: '' },
            { punten: 3, omschrijving: '' },
            { punten: 5, omschrijving: '' }
        ];
    } else {
        const c = competenties.find(x => x.competentie_id === id);
        if (!c) return;
        titel.textContent = 'Competentie bewerken';
        document.getElementById('inp-naam').value = c.naam || '';
        document.getElementById('inp-omschrijving').value = c.omschrijving || '';

        // Bestaande rubriek ophalen
        try {
            const rubriek = await apiFetch(`/competenties/${id}/rubriek`);
            huidigeNiveaus = Array.isArray(rubriek) && rubriek.length
                ? rubriek.map(n => ({ punten: n.punten, omschrijving: n.omschrijving || '' }))
                : [{ punten: 1, omschrijving: '' }];
        } catch (_) {
            huidigeNiveaus = [{ punten: 1, omschrijving: '' }];
        }
    }

    renderNiveaus();
    document.getElementById('modal').classList.add('open');
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
}

// ── Rubriek-niveaus ─────────────────────────────────────────
function renderNiveaus() {
    const container = document.getElementById('niveaus-container');
    container.innerHTML = huidigeNiveaus.map((n, i) => `
        <div class="niveau-row">
            <input type="number" class="niveau-punten" value="${n.punten}"
                   oninput="updateNiveau(${i}, 'punten', this.value)">
            <textarea class="niveau-omschrijving" placeholder="Beschrijf dit niveau..."
                      oninput="updateNiveau(${i}, 'omschrijving', this.value)">${esc(n.omschrijving)}</textarea>
            <button type="button" class="btn-niveau-del" onclick="verwijderNiveau(${i})">✕</button>
        </div>
    `).join('');
}

function updateNiveau(index, veld, waarde) {
    if (!huidigeNiveaus[index]) return;
    huidigeNiveaus[index][veld] = veld === 'punten' ? Number(waarde) : waarde;
}

function voegNiveauToe() {
    huidigeNiveaus.push({ punten: 0, omschrijving: '' });
    renderNiveaus();
}

function verwijderNiveau(index) {
    huidigeNiveaus.splice(index, 1);
    renderNiveaus();
}

// ── Opslaan (competentie + rubriek) ─────────────────────────
async function opslaan() {
    const naam = document.getElementById('inp-naam').value.trim();
    const omschrijving = document.getElementById('inp-omschrijving').value.trim();

    if (!naam) {
        alert('Naam is verplicht.');
        return;
    }

    const payload = { naam, omschrijving };

    try {
        let competentieId = bewerkId;

        if (bewerkId === null) {
            const res = await apiFetch('/competenties', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            competentieId = res.id;
        } else {
            await apiFetch(`/competenties/${bewerkId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        }

        // Rubriek opslaan (alleen niveaus met een omschrijving)
        const niveaus = huidigeNiveaus
            .filter(n => n.omschrijving && n.omschrijving.trim() !== '')
            .map(n => ({ punten: Number(n.punten) || 0, omschrijving: n.omschrijving.trim() }));

        await apiFetch(`/competenties/${competentieId}/rubriek`, {
            method: 'PUT',
            body: JSON.stringify({ niveaus })
        });

        closeModal();
        laadCompetenties();
    } catch (err) {
        alert(err.message || 'Opslaan mislukt.');
    }
}

// ── Verwijderen ─────────────────────────────────────────────
function openDeleteConfirm(id) {
    verwijderId = id;
    const c = competenties.find(x => x.competentie_id === id);
    document.getElementById('delete-confirm-sub').textContent =
        `Weet je zeker dat je "${c ? c.naam : ''}" wilt verwijderen? Dit kan niet ongedaan gemaakt worden.`;
    document.getElementById('delete-confirm').classList.add('open');
}

function closeDeleteConfirm() {
    verwijderId = null;
    document.getElementById('delete-confirm').classList.remove('open');
}

async function executeDelete() {
    if (verwijderId === null) return;
    try {
        await apiFetch(`/competenties/${verwijderId}`, { method: 'DELETE' });
        closeDeleteConfirm();
        laadCompetenties();
    } catch (err) {
        alert(err.message || 'Verwijderen mislukt.');
    }
}

// ── Hulp ────────────────────────────────────────────────────
function esc(tekst) {
    return String(tekst).replace(/[&<>"]/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    })[ch]);
}