async function loadDashboard() {
  if (!requireAuth('student')) return;

  try {
    const data = await apiFetch('/stage/my-stage');
    
    if (data.stage) {
      // Hide empty state
      document.querySelector('.empty-hero').style.display = 'none';
      document.querySelector('.info-row').style.display = 'none';
      
      // Create active state UI using their existing classes
      const mainDiv = document.querySelector('.main');
      
      // Helper to format status nicely
      const statusMap = {
        'in_aanvraag': 'In aanvraag ⏳',
        'goedgekeurd': 'Goedgekeurd ✅',
        'afgekeurd': 'Afgekeurd ❌'
      };
      const statusText = statusMap[data.stage.status] || data.stage.status;

      const activeHtml = `
        <div style="margin-top: 32px; background: white; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; color: #1e293b;">Jouw Stagevoorstel</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="font-size: 0.875rem; color: #64748b; margin-bottom: 4px;">Bedrijf</div>
              <div style="font-weight: 500; color: #0f172a;">${data.stage.bedrijfsnaam}</div>
            </div>
            <div>
              <div style="font-size: 0.875rem; color: #64748b; margin-bottom: 4px;">Titel</div>
              <div style="font-weight: 500; color: #0f172a;">${data.stage.titel}</div>
            </div>
            <div>
              <div style="font-size: 0.875rem; color: #64748b; margin-bottom: 4px;">Status</div>
              <div style="font-weight: 600; color: ${data.stage.status === 'in_aanvraag' ? '#eab308' : (data.stage.status === 'goedgekeurd' ? '#22c55e' : '#ef4444')};">
                ${statusText}
              </div>
            </div>
          </div>
        </div>
      `;
      
      mainDiv.insertAdjacentHTML('beforeend', activeHtml);
    }
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
