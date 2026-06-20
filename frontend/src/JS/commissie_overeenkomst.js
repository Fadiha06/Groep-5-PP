let contractData = null;
let checklistState = {}; // { [item_id]: boolean } — lokale wijzigingen aan de checklist
let wachtrij = []; // array van contract_id's, voor Vorige/Volgende navigatie
let huidigeIndex = -1;
let sigCtx = null;
let sigDrawing = false;
let heeftHandtekening = false;

// Stagecommissie mag controleren/tekenen/goed- of afkeuren; admin krijgt enkel read-only inzage.
function isReadOnly() {
  const rol = (localStorage.getItem('rol') || '').toLowerCase();
  return rol === 'admin' || rol === 'administrator';
}

function dashboardUrl() {
  return isReadOnly() ? 'admin_dashboard.html' : 'commissie_dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['stagecommissie', 'commissie', 'admin', 'administrator'])) return;

  const contractId = getContractIdFromUrl();
  if (!contractId) {
    // Haal de wachtrij op en ga naar de eerste
    fetchAndRedirectToFirst();
    return;
  }

  laadWachtrij(contractId);
  laadContract(contractId);

  document.getElementById('btn-vorige').addEventListener('click', () => navigeer(-1));
  document.getElementById('btn-volgende').addEventListener('click', () => navigeer(1));
});

// ============================================================
// URL / Navigatie
// ============================================================
function getContractIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function fetchAndRedirectToFirst() {
  try {
    const items = await apiFetch('/commissie/dashboard/actie-vereist');
    if (items.length > 0) {
      window.location.href = `commissie_overeenkomst.html?id=${items[0].contract_id}`;
    } else {
      toonFout('Er zijn momenteel geen overeenkomsten die wachten op juridische controle.');
    }
  } catch (err) {
    console.error(err);
    toonFout('Kon de lijst met overeenkomsten niet laden.');
  }
}

async function laadWachtrij(contractId) {
  try {
    // Verwacht: GET /api/commissie/dashboard/actie-vereist
    // Response: [{ contract_id, ... }]
    const items = await apiFetch('/commissie/dashboard/actie-vereist');
    wachtrij = items.map(i => i.contract_id);
    huidigeIndex = wachtrij.indexOf(Number(contractId));
    updatePaginationButtons();
  } catch (err) {
    console.error('Kon wachtrij niet laden:', err);
    wachtrij = [];
    huidigeIndex = -1;
    updatePaginationButtons();
  }
}

function updatePaginationButtons() {
  const vorigeBtn = document.getElementById('btn-vorige');
  const volgendeBtn = document.getElementById('btn-volgende');

  vorigeBtn.disabled = huidigeIndex <= 0;
  volgendeBtn.disabled = huidigeIndex === -1 || huidigeIndex >= wachtrij.length - 1;
}

function navigeer(richting) {
  const nieuweIndex = huidigeIndex + richting;
  if (nieuweIndex < 0 || nieuweIndex >= wachtrij.length) return;

  const nieuwContractId = wachtrij[nieuweIndex];
  window.location.href = `commissie_overeenkomst.html?id=${nieuwContractId}`;
}

// ============================================================
// Contract laden & renderen
// ============================================================
async function laadContract(contractId) {
  try {
    // Verwacht: GET /api/commissie/contracten/:id/controle
    // Response: {
    //   contract_id, bedrijf_naam, student_naam, opleiding,
    //   periode_start, periode_eind, status_contract, ingediend_op,
    //   handtekeningen: {
    //     student: { naam, getekend_op, status: 'aanwezig' | 'ontbreekt' },
    //     mentor:  { naam, getekend_op, status: 'aanwezig' | 'ontbreekt' },
    //     instelling: { naam, getekend_op, status: 'aanwezig' | 'ontbreekt' }
    //   },
    //   checklist: [{ item_id, label, verplicht, afgevinkt }],
    //   opmerking: string | null
    // }
    contractData = await apiFetch(`/commissie/contracten/${contractId}/controle`);

    checklistState = {};
    contractData.checklist.forEach(item => {
      checklistState[item.item_id] = item.afgevinkt;
    });

    renderContract();
  } catch (err) {
    console.error('Kon contract niet laden:', err);
    toonFout('Kon dit contract niet laden.');
  }
}

