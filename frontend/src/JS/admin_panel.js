let gebruikers = [];

async function loadUsers() {
  if (!requireAuth('administrator')) return;
  try {
    const data = await apiFetch('/users');
    gebruikers = data;
    filterTable();
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

window.addEventListener('DOMContentLoaded', () => { loadUsers(); loadContracten(); });

const ROLLEN = ['Student','Docent','Mentor','Stagecommissie','Administrator'];

function renderTable(data) {
  const tbody = document.getElementById('table-body');
  document.getElementById('count-label').textContent = data.length + ' gebruiker' + (data.length !== 1 ? 's' : '') + ' gevonden';
  const currentUserId = parseInt(localStorage.getItem('userId'), 10);

  tbody.innerHTML = data.map((g, idx) => {
    const actief = g.status === 'Actief';
    
    // Zorg dat 'admin' en 'administrator' mooi mappen naar de dropdown optie 'Administrator'
    let displayRol = g.rol;
    const lowerRol = g.rol.toLowerCase();
    if (lowerRol === 'admin' || lowerRol === 'administrator') displayRol = 'Administrator';
    else if (lowerRol === 'stagecommissie' || lowerRol === 'commissie') displayRol = 'Stagecommissie';

    const rolOpties = ROLLEN.map(r => `<option${r === displayRol ? ' selected' : ''}>${r}</option>`).join('');
    
    const isMe = g.id === currentUserId;

    return `
    <div class="table-row">
      <div class="td td-name">${g.naam}</div>
      <div class="td td-email">${g.email}</div>
      <div class="td">
        <select class="role-select" onchange="wijzigRol(${idx}, this.value)" ${isMe ? 'disabled title="Je kan je eigen rol niet wijzigen"' : ''}>${rolOpties}</select>
      </div>
      <div class="td">
        <span class="status-badge">
          <span class="status-dot ${actief ? 'dot-actief' : 'dot-inactief'}"></span>
          <span class="${actief ? 'text-actief' : 'text-inactief'}">${g.status}</span>
        </span>
      </div>
      <div class="td">
        <div class="actions">
          <button class="btn-bekijk">Bekijk</button>
          ${!isMe ? `<button class="btn-deactiveer" onclick="confirmDelete(${g.id}, '${g.naam.replace(/'/g, "\\'")}')">Verwijder</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterTable() {
  const q = document.querySelector('.search').value.toLowerCase();
  const rol = document.getElementById('filter-rol').value;
  const status = document.getElementById('filter-status').value;
  const gefilterd = gebruikers.filter(g =>
    (!q || g.naam.toLowerCase().includes(q) || g.email.toLowerCase().includes(q)) &&
    (!rol || g.rol === rol) &&
    (!status || g.status === status)
  );
  renderTable(gefilterd);
}

let userIdToDelete = null;

function confirmDelete(id, naam) {
  userIdToDelete = id;
  document.getElementById('delete-confirm-sub').textContent = `Weet je zeker dat je het account van ${naam} wilt verwijderen? Dit kan niet ongedaan gemaakt worden.`;
  document.getElementById('delete-confirm').classList.add('open');
}

function closeDeleteConfirm() {
  userIdToDelete = null;
  document.getElementById('delete-confirm').classList.remove('open');
}

async function executeDelete() {
  if (!userIdToDelete) return;
  try {
    await apiFetch(`/users/${userIdToDelete}`, { method: 'DELETE' });
    closeDeleteConfirm();
    loadUsers(); // Herlaad de tabel
    showConfirm('Account Verwijderd', 'Het account is succesvol verwijderd.');
  } catch (err) {
    console.error(err);
    alert('Kon geen verbinding maken met de server.');
  }
}

async function wijzigRol(idx, nieuweRol) {
  const user = gebruikers[idx];
  try {
    await apiFetch(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ rol: nieuweRol, status: user.status })
    });
    user.rol = nieuweRol;
    showConfirm('Rol gewijzigd', 'De rol van ' + user.naam + ' is gewijzigd naar ' + nieuweRol + '.');
  } catch (err) {
    console.error(err);
    alert('Kon de rol niet opslaan in de database.');
    loadUsers(); // Herlaad tabel om de foutieve dropdown te resetten
  }
}

