document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('reset-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const email = document.getElementById('email').value.trim();

        if (!email) {
            alert('Vul je e-mailadres in.');
            return;
        }

        btn.disabled = true;
        const origineleTekst = btn.textContent;
        btn.textContent = 'Versturen...';

        try {
            const data = await apiFetch('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            alert(data.message || 'Als dit e-mailadres bekend is, is er een resetlink verstuurd.');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Kon geen verbinding maken met de server.');
        } finally {
            btn.disabled = false;
            btn.textContent = origineleTekst;
        }
    });
});