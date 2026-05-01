// backend/routes/reservations.js
const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/db');
const { verifyToken, isClient, isEmploye, isGestionnaire, logAction } = require('../middleware/auth');

// ── GET /api/reservations ─────────────────────────────────────
// Client : ses réservations | Employé/Gestionnaire : toutes
router.get('/', verifyToken, isClient, async (req, res) => {
    try {
        let sql, params = [];

        if (req.user.role === 'client') {
            // Client ne voit que ses propres réservations
            const c = await query('SELECT id_client FROM client WHERE id_user = $1', [req.user.id_user]);
            if (c.rows.length === 0) return res.json({ reservations: [] });
            sql = `
                SELECT r.*, a.categorie, a.numero_appart, b.nom_batiment as batiment_nom,
                       c.nom_client, a.accomodation
                FROM reservation r
                JOIN appartement a ON a.id_appart = r.id_appartement
                LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
                JOIN client c ON c.id_client = r.id_client
                WHERE r.id_client = $1
                ORDER BY r.created_at DESC`;
            params = [c.rows[0].id_client];
        } else {
            // Employé/Gestionnaire : toutes avec filtres optionnels
            const { statut, date_debut, date_fin, batiment, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;
            let conditions = [];

            if (statut) { conditions.push(`r.statut = $${conditions.length + 1}`); params.push(statut); }
            if (batiment) { conditions.push(`r.nom_batiment = $${conditions.length + 1}`); params.push(batiment); }
            if (date_debut) { conditions.push(`r.date_entree >= $${conditions.length + 1}`); params.push(date_debut); }
            if (date_fin) { conditions.push(`r.date_entree <= $${conditions.length + 1}`); params.push(date_fin); }

            const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
            params.push(limit, offset);

            sql = `
                SELECT r.*, a.categorie, a.numero_appart, b.nom_batiment as batiment_nom,
                       c.nom_client, c.telephone as tel_client, e.nom_employee
                FROM reservation r
                JOIN appartement a ON a.id_appart = r.id_appartement
                LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
                JOIN client c ON c.id_client = r.id_client
                LEFT JOIN employee e ON e.id_employee = r.id_employee
                ${where}
                ORDER BY r.created_at DESC
                LIMIT $${params.length - 1} OFFSET $${params.length}`;
        }

        const result = await query(sql, params);
        res.json({ reservations: result.rows, total: result.rowCount });
    } catch (err) {
        console.error('[RESERV] GET:', err.message);
        res.status(500).json({ error: 'Erreur de récupération des réservations' });
    }
});

// ── GET /api/reservations/historique ─────────────────────────
// Historique journalier/hebdo/mensuel pour employé+
router.get('/historique', verifyToken, isEmploye, async (req, res) => {
    const { periode = 'mensuel', annee, mois } = req.query;
    try {
        let sql;
        if (periode === 'journalier') {
            sql = `SELECT DATE(r.date_entree) as jour,
                          COUNT(*) as nb_reservations,
                          SUM(r.montant_total) as total,
                          b.nom_batiment
                   FROM reservation r
                   LEFT JOIN appartement a ON a.id_appart = r.id_appartement
                   LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
                   WHERE r.statut != 'annulee'
                   AND EXTRACT(MONTH FROM r.date_entree) = $1
                   AND EXTRACT(YEAR FROM r.date_entree) = $2
                   GROUP BY jour, b.nom_batiment ORDER BY jour DESC`;
        } else if (periode === 'hebdomadaire') {
            sql = `SELECT DATE_TRUNC('week', r.date_entree) as semaine,
                          COUNT(*) as nb_reservations,
                          SUM(r.montant_total) as total
                   FROM reservation r
                   WHERE r.statut != 'annulee'
                   AND EXTRACT(YEAR FROM r.date_entree) = $2
                   GROUP BY semaine ORDER BY semaine DESC`;
        } else {
            sql = `SELECT * FROM vue_historique_mensuel WHERE EXTRACT(YEAR FROM mois) = $2`;
        }

        const result = await query(sql, [mois || new Date().getMonth() + 1, annee || new Date().getFullYear()]);
        res.json({ historique: result.rows, periode });
    } catch (err) {
        res.status(500).json({ error: 'Erreur historique' });
    }
});

// ── GET /api/reservations/:id ─────────────────────────────────
router.get('/:id', verifyToken, isClient, async (req, res) => {
    try {
        const result = await query(`
            SELECT r.*, a.categorie, a.numero_appart, a.accomodation, a.restriction,
                   b.nom_batiment, b.email as bat_email, b.telephone as bat_tel,
                   c.nom_client, c.numero_cni, c.telephone as tel_client, c.avance_paye
            FROM reservation r
            JOIN appartement a ON a.id_appart = r.id_appartement
            LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
            JOIN client c ON c.id_client = r.id_client
            WHERE r.id_reservation = $1`, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Réservation introuvable' });

        const reservation = result.rows[0];
        // Un client ne peut voir que ses propres réservations
        if (req.user.role === 'client') {
            const c = await query('SELECT id_client FROM client WHERE id_user = $1', [req.user.id_user]);
            if (!c.rows.length || c.rows[0].id_client !== reservation.id_client) {
                return res.status(403).json({ error: 'Accès refusé' });
            }
        }

        res.json({ reservation });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── POST /api/reservations ────────────────────────────────────
// Créer une réservation (client via web, ou employé/gestionnaire)
router.post('/', verifyToken, isClient, async (req, res) => {
    const {
        id_client, id_appartement, date_entree, date_sortie,
        notes, avance_paye = 0
    } = req.body;

    if (!id_appartement || !date_entree) {
        return res.status(400).json({ error: 'Appartement et date d\'entrée requis' });
    }

    try {
        // Vérifier disponibilité appartement
        const appart = await query(
            'SELECT * FROM appartement WHERE id_appart = $1 AND disponible = TRUE',
            [id_appartement]
        );
        if (appart.rows.length === 0) {
            return res.status(409).json({ error: 'Appartement non disponible' });
        }

        // Vérifier conflit de dates
        const conflict = await query(`
            SELECT id_reservation FROM reservation
            WHERE id_appartement = $1 AND statut IN ('en_cours','confirmee')
            AND (date_entree, COALESCE(date_sortie, '9999-12-31')) OVERLAPS ($2::date, $3::date)`,
            [id_appartement, date_entree, date_sortie || '9999-12-31']
        );
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'L\'appartement est déjà réservé sur ces dates' });
        }

        // Résoudre id_client pour un client connecté
        let clientId = id_client;
        if (req.user.role === 'client' && !id_client) {
            const c = await query('SELECT id_client FROM client WHERE id_user = $1', [req.user.id_user]);
            if (!c.rows.length) return res.status(400).json({ error: 'Profil client introuvable' });
            clientId = c.rows[0].id_client;
        }

        const a = appart.rows[0];
        const nbJours = date_sortie
            ? Math.max(1, Math.ceil((new Date(date_sortie) - new Date(date_entree)) / 86400000))
            : 0;
        const montantTotal = nbJours * a.prix_unitaire;

        // Obtenir infos batiment
        let batimentNom = null, numeroBatiment = null;
        if (a.id_batiment) {
            const b = await query('SELECT nom_batiment FROM batiment WHERE id_batiment = $1', [a.id_batiment]);
            if (b.rows.length) batimentNom = b.rows[0].nom_batiment;
        }

        // Résoudre id_employee
        let employeeId = null;
        if (req.user.role === 'employe' || req.user.role === 'gestionnaire') {
            const e = await query('SELECT id_employee FROM employee WHERE id_user = $1', [req.user.id_user]);
            if (e.rows.length) employeeId = e.rows[0].id_employee;
        }

        const result = await query(`
            INSERT INTO reservation
                (id_client, id_appartement, id_employee, numero_appart, prix_unitaire, montant_total,
                 date_entree, date_sortie, nombre_jours, nom_batiment, numero_batiment, source, notes, statut)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'en_cours')
            RETURNING *`,
            [clientId, id_appartement, employeeId, a.numero_appart, a.prix_unitaire, montantTotal,
             date_entree, date_sortie || null, nbJours, batimentNom, numeroBatiment,
             req.user.role === 'client' ? 'web' : req.user.role, notes || '']
        );

        // Mettre à jour le client (avance, montant, dates)
        await query(`
            UPDATE client SET
                id_appartement = $1, date_entree = $2, date_sortie = $3,
                prix_unitaire = $4, montant_total = $5,
                avance_paye = avance_paye + $6,
                solde_restant = $5 - (avance_paye + $6),
                statut = 'actif', updated_at = NOW()
            WHERE id_client = $7`,
            [id_appartement, date_entree, date_sortie || null, a.prix_unitaire,
             montantTotal, avance_paye, clientId]
        );

        // Marquer appartement comme non disponible si date_entree = aujourd'hui
        if (new Date(date_entree).toDateString() === new Date().toDateString()) {
            await query('UPDATE appartement SET disponible = FALSE WHERE id_appart = $1', [id_appartement]);
        }

        await logAction(req, 'CREATE_RESERVATION', 'reservation', result.rows[0].id_reservation);
        res.status(201).json({ message: 'Réservation créée', reservation: result.rows[0] });
    } catch (err) {
        console.error('[RESERV] POST:', err.message);
        res.status(500).json({ error: 'Erreur de création de la réservation' });
    }
});

// ── DELETE /api/reservations/:id ─────────────────────────────
// Client : dans délai 24h | Employé/Gestionnaire : toujours
router.delete('/:id', verifyToken, isClient, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM reservation WHERE id_reservation = $1', [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Réservation introuvable' });

        const reserv = result.rows[0];

        if (req.user.role === 'client') {
            // Vérifier que c'est sa réservation
            const c = await query('SELECT id_client FROM client WHERE id_user = $1', [req.user.id_user]);
            if (!c.rows.length || c.rows[0].id_client !== reserv.id_client) {
                return res.status(403).json({ error: 'Accès refusé' });
            }
            // Vérifier délai de 24h
            const createdAt = new Date(reserv.created_at);
            const now = new Date();
            const diffH = (now - createdAt) / 3600000;
            if (diffH > 24) {
                return res.status(403).json({
                    error: 'Délai dépassé',
                    message: 'Vous ne pouvez annuler une réservation que dans les 24 heures suivant sa création'
                });
            }
        }

        await query(
            `UPDATE reservation SET statut = 'annulee', updated_at = NOW()
             WHERE id_reservation = $1`, [req.params.id]
        );

        // Remettre appartement disponible si plus de réservations actives
        const active = await query(
            `SELECT id_reservation FROM reservation
             WHERE id_appartement = $1 AND statut IN ('en_cours','confirmee')`,
            [reserv.id_appartement]
        );
        if (active.rows.length === 0) {
            await query('UPDATE appartement SET disponible = TRUE WHERE id_appart = $1', [reserv.id_appartement]);
        }

        await logAction(req, 'CANCEL_RESERVATION', 'reservation', req.params.id);
        res.json({ message: 'Réservation annulée avec succès' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur d\'annulation' });
    }
});

// ── PATCH /api/reservations/:id/statut ───────────────────────
router.patch('/:id/statut', verifyToken, isEmploye, async (req, res) => {
    const { statut } = req.body;
    const allowed = ['en_cours', 'confirmee', 'terminee', 'annulee'];
    if (!allowed.includes(statut)) return res.status(400).json({ error: 'Statut invalide' });

    try {
        await query(
            'UPDATE reservation SET statut = $1, updated_at = NOW() WHERE id_reservation = $2',
            [statut, req.params.id]
        );
        await logAction(req, 'UPDATE_RESERVATION_STATUT', 'reservation', req.params.id, { statut });
        res.json({ message: 'Statut mis à jour' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
