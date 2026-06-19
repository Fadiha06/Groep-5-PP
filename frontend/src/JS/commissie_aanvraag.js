let alleStages = [];
let huidigIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['stagecommissie', 'commissie', 'administrator'])) return;
  loadDossier();
});

async function loadDossier() {
  toonLoading(true);
  verbergError();

  try {
    // Haal alle stages op
    const stages = await apiFetch('/stage/all');

    // Filter enkel in_aanvraag
    alleStages = stages.filter(s => s.status === 'in_aanvraag');

    // Badge bijwerken in sidebar
    const badge = document.getElementById('badge-nieuwe-aanvragen');
    if (badge) badge.textContent = alleStages.length;

    if (alleStages.length === 0) {
      toonLoading(false);
      document.getElementById('dossier-title').textContent = 'Geen openstaande aanvragen';
      document.getElementById('dossier-status').textContent = 'Alles beoordeeld';
      return;
    }

    // Kijk of er een ?id= in de URL staat
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('id');

    if (urlId) {
      const gevonden = alleStages.findIndex(s => String(s.stage_id) === String(urlId));
      huidigIndex = gevonden >= 0 ? gevonden : 0;
    } else {
      huidigIndex = 0;
    }

    toonDossier(huidigIndex);

  } catch (err) {
    console.error('Laad fout:', err);
    toonError(err.message);
  } finally {
    toonLoading(false);
  }
}

function toonDossier(index) {
  const stage = alleStages[index];
  if (!stage) return;

  // Reset radio buttons
  document.querySelectorAll('input[name="beslissing"]').forEach(r => r.checked = false);
  document.getElementById('interne-nota').value = '';
  document.getElementById('submit-feedback').hidden = true;

  // Paginatitel
  document.getElementById('dossier-title').textContent =
    `Dossier ${index + 1} van ${alleStages.length}`;

  // Status badge
  const statusEl = document.getElementById('dossier-status');
  statusEl.textContent = stage.status || '—';
  statusEl.className = 'status-badge status-badge--pending';

  // Meta info
  document.getElementById('dossier-ingediend').textContent =
    stage.startdatum ? `Start: ${formatDatum(stage.startdatum)}` : 'Startdatum onbekend';
  document.getElementById('dossier-opleiding').textContent = 'Toegepaste Informatica';

  // === STUDENT ===
  document.getElementById('student-naam').textContent = stage.studentnaam || '—';
  document.getElementById('student-nummer').textContent = stage.studentnummer || '—';
  document.getElementById('student-opleiding').textContent = stage.opleiding || 'Toegepaste Informatica';
  document.getElementById('student-jaar').textContent = stage.academiejaar || '—';

  // === BEDRIJF ===
  document.getElementById('bedrijf-naam').textContent = stage.bedrijfsnaam || '—';
  document.getElementById('bedrijf-afdeling').textContent = stage.bedrijf_afdeling || '—';
  document.getElementById('bedrijf-mentor').textContent = stage.mentornaam || '—';
  const emailEl = document.getElementById('bedrijf-email');
  emailEl.textContent = stage.mentoremail || '—';
  emailEl.href = stage.mentoremail ? `mailto:${stage.mentoremail}` : '#';
  document.getElementById('bedrijf-adres').textContent = stage.bedrijf_adres || '—';
  document.getElementById('bedrijf-sector').textContent = stage.bedrijf_sector || '—';

  // === OPDRACHT ===
  document.getElementById('opdracht-titel').textContent = stage.titel || '—';
  document.getElementById('opdracht-omschrijving').textContent = stage.omschrijving || '—';
  document.getElementById('opdracht-competenties').textContent = stage.leerdoelen || stage.verwachte_competenties || '—';

  // === PLANNING ===
  document.getElementById('planning-start').textContent =
    stage.startdatum ? formatDatum(stage.startdatum) : '—';
  document.getElementById('planning-eind').textContent =
    stage.einddatum ? formatDatum(stage.einddatum) : '—';
  document.getElementById('planning-regeling').textContent = stage.werkregeling || '—';
  document.getElementById('planning-uren').textContent = stage.uren_per_week ? `${stage.uren_per_week} uren` : '—';

  // === OPMERKINGEN ===
  document.getElementById('opmerkingen-list').innerHTML =
    '<p class="empty-state">Geen vorige opmerkingen.</p>';

  // === NAVIGATIE KNOPPEN ===
  document.getElementById('btn-vorige').disabled = index === 0;
  document.getElementById('btn-volgende').disabled = index === alleStages.length - 1;
}

function navigateDossier(richting) {
  const nieuw = huidigIndex + richting;
  if (nieuw < 0 || nieuw >= alleStages.length) return;
  huidigIndex = nieuw;
  toonDossier(huidigIndex);
}

async function submitBeslissing() {
  const gekozen = document.querySelector('input[name="beslissing"]:checked');

  if (!gekozen) {
    alert('Kies eerst een beslissing (Goedkeuren, Conditie of Weigeren).');
    return;
  }

  // Map radio waarde naar API status
  const statusMap = {
    goedkeuren: 'goedgekeurd',
    conditie: 'conditie',
    weigeren: 'geweigerd'
  };

  const status = statusMap[gekozen.value];
  const stage = alleStages[huidigIndex];

  const btn = document.getElementById('btn-bevestigen');
  btn.disabled = true;
  btn.textContent = 'Bezig…';

  const interneNota = document.getElementById('interne-nota').value.trim();

  try {
    await apiFetch(`/stage/${stage.stage_id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reden_weigering: interneNota })
    });

    // Toon succesmelding
    const feedback = document.getElementById('submit-feedback');
    feedback.hidden = false;
    feedback.style.color = '#22c55e';
    feedback.textContent = `✓ Beslissing opgeslagen: ${status}`;

    // Verwijder dit dossier uit de lijst
    alleStages.splice(huidigIndex, 1);

    // Wacht 1.5 seconden dan ga naar volgende of dashboard
    setTimeout(() => {
      if (alleStages.length === 0) {
        alert('Alle aanvragen zijn beoordeeld!');
        window.location.href = 'commissie_dashboard.html';
      } else {
        if (huidigIndex >= alleStages.length) {
          huidigIndex = alleStages.length - 1;
        }
        toonDossier(huidigIndex);
        btn.disabled = false;
        btn.textContent = 'Beslissing bevestigen';
      }
    }, 1500);

  } catch (err) {
    console.error('Submit fout:', err);
    const feedback = document.getElementById('submit-feedback');
    feedback.hidden = false;
    feedback.style.color = '#ef4444';
    feedback.textContent = `✗ Fout: ${err.message}`;
    btn.disabled = false;
    btn.textContent = 'Beslissing bevestigen';
  }
}

// === HULPFUNCTIES ===

function formatDatum(datum) {
  if (!datum) return '—';
  const d = new Date(datum);
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toonLoading(toon) {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = toon ? 'flex' : 'none';
}

function toonError(bericht) {
  const banner = document.getElementById('error-banner');
  const msg = document.getElementById('error-message');
  if (banner) banner.hidden = false;
  if (msg) msg.textContent = bericht;
}

function verbergError() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.hidden = true;
}