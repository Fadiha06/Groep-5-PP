async function loadDashboard() {
  if (!requireAuth('student')) return;

  try {
    const data = await apiFetch('/studenten/dashboard');
    const naamEl = document.getElementById('student-naam');
    if (naamEl && data.student && data.student.naam) naamEl.textContent = data.student.naam.split(' ')[0];

    const stage = data.stageproces;
    if (!stage) {
      updateNavLeeg();
      return;
    }

    // Redirect alleen als stage nog niet goedgekeurd of actief is
    const toegestaneStatussen = ['goedgekeurd', 'actief'];
    if (!toegestaneStatussen.includes(stage.status)) {
      window.location.href = 'student_voorstel_response.html';
      return;
    }

    // Stage is goedgekeurd of actief - verberg lege staat
    document.getElementById('empty-hero').style.display = 'none';
    document.getElementById('info-row').style.display = 'none';
    document.getElementById('page-sub').textContent = 'Hier vind je de status van je lopende stage.';

    const volledigGetekend = !!(stage.student_getekend && stage.mentor_getekend && stage.docent_getekend);
    updateNav(volledigGetekend);

    renderActieBanner(stage, data.logboekDezeWeek, volledigGetekend);
    renderStatCards(stage, data.stats, data.logboekDezeWeek);
    renderTimeline(stage);
    renderLogboekLijst(data.logboekDezeWeek);

    document.getElementById('actie-banner').style.display = '';
    document.getElementById('stat-cards').style.display = '';
    document.getElementById('dash-grid').style.display = '';

  } catch (err) {
    console.error(err);
    updateNav(false);
  }
}

function updateNavLeeg() {
  const nav = document.querySelector('.sb-nav');
  if (!nav) return;
  nav.innerHTML = '<a class="sb-item active" href="stageaanvraag.html">Mijn stage</a>';
}

function updateNav(contractVolledig) {
  const nav = document.querySelector('.sb-nav');
  if (!nav) return;

  const links = [
    { tekst: 'Dashboard',    href: 'student_dashboard.html', altijd: true },
    { tekst: 'Contract',     href: 'contract.html',           altijd: true },
    { tekst: 'Logboek',      href: 'logboek.html',            altijd: false },
    { tekst: 'Evaluaties',   href: 'evaluaties.html',         altijd: false },
  ];

  nav.innerHTML = links.map(function(l) {
    const actief = window.location.pathname.endsWith(l.href) ? 'active' : '';
    if (!l.altijd && !contractVolledig) {
      return '<span class="sb-item disabled" title="Beschikbaar na volledig getekend contract" style="opacity:.4;cursor:not-allowed;">' + l.tekst + ' [vergrendeld]</span>';
    }
    return '<a class="sb-item ' + actief + '" href="' + l.href + '">' + l.tekst + '</a>';
  }).join('');
}

// ============================================================
// ACTIE-BANNER
// ============================================================
function renderActieBanner(stage, week, volledigGetekend) {
  const banner = document.getElementById('actie-banner');
  const titleEl = document.getElementById('actie-titel');
  const subEl = document.getElementById('actie-sub');
  banner.classList.remove('ok');

  if (!volledigGetekend) {
    const wacht = [];
    if (!stage.student_getekend) wacht.push('jou');
    if (!stage.mentor_getekend) wacht.push('je mentor');
    if (!stage.docent_getekend) wacht.push('de stagecommissie');
    titleEl.textContent = 'Volgende stap: contract laten ondertekenen';
    subEl.textContent = `Nog te ondertekenen door: ${wacht.join(', ')}.`;
    banner.href = 'contract.html';
    return;
  }

  banner.href = 'logboek.html';

  const weeknummer = week ? week.weeknummer : berekenWeeknummer(new Date(), stage.startdatum);
  const weekIngediend = week && week.status === 'ingediend';

  if (weekIngediend) {
    banner.classList.add('ok');
    titleEl.textContent = 'Alles up to date!';
    subEl.textContent = `Logboek week ${weeknummer} is ingediend.`;
    return;
  }

  const vandaag = new Date();
  const dow = vandaag.getDay();
  const dagenTotVrijdag = 5 - (dow === 0 ? 7 : dow);
  const deadline = new Date(vandaag);
  deadline.setDate(vandaag.getDate() + dagenTotVrijdag);
  const dagenResterend = Math.ceil((deadline - vandaag) / (1000 * 60 * 60 * 24));
  const deadlineLabel = capitalize(deadline.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }));

  titleEl.textContent = `Volgende stap: logboek week ${weeknummer} indienen`;
  if (dagenResterend < 0) {
    subEl.textContent = `Deadline was ${deadlineLabel} — dien zo snel mogelijk in.`;
  } else if (dagenResterend === 0) {
    subEl.textContent = `Deadline vandaag (${deadlineLabel})!`;
  } else {
    subEl.textContent = `Deadline ${deadlineLabel} — ${dagenResterend} dag${dagenResterend === 1 ? '' : 'en'} resterend`;
  }
}

