function berekenHuidigeWeek() {
    const nu = new Date();
    const start = new Date(nu.getFullYear(), 8, 1);
    if (nu < start) start.setFullYear(start.getFullYear() - 1);
    const verschilInDagen = Math.floor((nu - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(verschilInDagen / 7) + 1);
}

const WEEK = berekenHuidigeWeek();

async function laadDashboard() {
    if (!requireAuth('docent')) return;

    try {
        const data = await apiFetch(`/docenten/studenten?week=${WEEK}`);
        const groet = document.getElementById('groet');
        if (groet) groet.textContent = `Welkom, ${data.docent}`;
        const weekLabel = document.getElementById('week-label');
        if (weekLabel) weekLabel.textContent = `Week ${data.weeknummer}`;
        vulStudenten(data.studenten);
    } catch (err) {
        const body = document.getElementById('studenten-body');
        if (body) body.innerHTML = `<div class="placeholder" style="padding:12px 0;">${err.message}</div>`;
    }

    try {
        const data = await apiFetch('/docenten/milestones');
        vulMilestones(data.milestones || []);
    } catch (err) {
        console.error('Milestones fout:', err);
    }

    try {
        const aggr = await apiFetch('/docenten/aggregatie');
        vulAggregatie(aggr);
    } catch (err) {
        console.error('Aggregatie fout:', err);
    }
}

function vulStudenten(studenten) {
    const body = document.getElementById('studenten-body');
    if (!body) return;
    body.innerHTML = '';
    if (!studenten || studenten.length === 0) {
        body.innerHTML = '<div class="placeholder" style="padding:12px 0;">Geen studenten gevonden.</div>';
        return;
    }
    studenten.forEach(s => {
        const badge = s.ingevuld ? 'badge-ok' : 'badge-missing';
        const actie = s.ingevuld
            ? '<span class="link">Bekijk details</span>'
            : `<button class="reminder-btn" onclick="stuurReminder(${s.stage_id})">Stuur reminder</button>`;
        const rij = document.createElement('div');
        rij.className = 'table-row';
        rij.innerHTML = `
            <div class="student">${s.student}</div>
            <div>${s.bedrijf}</div>
            <div><span class="badge ${badge}">${s.status}</span></div>
            <div>${actie}</div>
        `;
        body.appendChild(rij);
    });
}

function vulMilestones(milestones) {
    const body = document.getElementById('milestones-body');
    if (!body) return;
    body.innerHTML = '';
    if (!milestones || milestones.length === 0) {
        body.innerHTML = '<div class="placeholder" style="padding:8px 0;">Geen contracten gevonden.</div>';
        return;
    }
    milestones.forEach(function(m) {
        const badge = m.getekend ? 'badge-ok' : 'badge-missing';
        const div = document.createElement('div');
        div.className = 'milestone-item';

        let actie = '';
        if (m.docent_getekend) {
            actie = '<span style="font-size:12px;color:#15803D;font-weight:600;">&#10003; Volledig getekend</span>';
        } else {
            actie = '<span style="font-size:12px;color:#9CA3AF;">Wacht op stagecommissie</span>';
        }

        div.innerHTML = '<div class="milestone-naam">' + m.student + '</div>' +
            '<span class="badge ' + badge + '">' + m.stageovereenkomst + '</span>' +
            actie;
        body.appendChild(div);
    });
}

async function stuurReminder(stageId) {
    try {
        const data = await apiFetch('/docenten/reminder', {
            method: 'POST',
            body: JSON.stringify({ stage_id: stageId, weeknummer: WEEK })
        });
        alert(data.message);
    } catch (err) {
        alert(err.message || 'Kan geen verbinding maken met de server');
    }
}

laadDashboard();



function vulAggregatie(aggr) {
    const container = document.querySelector('.card:last-child .placeholder');
    if (!container) return;
    if (!aggr || aggr.length === 0) {
        container.innerHTML = 'Nog geen tussentijdse evaluaties ingevuld.';
        return;
    }
    
    let html = '<div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">';
    aggr.forEach(a => {
        const perc = Math.round((a.gemiddelde / 5) * 100);
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#374151;">
                <span>${a.competentie}</span>
                <span style="font-weight:600;">${Number(a.gemiddelde).toFixed(1)} / 5</span>
            </div>
            <div style="background:#E5E7EB; border-radius:4px; height:6px; width:100%; overflow:hidden;">
                <div style="background:#10B981; height:100%; width:${perc}%"></div>
            </div>
        `;
    });
    html += '</div>';
    
    container.parentElement.innerHTML = `
        <div class="card-title">Tussentijdse Punten Aggregatie (Competenties)</div>
        ${html}
    `;
}
