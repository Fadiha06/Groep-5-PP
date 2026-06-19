document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['stagecommissie', 'commissie', 'administrator'])) return;
  loadDashboard();
});

async function loadDashboard() {
  try {
    const stages = await apiFetch('/stage/all');

    // Filter de data voor de stat-cards
    const nieuw = stages.filter(s => s.status === 'in_aanvraag');
    const goedgekeurd = stages.filter(s => s.status === 'goedgekeurd');
    const geweigerd = stages.filter(s => s.status === 'geweigerd' || s.status === 'conditie');
    const actief = stages.filter(s => s.status === 'actief');

    // Update statistieken op het scherm
    document.getElementById('stat-new').textContent = nieuw.length;
    document.getElementById('stat-approved').textContent = goedgekeurd.length;
    document.getElementById('stat-rejected').textContent = geweigerd.length;
    document.getElementById('stat-active').textContent = actief.length;
    document.getElementById('badge-pending').textContent = nieuw.length;

    const totaal = stages.length;
    const pct = totaal > 0 ? Math.round((goedgekeurd.length / totaal) * 100) : 0;
    document.getElementById('stat-approved-pct').textContent = `${pct}% van de ingediende voorstellen`;

    // === AANDACHTSPUNTEN GRID (kaartjes) ===
    const grid = document.getElementById('attention-points-grid');
    grid.innerHTML = '';

    if (nieuw.length === 0) {
      grid.innerHTML = '<p style="color:#888; padding: 1rem 0;">Geen openstaande aanvragen om te beoordelen.</p>';
    } else {
      nieuw.forEach(stage => {
        const kaart = document.createElement('div');
        kaart.className = 'attention-card';
        kaart.innerHTML = `
          <strong>${stage.studentnaam || 'Onbekende Student'}</strong>
          <span>${stage.titel || 'Geen titel'}</span>
          <span style="color:#888; font-size:0.85rem; margin-bottom: 1rem;">${stage.bedrijfsnaam || 'Geen bedrijf'}</span>
          <a href="commissie_aanvraag.html?id=${stage.stage_id}" class="btn" style="text-decoration:none; display:inline-block; background-color:#1e3a8a; color:white; padding:0.4rem 0.8rem; border-radius:4px; font-size:0.85rem; text-align:center;">Beoordelen</a>
        `;
        grid.appendChild(kaart);
      });
    }

    // === RECENTE BESLISSINGEN ===
    const beslissingen = stages.filter(s => s.status !== 'in_aanvraag').slice(0, 5); // Laatste 5 beslissingen
    const lijst = document.getElementById('decisions-list');
    lijst.innerHTML = '';

    if (beslissingen.length === 0) {
      lijst.innerHTML = '<p style="color:#888; padding:1rem 0;">Nog geen eerdere beslissingen genomen.</p>';
    } else {
      beslissingen.forEach(stage => {
        const item = document.createElement('div');
        item.style.padding = '1rem 0';
        item.style.borderBottom = '1px solid #e2e8f0';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        let statusBadge = `<span style="background:#def7ec; color:#03543f; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; font-weight:bold;">${stage.status.toUpperCase()}</span>`;
        if (stage.status === 'geweigerd') {
          statusBadge = `<span style="background:#fde8e8; color:#9b1c1c; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; font-weight:bold;">GEWEIGERD</span>`;
        }

        item.innerHTML = `
          <div>
            <strong>${stage.studentnaam || 'Student'}</strong> — ${stage.titel || 'Stagevoorstel'} <br>
            <small style="color:#64748b;">Bedrijf: ${stage.bedrijfsnaam || '—'}</small>
          </div>
          <div>${statusBadge}</div>
        `;
        lijst.appendChild(item);
      });
    }

    // === AANDACHTSPUNTEN TABEL ===
    const tabelBody = document.getElementById('attention-table-body');
    tabelBody.innerHTML = '';

    // Filter bijvoorbeeld stages die in status 'conditie' of 'geweigerd' zijn
    const aandachtStages = stages.filter(s => s.status === 'conditie' || s.status === 'geweigerd');

    if (aandachtStages.length === 0) {
      tabelBody.innerHTML = '<p style="color:#888; padding:1rem;">Momenteel geen kritieke aandachtspunten.</p>';
    } else {
      aandachtStages.forEach(stage => {
        const row = document.createElement('div');
        row.className = 'table-grid';
        row.style.padding = '0.85rem 0';
        row.style.borderBottom = '1px solid #e2e8f0';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 1fr 1fr';
        
        row.innerHTML = `
          <span>${stage.studentnaam || '—'}</span>
          <span style="color:#b45309; font-weight:500;">Beoordeeld met aanpassingen/weigering</span>
          <span><span style="background:#fef3c7; color:#92400e; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem;">${stage.status.toUpperCase()}</span></span>
        `;
        tabelBody.appendChild(row);
      });
    }

  } catch (err) {
    console.error('Fout bij ophalen dashboard data:', err);
  }
}

function viewAllPoints(event) {
  event.preventDefault();
  window.location.href = 'commissie_dossiers.html';
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
}