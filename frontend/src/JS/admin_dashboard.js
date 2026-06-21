document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('administrator')) return;

  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', window.logout);

  loadStats();
  loadTeVersturen();
  loadActivity();
  loadContracts();
});

// ============================================================
// Header subtitel + stats
// ============================================================
async function loadStats() {
  try {
    // Verwacht: GET /api/admin/dashboard/stats
    // Response: { totalStudents, pendingContracts, activeExtensions, melding }
    // "pendingContracts" = contracten die de stagecommissie klaar heeft gezet en
    // die de admin nog moet versturen (zie ook /admin/dashboard/te-versturen).
    const stats = await apiFetch('/admin/dashboard/stats');

    setText('stat-total-students', stats.totalStudents);
    setText('stat-contracts-review', stats.pendingContracts);
    setText('stat-legal-check', stats.legalCheck);
    setText('header-subtitle', stats.melding || '');
  } catch (err) {
    console.error('Fout bij ophalen statistieken:', err);
    setText('header-subtitle', 'Kon overzicht niet laden.');
  }
}

// ============================================================
// Contracten klaar om te verzenden
// ============================================================
async function loadTeVersturen() {
  const container = document.getElementById('te-versturen-list');
  const badge = document.getElementById('te-versturen-badge');

  try {
    // Verwacht: GET /api/admin/dashboard/te-versturen
    // Response: [{ contract_id, student_naam, bedrijf_naam, getekend_op }]
    const items = await apiFetch('/admin/dashboard/te-versturen');

    badge.textContent = `${items.length} Wachtend`;

    if (items.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:13px;padding:20px">Geen contracten klaar om te verzenden.</div>`;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="contract-card">
        <div class="contract-header">
          <div class="contract-title">${item.bedrijf_naam || 'Onbekend bedrijf'} - Stageovereenkomst</div>
          <div class="contract-date">Getekend door commissie: ${formatDatum(item.getekend_op)}</div>
        </div>
        <div class="contract-details">
          <p><strong>Student:</strong> ${item.student_naam}</p>
        </div>
        <button class="action-btn" onclick="versturen(${item.contract_id}, this)">Verstuur naar student & bedrijf</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Fout bij ophalen te versturen contracten:', err);
    container.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:13px;padding:20px">Kon contracten niet laden.</div>`;
    badge.textContent = '- Wachtend';
  }
}

async function versturen(contractId, btn) {
  btn.disabled = true;
  btn.textContent = 'Versturen...';
  try {
    await apiFetch(`/admin/contracten/${contractId}/versturen`, { method: 'POST' });
    loadTeVersturen();
    loadStats();
  } catch (err) {
    alert(err.message || 'Kon het contract niet versturen.');
    btn.disabled = false;
    btn.textContent = 'Verstuur naar student & bedrijf';
  }
}
window.versturen = versturen;

// ============================================================
// Recente Activiteit
// ============================================================
async function loadActivity() {
  const container = document.getElementById('activity-list');

  try {
    // Verwacht: GET /api/admin/dashboard/activiteit
    // Response: [{ titel, tijd_geleden, door }]
    const activiteiten = await apiFetch('/admin/dashboard/activiteit');

    if (activiteiten.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:13px;padding:20px">Geen recente activiteit.</div>`;
      return;
    }

    container.innerHTML = activiteiten.map(a => `
      <div class="activity-item">
        <h4>${a.titel}</h4>
        <div class="activity-time">${a.tijd_geleden}${a.door ? ' door ' + a.door : ''}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Fout bij ophalen recente activiteit:', err);
    container.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:13px;padding:20px">Kon activiteit niet laden.</div>`;
  }
}

// ============================================================
// Lopende Contracten & Statussen
// ============================================================

// Aanvraag-status -> badge class + label
const STATUS_MAP = {
  goedgekeurd:  { cls: 'badge-goedgekeurd', label: 'Goedgekeurd' },
  in_review:    { cls: 'badge-review',      label: 'In Review' },
  in_afwachting:{ cls: 'badge-afwachting',  label: 'In Afwachting' },
  geweigerd:    { cls: 'badge-afwachting',  label: 'Geweigerd' }
};

// Contract-status -> badge class + label
const CONTRACT_STATUS_MAP = {
  verzonden:  { cls: 'badge-verzonden', label: 'Verzonden' },
  voltooid:   { cls: 'badge-voltooid',  label: 'Voltooid' },
  nog_niet:   { cls: 'badge-nognie',    label: 'Nog niet' },
  in_review:  { cls: 'badge-review',    label: 'In Review' }
};

async function loadContracts() {
  const tbody = document.getElementById('contracts-tbody');

  try {
    // Verwacht: GET /api/admin/dashboard/contracts
    // Response: [{
    //   student_naam, opleiding, bedrijf_naam,
    //   aanvraag_status: 'goedgekeurd' | 'in_review' | 'in_afwachting' | 'geweigerd',
    //   contract_status: 'verzonden' | 'voltooid' | 'nog_niet' | 'in_review',
    //   actie_label: 'Bekijk / Edit' | 'Bekijk Dossier',
    //   contract_id
    // }]
    const contracts = await apiFetch('/admin/dashboard/contracts');

    if (contracts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:24px">Geen overeenkomsten gevonden. Alle overeenkomsten zijn voltooid.</td></tr>`;
      return;
    }

    tbody.innerHTML = contracts.map(c => {
      const aanvraag = STATUS_MAP[c.aanvraag_status] || { cls: 'badge-afwachting', label: c.aanvraag_status || '-' };
      const contractStatus = CONTRACT_STATUS_MAP[c.contract_status] || { cls: 'badge-nognie', label: c.contract_status || '-' };
      const actieLabel = c.actie_label || 'Bekijk / Edit';

      return `
      <tr>
        <td class="td-name">${c.student_naam || 'Onbekend'}</td>
        <td>${c.opleiding || '-'}</td>
        <td>${c.bedrijf_naam || '-'}</td>
        <td><span class="badge ${aanvraag.cls}">${aanvraag.label}</span></td>
        <td><span class="badge ${contractStatus.cls}">${contractStatus.label}</span></td>
        
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Fout bij ophalen contracten:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:24px">Kon overeenkomsten niet laden.</td></tr>`;
  }
}

function exporteerContractenCSV() {
  // Verwacht: GET /api/admin/dashboard/contracts/export -> CSV blob
  window.location.href = '/api/admin/dashboard/contracts/export';
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === undefined || value === null) ? '-' : value;
}

function formatDatum(datumStr) {
  if (!datumStr) return '-';
  const d = new Date(datumStr);
  if (isNaN(d)) return datumStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}