function toonFout(bericht) {
  document.getElementById('detail-card').innerHTML = `
    <div style="text-align:center;color:#9CA3AF;font-size:13px;padding:40px">${bericht}</div>
  `;
}

function renderContract() {
  const c = contractData;
  const allesOk = isAllesGoedgekeurd();
  const readOnly = isReadOnly();
  const toontHandtekenen = !readOnly && c.handtekeningen.instelling.status !== 'aanwezig';

  document.getElementById('read-only-banner').style.display = readOnly ? '' : 'none';

  document.getElementById('detail-card').innerHTML = `
    <div class="detail-header">
      <div class="detail-title">Overeenkomst controleren</div>
      <div class="detail-sub">Juridische controle voor verzending naar mentor. Velden zijn read-only tenzij anders aangegeven.</div>
    </div>

    ${c.status_contract === 'in_afwachting' ? `
    <div class="warn-banner">
      <span class="warn-icon">⚠</span>
      <div class="warn-text">Deze overeenkomst wacht op juridische goedkeuring voordat ze verzonden kan worden. Controleer alle punten hieronder aandachtig.</div>
    </div>` : ''}

    <div>
      <div class="section-label" style="margin-bottom:16px">Contractgegevens</div>
      <div class="info-grid">
        <div class="info-field">
          <div class="info-label">Student</div>
          <div class="info-value">${c.student_naam}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Bedrijf</div>
          <div class="info-value">${c.bedrijf_naam}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Opleiding</div>
          <div class="info-value">${c.opleiding}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Periode</div>
          <div class="info-value">${formatDatum(c.periode_start)} – ${formatDatum(c.periode_eind)}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Status contract</div>
          <div class="info-value">${formatContractStatus(c.status_contract)}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Ingediend op</div>
          <div class="info-value">${formatDatumLang(c.ingediend_op)}</div>
        </div>
      </div>
    </div>

    <div>
      <div class="section-label" style="margin-bottom:16px">Handtekeningen Status</div>
      <div class="signature-row">
        ${renderSignature('Student', c.handtekeningen.student)}
        ${renderSignature('Mentor / Bedrijf', c.handtekeningen.mentor)}
        ${renderSignature('Instelling', c.handtekeningen.instelling)}
      </div>
    </div>

    <div>
      <div class="section-label" style="margin-bottom:16px">Juridische controlelijst</div>
      <div class="checklist" id="checklist">
        ${c.checklist.map(item => renderChecklistItem(item, readOnly)).join('')}
      </div>
    </div>

    <div>
      <div class="section-label" style="margin-bottom:16px">Commentaar / Opmerkingen</div>
      <textarea class="comment-box" id="opmerking" ${readOnly ? 'readonly' : ''} placeholder="Voeg een juridische opmerking toe voor de dossierhouder of student... (bijv: 'Verzekeringsattest ontbreekt nog')">${c.opmerking || ''}</textarea>
    </div>

    ${toontHandtekenen ? document.getElementById('signature-template').innerHTML : ''}

    ${readOnly ? '' : `
    <div class="detail-footer">
      <div class="footer-note">Alle <strong>verplichte</strong> punten moeten aangevinkt zijn, en je handtekening geplaatst, voor goedkeuring.</div>
      <div class="footer-actions">
        <button class="btn-opslaan" id="btn-opslaan" onclick="opslaan()">Opslaan</button>
        <button class="btn-afwijzen" id="btn-afwijzen" onclick="afwijzen()">Afwijzen</button>
        <button class="btn-goedkeuren" id="btn-goedkeuren" onclick="goedkeurenEnVerzenden()" ${allesOk ? '' : 'disabled'}>Goedkeuren, tekenen & verzenden</button>
      </div>
    </div>
    `}
  `;

  // Checkbox listeners (enkel actief als niet read-only)
  if (!readOnly) {
    c.checklist.forEach(item => {
      const checkbox = document.getElementById(`check-${item.item_id}`);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          checklistState[item.item_id] = e.target.checked;
          updateChecklistItemStyle(item.item_id, item.verplicht);
          updateGoedkeurenButton();
        });
      }
    });
  }

  if (toontHandtekenen) {
    initSignaturePad();
  }
}

