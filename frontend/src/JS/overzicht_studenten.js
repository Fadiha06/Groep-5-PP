let studentenData = [];
let actieveStudentId = null;
let huidigeMeldingen = [];
let actieveMeldingFilter = 'alles';

async function laadStudenten() {
  try {
    // Verwacht: GET /api/docent/dossiers
    // Response: [{ stage_id, naam, opleiding, bedrijf, email, telefoon,
    //              bedrijf_adres, mentor_naam, mentor_email,
    //              startdatum, einddatum, huidige_fase, meldingen: [...] }]
    studentenData = await apiFetch('/docent/dossiers');

    renderStudentList();
    if (studentenData.length > 0) {
      selectStudent(studentenData[0].stage_id);
    }
  } catch (err) {
    console.error('Kon studenten niet laden:', err);
  }
}

function renderStudentList() {
  const container = document.getElementById('student-items');
  container.innerHTML = studentenData.map(s => `
    <div class="student-item ${s.stage_id === actieveStudentId ? 'active' : ''}" onclick="selectStudent(${s.stage_id})">
      <div class="avatar ${s.stage_id === actieveStudentId ? 'av-blauw' : 'av-grijs'}">${s.naam.charAt(0)}</div>
      <div>
        <div class="student-naam">${s.naam}</div>
        <div class="student-meta">${s.opleiding} • ${s.bedrijf}</div>
      </div>
    </div>
  `).join('');
}

function selectStudent(stageId) {
  actieveStudentId = stageId;
  renderStudentList();
  const s = studentenData.find(x => x.stage_id === stageId);
  if (!s) return;
  renderDetail(s);
}

function renderDetail(s) {
  const container = document.getElementById('detail-container');

  // Info
  document.getElementById('info-naam').textContent = `${s.naam} (${s.opleiding})`;
  document.getElementById('info-contact').innerHTML = `${s.email}<br>${s.telefoon || '—'}`;
  document.getElementById('info-bedrijf').textContent = s.bedrijf;
  document.getElementById('info-adres').textContent = s.bedrijf_adres || '—';
  document.getElementById('info-mentor').textContent = s.mentor_naam || '—';
  document.getElementById('info-mentor-email').textContent = s.mentor_email || '—';
  document.getElementById('info-periode').textContent = `${s.startdatum} – ${s.einddatum}`;

  // Voortgang tijdlijn
  renderTimeline(s);

  // Meldingen
  document.getElementById('meldingen-titel').textContent = `Actuele Meldingen & Rapporten (${s.naam.split(' ')[0]})`;
  huidigeMeldingen = s.meldingen || [];
  actieveMeldingFilter = 'alles';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('filter-alles-count').classList.add('active');
  renderMeldingen(huidigeMeldingen);
}

function renderTimeline(s) {
  const fases = ['start', 'tussentijds1', 'huidig', 'tussentijds2', 'einde'];
  const labels = {
    start: ['Start', s.startdatum],
    tussentijds1: ['Tussentijds 1', '—'],
    huidig: [s.huidige_fase_label || 'Huidig', 'Huidig'],
    tussentijds2: ['Tussentijds 2', '—'],
    einde: ['Einde Stage', s.einddatum]
  };
  const huidigeIndex = fases.indexOf(s.huidige_fase || 'huidig');

  const stepsHtml = fases.map((fase, i) => {
    let dotClass = 'todo';
    let labelClass = '';
    if (i < huidigeIndex) { dotClass = 'done'; labelClass = 'done'; }
    else if (i === huidigeIndex) { dotClass = 'current'; labelClass = 'current'; }
    return `
      <div class="tl-step">
        <div class="tl-dot ${dotClass}">${dotClass === 'done' ? '✓' : ''}</div>
        <div class="tl-label ${labelClass}">${labels[fase][0]}</div>
        <div class="tl-sublabel">${labels[fase][1]}</div>
      </div>
    `;
  }).join('');

  const progressPct = huidigeIndex > 0 ? (huidigeIndex / (fases.length - 1)) * 100 : 0;
  document.getElementById('tl-progress').style.width = progressPct + '%';
  document.getElementById('tl-steps').innerHTML = stepsHtml;
}

function renderMeldingen(meldingen) {
  const grid = document.getElementById('meldingen-grid');
  document.getElementById('filter-alles-count').textContent = `Alles (${huidigeMeldingen.length})`;

  if (meldingen.length === 0) {
    grid.innerHTML = `<div style="font-size:13px;color:#9CA3AF;padding:20px">Geen meldingen${actieveMeldingFilter !== 'alles' ? ' van dit type' : ''} voor deze student.</div>`;
    return;
  }

  grid.innerHTML = meldingen.map(m => `
    <div class="melding-card ${m.type}">
      <div class="melding-header">
        <span class="melding-dot ${m.type === 'kritiek' ? 'dot-rood' : 'dot-oranje'}"></span>
        <span class="melding-titel">${m.titel}</span>
        <span class="melding-badge ${m.type === 'kritiek' ? 'badge-kritiek' : 'badge-waarschuwing'}">${m.type === 'kritiek' ? 'Kritiek' : 'Waarschuwing'}</span>
      </div>
      <div class="melding-tekst">${m.tekst}</div>
      <div class="melding-footer">
        <span>${m.bron}</span>
        <span>${m.tijd}</span>
      </div>
    </div>
  `).join('');
}

function setMeldingFilter(type, btn) {
  actieveMeldingFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const gefilterd = type === 'alles'
    ? huidigeMeldingen
    : huidigeMeldingen.filter(m => m.type === type);

  renderMeldingen(gefilterd);
}

function filterStudents() {
  const q = document.querySelector('.search').value.toLowerCase();
  document.querySelectorAll('.student-item').forEach((item, i) => {
    const naam = studentenData[i].naam.toLowerCase();
    item.style.display = naam.includes(q) ? '' : 'none';
  });
}

laadStudenten();
