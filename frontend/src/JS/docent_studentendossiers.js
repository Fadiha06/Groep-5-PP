let alle = [];
let huidigeStageId = null;

async function laad() {
    if (!requireAuth('docent')) return;

    try {
        const data = await apiFetch('/docent/dossiers');
        alle = data.studenten;
        renderLijst();
        if (alle.length > 0) selecteer(alle[0]);
    } catch (err) {
        document.getElementById('student-lijst').innerHTML =
            `<div class="placeholder">${err.message}</div>`;
    }
}

function renderLijst() {
    const q = document.getElementById('zoek').value.toLowerCase();
    const lijst = alle.filter(s => s.student_naam.toLowerCase().includes(q));
    const c = document.getElementById('student-lijst');
    c.innerHTML = '';
    if (lijst.length === 0) {
        c.innerHTML = '<div class="placeholder">Geen studenten.</div>';
        return;
    }
    lijst.forEach(s => {
        const div = document.createElement('div');
        div.className = 'student-item' + (s.stage_id === huidigeStageId ? ' active' : '');
        div.onclick = () => selecteer(s);
        div.innerHTML = `
            <div class="avatar">${s.student_naam.charAt(0).toUpperCase()}</div>
            <div>
                <div class="student-naam">${s.student_naam}</div>
                <div class="student-sub">${s.opleiding || '—'} • ${s.bedrijf_naam || '—'}</div>
            </div>
        `;
        c.appendChild(div);
    });
}

function filter() {
    renderLijst();
}

function selecteer(s) {
    huidigeStageId = s.stage_id;
    renderLijst();
    renderInfo(s);
    renderTijdlijn(s);
    laadMeldingen(s.gebruiker_id);
}

function datum(d) {
    return d ? new Date(d).toLocaleDateString('nl-BE') : '—';
}

function huidigeWeek(start) {
    if (!start) return 1;
    const verschil = Math.floor((new Date() - new Date(start)) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(verschil / 7) + 1);
}

function renderInfo(s) {
    const adres = [s.bedrijf_adres, s.bedrijf_stad].filter(Boolean).join(', ') || '—';
    document.getElementById('info').innerHTML = `
        <div class="info-grid">
            <div>
                <div class="info-label">Student & Opleiding</div>
                <div class="info-strong">${s.student_naam} (${s.opleiding || '—'})</div>
                <div class="info-text">${s.email}</div>
                <div class="info-text">— (geen telefoon in DB)</div>
            </div>
            <div>
                <div class="info-label">Bedrijf & Locatie</div>
                <div class="info-strong">${s.bedrijf_naam || '—'}</div>
                <div class="info-text">${adres}</div>
            </div>
            <div>
                <div class="info-label">Stagementor</div>
                <div class="info-strong">—</div>
                <div class="info-text">— (niet in DB)</div>
            </div>
            <div>
                <div class="info-label">Stageperiode</div>
                <div class="info-strong">${datum(s.startdatum)} – ${datum(s.einddatum)}</div>
            </div>
        </div>
    `;
}

function renderTijdlijn(s) {
    const week = huidigeWeek(s.startdatum);
    document.getElementById('tijdlijn').innerHTML = `
        <div class="mijlpaal done"><div class="dot"></div><div class="mp-label">Start</div><div class="mp-date">${datum(s.startdatum)}</div></div>
        <div class="mijlpaal done"><div class="dot"></div><div class="mp-label">Tussentijds 1</div><div class="mp-date">Afgerond</div></div>
        <div class="mijlpaal current"><div class="dot"></div><div class="mp-label">Week ${week}</div><div class="mp-date">Huidig</div></div>
        <div class="mijlpaal"><div class="dot"></div><div class="mp-label">Tussentijds 2</div><div class="mp-date">Gepland</div></div>
        <div class="mijlpaal"><div class="dot"></div><div class="mp-label">Einde Stage</div><div class="mp-date">${datum(s.einddatum)}</div></div>
    `;
}

async function laadMeldingen(gebruikerId) {
    const c = document.getElementById('meldingen');
    c.innerHTML = '<div class="placeholder">Laden...</div>';
    try {
        const data = await apiFetch(`/docent/student/${gebruikerId}/meldingen`);
        if (data.meldingen.length === 0) {
            c.innerHTML = '<div class="placeholder">Geen meldingen.</div>';
            return;
        }
        c.innerHTML = '';
        data.meldingen.forEach(m => {
            const div = document.createElement('div');
            div.className = 'melding';
            div.innerHTML = `
                <div class="melding-top">
                    <span class="melding-titel">${m.titel || 'Melding'}</span>
                    <span class="badge">${m.type || 'info'}</span>
                </div>
                <div class="melding-tekst">${m.bericht || ''}</div>
            `;
            c.appendChild(div);
        });
    } catch (err) {
        c.innerHTML = `<div class="placeholder">${err.message}</div>`;
    }
}

laad();