// ============================================================
// Handtekening (canvas)
// ============================================================
function initSignaturePad() {
  heeftHandtekening = false;
  const canvas = document.getElementById('sig-canvas');
  sigCtx = canvas.getContext('2d');

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = 160;
    canvas.width = w * ratio; canvas.height = h * ratio;
    sigCtx.scale(ratio, ratio);
    sigCtx.strokeStyle = '#1E40AF'; sigCtx.lineWidth = 2; sigCtx.lineCap = 'round'; sigCtx.lineJoin = 'round';
  }
  resizeCanvas();

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return { x: s.clientX - r.left, y: s.clientY - r.top };
  }
  canvas.addEventListener('mousedown', e => { sigDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', e => { if (!sigDrawing) return; const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); heeftHandtekening = true; });
  canvas.addEventListener('mouseup', () => sigDrawing = false);
  canvas.addEventListener('mouseleave', () => sigDrawing = false);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); sigDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!sigDrawing) return; const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); heeftHandtekening = true; }, { passive: false });
  canvas.addEventListener('touchend', () => sigDrawing = false);

  document.getElementById('btn-wis-handtekening').addEventListener('click', () => { resizeCanvas(); heeftHandtekening = false; });
}

function renderSignature(label, sig) {
  const isAanwezig = sig.status === 'aanwezig';
  return `
    <div class="sig-card ${isAanwezig ? '' : 'missing'}">
      <div class="sig-label">${label}</div>
      <div class="sig-name">${sig.naam}</div>
      <div class="sig-meta">${isAanwezig ? 'Ondertekend op: ' + formatDatum(sig.getekend_op) : 'Nog niet ondertekend'}</div>
      <div class="sig-status ${isAanwezig ? 'aanwezig' : 'ontbreekt'}">
        <span class="sig-dot ${isAanwezig ? 'aanwezig' : 'ontbreekt'}"></span>
        ${isAanwezig ? 'Aanwezig' : 'Ontbreekt'}
      </div>
    </div>
  `;
}

function renderChecklistItem(item, readOnly) {
  const afgevinkt = checklistState[item.item_id];
  const isProbleem = item.verplicht && !afgevinkt;

  let tagHtml;
  if (item.verplicht) {
    tagHtml = `<span class="check-tag verplicht ${isProbleem ? 'missing' : ''}">Verplicht</span>`;
  } else {
    tagHtml = `<span class="check-tag optioneel">Optioneel</span>`;
  }

  return `
    <div class="check-item ${isProbleem ? 'unchecked-required' : ''}" id="checkitem-${item.item_id}">
      <input type="checkbox" id="check-${item.item_id}" ${afgevinkt ? 'checked' : ''} ${readOnly ? 'disabled' : ''}>
      <div class="check-label">${item.label}</div>
      ${tagHtml}
    </div>
  `;
}

function updateChecklistItemStyle(itemId, verplicht) {
  const afgevinkt = checklistState[itemId];
  const isProbleem = verplicht && !afgevinkt;
  const itemEl = document.getElementById(`checkitem-${itemId}`);
  const tagEl = itemEl.querySelector('.check-tag');

  itemEl.classList.toggle('unchecked-required', isProbleem);
  if (verplicht) {
    tagEl.classList.toggle('missing', isProbleem);
  }
}

function isAllesGoedgekeurd() {
  return contractData.checklist
    .filter(item => item.verplicht)
    .every(item => checklistState[item.item_id]);
}

function updateGoedkeurenButton() {
  document.getElementById('btn-goedkeuren').disabled = !isAllesGoedgekeurd();
}

