let competenties = [];
let globaleInstellingen = {};
let opleidingen = [];
let actieveOpleidingId = null;
let volgendTijdelijkId = -1; // negatieve id's voor nieuwe, nog niet opgeslagen competenties

// ============================================================
// INIT
// ============================================================

async function init() {
  try {
    // Verwacht: GET /api/admin/opleidingen
    // Response: [{ opleiding_id, naam }]
    opleidingen = await apiFetch('/admin/opleidingen');

    const select = document.getElementById('opleiding-select');
    select.innerHTML = opleidingen.map(o => `<option value="${o.opleiding_id}">Opleiding: ${o.naam}</option>`).join('');

    if (opleidingen.length > 0) {
      actieveOpleidingId = opleidingen[0].opleiding_id;
      select.value = actieveOpleidingId;
      laadCompetenties();
    }
  } catch (err) {
    console.error('Kon opleidingen niet laden:', err);
  }
}

async function laadCompetenties() {
  actieveOpleidingId = document.getElementById('opleiding-select').value;

  try {
    // Verwacht: GET /api/admin/competenties?opleiding_id=X
    // Response: {
    //   competenties: [{
    //     competentie_id, naam, omschrijving, weging,
    //     rubrieken: [{ rubriek_id, score, label, omschrijving }]
    //   }],
    //   instellingen: { max_score, aantal_logboeken, slaagdrempel }
    // }
    const data = await apiFetch(`/admin/competenties?opleiding_id=${actieveOpleidingId}`);
    competenties = data.competenties || [];
    globaleInstellingen = data.instellingen || {};

    renderCompetenties();
    renderInstellingen();
    updateTotaal();
    markeerOnopgeslagen(false);
  } catch (err) {
    console.error('Kon competenties niet laden:', err);
  }
}

// ============================================================
// RENDER
// ============================================================

