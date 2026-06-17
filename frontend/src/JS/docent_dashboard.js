const WEEK = 4;

async function laadDashboard() {
    if (!requireAuth('docent')) return;

    try {
        const data = await apiFetch(`/docent/studenten?week=${WEEK}`);

        document.getElementById('groet').textContent = `Welkom, ${data.docent}`;
        document.getElementById('week-label').textContent = `Week ${data.weeknummer}`;
        vulStudenten(data.studenten);
    } catch (err) {
        document.getElementById('studenten-body').innerHTML =
            `<div class="placeholder" style="padding:12px 0;">${err.message}</div>`;
    }

    try {
        const data = await apiFetch('/docent/milestones');
        vulMilestones(data.milestones);
    } catch (err) {
        console.error(err);
    }
}

function vulStudenten(studenten) {
    const body = document.getElementById('studenten-body');
    body.innerHTML = '';
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
    body.innerHTML = '';
    milestones.forEach(m => {
        const badge = m.getekend ? 'badge-ok' : 'badge-missing';
        const div = document.createElement('div');
        div.className = 'milestone-item';
        div.innerHTML = `
            <div class="milestone-naam">${m.student}</div>
            <span class="badge ${badge}">${m.stageovereenkomst}</span>
        `;
        body.appendChild(div);
    });
}

async function stuurReminder(stageId) {
    try {
        const data = await apiFetch('/docent/reminder', {
            method: 'POST',
            body: JSON.stringify({ stage_id: stageId, weeknummer: WEEK })
        });
        alert(data.message);
    } catch (err) {
        alert(err.message || 'Kan geen verbinding maken met de server');
    }
}

laadDashboard();