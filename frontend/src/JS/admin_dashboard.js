document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('administrator')) return;

  // Handle logout
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', window.logout);
  }

  
});
