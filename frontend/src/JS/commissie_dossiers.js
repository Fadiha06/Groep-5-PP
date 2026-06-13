document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['stagecommissie', 'administrator'])) return;
  loadAlleDossiers();
});

async function loadAlleDossiers() {
  try {
    const stages = await apiFetch('/stage/all');

    // Update sidebar badge
    const pending = stages.filter(s => s.status === 'in_aanvraag');
    document.getElementById('badge-pending').textContent = pending.length;

    const tbody = document.getElementById('dossiers-table-body');
    tbody.innerHTML = '';

    if (stages.length === 0) {
      tbody.innerHTML = '<p class="no-data-msg">Geen dossiers gevonden.</p>';
      return;
    }

    stages.forEach(stage => {
      const row = document.createElement('div');
      row.className = 'table-grid';
      
      // Bepaal de juiste badge styling & tekst per status
      let badgeHtml = '';
      const statusValue = stage.status ? stage.status.toLowerCase() : '';

      if (statusValue === 'in_aanvraag') {
        badgeHtml = `<span class="badge badge--pending">Nieuw</span>`;
      } else if (statusValue === 'goedgekeurd') {
        badgeHtml = `<span class="badge badge--approved">Goedgekeurd</span>`;
      } else if (statusValue === 'actief') {
        badgeHtml = `<span class="badge badge--active">Actief</span>`;
      } else if (statusValue === 'geweigerd') {
        badgeHtml = `<span class="badge badge--rejected">Geweigerd</span>`;
      } else if (statusValue === 'conditie') {
        badgeHtml = `<span class="badge badge--condition">Voorwaarde</span>`;
      } else {
        badgeHtml = `<span class="badge badge--pending">${statusValue.toUpperCase() || 'ONBEKEND'}</span>`;
      }

      row.innerHTML = `
        <strong>${stage.studentnaam || '—'}</strong>
        <span>${stage.bedrijfsnaam || '—'}</span>
        <span>${stage.titel || '—'}</span>
        <div>${badgeHtml}</div>
        <div>
          <a href="commissie_aanvraag.html?id=${stage.stage_id}" class="btn-view-dossier">Dossier bekijken</a>
        </div>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error('Fout bij ophalen dossiers:', err);
    document.getElementById('dossiers-table-body').innerHTML = 
      `<p class="error-msg">Fout bij het laden van dossiers: ${err.message}</p>`;
  }
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}
