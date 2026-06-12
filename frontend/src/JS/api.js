const API_BASE_URL = 'http://localhost:5000/api';


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


function requireAuth(requiredRole = null) {
  const token = localStorage.getItem('token');
  const rol = localStorage.getItem('rol');

  if (!token) {
    alert('Je bent niet ingelogd!');
    window.location.href = 'index.html';
    return false;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    
    if (roles.includes('administrator') && !roles.includes('admin')) {
      roles.push('admin');
    }

    if (!roles.includes(rol)) {
      alert(`Geen toegang. Je hebt de rol '${roles.join(' of ')}' nodig.`);
      window.location.href = 'index.html';
      return false;
    }
  }

  return true;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('rol');
  window.location.href = 'index.html';
}

// Attach to window so other scripts can access it easily without modules (since we use regular script tags)
window.API_BASE_URL = API_BASE_URL;
window.apiFetch = apiFetch;
window.requireAuth = requireAuth;
window.logout = logout;
