// ============================================================
// app.js — Logique principale SPA
// ============================================================

let currentUser = null;
let rapportActif = 'journalier';
let adminActif   = 'employes';

// ── Initialisation ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initNav();
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const data = await api('/auth/me');
            currentUser = data.user;
            onLoginSuccess(data.user, false);
        } catch {
            localStorage.removeItem('token');
        }
    }
    // Stats d'accueil (publiques)
    loadStatsDispo();
    loadAppartements();
    showPage('accueil');
});

// ── Navigation ────────────────────────────────────────────────
function initNav() {
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById(`page-${page}`);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (link) link.classList.add('active');

    // Chargement à la demande
    if (page === 'appartements') loadAppartements();
    if (page === 'mes-reservations') loadMesReservations();
    if (page === 'dashboard') loadDashboard();
    if (page === 'clients') loadClients();
    if (page === 'rapports') loadRapport('journalier');
    if (page === 'admin') loadAdmin('employes');
    window.scrollTo(0, 0);
}

// ── Authentification ──────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pwd   = document.getElementById('loginPwd').value;
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';

    try {
        const data = await api('/auth/login', 'POST', { email, password: pwd });
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        onLoginSuccess(data.user, true);
    } catch (err) {
        errEl.textContent = err.message || 'Identifiants incorrects';
        errEl.style.display = 'block';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const pwd  = document.getElementById('regPwd').value;
    const pwd2 = document.getElementById('regPwd2').value;
    const errEl = document.getElementById('registerError');
    const okEl  = document.getElementById('registerSuccess');
    errEl.style.display = 'none';

    if (pwd !== pwd2) {
        errEl.textContent = 'Les mots de passe ne correspondent pas';
        errEl.style.display = 'block'; return;
    }

    try {
        await api('/auth/register', 'POST', {
            email:         document.getElementById('regEmail').value,
            password:      pwd,
            nom_client:    document.getElementById('regNom').value,
            numero_cni:    document.getElementById('regCni').value,
            adresse_client: document.getElementById('regAdresse').value,
            telephone:     document.getElementById('regTel').value,
        });
        okEl.textContent = 'Compte créé ! Vous pouvez maintenant vous connecter.';
        okEl.style.display = 'block';
        setTimeout(() => showPage('login'), 2500);
    } catch (err) {
        errEl.textContent = err.message || 'Erreur lors de la création du compte';
        errEl.style.display = 'block';
    }
}

