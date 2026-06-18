let logboekenData = [];

async function laadLogboeken() {
  try {
    logboekenData = await apiFetch('/docent/logboeken');
    renderTable(logboekenData);
  } catch (err) {
    console.error('Kon logboeken niet laden:', err);
    document.getElementById('tbody').innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:#EF4444;padding:24px">${err.message || 'Kon logboeken niet laden.'}</td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tbody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:24px">Geen logboeken gevonden.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((l, i) => {
    const badgeStatus = (l.status === 'ingediend' || l.status === 'goedgekeurd') ? 'badge-ingediend'
      : l.status === 'te-laat' ? 'badge-te-laat'
      : 'badge-niet';
    const statusLabel = l.status === 'goedgekeurd' ? 'Goedgekeurd'
      : l.status === 'ingediend' ? 'Ingediend'
      : l.status === 'te-laat' ? 'Te laat'
      : (l.status || 'Niet ingediend');
    return `
    <tr>
      <td><div class="td-name">${l.naam}</div><div class="td-opleiding">${l.opleiding || ''}</div></td>
      <td><span class="badge badge-week">Week ${l.week}</span></td>
      <td style="color:#6B7280">${l.datum || '—'}</td>
      <td><span class="badge ${badgeStatus}">${statusLabel}</span></td>
      <td><button class="btn-open" onclick="openModal(${i})">Open</button></td>
    </tr>`;
  }).join('');
}

let huidigModalIndex = null;

function openModal(index) {
  huidigModalIndex = index;
  const l = logboekenData[index];

  document.getElementById('modal-title').textContent = `Logboek: ${l.naam} (Week ${l.week})`;
  document.getElementById('modal-sub').textContent = `${l.periode || '—'} • ${l.bedrijf || '—'}`;

  const badge = document.getElementById('modal-badge');
  if (l.status === 'ingediend' || l.status === 'goedgekeurd') {
    badge.textContent = l.status === 'goedgekeurd' ? '✓ Goedgekeurd' : '✓ Ingediend';
    badge.style.background = '#DCFCE7';
    badge.style.color = '#166534';
  } else if (l.status === 'te-laat') {
    badge.textContent = '⚠ Te laat ingediend';
    badge.style.background = '#FFF8E6';
    badge.style.color = '#F0A500';
  } else {
    badge.textContent = '✕ Niet ingediend';
    badge.style.background = '#FFEAEA';
    badge.style.color = '#EF4444';
  }

  const body = document.getElementById('modal-body-content');
  const dagen = l.dagen || [];
  if (dagen.length === 0) {
    body.innerHTML = `<div style="font-size:13px;color:#9CA3AF;padding:20px">Geen dagentries beschikbaar voor dit logboek.</div>`;
  } else {
    body.innerHTML = dagen.map(dag => `
      <div class="dag-card">
        <div class="dag-header">
          <span class="dag-naam">${dag.datum}</span>
          <span class="uren-badge">${dag.uren} uur</span>
        </div>
        <div class="dag-body">
          ${dag.taken ? `
          <div class="dag-sectie">
            <div class="dag-label">Uitgevoerde taken:</div>
            <div class="dag-tekst">${dag.taken}</div>
          </div>` : ''}
          ${dag.reflectie ? `
          <div class="dag-sectie">
            <div class="dag-label">Reflectie:</div>
            <div class="dag-tekst">${dag.reflectie}</div>
          </div>` : ''}
          ${dag.problemen ? `
          <div class="dag-sectie">
            <div class="dag-label">Problemen of uitdagingen:</div>
            <div class="dag-tekst">${dag.problemen}</div>
          </div>` : ''}
          ${dag.competenties && dag.competenties.length > 0 ? `
          <div class="dag-sectie">
            <div class="dag-label">Gekoppelde competenties:</div>
            <div class="competentie-tags">
              ${dag.competenties.map(c => `<span class="comp-tag">${c}</span>`).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>
    `).join('');
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function filterTable() {
  const q = document.querySelector('.search').value.toLowerCase();
  const gefilterd = logboekenData.filter(l => l.naam.toLowerCase().includes(q));
  renderTable(gefilterd);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});

laadLogboeken();