// ============================================================
// Acties
// ============================================================
async function opslaan() {
  const btn = document.getElementById('btn-opslaan');
  btn.disabled = true;
  btn.textContent = 'Opslaan...';

  try {
    const payload = buildPayload();

    // Verwacht: PATCH /api/commissie/contracten/:id/controle
    await apiFetch(`/commissie/contracten/${contractData.contract_id}/controle`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    btn.textContent = 'Opgeslagen ✓';
    setTimeout(() => { btn.textContent = 'Opslaan'; btn.disabled = false; }, 1500);
  } catch (err) {
    alert(err.message || 'Kon niet opslaan.');
    btn.disabled = false;
    btn.textContent = 'Opslaan';
  }
}

async function afwijzen() {
  if (!confirm('Deze overeenkomst afwijzen? De student en mentor worden hiervan op de hoogte gebracht.')) return;

  const btn = document.getElementById('btn-afwijzen');
  btn.disabled = true;
  btn.textContent = 'Afwijzen...';

  try {
    const payload = buildPayload();

    // Verwacht: POST /api/commissie/contracten/:id/afwijzen
    await apiFetch(`/commissie/contracten/${contractData.contract_id}/afwijzen`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    alert('Overeenkomst afgewezen.');
    terugNaarDashboardOfVolgende();
  } catch (err) {
    alert(err.message || 'Kon niet afwijzen.');
    btn.disabled = false;
    btn.textContent = 'Afwijzen';
  }
}

async function goedkeurenEnVerzenden() {
  if (!isAllesGoedgekeurd()) {
    alert('Alle verplichte punten moeten aangevinkt zijn voordat je kan goedkeuren.');
    return;
  }

  const moetTekenen = contractData.handtekeningen.instelling.status !== 'aanwezig';
  if (moetTekenen && !heeftHandtekening) {
    alert('Plaats eerst je handtekening voordat je kan goedkeuren.');
    return;
  }

  const btn = document.getElementById('btn-goedkeuren');
  btn.disabled = true;
  btn.textContent = 'Verzenden...';

  try {
    const payload = buildPayload();
    if (moetTekenen) {
      payload.signature = document.getElementById('sig-canvas').toDataURL('image/png');
    }

    // Verwacht: POST /api/commissie/contracten/:id/goedkeuren
    await apiFetch(`/commissie/contracten/${contractData.contract_id}/goedkeuren`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    alert('Overeenkomst goedgekeurd, getekend en verzonden naar student en bedrijf.');
    terugNaarDashboardOfVolgende();
  } catch (err) {
    alert(err.message || 'Kon niet goedkeuren.');
    btn.disabled = false;
    btn.textContent = 'Goedkeuren, tekenen & verzenden';
  }
}

function buildPayload() {
  return {
    checklist: Object.entries(checklistState).map(([item_id, afgevinkt]) => ({
      item_id: Number(item_id),
      afgevinkt
    })),
    opmerking: document.getElementById('opmerking').value
  };
}

function terugNaarDashboardOfVolgende() {
  // Probeer naar het volgende item in de wachtrij te gaan; anders terug naar dashboard
  if (huidigeIndex !== -1 && huidigeIndex < wachtrij.length - 1) {
    window.location.href = `commissie_overeenkomst.html?id=${wachtrij[huidigeIndex + 1]}`;
  } else {
    window.location.href = dashboardUrl();
  }
}

// ============================================================
// HELPERS
// ============================================================
function formatDatum(datumStr) {
  if (!datumStr) return '-';
  const d = new Date(datumStr);
  if (isNaN(d)) return datumStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
function formatDatumLang(datumStr) {
  if (!datumStr) return '-';
  const d = new Date(datumStr);
  if (isNaN(d)) return datumStr;
  return `${d.getDate()} ${capitalize(MAANDEN[d.getMonth()])} ${d.getFullYear()}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatContractStatus(status) {
  const map = {
    in_afwachting: 'In afwachting',
    goedgekeurd: 'Goedgekeurd',
    geweigerd: 'Geweigerd',
    verzonden: 'Verzonden'
  };
  return map[status] || status;
}
