async function laadNaam() {
  const gebruiker = await fetch('/api/auth/me').then(r => r.json());
  document.getElementById('student-naam').textContent = gebruiker.voornaam;
}

laadNaam();