document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('stagecommissie')) return;

  // Handle logout (assuming logout button calls window.logout() directly or via id)
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', window.logout);
  }

 
  
});

function viewAllPoints(event) {
  event.preventDefault();
  alert('Deze functionaliteit (Aandachtspunten overzicht) wordt later toegevoegd.');
}
