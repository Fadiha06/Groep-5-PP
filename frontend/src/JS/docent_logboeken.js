let logboekenData = [];
let openenIndex = null;

async function laadLogboeken() {
  try {
    logboekenData = await apiFetch('/docenten/logboeken');
    renderTable(logboekenData);
  } catch (err) {
    console.error('Kon logboeken niet laden:', err);
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tbody');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:24px">Geen logboeken gevonden.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((l, i) => {
    const statusLabel = l.status === 'goedgekeurd' ? 'Goedgekeurd'
      : l.status === 'feedback' ? 'Feedback gegeven'
      : l.status === 'ingediend' ? 'Ingediend'
      : l.status === 'te-laat' ? 'Te laat'
      : 'Niet ingediend';
    const badgeClass = l.status === 'goedgekeurd' ? 'badge-goedgekeurd'
      : l.status === 'feedback' ? 'badge-feedback'
      : l.status === 'ingediend' ? 'badge-ingediend'
      : l.status === 'te-laat' ? 'badge-te-laat'
      : 'badge-niet';

    const docentCheck = l.docent_goedgekeurd ? ' <span style="color:#10B981">✓</span>' : '';
    const mentorCheck = l.mentor_feedback ? ' <span style="color:#6366F1">📋</span>' : '';

    const isOpen = openenIndex === i;

    return `
    <tr class="summary-row" data-index="${i}">
      <td><div class="td-name">${l.naam}</div><div class="td-opleiding">${l.opleiding}</div></td>
      <td><span class="badge badge-week">Week ${l.week}</span></td>
      <td style="color:#6B7280">${l.datum || '—'}</td>
      <td><span class="badge ${badgeClass}">${statusLabel}</span>${docentCheck}${mentorCheck}</td>
      <td><button class="btn-open" onclick="toggleExpand(${i})">${isOpen ? 'Sluit' : 'Open'}</button></td>
    </tr>
    <tr class="expand-row ${isOpen ? 'open' : ''}" id="expand-${i}">
      <td colspan="5">
        <div class="expand-content" id="expand-content-${i}">
          <div style="text-align:center;color:#9CA3AF;padding:16px">Laden...</div>
        </div>
      </td>
    </tr>`;
  }).join('');

  if (openenIndex !== null) {
    laadExpandContent(openenIndex);
  }
}

async function toggleExpand(index) {
  if (openenIndex === index) {
    openenIndex = null;
    renderTable(logboekenData);
    return;
  }
  openenIndex = index;
  renderTable(logboekenData);
}