function renderCompetenties() {
  const container = document.getElementById('competenties-list');

  if (competenties.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:13px;padding:30px">Nog geen competenties voor deze opleiding.</div>`;
    return;
  }

  container.innerHTML = competenties.map((c, i) => `
    <div class="competentie-card">
      <button class="btn-delete" onclick="verwijderCompetentie(${i})" title="Verwijder competentie">🗑️</button>

      <input class="editable-input" value="${escapeAttr(c.naam)}"
             oninput="updateVeld(${i}, 'naam', this.value)" placeholder="Naam van de competentie">

      <textarea class="editable-textarea" rows="1"
                oninput="updateVeld(${i}, 'omschrijving', this.value); autoGrow(this)"
                placeholder="Beschrijving">${escapeHtml(c.omschrijving)}</textarea>

      <div class="rubric-section">
        <div class="rubric-title">RUBRIC NIVEAUS (BEOORDELINGSCRITERIA)</div>
        <div class="rubric-levels">
          ${c.rubrieken.map((r, j) => `
            <div class="rubric-level">
              <div class="rubric-level-header">
                <input class="rubric-score-input" type="number" value="${r.score}"
                       onchange="updateRubriek(${i}, ${j}, 'score', this.value)">
                <input class="rubric-label-input" type="text" value="${escapeAttr(r.label)}"
                       oninput="updateRubriek(${i}, ${j}, 'label', this.value)" placeholder="Label">
              </div>
              <textarea class="rubric-desc-textarea"
                        oninput="updateRubriek(${i}, ${j}, 'omschrijving', this.value)"
                        placeholder="Beschrijving van dit niveau">${escapeHtml(r.omschrijving)}</textarea>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="weging-row">
        <span class="weging-label">Weging</span>
        <input class="weging-slider" type="range" min="0" max="100" step="5" value="${c.weging}"
               oninput="updateWeging(${i}, this.value)" style="flex:1">
        <input class="weging-value" type="number" min="0" max="100" value="${c.weging}"
               onchange="updateWeging(${i}, this.value)"> %
      </div>
    </div>
  `).join('');
}

function renderInstellingen() {
  document.getElementById('setting-max-score').value = globaleInstellingen.max_score ?? '';
  document.getElementById('setting-logboeken').value = globaleInstellingen.aantal_logboeken ?? '';
  document.getElementById('setting-slaagdrempel').value = globaleInstellingen.slaagdrempel ?? '';

  ['setting-max-score', 'setting-logboeken', 'setting-slaagdrempel'].forEach(id => {
    document.getElementById(id).oninput = () => markeerOnopgeslagen(true);
  });
}

// ============================================================
// EDIT HANDLERS
// ============================================================

function updateVeld(index, veld, waarde) {
  competenties[index][veld] = waarde;
  markeerOnopgeslagen(true);
}

function updateRubriek(compIndex, rubriekIndex, veld, waarde) {
  if (veld === 'score') waarde = Number(waarde);
  competenties[compIndex].rubrieken[rubriekIndex][veld] = waarde;
  markeerOnopgeslagen(true);
}

function updateWeging(index, waarde) {
  waarde = Math.max(0, Math.min(100, Number(waarde)));
  competenties[index].weging = waarde;
  renderCompetenties();
  updateTotaal();
  markeerOnopgeslagen(true);
}

function voegCompetentieToe() {
  competenties.push({
    competentie_id: volgendTijdelijkId--,
    naam: 'Nieuwe competentie',
    omschrijving: '',
    weging: 0,
    rubrieken: [
      { rubriek_id: volgendTijdelijkId--, score: 1, label: 'Onvoldoende', omschrijving: '' },
      { rubriek_id: volgendTijdelijkId--, score: 2, label: 'Voldoende', omschrijving: '' },
      { rubriek_id: volgendTijdelijkId--, score: 3, label: 'Goed', omschrijving: '' },
      { rubriek_id: volgendTijdelijkId--, score: 4, label: 'Zeer goed', omschrijving: '' },
      { rubriek_id: volgendTijdelijkId--, score: 5, label: 'Perfect', omschrijving: '' }
    ]
  });
  renderCompetenties();
  updateTotaal();
  markeerOnopgeslagen(true);
}

function verwijderCompetentie(index) {
  if (!confirm(`"${competenties[index].naam}" verwijderen? Dit kan niet ongedaan worden gemaakt na opslaan.`)) return;
  competenties.splice(index, 1);
  renderCompetenties();
  updateTotaal();
  markeerOnopgeslagen(true);
}

// ============================================================
// VALIDATIE
// ============================================================

function updateTotaal() {
  const totaal = competenties.reduce((sum, c) => sum + Number(c.weging || 0), 0);
  const totaalEl = document.getElementById('totaal-weging');
  const warningEl = document.getElementById('warning-banner');
  const saveBtn = document.getElementById('btn-save');

  totaalEl.textContent = totaal + '%';

  if (totaal === 100) {
    totaalEl.className = 'totaal-value ok';
    warningEl.classList.add('hidden');
    saveBtn.disabled = false;
  } else {
    totaalEl.className = 'totaal-value fout';
    document.getElementById('warning-percent').textContent = totaal + '%';
    warningEl.classList.remove('hidden');
    saveBtn.disabled = true;
  }
}

function markeerOnopgeslagen(gewijzigd) {
  updateTotaal();
  // updateTotaal regelt zelf of btn-save disabled is op basis van de 100% check.
  // Als er niets gewijzigd is, hoeft de knop niet actief te zijn.
  if (!gewijzigd) {
    document.getElementById('btn-save').disabled = true;
  }
}

// ============================================================
// OPSLAAN
// ============================================================

async function opslaanWijzigingen() {
  const totaal = competenties.reduce((sum, c) => sum + Number(c.weging || 0), 0);
  if (totaal !== 100) {
    alert('De wegingsfactoren moeten samen exact 100% zijn voordat je kan opslaan.');
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Opslaan...';

  try {
    const payload = {
      opleiding_id: actieveOpleidingId,
      competenties: competenties,
      instellingen: {
        max_score: Number(document.getElementById('setting-max-score').value),
        aantal_logboeken: Number(document.getElementById('setting-logboeken').value),
        slaagdrempel: Number(document.getElementById('setting-slaagdrempel').value)
      }
    };

    // Verwacht: POST /api/admin/competenties
    await apiFetch('/admin/competenties', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    btn.textContent = 'Opgeslagen ✓';
    setTimeout(() => { laadCompetenties(); }, 1000);
  } catch (err) {
    alert(err.message || 'Kon de wijzigingen niet opslaan.');
    btn.disabled = false;
    btn.textContent = 'Wijzigingen Opslaan';
  }
}

// ============================================================
// HELPERS
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

init();
