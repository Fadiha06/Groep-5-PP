// ============================================================
//  mentor_logboeken.js
//  Laadt en beoordeelt logboeken per week
// ============================================================

let alleLogboeken     = [];
let huidigLogboekIdx  = null;
let huidigWeekIndex   = 0;
let competentiesLijst = [];
let huidigeTab = 'dagen';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function') {
    if (!requireAuth(['mentor', 'stagementor', 'docent', 'administrator'])) return;
  }
  laadCompetenties().then(() => laadLogboeken());
});

// ── Laad competenties ──
async function laadCompetenties() {
  try {
    const data = await apiFetch('/competenties');
    competentiesLijst = Array.isArray(data?.competenties) ? data.competenties : (Array.isArray(data) ? data : []);
  } catch (err) {
    competentiesLijst = [];
  }
}

// ── 1. Logboeken ophalen ────────────────────────────────────
async function laadLogboeken() {
  verbergError();

  const container = document.getElementById('logboek-select');
  if (container) {
    container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        Logboeken laden...
      </div>
    `;
  }

  try {
    const data = await apiFetch('/mentors/logboeken');
    alleLogboeken = Array.isArray(data) ? data : [];
    toonLogboekSelectie(alleLogboeken);
    await selecteerVanUrl();
  } catch (err) {
    toonError(err.message || 'Kan logboeken niet laden.');
    if (container) {
      container.innerHTML = '<p class="empty-state">Fout bij laden van logboeken.</p>';
    }
  }
}

// ── Open meteen het juiste logboek/week als die via de URL zijn meegegeven ──
async function selecteerVanUrl() {
  const params = new URLSearchParams(window.location.search);
  const stageId = params.get('stage_id');
  if (!stageId) return;

  const idx = alleLogboeken.findIndex(log => String(log.logboek_id || log.id) === stageId);
  if (idx === -1) return;

  await selecteerLogboek(idx);

  const week = params.get('week');
  if (week) {
    const log = alleLogboeken[idx];
    const weekIdx = (log.weken || []).findIndex(w => String(w.weeknummer) === week);
    if (weekIdx !== -1) toonWeek(weekIdx);
  }
}

// ── 2. Logboeken selectie renderen ─────────────────────────
function toonLogboekSelectie(lijst) {
  const container = document.getElementById('logboek-select');
  if (!container) return;

  if (!lijst || lijst.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen logboeken gevonden.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
      ${lijst.map((log, idx) => {
        const naam = log.studentnaam || log.naam || '—';
        const week = log.week_nr || '?';
        const status = log.status || 'pending';

        return `
          <button
            class="logboek-select-btn"
            id="logboek-btn-${idx}"
            onclick="selecteerLogboek(${idx})"
          >
            <span class="logboek-select-btn__naam">${naam}</span>
            <span class="logboek-select-btn__week">Week ${week}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ── 3. Logboek selecteren ──────────────────────────────────
async function selecteerLogboek(idx) {
  huidigLogboekIdx = idx;
  huidigWeekIndex = 0;

  const log = alleLogboeken[idx];
  if (!log) return;

  // Button markeren
  document.querySelectorAll('.logboek-select-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`logboek-btn-${idx}`);
  if (btn) btn.classList.add('active');

  // Student info tonen
  const naam = log.studentnaam || log.naam || '—';
  const bedrijf = log.bedrijfsnaam || log.bedrijf || '—';

  stel('logboek-student-naam', naam);
  stel('logboek-student-meta', bedrijf);

  const avatar = document.getElementById('logboek-avatar');
  if (avatar) avatar.textContent = naam.charAt(0).toUpperCase();

  // Detail tonen
  const detail = document.getElementById('logboek-detail');
  if (detail) detail.classList.remove('hidden');

  // Toon docent feedback als die er is
  const docentFeedbackBox = document.getElementById('docent-feedback-box');
  if (log.docent_feedback) {
    docentFeedbackBox.style.display = 'block';
    document.getElementById('docent-feedback-tekst').textContent = log.docent_feedback;
  } else {
    docentFeedbackBox.style.display = 'none';
  }

  // Eerste week laden
  try {
    await laadLogboekWeken(log);
    toonWeek(0);
  } catch (err) {
    toonError(err.message);
  }
}

// ── 4. Logboek weken ophalen ──────────────────────────────
async function laadLogboekWeken(log) {
  const logId = log.logboek_id || log.id;

  try {
    const data = await apiFetch(`/logboeken/${logId}/weken`);
    const weken = Array.isArray(data) ? data : [];

    // Opslaan in huidge logboek
    alleLogboeken[huidigLogboekIdx].weken = weken;

    return weken;
  } catch (err) {
    console.error('Weken laden mislukt:', err);
    return [];
  }
}

// ── 5. Week tonen ──────────────────────────────────────────
function toonWeek(weekIdx) {
  const log = alleLogboeken[huidigLogboekIdx];
  if (!log) return;

  huidigWeekIndex = weekIdx;
  const weken = log.weken || [];
  const week = weken[weekIdx];

  if (!week) {
    document.getElementById('logboek-dagen').innerHTML = '';
    return;
  }

  // Knoppen updaten
  const btnVorige = document.getElementById('btn-vorige');
  const btnVolgende = document.getElementById('btn-volgende');
  if (btnVorige) btnVorige.disabled = weekIdx === 0;
  if (btnVolgende) btnVolgende.disabled = weekIdx === weken.length - 1;

  // Label updaten
  stel('week-label', `Week ${week.weeknummer || weekIdx + 1}/${weken.length}`);

  // Meta-tekst (bedrijf · week) bijwerken
  const bedrijf = log.bedrijfsnaam || log.bedrijf || '—';
  stel('logboek-student-meta', `${bedrijf} · Week ${week.weeknummer || weekIdx + 1} van ${weken.length}`);

  // Status badge
  const badge = document.getElementById('logboek-status-badge');
  if (badge) {
    let badgeClass = 'status-badge--blue';
    let badgeText = 'Ingediend';

    if (week.status === 'goedgekeurd') {
      badgeClass = 'status-badge--green';
      badgeText = 'Goedgekeurd';
    } else if (week.status === 'feedback') {
      badgeClass = 'status-badge--blue';
      badgeText = 'Feedback gegeven';
    } else if (week.status === 'draft') {
      badgeClass = 'status-badge--gray';
      badgeText = 'Concept';
    }

    badge.className = `status-badge ${badgeClass}`;
    badge.textContent = badgeText;
  }

  // Tabel vullen
  const tbody = document.getElementById('logboek-dagen');
  if (!tbody) return;

  const dagen = week.dagen || [];
  if (dagen.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Geen dagen ingevuld.</td></tr>';
    return;
  }

  tbody.innerHTML = dagen.map(dag => `
    <tr>
      <td>${formatDatum(dag.datum)}</td>
      <td style="text-align: center; font-weight: 600;">${dag.uren || 0}u</td>
      <td>${dag.taken_beschrijving || dag.taken || '—'}</td>
      <td>${dag.reflectie || '—'}</td>
    </tr>
  `).join('');

  // Zelfbeoordeling tonen
  toonZelfbeoordeling(week);

  // Docent scores tonen
  toonDocentScores(week);

  // Feedback inladen
  const feedbackEl = document.getElementById('logboek-feedback');
  if (feedbackEl) {
    feedbackEl.value = week.mentor_feedback || '';
    feedbackEl.disabled = week.status === 'goedgekeurd';
  }

  // Knop status
  const approveBtn = document.querySelector('.btn--approve');
  if (approveBtn) {
    approveBtn.disabled = week.status === 'goedgekeurd';
  }

  // Laad competenties voor scoring
  laadCompetentiesVoorScoring();
}

// ── Zelfbeoordeling tonen ──
function toonZelfbeoordeling(week) {
  const container = document.getElementById('zelfbeoordeling-inhoud');
  if (!container) return;

  const dagen = week.dagen || [];
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
    container.innerHTML = '<p style="color:#9CA3AF;font-size:13px">Geen zelfbeoordelingen gevonden voor deze week.</p>';
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

// ── Docent scores tonen ──
function toonDocentScores(week) {
  const docentScores = week.docent_scores || [];
  if (docentScores.length === 0) return;

  const container = document.getElementById('zelfbeoordeling-inhoud');
  if (!container) return;

  container.innerHTML += `
    <div style="font-size:14px;font-weight:700;color:#1E293B;margin-top:20px;margin-bottom:12px">Scores van docent</div>
    ${docentScores.map(e =>
      `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:13px">
        <span style="color:#334155">${e.competentie_naam}</span>
        <span style="font-weight:600;color:#2563EB">${e.score}/5</span>
      </div>`
    ).join('')}
  `;
}

// ── Tab wisselen ──
function toonTab(tab) {
  huidigeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  document.getElementById('tab-dagen').style.display = tab === 'dagen' ? '' : 'none';
  document.getElementById('tab-zelfbeoordeling').style.display = tab === 'zelfbeoordeling' ? '' : 'none';
  document.getElementById('tab-scoring').style.display = tab === 'scoring' ? '' : 'none';
}

// ── Laad competenties voor scoring ──
async function laadCompetentiesVoorScoring() {
  try {
    // Haal competenties op via het stage-info van de student
    const log = alleLogboeken[huidigLogboekIdx];
    if (!log) return;

    // Gebruik het logboeken endpoint om weken te krijgen met scores
    const weken = log.weken || [];
    const week = weken[huidigWeekIndex];
    if (!week) return;

    // Bestaande mentor scores
    const mentorScores = {};
    (week.mentor_scores || []).forEach(e => { mentorScores[e.competentie_id] = e.score; });

    // Haal competenties op
    const comps = await apiFetch('/competenties');
    competentiesLijst = Array.isArray(comps) ? comps : [];

    const lijst = document.getElementById('scoring-lijst');
    if (!lijst) return;

    lijst.innerHTML = competentiesLijst.map(c => {
      const huidig = mentorScores[c.competentie_id] || '';
      return `
        <div class="scoring-rij">
          <span class="scoring-naam">${c.naam}</span>
          <div class="scoring-knoppen">
            ${[1,2,3,4,5].map(n => `
              <button class="score-btn ${huidig === n ? 'score-btn--active' : ''}"
                data-comp="${c.competentie_id}" data-score="${n}"
                onclick="selecteerScore(this, ${c.competentie_id}, ${n})"
              >${n}</button>
            `).join('')}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Competenties laden mislukt:', err);
  }
}

function selecteerScore(btn, compId, score) {
  document.querySelectorAll(`.score-btn[data-comp="${compId}"]`).forEach(b => {
    b.classList.remove('score-btn--active');
  });
  btn.classList.add('score-btn--active');
}

// ── 6. Week navigatie ──────────────────────────────────────
function vorigeWeek() {
  if (huidigWeekIndex > 0) toonWeek(huidigWeekIndex - 1);
}

function volgendeWeek() {
  const log = alleLogboeken[huidigLogboekIdx];
  const weken = log?.weken || [];
  if (huidigWeekIndex < weken.length - 1) toonWeek(huidigWeekIndex + 1);
}

// ── 7. Scores opslaan ──────────────────────────────────────
async function slaScoresOp() {
  const log = alleLogboeken[huidigLogboekIdx];
  if (!log || !log.weken) return;

  const week = log.weken[huidigWeekIndex];
  const scores = {};

  document.querySelectorAll('.score-btn--active').forEach(btn => {
    scores[btn.dataset.comp] = Number(btn.dataset.score);
  });

  if (Object.keys(scores).length === 0) {
    alert('Selecteer eerst scores voor ten minste één competentie.');
    return;
  }

  try {
    await apiFetch('/mentors/logboek/evaluatie', {
      method: 'POST',
      body: JSON.stringify({
        stage_id: log.logboek_id || log.id,
        weeknummer: week.weeknummer || huidigWeekIndex + 1,
        scores
      })
    });

    // Update lokale data
    week.mentor_scores = Object.entries(scores).map(([compId, score]) => ({
      competentie_id: Number(compId),
      score,
      competentie_naam: competentiesLijst.find(c => c.competentie_id == compId)?.naam || ''
    }));

    toonWeek(huidigWeekIndex);
    toonSucces('Scores opgeslagen.');
  } catch (err) {
    console.error('Scores opslaan mislukt:', err);
    alert(`Fout: ${err.message}`);
  }
}

// ── 8. Concept opslaan ─────────────────────────────────────
async function slaConceptOp() {
  const log = alleLogboeken[huidigLogboekIdx];
  if (!log || !log.weken) return;

  const week = log.weken[huidigWeekIndex];
  const feedback = document.getElementById('logboek-feedback').value.trim();

  try {
    await apiFetch('/mentors/logboek/feedback', {
      method: 'POST',
      body: JSON.stringify({
        stage_id: log.logboek_id || log.id,
        weeknummer: week.weeknummer || huidigWeekIndex + 1,
        feedback
      })
    });

    week.mentor_feedback = feedback;
    toonSucces('Feedback concept opgeslagen.');
  } catch (err) {
    console.error('Opslaan mislukt:', err);
    alert(`Fout: ${err.message}`);
  }
}

// ── 9. Goedkeuren ─────────────────────────────────────────
async function keurGoed() {
  const log = alleLogboeken[huidigLogboekIdx];
  if (!log || !log.weken) return;

  const week = log.weken[huidigWeekIndex];
  const feedback = document.getElementById('logboek-feedback').value.trim();

  try {
    // Sla eerst feedback op
    if (feedback) {
      await apiFetch('/mentors/logboek/feedback', {
        method: 'POST',
        body: JSON.stringify({
          stage_id: log.logboek_id || log.id,
          weeknummer: week.weeknummer || huidigWeekIndex + 1,
          feedback
        })
      });
    }

    // Keur dan goed
    await apiFetch('/mentors/logboek/goedkeuren', {
      method: 'POST',
      body: JSON.stringify({
        stage_id: log.logboek_id || log.id,
        weeknummer: week.weeknummer || huidigWeekIndex + 1
      })
    });

    // Status lokaal updaten
    week.status = 'goedgekeurd';
    week.mentor_feedback = feedback;

    toonWeek(huidigWeekIndex);
    toonSucces('Logboek goedgekeurd en feedback opgeslagen.');

  } catch (err) {
    console.error('Goedkeuren mislukt:', err);
    alert(`Fout: ${err.message}`);
  }
}

// ── Modal ──────────────────────────────────────────────────
function toonSucces(bericht) {
  stel('modal-msg', bericht);
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.remove('hidden');
}

function sluitModal() {
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.add('hidden');
}

// ── Hulpfuncties ──────────────────────────────────────────
function stel(id, tekst) {
  const el = document.getElementById(id);
  if (el) el.textContent = tekst;
}

function formatDatum(datum) {
  if (!datum) return '—';
  try {
    return new Date(datum).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return datum;
  }
}

function toonError(bericht) {
  const el = document.getElementById('error-banner');
  if (el) {
    el.textContent = `Fout: ${bericht}`;
    el.classList.remove('hidden');
  }
}

function verbergError() {
  const el = document.getElementById('error-banner');
  if (el) el.classList.add('hidden');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('rol');
  localStorage.removeItem('userId');
  window.location.href = 'index.html';
}
