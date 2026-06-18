// ============================================================
//  admin_competenties.js
//  Admin beheert de beoordelingscriteria (COMPETENTIE).
//    GET    /competenties
//    POST   /competenties
//    PUT    /competenties/:id
//    DELETE /competenties/:id
// ============================================================

let competenties = [];
let bewerkId     = null;   // null = nieuw, anders = id dat bewerkt wordt
let verwijderId  = null;

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
function openModal(id = null) {
    bewerkId = id;
    const titel = document.getElementById('modal-title');

    if (id === null) {
        titel.textContent = 'Nieuwe competentie';
        document.getElementById('inp-naam').value = '';
        document.getElementById('inp-omschrijving').value = '';
    } else {
        const c = competenties.find(x => x.competentie_id === id);
        if (!c) return;
        titel.textContent = 'Competentie bewerken';
        document.getElementById('inp-naam').value = c.naam || '';
        document.getElementById('inp-omschrijving').value = c.omschrijving || '';
    }

    document.getElementById('modal').classList.add('open');
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
}

async function opslaan() {
    const naam = document.getElementById('inp-naam').value.trim();
    const omschrijving = document.getElementById('inp-omschrijving').value.trim();

    if (!naam) {
        alert('Naam is verplicht.');
        return;
    }

    const payload = { naam, omschrijving };

    try {
        if (bewerkId === null) {
            await apiFetch('/competenties', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        } else {
            await apiFetch(`/competenties/${bewerkId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        }
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