// Laad contractgegevens vanuit de backend
async function laadContract() {
  var foutEl = document.getElementById('contract-fout');
  try {
    var stage = await apiFetch('/contracten/mijn');

    window.currentContractId = stage.contract_id;

    document.getElementById('contract-student').textContent = stage.student_naam + (stage.opleiding ? ' — ' + stage.opleiding : '');
    document.getElementById('contract-studentnummer').textContent = stage.studentnummer;
    document.getElementById('contract-bedrijf').textContent = stage.bedrijf_naam;
    document.getElementById('contract-mentor').textContent = (stage.mentor_naam || '—') + ' — ' + (stage.mentor_email || '—');
    document.getElementById('contract-docent').textContent = stage.docent_naam || '—';
    document.getElementById('contract-titel').textContent = stage.titel;
    document.getElementById('contract-periode').textContent = stage.startdatum + ' – ' + stage.einddatum;
    document.getElementById('sign-student-naam').textContent = stage.student_naam;
    document.getElementById('sign-mentor-naam').textContent = stage.mentor_naam || '—';
    // De derde handtekening is die van de stagecommissie als instelling (niet van één specifieke docent).
    document.getElementById('sign-docent-naam').textContent = 'Administrator';

    document.querySelectorAll('.sign-placeholder').forEach(function(el) { el.style.display = 'none'; });

    if (foutEl) foutEl.style.display = 'none';

    // Update de status-teksten van mentor en docent in de sign-grid
    updateSignGrid(stage);

    if (stage.student_getekend) {
      document.getElementById('canvas-wrap').style.display = 'none';
      document.getElementById('sign-actions').style.display = 'none';
      document.getElementById('sign-confirmed').style.display = 'block';
      var btn = document.getElementById('btn-indienen');
      btn.disabled = true;
      btn.textContent = 'Al ondertekend';

      // Toon het statuspaneel met mentor-link indien nodig
      await toonStatusPanel(stage);
    }

  } catch (err) {
    console.error('Kon contract niet laden:', err);
    var bericht = err.message || 'Kon contract niet laden. Controleer of je ingelogd bent als student.';
    if (foutEl) {
      foutEl.textContent = bericht;
      foutEl.style.display = 'block';
    } else {
      alert(bericht);
    }
    ['contract-student','contract-studentnummer','contract-bedrijf',
     'contract-mentor','contract-docent','contract-titel','contract-periode',
     'sign-student-naam','sign-mentor-naam','sign-docent-naam'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = 'Niet beschikbaar';
    });
    document.querySelectorAll('.sign-placeholder').forEach(function(el) { el.style.display = 'flex'; });
    document.getElementById('btn-bevestig').disabled = true;
  }
}

// Update de status-tekst bij mentor en docent in de handtekeningen-sectie
function updateSignGrid(stage) {
  var statusEls = document.querySelectorAll('.sign-other-status');
  if (statusEls.length >= 1) {
    if (stage.mentor_getekend) {
      statusEls[0].textContent = 'Getekend';
      statusEls[0].style.color = '#15803D';
    } else if (stage.student_getekend) {
      statusEls[0].textContent = 'Wacht op handtekening mentor bedrijf';
      statusEls[0].style.color = '#92400E';
    } else {
      statusEls[0].textContent = 'Wacht op handtekening student';
    }
  }
  if (statusEls.length >= 2) {
    if (stage.docent_getekend) {
      statusEls[1].textContent = 'Getekend';
      statusEls[1].style.color = '#15803D';
    } else if (stage.mentor_getekend) {
      statusEls[1].textContent = 'Wacht op handtekening admin';
      statusEls[1].style.color = '#92400E';
    } else {
      statusEls[1].textContent = 'Wacht op handtekening mentor bedrijf';
    }
  }
}

