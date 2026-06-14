let studentenData = [];
let actieveStageId = null;
let actieveWeek = 1;
const WEKEN = [1, 2, 3, 4];

// Houdt lokale wijzigingen bij voordat ze opgeslagen worden:
// { [competentie_id]: nieuweScore }
let lokaleWijzigingen = {};
let laatsteEvaluatieData = [];

async function laadStudenten() {
  try {
    // Verwacht: GET /api/docent/evaluatie-studenten
    // Response: [{ stage_id, naam, klas, status: 'normaal' | 'te-laat', statustekst }]
    studentenData = await apiFetch('/docent/evaluatie-studenten');
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
  container.innerHTML = studentenData.map(s => {
    const isActief = s.stage_id === actieveStageId;
    const isTeLaat = s.status === 'te-laat';
    return `
    <div class="student-item ${isActief ? 'active' : ''}" onclick="selectStudent(${s.stage_id})">
      <div class="avatar ${isActief ? 'active' : (isTeLaat ? 'te-laat' : '')}">${s.naam.charAt(0)}</div>
      <div>
        <div class="student-naam">${s.naam}</div>
        <div class="student-meta ${isTeLaat ? 'te-laat' : ''}">${isTeLaat ? (s.statustekst || 'Te laat') : (s.klas || '')}</div>
      </div>
    </div>`;
  }).join('');
}

function selectStudent(stageId) {
  actieveStageId = stageId;
  actieveWeek = 1;
  lokaleWijzigingen = {};
  renderStudentList();
  renderWeekTabs();

  const s = studentenData.find(x => x.stage_id === stageId);
  if (s) {
    document.getElementById('eval-titel').textContent = `Samengebrachte score — ${s.naam}`;
  }

  laadEvaluatie();
}

function renderWeekTabs() {
  const container = document.getElementById('week-tabs');
  container.innerHTML = WEKEN.map(w => `
    <button class="week-tab ${w === actieveWeek ? 'active' : ''}" onclick="selectWeek(${w})">Week ${w}</button>
  `).join('');
}

function selectWeek(week) {
  actieveWeek = week;
  lokaleWijzigingen = {};
  renderWeekTabs();
  laadEvaluatie();
}

async function laadEvaluatie() {
  const container = document.getElementById('competenties-container');
  container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Laden...</div>`;

  try {
    // Verwacht: GET /api/docent/evaluatie?stage_id=X&week=Y
    // Response: [{
    //   competentie_id, naam, domeinen,
    //   opties: [{ score, label, beschrijving }],  // bv. [{score:0,...},{score:3,...},{score:5,...}]
    //   score_student, score_mentor,
    //   feedback_mentor, feedback_student
    // }]
    const data = await apiFetch(`/docent/evaluatie?stage_id=${actieveStageId}&week=${actieveWeek}`);
    laatsteEvaluatieData = data;
    renderCompetenties(data);
  } catch (err) {
    console.error('Kon evaluatie niet laden:', err);
    container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Kon evaluatie niet laden.</div>`;
  }
}

function renderCompetenties(data) {
  const container = document.getElementById('competenties-container');

  if (!data || data.length === 0) {
    container.innerHTML = `<div style="padding:30px;text-align:center;color:#9CA3AF;font-size:13px">Geen evaluatiedata voor deze week.</div>`;
    document.getElementById('totaal-badge').textContent = 'Totaal: — / —';
    return;
  }

  container.innerHTML = data.map(c => {
    const huidigeScore = lokaleWijzigingen.hasOwnProperty(c.competentie_id)
      ? lokaleWijzigingen[c.competentie_id]
      : c.score_mentor;

    const optiesHtml = c.opties.map(optie => {
      const isSelected = optie.score === huidigeScore;
      const isStudentScore = optie.score === c.score_student;
      const isMentorScore = optie.score === c.score_mentor;
      return `
        <div class="score-option ${isSelected ? 'selected' : ''}"
             onclick="kiesScore(${c.competentie_id}, ${optie.score})">
          ${isStudentScore ? '<span class="score-dot student"></span>' : ''}
          ${isMentorScore ? '<span class="score-dot mentor"></span>' : ''}
          <div class="score-ptn">${optie.score} ptn</div>
          <div class="score-label">${optie.label}</div>
          <div class="score-desc">${optie.beschrijving}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="competentie-card" style="margin-bottom:16px">
        <div class="competentie-grid">
          <div class="competentie-label">
            <div class="competentie-naam">${c.naam}</div>
            <div class="competentie-domeinen">${c.domeinen || ''}</div>
          </div>
          <div class="score-options">${optiesHtml}</div>
          <div class="competentie-totaal">
            <div class="competentie-totaal-value">${huidigeScore}</div>
          </div>
        </div>
        ${(c.feedback_mentor || c.feedback_student) ? `
        <div class="feedback-row">
          <div>
            <div class="feedback-label">Mentor</div>
            <div class="feedback-tekst">${c.feedback_mentor || '—'}</div>
          </div>
          <div>
            <div class="feedback-label">Student</div>
            <div class="feedback-tekst">${c.feedback_student || '—'}</div>
          </div>
        </div>` : ''}
      </div>
    `;
  }).join('');

  updateTotaal(data);
}

function kiesScore(competentieId, score) {
  lokaleWijzigingen[competentieId] = score;
  renderCompetenties(laatsteEvaluatieData);
}

function updateTotaal(data) {
  let totaalScore = 0;
  let totaalMax = 0;

  data.forEach(c => {
    const huidigeScore = lokaleWijzigingen.hasOwnProperty(c.competentie_id)
      ? lokaleWijzigingen[c.competentie_id]
      : c.score_mentor;
    totaalScore += huidigeScore;
    const maxOptie = Math.max(...c.opties.map(o => o.score));
    totaalMax += maxOptie;
  });

  document.getElementById('totaal-badge').textContent = `Totaal: ${totaalScore} / ${totaalMax}`;
}

async function opslaanScore() {
  if (Object.keys(lokaleWijzigingen).length === 0) {
    alert('Er zijn geen wijzigingen om op te slaan.');
    return;
  }

  const btn = document.getElementById('btn-opslaan');
  btn.disabled = true;
  btn.textContent = 'Opslaan...';

  try {
    // Verwacht: POST /api/docent/evaluatie/opslaan
    // Body: { stage_id, week, scores: [{ competentie_id, score }] }
    const scores = Object.entries(lokaleWijzigingen).map(([competentie_id, score]) => ({
      competentie_id: Number(competentie_id),
      score
    }));

    await apiFetch('/docent/evaluatie/opslaan', {
      method: 'POST',
      body: JSON.stringify({ stage_id: actieveStageId, week: actieveWeek, scores })
    });

    lokaleWijzigingen = {};
    btn.textContent = 'Opgeslagen ✓';
    setTimeout(() => { btn.textContent = 'Opslaan score'; btn.disabled = false; }, 1500);

    laadEvaluatie();
  } catch (err) {
    alert(err.message || 'Kon de scores niet opslaan.');
    btn.disabled = false;
    btn.textContent = 'Opslaan score';
  }
}

function filterStudents() {
  const q = document.querySelector('.search').value.toLowerCase();
  document.querySelectorAll('.student-item').forEach((item, i) => {
    const naam = studentenData[i].naam.toLowerCase();
    item.style.display = naam.includes(q) ? '' : 'none';
  });
}

laadStudenten();
