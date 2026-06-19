async function initDashboard() {
  if (!requireAuth('student')) return;

  try {
    const data = await apiFetch('/stage/my-stage');
    if (data && data.stage) {
      window.location.href = 'student_voorstel_response.html';
      return;
    }
  } catch (err) {
    // Geen stage gevonden, toon dashboard
  }

  try {
    const gebruiker = await apiFetch('/auth/me');
    const naamEl = document.getElementById('student-naam');
    if (naamEl && gebruiker) {
      naamEl.textContent = gebruiker.voornaam || gebruiker.naam || '';
    }
  } catch (err) {
    console.error('Fout bij laden gebruiker:', err);
  }
}

initDashboard();