// Toon een statuspaneel onder het contract met de stand van zaken
async function toonStatusPanel(stage) {
  var bestaand = document.getElementById('contract-status-panel');
  if (bestaand) bestaand.remove();

  var panel = document.createElement('div');
  panel.id = 'contract-status-panel';
  panel.style.cssText = 'margin-top:20px;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;';

  var volledig = stage.student_getekend && stage.mentor_getekend && stage.docent_getekend;

  if (volledig) {
    panel.innerHTML = '<div style="background:#F0FDF4;border-left:4px solid #22C55E;padding:16px 20px;">' +
      '<div style="font-size:14px;font-weight:700;color:#15803D;margin-bottom:4px;">Contract volledig getekend</div>' +
      '<div style="font-size:13px;color:#166534;">Alle partijen hebben getekend. Je hebt nu toegang tot je logboek en evaluaties.</div>' +
      '<div style="margin-top:12px;display:flex;gap:10px;">' +
        '<a href="logboek.html" style="background:#15803D;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">Ga naar logboek</a>' +
        '<a href="evaluaties.html" style="background:#1D4ED8;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">Ga naar evaluaties</a>' +
      '</div>' +
    '</div>';
  } else {
    var stStud = stage.student_getekend ? '<span style="color:#15803D;font-weight:600;">Getekend</span>' : '<span style="color:#9CA3AF;">Wacht</span>';
    var stMent = stage.mentor_getekend ? '<span style="color:#15803D;font-weight:600;">Getekend</span>' : '<span style="color:#F59E0B;font-weight:600;">Nog niet getekend</span>';
    var stAdm = stage.docent_getekend ? '<span style="color:#15803D;font-weight:600;">Getekend</span>' : '<span style="color:#9CA3AF;">Wacht</span>';

    var mentorLinkHtml = '';
    if (stage.student_getekend && !stage.mentor_getekend && window.currentContractId) {
      try {
        var linkData = await apiFetch('/contracten/' + window.currentContractId + '/mentor-link');
        if (linkData && linkData.link) {
          mentorLinkHtml = '<div style="margin-top:14px;padding:12px 16px;background:#FFF8E6;border:1px solid #FDE68A;border-radius:8px;">' +
            '<div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:6px;">Deel deze link met je stagementor</div>' +
            '<div style="font-size:12px;color:#78350F;margin-bottom:8px;">Als de automatische e-mail niet aankwam, kopieer dan deze link en stuur die zelf door.</div>' +
            '<div style="display:flex;gap:8px;align-items:center;">' +
              '<input type="text" readonly id="mentor-link-input" value="' + linkData.link + '" style="flex:1;padding:7px 10px;border:1px solid #FDE68A;border-radius:5px;font-size:12px;background:#fff;color:#374151;">' +
              '<button id="btn-kopieer-link" style="background:#D1193E;color:#fff;border:none;border-radius:5px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Kopieer</button>' +
            '</div>' +
          '</div>';
        }
      } catch (e) {
        console.warn('Kon mentor-link niet ophalen:', e.message);
      }
    }

    panel.innerHTML = '<div style="background:#fff;padding:16px 20px;">' +
      '<div style="font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Status handtekeningen</div>' +
      '<div style="display:flex;gap:28px;font-size:14px;">' +
        '<div><span style="color:#64748B;font-size:12px;">Student</span><br>' + stStud + '</div>' +
        '<div><span style="color:#64748B;font-size:12px;">Mentor bedrijf</span><br>' + stMent + '</div>' +
        '<div><span style="color:#64748B;font-size:12px;">Admin</span><br>' + stAdm + '</div>' +
      '</div>' +
      mentorLinkHtml +
    '</div>';
  }

  var main = document.querySelector('.main');
  if (main) main.appendChild(panel);

  // Kopieer-knop event
  var kopieerBtn = document.getElementById('btn-kopieer-link');
  if (kopieerBtn) {
    kopieerBtn.addEventListener('click', function() {
      var inp = document.getElementById('mentor-link-input');
      if (inp) {
        inp.select();
        try { document.execCommand('copy'); } catch(e) { navigator.clipboard.writeText(inp.value).catch(function(){}); }
        kopieerBtn.textContent = 'Gekopieerd!';
        setTimeout(function() { kopieerBtn.textContent = 'Kopieer'; }, 2000);
      }
    });
  }
}

// Canvas handtekening
var canvas = document.getElementById('sig-canvas');
var ctx = canvas.getContext('2d');

function resizeCanvas() {
  var wrap = document.getElementById('canvas-wrap');
  var ratio = window.devicePixelRatio || 1;
  var w = wrap.clientWidth || 600;
  var h = 150;
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(ratio, ratio);
  ctx.strokeStyle = '#1E40AF';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

var drawing = false;
var hasSig = false;

function getPos(e) {
  var r = canvas.getBoundingClientRect();
  var src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}

canvas.addEventListener('mousedown', function(e) { drawing = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
canvas.addEventListener('mousemove', function(e) { if (!drawing) return; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasSig = true; });
canvas.addEventListener('mouseup', function() { drawing = false; });
canvas.addEventListener('mouseleave', function() { drawing = false; });
canvas.addEventListener('touchstart', function(e) { e.preventDefault(); drawing = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, {passive:false});
canvas.addEventListener('touchmove', function(e) { e.preventDefault(); if (!drawing) return; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasSig = true; }, {passive:false});
canvas.addEventListener('touchend', function() { drawing = false; });

document.getElementById('btn-wis').addEventListener('click', function() {
  resizeCanvas();
  hasSig = false;
  document.getElementById('btn-indienen').disabled = true;
  document.getElementById('sign-confirmed').style.display = 'none';
  document.getElementById('canvas-wrap').style.display = 'block';
  document.getElementById('sign-actions').style.display = 'flex';
});

document.getElementById('btn-bevestig').addEventListener('click', function() {
  if (!hasSig) { alert('Teken eerst je handtekening.'); return; }
  if (!window.currentContractId) { alert('Contract is niet geladen. Herlaad de pagina.'); return; }
  document.getElementById('canvas-wrap').style.display = 'none';
  document.getElementById('sign-actions').style.display = 'none';
  document.getElementById('sign-confirmed').style.display = 'block';
  document.getElementById('btn-indienen').disabled = false;
});

document.getElementById('btn-indienen').addEventListener('click', async function() {
  if (!window.currentContractId) { alert('Contract is niet geladen. Herlaad de pagina.'); return; }
  try {
    var signature = canvas.toDataURL('image/png');
    var result = await apiFetch('/contracten/' + window.currentContractId + '/tekenen', {
      method: 'POST',
      body: JSON.stringify({ signature: signature })
    });
    alert('Contract succesvol ondertekend! De mentor ontvangt automatisch een e-mail met een link om ook te tekenen.');
    laadContract();
  } catch (err) {
    alert(err.message || 'Kon het contract niet indienen.');
  }
});

if (typeof requireAuth === 'function' && !requireAuth('student')) throw new Error();
laadContract();