// ============================================================
// STATKAARTEN
// ============================================================
function countWerkdagen(start, eind) {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(eind);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function renderStatCards(stage, stats, week) {
  const start = new Date(stage.startdatum);
  const eind = new Date(stage.einddatum);
  const vandaag = new Date();

  const totaalDagen = countWerkdagen(start, eind);
  const voltooidDagen = vandaag < start ? 0 : countWerkdagen(start, vandaag < eind ? vandaag : eind);
  const pctDagen = totaalDagen > 0 ? Math.round((voltooidDagen / totaalDagen) * 100) : 0;

  document.getElementById('stat-dagen').textContent = `${voltooidDagen}/${totaalDagen}`;
  document.getElementById('bar-dagen').style.width = Math.min(100, pctDagen) + '%';
  document.getElementById('stat-dagen-sub').textContent = `${pctDagen}% voltooid`;

  const urenDoel = stage.uren_per_week || 0;
  const urenDezeWeek = week ? week.dagen.reduce((sum, d) => sum + Number(d.uren || 0), 0) : 0;
  const pctUren = urenDoel > 0 ? Math.round((urenDezeWeek / urenDoel) * 100) : 0;
  document.getElementById('stat-uren').textContent = urenDoel > 0 ? `${urenDezeWeek}/${urenDoel}` : `${urenDezeWeek}`;
  document.getElementById('bar-uren').style.width = Math.min(100, pctUren) + '%';
  const urenResterend = Math.max(0, urenDoel - urenDezeWeek);
  document.getElementById('stat-uren-sub').textContent = urenDoel > 0
    ? (urenResterend > 0 ? `${urenResterend}u resterend` : 'Doel behaald')
    : 'Geen wekelijks urendoel ingesteld';

  const verplichtAantal = stats.aantal_logboeken_verplicht;
  document.getElementById('stat-logboeken').textContent = verplichtAantal != null ? `${stats.ingediend}/${verplichtAantal}` : `${stats.ingediend}`;
}

// ============================================================
// STAGEPROCES TIJDLIJN
// ============================================================
function renderTimeline(stage) {
  const start = new Date(stage.startdatum);
  const eind = new Date(stage.einddatum);
  const vandaag = new Date();
  const totaalWeken = Math.max(1, Math.ceil((eind - start) / (1000 * 60 * 60 * 24 * 7)));
  const huidigeWeek = Math.min(totaalWeken, Math.max(1, berekenWeeknummer(vandaag, stage.startdatum)));
  const halverwegeWeek = Math.ceil(totaalWeken / 2);
  const volledigGetekend = !!(stage.student_getekend && stage.mentor_getekend && stage.docent_getekend);

  const stappen = [];

  stappen.push({
    titel: 'Voorstel ingediend',
    sub: stage.goedkeuringsdatum ? `Goedgekeurd op ${formatDatum(stage.goedkeuringsdatum)}` : 'In behandeling bij de stagecommissie',
    status: 'done'
  });

  let contractSub;
  if (volledigGetekend) {
    contractSub = stage.getekend_op ? `Volledig getekend op ${formatDatum(stage.getekend_op)}` : 'Volledig getekend';
  } else {
    const wacht = [];
    if (!stage.student_getekend) wacht.push('jou');
    if (!stage.mentor_getekend) wacht.push('mentor');
    if (!stage.docent_getekend) wacht.push('stagecommissie');
    contractSub = `Wacht op handtekening: ${wacht.join(', ')}`;
  }
  stappen.push({ titel: 'Contract opgemaakt', sub: contractSub, status: volledigGetekend ? 'done' : 'pending' });

  const stageStatus = stage.status === 'actief' ? 'current' : (vandaag > eind ? 'done' : 'pending');
  stappen.push({
    titel: 'Stage lopende',
    sub: stageStatus === 'current' ? `Week ${huidigeWeek} op ${totaalWeken}` : (stageStatus === 'done' ? 'Afgerond' : 'Nog niet gestart'),
    status: stageStatus
  });

  stappen.push({
    titel: 'Tussentijdse evaluatie',
    sub: stage.tussentijdse_evaluatie ? `Afgerond op ${formatDatum(stage.tussentijdse_evaluatie.datum)}` : `Gepland in week ${halverwegeWeek}`,
    status: stage.tussentijdse_evaluatie ? 'done' : 'pending'
  });

  stappen.push({
    titel: 'Finale evaluatie',
    sub: stage.finale_evaluatie ? `Afgerond op ${formatDatum(stage.finale_evaluatie.datum)}` : 'Na afloop van de stage',
    status: stage.finale_evaluatie ? 'done' : (vandaag > eind ? 'current' : 'pending')
  });

  document.getElementById('timeline').innerHTML = stappen.map(s => `
    <div class="timeline-item ${s.status === 'current' ? 'current' : ''}">
      <div class="timeline-dot ${s.status === 'done' ? 'done' : ''} ${s.status === 'current' ? 'current' : ''}"></div>
      <div>
        <div class="timeline-item__title">${s.titel}</div>
        <div class="timeline-item__sub">${s.sub}</div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// LOGBOEK DEZE WEEK
// ============================================================
function renderLogboekLijst(week) {
  const container = document.getElementById('logboek-lijst');

  const vandaag = new Date();
  const dow = vandaag.getDay();
  const offsetTotMaandag = dow === 0 ? -6 : 1 - dow;
  const maandag = new Date(vandaag);
  maandag.setDate(vandaag.getDate() + offsetTotMaandag);
  maandag.setHours(0, 0, 0, 0);

  const dagenMap = {};
  (week && week.dagen ? week.dagen : []).forEach(d => {
    const key = new Date(d.datum).toISOString().split('T')[0];
    dagenMap[key] = d;
  });

  const rijen = [];
  for (let i = 0; i < 5; i++) {
    const dag = new Date(maandag);
    dag.setDate(maandag.getDate() + i);
    const key = dag.toISOString().split('T')[0];
    const entry = dagenMap[key];
    const label = capitalize(dag.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }));
    rijen.push({ label, entry });
  }

  container.innerHTML = rijen.map(r => `
    <div class="logboek-rij">
      <div>
        <div class="logboek-rij__dag">${r.label}</div>
        <div class="logboek-rij__taak">${r.entry ? r.entry.taken_beschrijving : 'Nog niet ingevuld'}</div>
      </div>
      <span class="status-pil ${r.entry ? 'ok' : 'open'}">${r.entry ? 'Ok' : 'Openstaand'}</span>
    </div>
  `).join('');
}

// ============================================================
// HELPERS
// ============================================================
function berekenWeeknummer(datum, start) {
  const d = new Date(datum), s = new Date(start);
  return Math.floor((d - s) / (1000 * 60 * 60 * 24 * 7)) + 1;
}

function formatDatum(datumStr) {
  return new Date(datumStr).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

document.addEventListener('DOMContentLoaded', loadDashboard);
