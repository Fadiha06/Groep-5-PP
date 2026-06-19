const API_BASE_URL = '/api';

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `API error: ${response.status}`);
  }

  return data;
}

function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:' +
    (type === 'error' ? '#ef4444' : '#22c55e') +
    ';color:white;padding:12px 24px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);font-family:Inter,sans-serif;font-weight:500;z-index:9999;transition:opacity 0.3s;';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function requireAuth(requiredRole = null) {
  const token = localStorage.getItem('token');
  const rol = localStorage.getItem('rol');

  if (!token) {
    showToast('Je bent niet ingelogd!', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return false;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // Rol-aliassen: admin=administrator, commissie=stagecommissie
    if (roles.includes('administrator') && !roles.includes('admin')) roles.push('admin');
    if (roles.includes('admin') && !roles.includes('administrator')) roles.push('administrator');
    if (roles.includes('stagecommissie') && !roles.includes('commissie')) roles.push('commissie');
    if (roles.includes('commissie') && !roles.includes('stagecommissie')) roles.push('stagecommissie');
    if (roles.includes('mentor') && !roles.includes('stagementor')) roles.push('stagementor');
    if (roles.includes('stagementor') && !roles.includes('mentor')) roles.push('mentor');
    if (!roles.includes(rol)) {
      showToast(`Geen toegang. Je hebt de juiste rol nodig.`, 'error');
      setTimeout(() => { window.location.href = 'index.html'; }, 1500);
      return false;
    }
  }

  return true;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('rol');
  localStorage.removeItem('userId');
  window.location.href = 'index.html';
}

async function vereisContractGetekend() {
  try {
    const contract = await apiFetch('/contracten/mijn');
    const volledig = !!(contract.student_getekend && contract.mentor_getekend && contract.docent_getekend);
    if (!volledig) {
      window.location.href = 'contract.html?reden=niet-getekend';
      return null;
    }
    return contract;
  } catch (err) {
    window.location.href = 'contract.html?reden=niet-getekend';
    return null;
  }
}

window.API_BASE_URL = API_BASE_URL;
window.apiFetch = apiFetch;
window.requireAuth = requireAuth;
window.logout = logout;
window.vereisContractGetekend = vereisContractGetekend;