function onLoginSuccess(user, redirect) {
    document.getElementById('navGuest').style.display = 'none';
    document.getElementById('navUser').style.display  = 'flex';
    document.getElementById('userGreeting').textContent = user.nom_client || user.nom_employee || user.email;
    document.getElementById('userBadge').textContent = user.role;

    // Afficher les liens selon le rôle
    document.querySelectorAll('.nav-auth-hide').forEach(el => el.style.display = 'inline-flex');
    if (user.role === 'employe' || user.role === 'gestionnaire') {
        document.querySelectorAll('.nav-emp').forEach(el => el.style.display = 'inline-flex');
    }
    if (user.role === 'gestionnaire') {
        document.querySelectorAll('.nav-gest').forEach(el => el.style.display = 'inline-flex');
    }

    // Préparer modal réservation
    if (user.role !== 'client') {
        document.getElementById('selectClientGroup').style.display = 'block';
    }

    if (redirect) {
        toast('Bienvenue !', 'success');
        if (user.role === 'client') showPage('mes-reservations');
        else showPage('dashboard');
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('navGuest').style.display = 'flex';
    document.getElementById('navUser').style.display  = 'none';
    document.querySelectorAll('.nav-auth-hide,.nav-emp,.nav-gest').forEach(el => el.style.display = 'none');
    showPage('accueil');
    toast('Déconnecté');
}

// ── Appartements ──────────────────────────────────────────────
async function loadAppartements() {
    const grid = document.getElementById('appartGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-spinner">Chargement des appartements...</div>';

    const params = new URLSearchParams();
    const cat = document.getElementById('filtCat')?.value;
    const bat = document.getElementById('filtBat')?.value;
    const dispo = document.getElementById('filtDispo')?.value;
    if (cat)   params.append('categorie', cat);
    if (bat)   params.append('batiment', bat);
    if (dispo) params.append('disponible', dispo);

    try {
        const data = await api('/appartements?' + params.toString());
        grid.innerHTML = '';

        if (!data.appartements?.length) {
            grid.innerHTML = '<div class="empty-state"><h3>Aucun appartement trouvé</h3><p>Modifiez vos filtres de recherche</p></div>';
            return;
        }

        data.appartements.forEach(a => {
            grid.appendChild(buildAppartCard(a));
        });
    } catch (err) {
        grid.innerHTML = `<div class="empty-state"><h3>Erreur de chargement</h3><p>${err.message}</p></div>`;
    }
}

function buildAppartCard(a) {
    const card = document.createElement('div');
    card.className = 'appart-card';
    const dispo = a.disponible;
    card.innerHTML = `
    <div class="appart-card-header">
      <div>
        <div class="appart-num">Appart. ${a.numero_appart || a.id_appart}</div>
        <div class="appart-bat">${a.nom_batiment ? `Bât. ${a.nom_batiment}` : ''} · ${a.capacite}</div>
      </div>
      <span class="badge-cat badge-${a.categorie.toLowerCase()}">${a.categorie}</span>
    </div>
    <div class="appart-card-body">
      <div class="appart-prix">${fmtPrix(a.prix_unitaire)} <small>/ nuit</small></div>
      <div class="appart-details">
        <span><span class="dispo-dot ${dispo ? 'dispo-yes':'dispo-no'}"></span>${dispo ? 'Disponible':'Occupé'}</span>
        ${a.telephone_appart ? `<span>📞 ${a.telephone_appart}</span>` : ''}
      </div>
      ${a.accomodation ? `<div class="appart-accom">✓ ${a.accomodation}</div>` : ''}
      ${a.restriction ? `<div class="appart-accom" style="color:#C0392B">⚠ ${a.restriction}</div>` : ''}
    </div>
    <div class="appart-card-footer">
      ${dispo && currentUser ? `<button class="btn btn-primary btn-sm" onclick="showModalReservation(${a.id_appart})">Réserver</button>` : ''}
      ${!currentUser && dispo ? `<button class="btn btn-outline btn-sm" onclick="showPage('login')">Se connecter pour réserver</button>` : ''}
      ${currentUser && (currentUser.role==='gestionnaire') ? `<button class="btn btn-ghost btn-sm" onclick="editAppart(${a.id_appart})">Modifier</button>` : ''}
    </div>`;
    return card;
}

function filterCat(cat) {
    document.getElementById('filtCat').value = cat;
    showPage('appartements');
}

// ── Mes Réservations ──────────────────────────────────────────
async function loadMesReservations() {
    if (!currentUser) { showPage('login'); return; }
    const el = document.getElementById('mesReservList');
    el.innerHTML = '<div class="loading-spinner">Chargement...</div>';

    try {
        const data = await api('/reservations');
        if (!data.reservations?.length) {
            el.innerHTML = '<div class="empty-state"><h3>Aucune réservation</h3><p>Commencez par choisir un appartement !</p></div>';
            return;
        }
        el.innerHTML = '<div class="reserv-list" id="reservList"></div>';
        const list = document.getElementById('reservList');
        data.reservations.forEach(r => list.appendChild(buildReservCard(r)));
    } catch (err) {
        el.innerHTML = `<div class="empty-state"><h3>Erreur</h3><p>${err.message}</p></div>`;
    }
}

function buildReservCard(r) {
    const el = document.createElement('div');
    el.className = 'reserv-card';
    const jours = r.nombre_jours || '—';
    el.innerHTML = `
    <div class="reserv-info">
      <h4>Appart. ${r.numero_appart || r.id_appartement} · ${r.categorie || ''}</h4>
      <div class="reserv-meta">
        📅 Entrée : <strong>${fmtDate(r.date_entree)}</strong>
        ${r.date_sortie ? ` → Sortie : <strong>${fmtDate(r.date_sortie)}</strong>` : ''}
        · ${jours} jour(s)
        ${r.batiment_nom ? ` · Bât. ${r.batiment_nom}` : ''}
      </div>
    </div>
    <div style="display:flex;gap:12px;align-items:center">
      <div>
        <div class="reserv-prix">${fmtPrix(r.montant_total)}</div>
        <div style="font-size:12px;color:var(--gris3)">Total estimé</div>
      </div>
      <span class="reserv-statut s-${r.statut}">${r.statut.replace('_',' ')}</span>
      ${r.statut === 'en_cours' || r.statut === 'confirmee' ? 
        `<button class="btn btn-danger btn-sm" onclick="annulerReservation(${r.id_reservation})">Annuler</button>` : ''}
    </div>`;
    return el;
}

async function annulerReservation(id) {
    if (!confirm('Annuler cette réservation ? (délai de 24h pour les clients)')) return;
    try {
        await api(`/reservations/${id}`, 'DELETE');
        toast('Réservation annulée', 'success');
        loadMesReservations();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ── Modal Réservation ─────────────────────────────────────────
async function showModalReservation(idAppart = null) {
    if (!currentUser) { showPage('login'); return; }
    document.getElementById('reservError').style.display = 'none';
    document.getElementById('montantPreview').style.display = 'none';
    document.getElementById('rDateEntree').value = '';
    document.getElementById('rDateSortie').value = '';
    document.getElementById('rAvance').value = '';
    document.getElementById('rNotes').value = '';

    // Charger les apparts disponibles
    const sel = document.getElementById('rAppart');
    sel.innerHTML = '<option value="">Chargement...</option>';
    try {
        const data = await api('/appartements?disponible=true');
        sel.innerHTML = '<option value="">Sélectionner un appartement</option>';
        data.appartements.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id_appart;
            opt.textContent = `Appart. ${a.numero_appart} — ${a.categorie} — ${fmtPrix(a.prix_unitaire)}/nuit ${a.nom_batiment ? `(${a.nom_batiment})` : ''}`;
            opt.dataset.prix = a.prix_unitaire;
            if (a.id_appart == idAppart) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch { sel.innerHTML = '<option value="">Erreur de chargement</option>'; }

    document.getElementById('modalReservation').style.display = 'flex';
}

function closeModal(e) {
    if (e.target.id === 'modalReservation') closeModalFn();
}
function closeModalFn() {
    document.getElementById('modalReservation').style.display = 'none';
}

function calcMontant() {
    const sel = document.getElementById('rAppart');
    const opted = sel.options[sel.selectedIndex];
    const prix = parseFloat(opted?.dataset?.prix) || 0;
    const d1 = new Date(document.getElementById('rDateEntree').value);
    const d2 = new Date(document.getElementById('rDateSortie').value);
    const prev = document.getElementById('montantPreview');

    if (prix && !isNaN(d1) && !isNaN(d2) && d2 > d1) {
        const jours = Math.ceil((d2 - d1) / 86400000);
        document.getElementById('mpJours').textContent = jours + ' jour(s)';
        document.getElementById('mpPrix').textContent  = fmtPrix(prix);
        document.getElementById('mpTotal').textContent = fmtPrix(jours * prix);
        prev.style.display = 'block';
    } else {
        prev.style.display = 'none';
    }
}

document.getElementById('rAppart')?.addEventListener('change', calcMontant);

async function submitReservation(e) {
    e.preventDefault();
    const errEl = document.getElementById('reservError');
    errEl.style.display = 'none';

    const body = {
        id_appartement: parseInt(document.getElementById('rAppart').value),
        date_entree:    document.getElementById('rDateEntree').value,
        date_sortie:    document.getElementById('rDateSortie').value || undefined,
        avance_paye:    parseFloat(document.getElementById('rAvance').value) || 0,
        notes:          document.getElementById('rNotes').value,
    };

    if (currentUser.role !== 'client') {
        const cid = document.getElementById('rClientId').value;
        if (!cid) { errEl.textContent = 'Veuillez saisir l\'ID du client'; errEl.style.display = 'block'; return; }
        body.id_client = parseInt(cid);
    }

    try {
        await api('/reservations', 'POST', body);
        closeModalFn();
        toast('Réservation créée avec succès !', 'success');
        if (currentUser.role === 'client') loadMesReservations();
        else loadDashboard();
    } catch (err) {
        errEl.textContent = err.message || 'Erreur de réservation';
        errEl.style.display = 'block';
    }
}

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
    if (!currentUser || currentUser.role === 'client') return;
    try {
        const data = await api('/appartements/dashboard');
        const d = data.dashboard;

        document.getElementById('statsRow').innerHTML = `
          <div class="stat-card"><div class="stat-val">${d.apparts_disponibles}</div><div class="stat-lbl">Apparts disponibles</div></div>
          <div class="stat-card"><div class="stat-val">${d.reservations_actives}</div><div class="stat-lbl">Réservations actives</div></div>
          <div class="stat-card"><div class="stat-val">${d.reservations_aujourd_hui}</div><div class="stat-lbl">Réservations aujourd'hui</div></div>
          <div class="stat-card"><div class="stat-val">${fmtPrix(d.recettes_jour)}</div><div class="stat-lbl">Recettes du jour</div></div>
          <div class="stat-card"><div class="stat-val">${fmtPrix(d.recettes_mois)}</div><div class="stat-lbl">Recettes du mois</div></div>
        `;

        const loues = data.loues_aujourd_hui;
        if (!loues?.length) {
            document.getElementById('tableDashLoues').innerHTML = '<div class="empty-state"><p>Aucun appartement loué aujourd\'hui</p></div>';
        } else {
            document.getElementById('tableDashLoues').innerHTML = buildTable(
                ['Appart.', 'Client', 'Entrée', 'Jours', 'Montant/j', 'Cumulé', 'Avance', 'Solde'],
                loues.map(r => [
                    r.numero_appart, r.nom_client, fmtDate(r.date_entree),
                    r.jours_ecoules, fmtPrix(r.prix_unitaire), fmtPrix(r.montant_cumule),
                    fmtPrix(r.avance_paye), colorSolde(r.solde_avance)
                ])
            );
        }
    } catch (err) {
        console.error('Dashboard:', err);
    }
}

// ── Clients ───────────────────────────────────────────────────
async function loadClients() {
    const el = document.getElementById('clientsTable');
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner">Chargement...</div>';
    const search = document.getElementById('searchClient')?.value || '';

    try {
        const data = await api(`/clients?search=${search}`);
        if (!data.clients?.length) {
            el.innerHTML = '<div class="empty-state"><h3>Aucun client trouvé</h3></div>';
            return;
        }
        el.innerHTML = '<div class="table-wrap">' + buildTable(
            ['ID', 'Nom', 'CNI', 'Téléphone', 'Appartement', 'Bâtiment', 'Date entrée', 'Avance', 'Solde', 'Statut'],
            data.clients.map(c => [
                c.id_client, c.nom_client, c.numero_cni, c.telephone || '—',
                c.numero_appart || '—', c.nom_batiment || '—',
                fmtDate(c.date_entree), fmtPrix(c.avance_paye || 0),
                colorSolde(c.solde_restant || 0),
                `<span class="reserv-statut s-${c.statut}">${c.statut}</span>`
            ])
        ) + '</div>';
    } catch (err) {
        el.innerHTML = `<div class="empty-state"><h3>Erreur : ${err.message}</h3></div>`;
    }
}

// ── Rapports ──────────────────────────────────────────────────
function loadRapport(type, btn) {
    rapportActif = type;
    if (btn) {
        document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }
    loadRapportActif();
}

async function loadRapportActif() {
    const el = document.getElementById('rapportContent');
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner">Chargement...</div>';

    const moisVal = document.getElementById('filtMois')?.value || '';
    const [annee, mois] = moisVal ? moisVal.split('-') : [new Date().getFullYear(), new Date().getMonth() + 1];

    try {
        if (rapportActif === 'resume') {
            const data = await api(`/rapports/resume?mois=${mois}&annee=${annee}`);
            const r = data.resume;
            el.innerHTML = `
              <div class="stats-row" style="padding:0;margin-top:16px">
                <div class="stat-card"><div class="stat-val">${r.total_reservations}</div><div class="stat-lbl">Réservations totales</div></div>
                <div class="stat-card"><div class="stat-val">${r.en_cours}</div><div class="stat-lbl">En cours</div></div>
                <div class="stat-card"><div class="stat-val">${r.terminees}</div><div class="stat-lbl">Terminées</div></div>
                <div class="stat-card"><div class="stat-val">${fmtPrix(r.montant_total_prevu)}</div><div class="stat-lbl">Montant prévu</div></div>
                <div class="stat-card"><div class="stat-val">${fmtPrix(r.montant_encaisse)}</div><div class="stat-lbl">Encaissé</div></div>
              </div>
              <h3 style="margin-top:24px;font-size:16px;color:var(--vert)">Par bâtiment</h3>
              ${buildTable(['Bâtiment','Réservations','Total'],data.par_batiment.map(b=>[b.nom_batiment,b.nb,fmtPrix(b.total)]))}`;
        } else {
            const data = await api(`/rapports/journal?date=${new Date().toISOString().split('T')[0]}`);
            if (!data.journal?.length) {
                el.innerHTML = '<div class="empty-state"><h3>Aucune entrée pour cette date</h3></div>';
                return;
            }
            el.innerHTML = buildTable(
                ['Appart.', 'Bâtiment', 'Client', 'Téléphone', 'Montant/j', 'Jours', 'Cumulé', 'Avance', 'Solde'],
                data.journal.map(j => [
                    j.numero_appart, j.nom_batiment, j.nom_client, j.telephone,
                    fmtPrix(j.montant_jour), j.jours_ecoules, fmtPrix(j.montant_cumule),
                    fmtPrix(j.avance_initiale), colorSolde(j.solde_restant)
                ])
            );
        }
    } catch (err) {
        el.innerHTML = `<div class="empty-state"><h3>Erreur : ${err.message}</h3></div>`;
    }
}

// ── Admin ─────────────────────────────────────────────────────
function loadAdmin(section, btn) {
    adminActif = section;
    if (btn) {
        document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }
    const el = document.getElementById('adminContent');
    if (!el) return;

    if (section === 'employes') loadAdminEmployes(el);
    else if (section === 'appartements') loadAdminApparts(el);
    else if (section === 'logs') loadAdminLogs(el);
}

async function loadAdminEmployes(el) {
    el.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary" onclick="showModalEmploye()">➕ Ajouter un employé</button>
      </div>
      <div class="loading-spinner">Chargement...</div>`;
    // Implémenter avec api('/employes')
    toast('Section employés — connectez /api/employes', 'info');
}

async function loadAdminApparts(el) {
    el.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary" onclick="showPage('appartements')">Voir tous les appartements</button>
      </div>`;
}

async function loadAdminLogs(el) {
    el.innerHTML = '<div class="empty-state"><h3>Journal des accès</h3><p>Consultez les logs via l\'API /api/admin/logs</p></div>';
}

// ── CRON manuel ───────────────────────────────────────────────
async function lancerCron() {
    if (!confirm('Lancer la vérification journalière manuellement ?')) return;
    try {
        const data = await api('/admin/cron/verif', 'POST');
        toast(`Vérification terminée : ${data.journauxCrees} journaux créés`, 'success');
        loadDashboard();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ── Export CSV ────────────────────────────────────────────────
function exportCSV(type = 'reservations') {
    if (!currentUser) { showPage('login'); return; }
    const token = localStorage.getItem('token');
    window.open(`/api/rapports/export-csv?type=${type}&token=${token}`);
}

// ── Stats accueil ─────────────────────────────────────────────
async function loadStatsDispo() {
    try {
        const data = await api('/appartements?disponible=true');
        const el = document.getElementById('statDispo');
        if (el) el.textContent = data.appartements?.length || 0;
    } catch {}
}

// ── Utilitaires ───────────────────────────────────────────────
function buildTable(headers, rows) {
    const ths = headers.map(h => `<th>${h}</th>`).join('');
    const trs = rows.map(r => `<tr>${r.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function fmtPrix(v) {
    if (!v && v !== 0) return '—';
    return parseFloat(v).toLocaleString('fr-CM') + ' FCFA';
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function colorSolde(v) {
    const n = parseFloat(v) || 0;
    const color = n >= 0 ? 'var(--vert-ok)' : 'var(--rouge)';
    return `<span style="color:${color};font-weight:500">${fmtPrix(n)}</span>`;
}

function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    setTimeout(() => el.classList.remove('show'), 3500);
}