function openModal() {
  document.getElementById('modal').classList.add('open');
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  ['inp-voornaam','inp-achternaam','inp-email'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('inp-rol').value = '';
  document.getElementById('inp-status').value = 'Actief';
}
async function createAccount() {
  const voornaam = document.getElementById('inp-voornaam').value.trim();
  const achternaam = document.getElementById('inp-achternaam').value.trim();
  const email = document.getElementById('inp-email').value.trim();
  const rol = document.getElementById('inp-rol').value;
  const status = document.getElementById('inp-status').value;

  if (!voornaam || !achternaam || !email || !rol) {
    alert('Vul alle verplichte velden in.');
    return;
  }

  const naam = voornaam + ' ' + achternaam;
  const rolFormatted = rol.toLowerCase(); // 'Student' -> 'student'

  try {
    const data = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ voornaam, achternaam, email, rol: rolFormatted })
    });

    gebruikers.unshift({ naam, email, rol, status });
    filterTable();
    closeModal();
    showConfirm('Account aangemaakt', data.message);
  } catch (err) {
    console.error(err);
    alert(err.message || 'Kon geen verbinding maken met de server.');
  }
}

function showConfirm(title, sub) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-sub').textContent = sub;
  document.getElementById('confirm').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirm').classList.remove('open');
}

// Ensure globally accessible for inline onclick
window.filterTable = filterTable;
window.confirmDelete = confirmDelete;
window.closeDeleteConfirm = closeDeleteConfirm;
window.executeDelete = executeDelete;
window.wijzigRol = wijzigRol;
window.openModal = openModal;
window.closeModal = closeModal;
window.createAccount = createAccount;
window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;

