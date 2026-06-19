const WEEK = 4;

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
        } else if (m.student_getekend && m.mentor_getekend && m.contract_id) {
            actie = '<a href="docent_contract.html?id=' + m.contract_id + '" style="background:#D1193E;color:#fff;padding:5px 12px;border-radius:5px;font-size:12px;font-weight:600;text-decoration:none;">&#9998; Teken contract</a>';
        } else {
            actie = '<span style="font-size:12px;color:#9CA3AF;">Wacht op student/mentor</span>';
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
