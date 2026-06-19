async function laadStudentGegevens() {
  if (!requireAuth('student')) return;
  try {
    const gebruiker = await apiFetch('/auth/me');
    document.getElementById('inp-naam').value = gebruiker.naam || '';
    document.getElementById('inp-email').value = gebruiker.email || '';

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edit') === 'true') {
      const data = await apiFetch(`/stage/my-stage?_t=${Date.now()}`);
      if (data && data.stage) {
        const s = data.stage;
        document.getElementById('inp-studentnummer').value = s.studentnummer || '';
        document.getElementById('inp-bedrijfsnaam').value = s.bedrijfsnaam || '';
        document.getElementById('inp-mentor-naam').value = s.mentorNaam || '';
        document.getElementById('inp-mentor-email').value = s.mentorEmail || '';
        document.getElementById('inp-telefoon').value = s.mentorTelefoon || '';
        document.getElementById('inp-adres').value = s.bedrijf_adres || '';
        document.getElementById('inp-sector').value = s.bedrijf_sector || '';
        document.getElementById('inp-afdeling').value = s.bedrijf_afdeling || '';
        if (s.startdatum) document.getElementById('inp-startdatum').value = s.startdatum.split('T')[0];
        if (s.einddatum) document.getElementById('inp-einddatum').value = s.einddatum.split('T')[0];
        document.getElementById('inp-uren').value = s.uren_per_week || '';
        document.getElementById('inp-titel').value = s.titel || '';
        document.getElementById('inp-omschrijving').value = s.omschrijving || '';
        document.getElementById('inp-leerdoelen').value = s.leerdoelen || '';
        
        if (s.status === 'conditie' && s.reden_weigering) {
          const alertDiv = document.getElementById('conditie-alert');
          alertDiv.style.display = 'block';
          alertDiv.innerHTML = `<strong>Let op (Voorstel onder conditie):</strong><br>${s.reden_weigering}`;
        }
      }
    }
  } catch (error) {
    console.error('Fout bij inladen gegevens:', error);
  }
}
laadStudentGegevens();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-submit').addEventListener('click', async () => {
    const payload = {
      studentnummer: document.getElementById('inp-studentnummer')?.value,
      bedrijfsnaam: document.getElementById('inp-bedrijfsnaam').value,
      mentorNaam: document.getElementById('inp-mentor-naam').value,
      mentorEmail: document.getElementById('inp-mentor-email').value,
      telefoon: document.getElementById('inp-telefoon').value,
      adres: document.getElementById('inp-adres').value,
      sector: document.getElementById('inp-sector').value,
      afdeling: document.getElementById('inp-afdeling')?.value,
      startdatum: document.getElementById('inp-startdatum').value,
      einddatum: document.getElementById('inp-einddatum').value,
      uren_per_week: document.getElementById('inp-uren')?.value,
      titel: document.getElementById('inp-titel').value,
      omschrijving: document.getElementById('inp-omschrijving').value,
      leerdoelen: document.getElementById('inp-leerdoelen')?.value
    };

    // Validatie: check of alle velden zijn ingevuld
    for (const [key, value] of Object.entries(payload)) {
      if (!value || value.trim() === '') {
        alert('Vul a.u.b. alle verplichte velden in.');
        return;
      }
    }

    if (!requireAuth('student')) return;

    try {
      const data = await apiFetch('/stage/submit', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      alert(data.message);
      window.location.href = 'student_voorstel_response.html';
    } catch (err) {
      console.error(err);
      alert(err.message || 'Kon de aanvraag niet versturen.');
    }
  });
});
