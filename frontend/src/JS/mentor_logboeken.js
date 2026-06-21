// ============================================================
//  mentor_logboeken.js
//  Laadt en beoordeelt logboeken per week
// ============================================================

let alleLogboeken     = [];
let huidigLogboekIdx  = null;
let huidigWeekIndex   = 0;
let huidigeTab = 'dagen';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth === 'function') {
    if (!requireAuth(['mentor', 'stagementor', 'docent', 'administrator'])) return;
  }
  laadLogboeken();
});

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
    const data = await apiFetch('/mentor/logboeken');
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
    const data = await apiFetch(`/logboek/${logId}/weken`);
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
      <td>${dag.leerpunten || '—'}</td>
    </tr>
  `).join('');

  // Zelfbeoordeling tonen
  toonZelfbeoordeling(week);

  // Docent scores tonen
  toonDocentScores(week);
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
