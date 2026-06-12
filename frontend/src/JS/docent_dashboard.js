const WEEK = 4; // Pas dit aan naar de huidige week

async function laadDashboard() {
  try {
    const data = await apiFetch(`/docent/studenten?week=${WEEK}`);

    // Naam docent invullen
    document.getElementById('docent-naam').textContent = data.docent;

    // Logboek controle tabel vullen
    const tbody = document.getElementById('logboek-tbody');
    tbody.innerHTML = data.studenten.map(s => `
      const teBoordelen = data.studenten.filter(s => !s.ingevuld).length;
      document.getElementById('volgende-taak').textContent = teBoordelen + ' te beoordelen logboeken';
      <tr>
        <td class="td-name">${s.student}</td>
        <td>${s.bedrijf}</td>
        <td>
          <span class="badge ${s.ingevuld ? 'badge-groen' : 'badge-rood'}">
            ${s.status}
          </span>
        </td>
        <td>
          ${s.ingevuld
            ? `<span class="link-actie">Bekijk details</span>`
            : `<span class="link-actie" onclick="stuurReminder(${s.stage_id})">Stuur reminder</span>`
          }
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Kon dashboard niet laden:', err);
  }
}

async function stuurReminder(stageId) {
  try {
    const data = await apiFetch('/docent/reminder', {
      method: 'POST',
      body: JSON.stringify({ stage_id: stageId, weeknummer: WEEK })
    });
    alert(data.message);
  } catch (err) {
    alert(err.message || 'Kon reminder niet versturen.');
  }
}

laadDashboard();
