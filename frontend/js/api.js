// ============================================================
// api.js — Couche d'appel API REST
// Base URL : /api
// Gère automatiquement le token JWT depuis localStorage
// ============================================================

const API_BASE = '/api';

async function api(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body && method !== 'GET') options.body = JSON.stringify(body);

    const res = await fetch(API_BASE + endpoint, options);
    const data = await res.json();

    if (!res.ok) {
        // Token expiré → déconnecter
        if (res.status === 401) {
            localStorage.removeItem('token');
            currentUser = null;
        }
        throw new Error(data.error || data.message || `Erreur ${res.status}`);
    }

    return data;
}
