// Laad contractgegevens vanuit de backend
async function laadContract() {
  try {
    const stage = await apiFetch('/stage/mijn');

    // Partijen
    document.getElementById('contract-student').textContent = stage.student_naam + ' — ' + stage.opleiding;
    document.getElementById('contract-studentnummer').textContent = stage.studentnummer;
    document.getElementById('contract-bedrijf').textContent = stage.bedrijf_naam;
    document.getElementById('contract-mentor').textContent = stage.mentor_naam + ' — ' + stage.mentor_email;
    document.getElementById('contract-docent').textContent = stage.docent_naam;

    // Stagegegevens
    document.getElementById('contract-titel').textContent = stage.titel;
    document.getElementById('contract-periode').textContent = stage.startdatum + ' – ' + stage.einddatum;

    // Handtekening namen
    document.getElementById('sign-student-naam').textContent = stage.student_naam;
    document.getElementById('sign-mentor-naam').textContent = stage.mentor_naam;
    document.getElementById('sign-docent-naam').textContent = stage.docent_naam;

  } catch (err) {
    console.error('Kon contract niet laden:', err);
  }
}

// Canvas handtekening
const canvas = document.getElementById('sig-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  const ratio = window.devicePixelRatio || 1;
  const w = wrap.clientWidth;
  const h = 150;
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

let drawing = false;
let hasSig = false;

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}

canvas.addEventListener('mousedown', e => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
canvas.addEventListener('mousemove', e => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasSig = true; });
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseleave', () => drawing = false);
canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, {passive:false});
canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasSig = true; }, {passive:false});
canvas.addEventListener('touchend', () => drawing = false);

document.getElementById('btn-wis').addEventListener('click', () => {
  resizeCanvas();
  hasSig = false;
  document.getElementById('btn-indienen').disabled = true;
  document.getElementById('sign-confirmed').style.display = 'none';
  document.getElementById('canvas-wrap').style.display = 'block';
  document.getElementById('sign-actions').style.display = 'flex';
});

document.getElementById('btn-bevestig').addEventListener('click', () => {
  if (!hasSig) return;
  document.getElementById('canvas-wrap').style.display = 'none';
  document.getElementById('sign-actions').style.display = 'none';
  document.getElementById('sign-confirmed').style.display = 'block';
  document.getElementById('btn-indienen').disabled = false;
});

document.getElementById('btn-indienen').addEventListener('click', async () => {
  try {
    const handtekening = canvas.toDataURL('image/png');
    await apiFetch('/contract/tekenen', {
      method: 'POST',
      body: JSON.stringify({ handtekening })
    });
    window.location.href = 'confirmatie_popup.html';
  } catch (err) {
    alert(err.message || 'Kon het contract niet indienen.');
  }
});

// Init
laadContract();
