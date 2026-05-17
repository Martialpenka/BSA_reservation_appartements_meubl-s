// ============================================================
// app.js BSA — Beautiful Stay by Alliance
// ============================================================

let currentUser = null;
let rapportActif = 'journalier';

document.addEventListener('DOMContentLoaded', async () => {
    initNav();
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const data = await api('/auth/me');
            currentUser = data.user;
            onLoginSuccess(data.user, false);
        } catch { localStorage.removeItem('token'); }
    }
    loadAppartements();
    showPage('accueil');
});

function initNav() {
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', e => { e.preventDefault(); showPage(link.dataset.page); });
    });
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    const link = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (link) link.classList.add('active');
    if (page === 'appartements')     loadAppartements();
    if (page === 'mes-reservations') loadMesReservations();
    if (page === 'dashboard')        loadDashboard();
    if (page === 'clients')          loadClients();
    if (page === 'rapports')         loadRapport('journalier');
    if (page === 'admin')            loadAdmin('employes');
    window.scrollTo(0, 0);
}

async function handleLogin(e) {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    try {
        const data = await api('/auth/login', 'POST', {
            email:    document.getElementById('loginEmail').value,
            password: document.getElementById('loginPwd').value
        });
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
    if (pwd !== pwd2) { errEl.textContent = 'Les mots de passe ne correspondent pas'; errEl.style.display = 'block'; return; }
    try {
        await api('/auth/register', 'POST', {
            email: document.getElementById('regEmail').value,
            password: pwd,
            nom_client: document.getElementById('regNom').value,
            numero_cni: document.getElementById('regCni').value,
            adresse_client: document.getElementById('regAdresse').value,
            telephone: document.getElementById('regTel').value,
        });
        okEl.textContent = 'Compte créé ! Connectez-vous maintenant.';
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
    document.getElementById('userBadge').textContent    = user.role;
    document.querySelectorAll('.nav-auth-hide').forEach(el => el.style.display = 'inline-flex');
    if (user.role === 'employe' || user.role === 'gestionnaire') {
        document.querySelectorAll('.nav-emp').forEach(el => el.style.display = 'inline-flex');
    }
    if (user.role === 'gestionnaire') {
        document.querySelectorAll('.nav-gest').forEach(el => el.style.display = 'inline-flex');
    }
    if (user.role !== 'client') {
        document.getElementById('selectClientGroup').style.display = 'block';
    }
    if (redirect) {
        toast('Bienvenue chez BSA ! 🏠', 'success');
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

// ── Appartements avec photos ──────────────────────────────────
async function loadAppartements() {
    const grid = document.getElementById('appartGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-spinner">Chargement des appartements BSA...</div>';
    const params = new URLSearchParams();
    const cat   = document.getElementById('filtCat') ? document.getElementById('filtCat').value : '';
    const dispo = document.getElementById('filtDispo') ? document.getElementById('filtDispo').value : '';
    if (cat)   params.append('categorie', cat);
    if (dispo) params.append('disponible', dispo);
    try {
        const data = await api('/appartements?' + params.toString());
        grid.innerHTML = '';
        if (!data.appartements || !data.appartements.length) {
            grid.innerHTML = '<div class="empty-state"><h3>Aucun appartement trouvé</h3><p>Modifiez vos filtres</p></div>';
            return;
        }
        data.appartements.forEach(function(a) { grid.appendChild(buildAppartCard(a)); });
    } catch (err) {
        grid.innerHTML = '<div class="empty-state"><h3>Erreur de chargement</h3><p>' + err.message + '</p></div>';
    }
}

function buildAppartCard(a) {
    const card   = document.createElement('div');
    card.className = 'appart-card';
    const dispo  = a.disponible;
    const num    = a.numero_appart;
    const cardId = 'card-' + a.id_appart;

    // Construire les images du carrousel (6 photos)
    var photoHtml = '';
    for (var i = 0; i < 6; i++) {
       photoHtml += '<img src="/images/appartements/appart_' + num + '/' + i + '.jpg" ' +
            'class="appart-photo active" style="opacity:1;position:relative;display:block;width:100%;height:' + (i === 0 ? '220px' : '0') + ';object-fit:cover;" ' +
            'alt="Appart ' + num + ' photo ' + (i+1) + '" ' +
            'onerror="this.style.display=\'none\'">';
    }

    // Points de navigation
    var dotsHtml = '';
    for (var j = 0; j < 6; j++) {
        dotsHtml += '<span class="photo-dot ' + (j === 0 ? 'active' : '') + '"></span>';
    }

    // Tags commodités
    var tags = [];
    if (a.accomodation) {
        if (a.accomodation.indexOf('WiFi') >= 0)          tags.push('📶 WiFi');
        if (a.accomodation.indexOf('Clim') >= 0)          tags.push('❄️ Clim');
        if (a.accomodation.indexOf('Petit') >= 0)         tags.push('☕ Petit-dej');
        if (a.accomodation.indexOf('balcon') >= 0)        tags.push('🏡 Balcon');
        if (a.accomodation.indexOf('cuisine') >= 0)       tags.push('🍳 Cuisine');
        if (a.accomodation.indexOf('Groupe') >= 0)        tags.push('⚡ Générateur');
    }
    var tagsHtml = tags.map(function(t) { return '<span class="appart-tag">' + t + '</span>'; }).join('');

    var btnHtml = '';
    if (dispo && currentUser) {
        btnHtml += '<button class="btn btn-primary btn-sm" onclick="showModalReservation(' + a.id_appart + ')">Réserver</button>';
    }
    if (!currentUser) {
        btnHtml += '<button class="btn btn-outline btn-sm" onclick="showPage(\'login\')">Connexion pour réserver</button>';
    }
    if (currentUser && currentUser.role === 'gestionnaire') {
        btnHtml += '<button class="btn btn-ghost btn-sm" onclick="editAppart(' + a.id_appart + ')">Modifier</button>';
    }

    card.innerHTML =
        '<div class="appart-card-header">' +
            '<div>' +
                '<div class="appart-num">Appartement ' + num + '</div>' +
                '<div class="appart-bat">BSA Omnisport · Yaoundé</div>' +
            '</div>' +
            '<span class="badge-cat badge-' + a.categorie.toLowerCase() + '">' + a.categorie + '</span>' +
        '</div>' +
        '<div class="appart-photos" id="' + cardId + '">' +
            photoHtml +
            '<button class="photo-nav photo-prev" onclick="prevPhoto(\'' + cardId + '\')">&#8249;</button>' +
            '<button class="photo-nav photo-next" onclick="nextPhoto(\'' + cardId + '\')">&#8250;</button>' +
            '<div class="photo-dots">' + dotsHtml + '</div>' +
            '<div class="photo-dispo-badge ' + (dispo ? 'badge-dispo-yes' : 'badge-dispo-no') + '">' +
                (dispo ? '✓ Disponible' : '✗ Occupé') +
            '</div>' +
        '</div>' +
        '<div class="appart-card-body">' +
            '<div class="appart-prix">' + fmtPrix(a.prix_unitaire) + ' <small>/ nuit</small></div>' +
            (a.prix_studio ? '<div class="appart-prix-studio">Studio : ' + fmtPrix(a.prix_studio) + ' / nuit</div>' : '') +
            '<div class="appart-details">' + tagsHtml + '</div>' +
            '<div class="appart-accom">Salon avec balcon · 2 chambres · 1 cuisine · 2 douches</div>' +
            (a.restriction ? '<div class="appart-restriction">⚠ ' + a.restriction + '</div>' : '') +
        '</div>' +
        '<div class="appart-card-footer">' + btnHtml + '</div>';

    return card;
}

function nextPhoto(cardId) {
    var container = document.getElementById(cardId);
    if (!container) return;
    var photos = Array.prototype.slice.call(container.querySelectorAll('.appart-photo')).filter(function(p) { return p.style.display !== 'none'; });
    var dots   = container.querySelectorAll('.photo-dot');
    var active = 0;
    for (var i = 0; i < photos.length; i++) { if (photos[i].classList.contains('active')) { active = i; break; } }
    photos[active].classList.remove('active');
    if (dots[active]) dots[active].classList.remove('active');
    active = (active + 1) % photos.length;
    photos[active].classList.add('active');
    if (dots[active]) dots[active].classList.add('active');
}

function prevPhoto(cardId) {
    var container = document.getElementById(cardId);
    if (!container) return;
    var photos = Array.prototype.slice.call(container.querySelectorAll('.appart-photo')).filter(function(p) { return p.style.display !== 'none'; });
    var dots   = container.querySelectorAll('.photo-dot');
    var active = 0;
    for (var i = 0; i < photos.length; i++) { if (photos[i].classList.contains('active')) { active = i; break; } }
    photos[active].classList.remove('active');
    if (dots[active]) dots[active].classList.remove('active');
    active = (active - 1 + photos.length) % photos.length;
    photos[active].classList.add('active');
    if (dots[active]) dots[active].classList.add('active');
}

function filterCat(cat) {
    document.getElementById('filtCat').value = cat;
    showPage('appartements');
}

async function showModalReservation(idAppart) {
    if (!currentUser) { showPage('login'); return; }
    document.getElementById('reservError').style.display   = 'none';
    document.getElementById('montantPreview').style.display = 'none';
    document.getElementById('rDateEntree').value = '';
    document.getElementById('rDateSortie').value = '';
    document.getElementById('rAvance').value     = '';
    document.getElementById('rNotes').value      = '';
    document.getElementById('sAeroport').checked = false;
    document.getElementById('sTourisme').checked = false;
    document.getElementById('aeroportDetails').style.display = 'none';
    document.getElementById('tourismeDetails').style.display = 'none';

    var sel = document.getElementById('rAppart');
    sel.innerHTML = '<option value="">Chargement...</option>';
    try {
        const data = await api('/appartements?disponible=true');
        sel.innerHTML = '<option value="">Sélectionner un appartement</option>';
        data.appartements.forEach(function(a) {
            var opt = document.createElement('option');
            opt.value = a.id_appart;
            opt.textContent = 'Appart. ' + a.numero_appart + ' — ' + a.categorie + ' — ' + fmtPrix(a.prix_unitaire) + '/nuit';
            opt.dataset.prix       = a.prix_unitaire;
            opt.dataset.prixStudio = a.prix_studio || a.prix_unitaire;
            if (a.id_appart == idAppart) opt.selected = true;
            sel.appendChild(opt);
        });
        if (idAppart) calcMontant();
    } catch(e) { sel.innerHTML = '<option value="">Erreur de chargement</option>'; }

    document.getElementById('modalReservation').style.display = 'flex';
}

function toggleService(id) {
    var el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function closeModal(e) { if (e.target.id === 'modalReservation') closeModalFn(); }
function closeModalFn() { document.getElementById('modalReservation').style.display = 'none'; }

function calcMontant() {
    var sel  = document.getElementById('rAppart');
    var opted = sel.options[sel.selectedIndex];
    var typeLocation = document.getElementById('rTypeLocation').value;
    var prix = typeLocation === 'studio'
        ? parseFloat(opted && opted.dataset ? opted.dataset.prixStudio : 0) || 0
        : parseFloat(opted && opted.dataset ? opted.dataset.prix : 0) || 0;
    var d1   = new Date(document.getElementById('rDateEntree').value);
    var d2   = new Date(document.getElementById('rDateSortie').value);
    var prev = document.getElementById('montantPreview');
    if (prix && !isNaN(d1) && !isNaN(d2) && d2 > d1) {
        var jours = Math.ceil((d2 - d1) / 86400000);
        document.getElementById('mpJours').textContent = jours + ' nuit(s)';
        document.getElementById('mpPrix').textContent  = fmtPrix(prix);
        document.getElementById('mpTotal').textContent = fmtPrix(jours * prix);
        prev.style.display = 'block';
    } else { prev.style.display = 'none'; }
}

var rAppartEl = document.getElementById('rAppart');
if (rAppartEl) rAppartEl.addEventListener('change', calcMontant);
var rTypeEl = document.getElementById('rTypeLocation');
if (rTypeEl) rTypeEl.addEventListener('change', calcMontant);

async function submitReservation(e) {
    e.preventDefault();
    var errEl = document.getElementById('reservError');
    errEl.style.display = 'none';
    var typeLocation = document.getElementById('rTypeLocation').value;
    var sel   = document.getElementById('rAppart');
    var opted = sel.options[sel.selectedIndex];
    var prix  = typeLocation === 'studio'
        ? parseFloat(opted && opted.dataset ? opted.dataset.prixStudio : 0)
        : parseFloat(opted && opted.dataset ? opted.dataset.prix : 0);

    var body = {
        id_appartement: parseInt(sel.value),
        date_entree:    document.getElementById('rDateEntree').value,
        date_sortie:    document.getElementById('rDateSortie').value || undefined,
        avance_paye:    parseFloat(document.getElementById('rAvance').value) || 0,
        notes:          document.getElementById('rNotes').value,
        prix_unitaire_override: prix,
        type_location:  typeLocation,
        service_aeroport: document.getElementById('sAeroport').checked ? {
            date: document.getElementById('sAeroportDate').value,
            heure: document.getElementById('sAeroportHeure').value,
            vol: document.getElementById('sAeroportVol').value,
            personnes: parseInt(document.getElementById('sAeroportPersonnes').value) || 1
        } : null,
        service_tourisme: document.getElementById('sTourisme').checked ? {
            type: document.getElementById('sTourismeType').value,
            date: document.getElementById('sTourismeDate').value,
            personnes: parseInt(document.getElementById('sTourismePersonnes').value) || 1,
            description: document.getElementById('sTourismeDesc').value
        } : null
    };

    if (currentUser.role !== 'client') {
        var cid = document.getElementById('rClientId').value;
        if (!cid) { errEl.textContent = "Veuillez saisir l'ID du client"; errEl.style.display = 'block'; return; }
        body.id_client = parseInt(cid);
    }

    try {
        await api('/reservations', 'POST', body);
        closeModalFn();
        toast('Réservation BSA créée avec succès ! 🏠', 'success');
        if (currentUser.role === 'client') { loadMesReservations(); showPage('mes-reservations'); }
        else loadDashboard();
    } catch (err) {
        errEl.textContent = err.message || 'Erreur de réservation';
        errEl.style.display = 'block';
    }
}

async function loadMesReservations() {
    if (!currentUser) { showPage('login'); return; }
    var el = document.getElementById('mesReservList');
    el.innerHTML = '<div class="loading-spinner">Chargement...</div>';
    try {
        const data = await api('/reservations');
        if (!data.reservations || !data.reservations.length) {
            el.innerHTML = '<div class="empty-state"><h3>Aucune réservation</h3><p>Choisissez un appartement BSA !</p></div>';
            return;
        }
        el.innerHTML = '<div class="reserv-list" id="reservList"></div>';
        var list = document.getElementById('reservList');
        data.reservations.forEach(function(r) { list.appendChild(buildReservCard(r)); });
    } catch (err) {
        el.innerHTML = '<div class="empty-state"><h3>Erreur</h3><p>' + err.message + '</p></div>';
    }
}

function buildReservCard(r) {
    var el = document.createElement('div');
    el.className = 'reserv-card';
    var annulerBtn = (r.statut === 'en_cours' || r.statut === 'confirmee')
        ? '<button class="btn btn-danger btn-sm" onclick="annulerReservation(' + r.id_reservation + ')">Annuler</button>'
        : '';
    el.innerHTML =
        '<div class="reserv-info">' +
            '<h4>Appartement ' + r.numero_appart + ' · BSA Omnisport</h4>' +
            '<div class="reserv-meta">📅 Entrée : <strong>' + fmtDate(r.date_entree) + '</strong>' +
            (r.date_sortie ? ' → Sortie : <strong>' + fmtDate(r.date_sortie) + '</strong>' : '') +
            ' · ' + (r.nombre_jours || '—') + ' nuit(s)</div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
            '<div><div class="reserv-prix">' + fmtPrix(r.montant_total) + '</div>' +
            '<div style="font-size:11px;color:var(--gris3)">Total estimé</div></div>' +
            '<span class="reserv-statut s-' + r.statut + '">' + r.statut.replace('_',' ') + '</span>' +
            annulerBtn +
        '</div>';
    return el;
}

async function annulerReservation(id) {
    if (!confirm('Annuler cette réservation ?')) return;
    try {
        await api('/reservations/' + id, 'DELETE');
        toast('Réservation annulée', 'success');
        loadMesReservations();
    } catch (err) { toast(err.message, 'error'); }
}

async function loadDashboard() {
    if (!currentUser || currentUser.role === 'client') return;
    try {
        const data = await api('/appartements/dashboard');
        var d = data.dashboard;
        document.getElementById('statsRow').innerHTML =
            '<div class="stat-card"><div class="stat-val">' + d.apparts_disponibles + '</div><div class="stat-lbl">Apparts disponibles</div></div>' +
            '<div class="stat-card"><div class="stat-val">' + d.reservations_actives + '</div><div class="stat-lbl">Réservations actives</div></div>' +
            '<div class="stat-card"><div class="stat-val">' + d.reservations_aujourd_hui + '</div><div class="stat-lbl">Réservations aujourd\'hui</div></div>' +
            '<div class="stat-card"><div class="stat-val">' + fmtPrix(d.recettes_jour) + '</div><div class="stat-lbl">Recettes du jour</div></div>' +
            '<div class="stat-card"><div class="stat-val">' + fmtPrix(d.recettes_mois) + '</div><div class="stat-lbl">Recettes du mois</div></div>';

        var loues = data.loues_aujourd_hui;
        if (!loues || !loues.length) {
            document.getElementById('tableDashLoues').innerHTML = '<div class="empty-state" style="padding:20px"><p>Aucun appartement loué aujourd\'hui</p></div>';
        } else {
            document.getElementById('tableDashLoues').innerHTML = buildTable(
                ['Appart.','Client','Entrée','Jours','Montant/j','Cumulé','Avance','Solde'],
                loues.map(function(r) { return [
                    '<strong>' + r.numero_appart + '</strong>', r.nom_client, fmtDate(r.date_entree),
                    r.jours_ecoules, fmtPrix(r.prix_unitaire), fmtPrix(r.montant_cumule),
                    fmtPrix(r.avance_paye), colorSolde(r.solde_avance)
                ]; })
            );
        }
    } catch (err) { console.error('Dashboard:', err); }
}

async function loadClients() {
    var el = document.getElementById('clientsTable');
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner">Chargement...</div>';
    var search = document.getElementById('searchClient') ? document.getElementById('searchClient').value : '';
    try {
        const data = await api('/clients?search=' + search);
        if (!data.clients || !data.clients.length) { el.innerHTML = '<div class="empty-state"><h3>Aucun client trouvé</h3></div>'; return; }
        el.innerHTML = '<div class="table-wrap">' + buildTable(
            ['ID','Nom','CNI','Téléphone','Appartement','Date entrée','Avance','Solde','Statut'],
            data.clients.map(function(c) { return [
                c.id_client, c.nom_client, c.numero_cni, c.telephone || '—',
                c.numero_appart ? 'Appart. ' + c.numero_appart : '—',
                fmtDate(c.date_entree), fmtPrix(c.avance_paye || 0),
                colorSolde(c.solde_restant || 0),
                '<span class="reserv-statut s-' + c.statut + '">' + c.statut + '</span>'
            ]; })
        ) + '</div>';
    } catch (err) { el.innerHTML = '<div class="empty-state"><h3>Erreur : ' + err.message + '</h3></div>'; }
}

function loadRapport(type, btn) {
    rapportActif = type;
    if (btn) { document.querySelectorAll('.rtab').forEach(function(t) { t.classList.remove('active'); }); btn.classList.add('active'); }
    loadRapportActif();
}

async function loadRapportActif() {
    var el = document.getElementById('rapportContent');
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner">Chargement...</div>';
    var moisVal = document.getElementById('filtMois') ? document.getElementById('filtMois').value : '';
    var annee, mois;
    if (moisVal) { var parts = moisVal.split('-'); annee = parts[0]; mois = parts[1]; }
    else { annee = new Date().getFullYear(); mois = new Date().getMonth() + 1; }
    try {
        if (rapportActif === 'resume') {
            const data = await api('/rapports/resume?mois=' + mois + '&annee=' + annee);
            var r = data.resume;
            el.innerHTML =
                '<div class="stats-row" style="padding:0;margin-top:16px">' +
                '<div class="stat-card"><div class="stat-val">' + r.total_reservations + '</div><div class="stat-lbl">Réservations totales</div></div>' +
                '<div class="stat-card"><div class="stat-val">' + r.en_cours + '</div><div class="stat-lbl">En cours</div></div>' +
                '<div class="stat-card"><div class="stat-val">' + r.terminees + '</div><div class="stat-lbl">Terminées</div></div>' +
                '<div class="stat-card"><div class="stat-val">' + fmtPrix(r.montant_total_prevu) + '</div><div class="stat-lbl">Montant prévu</div></div>' +
                '<div class="stat-card"><div class="stat-val">' + fmtPrix(r.montant_encaisse) + '</div><div class="stat-lbl">Encaissé</div></div>' +
                '</div>';
        } else {
            const data = await api('/rapports/journal?date=' + new Date().toISOString().split('T')[0]);
            if (!data.journal || !data.journal.length) { el.innerHTML = '<div class="empty-state"><h3>Aucune entrée pour cette date</h3></div>'; return; }
            el.innerHTML = buildTable(
                ['Appart.','Client','Tél.','Montant/j','Jours','Cumulé','Avance','Solde'],
                data.journal.map(function(j) { return [
                    'Appart. ' + j.numero_appart, j.nom_client, j.telephone || '—',
                    fmtPrix(j.montant_jour), j.jours_ecoules, fmtPrix(j.montant_cumule),
                    fmtPrix(j.avance_initiale), colorSolde(j.solde_restant)
                ]; })
            );
        }
    } catch (err) { el.innerHTML = '<div class="empty-state"><h3>Erreur : ' + err.message + '</h3></div>'; }
}

function loadAdmin(section, btn) {
    if (btn) { document.querySelectorAll('.atab').forEach(function(t) { t.classList.remove('active'); }); btn.classList.add('active'); }
    var el = document.getElementById('adminContent');
    if (!el) return;
    if (section === 'employes') loadAdminEmployes(el);
    else if (section === 'appartements') el.innerHTML = '<div style="padding:20px"><button class="btn btn-primary" onclick="showPage(\'appartements\')">Voir les appartements</button></div>';
    else if (section === 'services') el.innerHTML = '<div class="empty-state"><h3>Services additionnels</h3><p>Les demandes apparaissent ici après les réservations.</p></div>';
    else el.innerHTML = '<div class="empty-state"><h3>Journal des accès</h3></div>';
}

async function loadAdminEmployes(el) {
    el.innerHTML = '<div class="loading-spinner">Chargement...</div>';
    try {
        const data = await api('/employes');
        if (!data.employes || !data.employes.length) { el.innerHTML = '<div class="empty-state"><h3>Aucun employé</h3></div>'; return; }
        el.innerHTML = buildTable(
            ['ID','Nom','Poste','Email','Dernière connexion','Statut'],
            data.employes.map(function(e) { return [
                e.id_employee, e.nom_employee, e.poste || '—', e.email || '—',
                fmtDate(e.last_login),
                e.is_active ? '<span style="color:var(--vert-dark);font-weight:600">Actif</span>' : '<span style="color:var(--rouge)">Inactif</span>'
            ]; })
        );
    } catch (err) { el.innerHTML = '<div class="empty-state"><h3>Erreur : ' + err.message + '</h3></div>'; }
}

async function lancerCron() {
    if (!confirm('Lancer la vérification journalière ?')) return;
    try {
        const data = await api('/admin/cron/verif', 'POST');
        toast('Vérification terminée : ' + data.journauxCrees + ' journaux créés', 'success');
        loadDashboard();
    } catch (err) { toast(err.message, 'error'); }
}

function exportCSV(type) {
    if (!type) type = 'reservations';
    if (!currentUser) { showPage('login'); return; }
    var token = localStorage.getItem('token');
    window.open('/api/rapports/export-csv?type=' + type + '&token=' + token);
}

function buildTable(headers, rows) {
    var ths = headers.map(function(h) { return '<th>' + h + '</th>'; }).join('');
    var trs = rows.map(function(r) {
        return '<tr>' + r.map(function(c) { return '<td>' + (c !== null && c !== undefined ? c : '—') + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<table><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
}

function fmtPrix(v) {
    if (!v && v !== 0) return '—';
    return parseFloat(v).toLocaleString('fr-CM') + ' FCFA';
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function colorSolde(v) {
    var n = parseFloat(v) || 0;
    var color = n >= 0 ? 'var(--vert-dark)' : 'var(--rouge)';
    return '<span style="color:' + color + ';font-weight:600">' + fmtPrix(n) + '</span>';
}

function toast(msg, type) {
    if (!type) type = '';
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type + ' show';
    setTimeout(function() { el.classList.remove('show'); }, 3500);
}