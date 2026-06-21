function toggleVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.style.opacity = '1';
  } else {
    input.type = 'password';
    btn.style.opacity = '';
  }
}

function checkRequirements() {
  const pw = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;

  const rules = {
    'req-length':  pw.length >= 8,
    'req-upper':   /[A-Z]/.test(pw),
    'req-number':  /[0-9]/.test(pw),
    'req-special': /[!@#$%^&*(),.?":{}|<>]/.test(pw),
  };

  let allValid = true;
  for (const [id, valid] of Object.entries(rules)) {
    const el = document.getElementById(id);
    const icon = el.querySelector('.req-icon');
    if (valid) {
      el.classList.add('valid');
      icon.textContent = '✓';
    } else {
      el.classList.remove('valid');
      icon.textContent = '';
      allValid = false;
    }
  }

  const canSubmit = allValid && pw === confirm && confirm.length > 0;
  document.getElementById('submit-btn').disabled = !canSubmit;
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    try {
      const payloadBase64 = token.split('.')[1];
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);
      
      if (payload.exp && (Date.now() >= payload.exp * 1000)) {
        window.location.href = 'sessie_vervallen.html';
        return;
      }

      // Toon email uit token als user badge
      if (payload.email) {
        document.getElementById('user-email').textContent = payload.email;
        const initials = payload.email.substring(0, 2).toUpperCase();
        document.getElementById('avatar-initials').textContent = initials;
        document.getElementById('user-badge').style.display = 'flex';
      }
    } catch (e) {
      console.error("Fout bij het lezen van token:", e);
    }
  }

  document.getElementById('submit-btn').addEventListener('click', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const password = document.getElementById('new-password').value;

    if (!token) {
      alert('Geen reset token gevonden in de link!');
      return;
    }

    try {
      const data = await apiFetch('/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      
      alert(data.message);
      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('verlopen')) {
        window.location.href = 'sessie_vervallen.html';
      } else {
        alert(err.message || 'Kon geen verbinding maken met de server.');
      }
    }
  });

  // Make checkRequirements available globally if needed by inline handlers, 
  // though it's already declared at top-level.
  window.toggleVisibility = toggleVisibility;
  window.checkRequirements = checkRequirements;
});