async function laadExpandContent(index) {
  const l = logboekenData[index];
  const container = document.getElementById(`expand-content-${index}`);
  if (!container) return;

  // Laad evaluaties
  let evals = [];
  try {
    evals = await apiFetch(`/docenten/logboek/evaluatie?stage_id=${l.stage_id}&week=${l.week}`);
    evals = Array.isArray(evals) ? evals : [];
  } catch (err) { evals = []; }
  l._evaluaties = evals;

  const dagen = l.dagen || [];

  // Tab bar + content
  container.innerHTML = `
    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab(${index}, 'dagen', this)">Dagoverzicht</button>
      <button class="tab-btn" onclick="switchTab(${index}, 'zelfbeoordeling', this)">Zelfbeoordeling</button>
      <button class="tab-btn" onclick="switchTab(${index}, 'beoordelen', this)">Beoordelen</button>
    </div>

    <!-- Tab: Dagen -->
    <div class="tab-pane active" id="pane-dagen-${index}">
      ${dagen.length === 0
        ? '<div style="font-size:13px;color:#9CA3AF;padding:20px">Geen dagentries beschikbaar.</div>'
        : dagen.map(dag => `
          <div class="dag-card" style="margin-bottom:10px">
            <div class="dag-header">
              <span class="dag-naam">${dag.datum}</span>
              <span class="uren-badge">${dag.uren} uur</span>
            </div>
            <div class="dag-body">
              ${dag.taken ? `<div class="dag-sectie"><div class="dag-label">Uitgevoerde taken:</div><div class="dag-tekst">${dag.taken}</div></div>` : ''}
              ${dag.problemen ? `<div class="dag-sectie"><div class="dag-label">Problemen of uitdagingen:</div><div class="dag-tekst">${dag.problemen}</div></div>` : ''}
              ${dag.competenties && dag.competenties.length > 0 ? `
                <div class="dag-sectie">
                  <div class="dag-label">Zelfbeoordeling:</div>
                  <div class="competentie-tags">
                    ${dag.competenties.map(c => `<span class="comp-tag">${c.naam}: ${c.score != null ? c.score + '/5' : '–'}</span>`).join('')}
                  </div>
                </div>` : ''}
            </div>
          </div>
        `).join('')}

      ${l.mentor_feedback ? `
        <div class="bestaaand-box bestaaand-box--groen">
          <div class="bestaaand-box__label">📋 Feedback van mentor:</div>
          <div class="bestaaand-box__tekst">${l.mentor_feedback}</div>
        </div>` : ''}
    </div>

    <!-- Tab: Zelfbeoordeling -->
    <div class="tab-pane" id="pane-zelfbeoordeling-${index}">
      <div id="zelfb-content-${index}"></div>
    </div>

    <!-- Tab: Beoordelen -->
    <div class="tab-pane" id="pane-beoordelen-${index}">
      ${l.docent_feedback ? `
        <div class="bestaaand-box">
          <div class="bestaaand-box__label">💬 Eerder gegeven feedback:</div>
          <div class="bestaaand-box__tekst">${l.docent_feedback}</div>
        </div>` : ''}

      <div class="scoring-sectie">
        <div class="scoring-titel">Scores van de mentor</div>
        ${evals.length > 0 ? evals.map(e => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F1F5F9;font-size:13px">
              <span style="color:#334155">${e.competentie_naam}</span>
              <span style="font-weight:600;color:#2563EB">${e.score}/5</span>
            </div>`).join('')
          : '<p style="color:#9CA3AF;font-size:13px;padding:8px 0">De mentor heeft deze week nog geen scores gegeven.</p>'}
      </div>

      <div class="feedback-sectie">
        <div class="feedback-label">Feedback voor de student</div>
        <textarea id="feedback-tekst-${index}" class="feedback-textarea" placeholder="Schrijf hier je feedback...">${l.docent_feedback || ''}</textarea>
        <div class="feedback-actions">
          <button class="btn-feedback" onclick="verstuurFeedback(${index})">Feedback opslaan</button>
          <button class="btn-goedkeuren" onclick="goedkeuren(${index})">✓ Goedkeuren</button>
        </div>
      </div>
    </div>
  `;

  // Vul zelfbeoordeling
  vulZelfbeoordeling(index, dagen);
}

function switchTab(index, tab, btn) {
  const parent = btn.closest('.expand-content');
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`pane-${tab}-${index}`).classList.add('active');
}

function vulZelfbeoordeling(index, dagen) {
  const container = document.getElementById(`zelfb-content-${index}`);
  if (!container) return;

  const alleComps = {};
  dagen.forEach(dag => {
    (dag.competenties || []).forEach(c => {
      if (!alleComps[c.competentie_id]) {
        alleComps[c.competentie_id] = { naam: c.naam, scores: [] };
      }
      if (c.score != null) alleComps[c.competentie_id].scores.push(c.score);
    });
  });

  const compArray = Object.values(alleComps);
  if (compArray.length === 0) {
    container.innerHTML = '<p style="color:#9CA3AF;font-size:13px;padding:16px 0">Geen zelfbeoordelingen gevonden.</p>';
    return;
  }

  container.innerHTML = `
    <div style="font-size:14px;font-weight:700;color:#1E293B;margin-bottom:12px">Zelfbeoordeling van de student</div>
    ${compArray.map(c => {
      const avg = c.scores.length > 0 ? (c.scores.reduce((a, b) => a + b, 0) / c.scores.length).toFixed(1) : '–';
      return `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:13px">
        <span style="color:#334155">${c.naam}</span>
        <span style="font-weight:600;color:#1E293B">${avg}/5 <span style="color:#9CA3AF;font-weight:400">(${c.scores.length}x)</span></span>
      </div>`;
    }).join('')}
  `;
}

async function verstuurFeedback(index) {
  const l = logboekenData[index];
  const tekst = document.getElementById(`feedback-tekst-${index}`).value.trim();
  if (!tekst) {
    alert('Schrijf eerst feedback voor je verstuurt.');
    return;
  }
  try {
    await apiFetch('/docenten/logboek/feedback', {
      method: 'POST',
      body: JSON.stringify({ stage_id: l.stage_id, week: l.week, feedback: tekst })
    });
    laadLogboeken();
  } catch (err) {
    alert(err.message || 'Kon de feedback niet versturen.');
  }
}

async function goedkeuren(index) {
  const l = logboekenData[index];
  try {
    await apiFetch('/docenten/logboek/goedkeuren', {
      method: 'POST',
      body: JSON.stringify({ stage_id: l.stage_id, week: l.week })
    });
    laadLogboeken();
  } catch (err) {
    alert(err.message || 'Kon het logboek niet goedkeuren.');
  }
}

function filterTable() {
  const q = document.querySelector('.search').value.toLowerCase();
  const gefilterd = logboekenData.filter(l => l.naam.toLowerCase().includes(q));
  renderTable(gefilterd);
}

if (typeof requireAuth === 'function' && !requireAuth('docent')) throw new Error();
laadLogboeken();
