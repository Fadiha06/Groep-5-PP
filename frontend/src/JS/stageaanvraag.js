async function laadStudentGegevens() {
    if (!requireAuth('student')) return;
    try {
        const gebruiker = await apiFetch('/student/profiel');
        document.getElementById('inp-naam').value = gebruiker.naam;
        document.getElementById('inp-email').value = gebruiker.email;
    } catch (err) {
        console.error('Kon studentgegevens niet laden:', err);
    }
}

laadStudentGegevens();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-submit').addEventListener('click', async () => {
        const payload = {
            bedrijfsnaam: document.getElementById('inp-bedrijfsnaam').value,
            mentorNaam: document.getElementById('inp-mentor-naam').value,
            mentorEmail: document.getElementById('inp-mentor-email').value,
            telefoon: document.getElementById('inp-telefoon').value,
            adres: document.getElementById('inp-adres').value,
            sector: document.getElementById('inp-sector').value,
            startdatum: document.getElementById('inp-startdatum').value,
            einddatum: document.getElementById('inp-einddatum').value,
            titel: document.getElementById('inp-titel').value,
            omschrijving: document.getElementById('inp-omschrijving').value
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
            window.location.href = 'student_dashboard.html';
        } catch (err) {
            console.error(err);
            alert(err.message || 'Kon de aanvraag niet versturen.');
        }
    });
});