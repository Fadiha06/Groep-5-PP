let rapportenData = [];
let competentieKolommen = []; // [{ id, label }] — dynamisch, max 3 zichtbare kolommen

async function laadRapporten() {
  try {
    // Verwacht: GET /api/admin/rapporten
    // Response: {
    //   competenties: [{ id, label }],  // bv. [{id:1,label:'C1 Teamwerk'}, ...]
    //   studenten: [{
    //     stage_id, naam, bedrijf,
    //     scores: { [competentie_id]: score_of_null },  // max 5 per competentie
    //     totaal: score_of_null,   // op 100
    //     totaal_max: 100
    //   }]
    // }
    const data = await apiFetch('/admin/rapporten');
    competentieKolommen = data.competenties || [];
    rapportenData = data.studenten || [];

    renderHeaders();
    renderTable(rapportenData);
  } catch (err) {
    console.error('Kon rapporten niet laden:', err);
  }
}

function renderHeaders() {
  ['th-c1', 'th-c2', 'th-c3'].forEach((id, i) => {
    const th = document.getElementById(id);
    if (competentieKolommen[i]) {
      th.textContent = competentieKolommen[i].label;
    } else {
      th.style.display = 'none';
    }
  });
}

function renderTable(data) {
  const tbody = document.getElementById('tbody');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#9CA3AF;padding:24px">Geen rapporten gevonden.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => {
    const scoreCellsHtml = competentieKolommen.slice(0, 3).map(k => {
      const score = s.scores ? s.scores[k.id] : null;
      if (score === null || score === undefined) {
        return `<td class="center"><span class="score-pill na">-</span></td>`;
      }
      return `<td class="center"><span class="score-pill">${score}/5</span></td>`;
    }).join('');

    let totaalHtml;
    if (s.totaal === null || s.totaal === undefined) {
      totaalHtml = `<span class="totaal-pill totaal-na">N.v.t.</span>`;
    } else {
      const pct = (s.totaal / (s.totaal_max || 100)) * 100;
      const cls = pct >= 70 ? 'totaal-goed' : pct >= 50 ? 'totaal-matig' : 'totaal-slecht';
      totaalHtml = `<span class="totaal-pill ${cls}">${s.totaal}/${s.totaal_max || 100}</span>`;
    }

    return `
    <tr>
      <td><input type="checkbox" class="check row-check" data-stage-id="${s.stage_id}" onchange="updateExportButton()"></td>
      <td class="td-name">${s.naam}</td>
      <td class="td-bedrijf">${s.bedrijf}</td>
      ${scoreCellsHtml}
      <td class="center">${totaalHtml}</td>
    </tr>`;
  }).join('');
}

function toggleAlles(checkbox) {
  document.querySelectorAll('.row-check').forEach(c => {
    // Alleen zichtbare (niet-gefilterde) rijen aanvinken
    if (c.closest('tr').style.display !== 'none') {
      c.checked = checkbox.checked;
    }
  });
  updateExportButton();
}

function updateExportButton() {
  const aantal = document.querySelectorAll('.row-check:checked').length;
  const btn = document.getElementById('btn-export');
  btn.disabled = aantal === 0;
  btn.textContent = aantal === 0
    ? '📥 Exporteer geselecteerde als CSV'
    : `📥 Exporteer ${aantal} geselecteerde${aantal > 1 ? 'n' : ''} als CSV`;
}

function filterTable() {
  const q = document.querySelector('.search').value.toLowerCase();
  document.querySelectorAll('#tbody tr').forEach((row, i) => {
    if (!rapportenData[i]) return;
    const s = rapportenData[i];
    const match = s.naam.toLowerCase().includes(q) || s.bedrijf.toLowerCase().includes(q);
    row.style.display = match ? '' : 'none';
  });
}

async function exporteerCSV() {
  const stageIds = Array.from(document.querySelectorAll('.row-check:checked'))
    .map(c => Number(c.dataset.stageId));

  if (stageIds.length === 0) return;

  try {
    // Verwacht: POST /api/admin/rapporten/export
    // Body: { stage_ids: [...] }
    // Response: CSV bestand (blob) of een download URL
    const response = await fetch(`${window.API_BASE_URL}/admin/rapporten/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ stage_ids: stageIds })
    });

    if (!response.ok) throw new Error('Export mislukt');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rapporten_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message || 'Kon de export niet downloaden.');
  }
}

laadRapporten();
