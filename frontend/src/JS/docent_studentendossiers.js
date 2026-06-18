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
                <div class="info-text">${s.student_telefoon || '—'}</div>
            </div>
            <div>
                <div class="info-label">Bedrijf & Locatie</div>
                <div class="info-strong">${s.bedrijf_naam || '—'}</div>
                <div class="info-text">${adres}</div>
                <div class="info-text">${s.bedrijf_telefoon || '—'}</div>
            </div>
            <div>
                <div class="info-label">Stagementor</div>
                <div class="info-strong">${s.mentor_naam || '—'}</div>
                <div class="info-text">${s.mentor_telefoon || '— (geen telefoon)'}</div>
            </div>
            <div>
                <div class="info-label">Stageperiode</div>
                <div class="info-strong">${datum(s.startdatum)} – ${datum(s.einddatum)}</div>
            </div>
        </div>
    `;
}

function renderTijdlijn(s) {
    const now = new Date();
    const start = s.startdatum ? new Date(s.startdatum) : null;
    const eind = s.einddatum ? new Date(s.einddatum) : null;
    const afgerond = s.status === 'afgerond' || (eind && now > eind);

    let frac = 0;
    if (start && eind && eind > start) {
        frac = Math.min(1, Math.max(0, (now - start) / (eind - start)));
    }

    const week = huidigeWeek(s.startdatum);
    const punten = [
        { label: 'Start',         date: datum(s.startdatum), pos: 0 },
        { label: 'Tussentijds 1', date: '',                  pos: 0.25 },
        { label: `Week ${week}`,  date: '',                  pos: 0.5 },
        { label: 'Tussentijds 2', date: '',                  pos: 0.75 },
        { label: 'Einde Stage',   date: datum(s.einddatum),  pos: 1 }
    ];

    // huidige mijlpaal = de laatste die door de tijd al bereikt is
    let currentIndex = 0;
    punten.forEach((m, i) => { if (frac >= m.pos) currentIndex = i; });

    document.getElementById('tijdlijn').innerHTML = punten.map((m, i) => {
        let cls;
        if (afgerond) {
            cls = 'done';                       // afgerond → alles groen
        } else if (i < currentIndex) {
            cls = 'done';                       // verleden → groen
        } else if (i === currentIndex) {
            cls = 'current';                    // nu → blauw
        } else {
            cls = '';                           // toekomst → grijs
        }
        const dateLabel = (!afgerond && i === currentIndex) ? 'Huidig' : m.date;
        return `<div class="mijlpaal ${cls}"><div class="dot"></div><div class="mp-label">${m.label}</div><div class="mp-date">${dateLabel}</div></div>`;
    }).join('');
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