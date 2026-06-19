document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('administrator')) return;

  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', window.logout);

  loadStats();
  loadActionRequired();
  loadActivity();
  loadContracts();
});

// ============================================================
// Header subtitel + stats
// ============================================================
async function loadStats() {
  try {
    // Verwacht: GET /api/admin/dashboard/stats
    // Response: {
    //   totalStudents, pendingContracts, legalCheck, activeExtensions,
    //   melding: "3 zaken vereisen jouw actie vandaag — 2 contracten wachten op controle, 1 juridisch probleem."
    // }
    const stats = await apiFetch('/admin/dashboard/stats');

    setText('stat-total-students', stats.totalStudents);
    setText('stat-contracts-review', stats.pendingContracts);
    setText('stat-legal-check', stats.legalCheck);
    setText('stat-extensions', stats.activeExtensions);
    setText('header-subtitle', stats.melding || '');
  } catch (err) {
    console.error('Fout bij ophalen statistieken:', err);
    setText('header-subtitle', 'Kon overzicht niet laden.');
  }
}

// ============================================================
// Overeenkomsten - Actie Vereist (Inline Review)
// ============================================================
async function loadActionRequired() {
  const container = document.getElementById('action-required-list');
  const badge = document.getElementById('action-required-badge');

  try {
    // Verwacht: GET /api/admin/dashboard/actie-vereist
    // Response: [{
    //   contract_id, bedrijf_naam, student_naam, opleiding, ingediend_op,
    //   risicoanalyse_ok, mentor_getekend, student_getekend, verzekering_status
    // }]
    const items = await apiFetch('/admin/dashboard/actie-vereist');

    badge.textContent = `${items.length} Wachtend`;

    if (items.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:13px;padding:20px">Geen overeenkomsten die actie vereisen.</div>`;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="contract-card">
        <div class="contract-header">
          <div class="contract-title">${item.bedrijf_naam} - Stageovereenkomst</div>
          <div class="contract-date">Ingediend: ${formatDatum(item.ingediend_op)}</div>
        </div>
        <div class="contract-details">
          <p><strong>Student:</strong> ${item.student_naam} (${item.opleiding})</p>
          <p><strong>Risicoanalyse:</strong> <span class="${item.risicoanalyse_ok ? 'status-ok' : 'status-bad'}">${item.risicoanalyse_ok ? '✓ Geüpload en in orde' : '✗ Nog niet geüpload'}</span></p>
          <p><strong>Handtekening Mentor:</strong> <span class="${item.mentor_getekend ? 'status-ok' : 'status-bad'}">${item.mentor_getekend ? '✓ Getekend' : '✗ Nog niet getekend'}</span></p>
          <p><strong>Handtekening Student:</strong> <span class="${item.student_getekend ? 'status-ok' : 'status-bad'}">${item.student_getekend ? '✓ Getekend' : '✗ Nog niet getekend'}</span></p>
          <p><strong>Verzekeringsdossier:</strong> ${item.verzekering_status || 'Onbekend'}</p>
        </div>
        <button class="action-btn" onclick="window.location.href='admin_overeenkomst.html?id=${item.contract_id}'">Check contract</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Fout bij ophalen actie-vereist overeenkomsten:', err);
    container.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:13px;padding:20px">Kon overeenkomsten niet laden.</div>`;
    badge.textContent = '- Wachtend';
  }
}

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
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:24px">Geen contracten gevonden.</td></tr>`;
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
        <td><button class="view-btn" onclick="window.location.href='admin_overeenkomst.html?id=${c.contract_id}'">${actieLabel}</button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Fout bij ophalen contracten:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:24px">Kon contracten niet laden.</td></tr>`;
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