async function loadContracten() {
  try {
    const data = await apiFetch('/admin/contracten-te-tekenen');
    const body = document.getElementById('contracten-body');
    if (!body) return;
    if (!data || data.length === 0) {
      body.innerHTML = '<div style="padding:12px;color:#9CA3AF;font-size:14px;">Geen contracten gevonden.</div>';
      return;
    }
    body.innerHTML = data.map(c => {
      const stStudent = c.student_getekend ? '✓' : '○';
      const stMentor  = c.mentor_getekend  ? '✓' : '○';
      const stAdmin   = c.admin_getekend   ? '✓' : '○';
      const kleurStudent = c.student_getekend ? '#15803D' : '#9CA3AF';
      const kleurMentor  = c.mentor_getekend  ? '#15803D' : '#9CA3AF';
      const kleurAdmin   = c.admin_getekend   ? '#15803D' : '#9CA3AF';

      let actie = '';
      if (c.admin_getekend) {
        actie = '<span style="color:#15803D;font-weight:600;font-size:13px;">✓ Volledig getekend</span>';
      } else if (c.student_getekend && c.mentor_getekend) {
        actie = `<a href="docent_contract.html?id=${c.contract_id}" style="background:#D1193E;color:#fff;padding:7px 14px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">✎ Teken als admin</a>`;
      } else {
        actie = '<span style="color:#9CA3AF;font-size:13px;">Wacht op student/mentor</span>';
      }

      return `<div class="table-row" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F1F5F9;">
        <div style="flex:2;font-size:14px;font-weight:500;">${c.student_naam}</div>
        <div style="flex:2;font-size:13px;color:#64748B;">${c.bedrijf_naam}</div>
        <div style="flex:2;font-size:12px;display:flex;gap:12px;">
          <span style="color:${kleurStudent}">${stStudent} Student</span>
          <span style="color:${kleurMentor}">${stMentor} Mentor</span>
          <span style="color:${kleurAdmin}">${stAdmin} Admin</span>
        </div>
        <div style="flex:1;text-align:right;">${actie}</div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Contracten laden mislukt:', e);
  }
}
window.loadContracten = loadContracten;

// ============================================================
// MENTOR ACCOUNT & KOPPELEN
// ============================================================
async function openMentorModal() {
    document.getElementById('mentor-modal').classList.add('open');
    try {
        const stages = await apiFetch('/admin/stages-zonder-mentor');
        const select = document.getElementById('inp-mentor-stage');
        select.innerHTML = '<option value="">Selecteer een stage/student</option>' +
            stages.map(s => `<option value="${s.stage_id}">${s.student_naam} (${s.bedrijf_naam || 'Geen bedrijf'}) - ${s.titel}</option>`).join('');
    } catch (e) {
        console.error(e);
        document.getElementById('inp-mentor-stage').innerHTML = '<option value="">Fout bij laden stages</option>';
    }
}
window.openMentorModal = openMentorModal;

function closeMentorModal() {
    document.getElementById('mentor-modal').classList.remove('open');
}
window.closeMentorModal = closeMentorModal;

async function createMentorAccount() {
    const stage_id = document.getElementById('inp-mentor-stage').value;
    const voornaam = document.getElementById('inp-mentor-voornaam').value;
    const achternaam = document.getElementById('inp-mentor-achternaam').value;
    const email = document.getElementById('inp-mentor-email').value;
    const afdeling = document.getElementById('inp-mentor-afdeling').value;
    const telefoonnummer = document.getElementById('inp-mentor-telefoon').value;

    if (!stage_id || !voornaam || !achternaam || !email) {
        alert('Vul alle verplichte velden in en kies een stage.');
        return;
    }

    try {
        await apiFetch('/admin/mentors', {
            method: 'POST',
            body: JSON.stringify({ stage_id, voornaam, achternaam, email, afdeling, telefoonnummer })
        });
        closeMentorModal();
        showConfirm('Mentor gekoppeld', 'Account aangemaakt, e-mail verstuurd en mentor gekoppeld aan de stage.');
        laadGebruikers();
    } catch (err) {
        alert(err.message || 'Fout bij aanmaken mentor.');
    }
}
window.createMentorAccount = createMentorAccount;

// ============================================================
// DOCENT TOEWIJZEN
// ============================================================
async function openDocentModal() {
    document.getElementById('docent-modal').classList.add('open');
    try {
        const [stages, docentenRes] = await Promise.all([
            apiFetch('/admin/stages-zonder-docent'),
            apiFetch('/users')
        ]);
        
        const docenten = docentenRes.filter(u => u.rol && (u.rol.toLowerCase() === 'docent' || u.rol.toLowerCase() === 'stagecommissie'));

        const selectStage = document.getElementById('inp-docent-stage');
        selectStage.innerHTML = '<option value="">Selecteer een stage/student</option>' +
            stages.map(s => `<option value="${s.stage_id}">${s.student_naam} (${s.bedrijf_naam || 'Geen bedrijf'}) - ${s.titel}</option>`).join('');

        const selectDocent = document.getElementById('inp-docent-docent');
        selectDocent.innerHTML = '<option value="">Selecteer een docent</option>' +
            docenten.map(d => `<option value="${d.id}">${d.naam}</option>`).join('');
    } catch (e) {
        console.error(e);
        document.getElementById('inp-docent-stage').innerHTML = '<option value="">Fout bij laden</option>';
    }
}
window.openDocentModal = openDocentModal;

function closeDocentModal() {
    document.getElementById('docent-modal').classList.remove('open');
}
window.closeDocentModal = closeDocentModal;

async function assignDocent() {
    const stage_id = document.getElementById('inp-docent-stage').value;
    const docent_gebruiker_id = document.getElementById('inp-docent-docent').value;

    if (!stage_id || !docent_gebruiker_id) {
        alert('Selecteer een stage en een docent.');
        return;
    }

    try {
        await apiFetch('/admin/docent-toewijzen', {
            method: 'POST',
            body: JSON.stringify({ stage_id, docent_gebruiker_id: Number(docent_gebruiker_id) })
        });
        closeDocentModal();
        showConfirm('Docent Toegewezen', 'De docent is succesvol aan de stage gekoppeld.');
    } catch (err) {
        alert(err.message || 'Fout bij toewijzen docent.');
    }
}
window.assignDocent = assignDocent;
