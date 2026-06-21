// Loginknop koppelen aan de backend
document.addEventListener('DOMContentLoaded', () => {
  const handleLogin = async (emailId, passwordId) => {
    const email = document.getElementById(emailId).value;
    const password = document.getElementById(passwordId).value;

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('rol', data.rol);
      localStorage.setItem('userId', data.userId);
      window.location.href = data.redirect_url;
    } catch (err) {
      console.error(err);
      alert(err.message || 'Kan geen verbinding maken met de server.');
    }
  };

  const ehbSubmit = document.querySelector('#tab-ehb .btn-submit');
  if (ehbSubmit) {
    ehbSubmit.addEventListener('click', () => {
      handleLogin('email', 'password');
    });
  }
});
