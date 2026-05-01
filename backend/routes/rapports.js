const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { verifyToken, isEmploye, isGestionnaire } = require('../middleware/auth');

router.get('/journal', verifyToken, isEmploye, async (req, res) => {
    try {
        const { date } = req.query;
        const dateVerif = date || new Date().toISOString().split('T')[0];
        const result = await query(`
            SELECT jj.*, a.numero_appart, a.categorie, b.nom_batiment, c.nom_client, c.telephone
            FROM journal_journalier jj
            JOIN appartement a ON a.id_appart = jj.id_appartement
            LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
            JOIN client c ON c.id_client = jj.id_client
            WHERE jj.date_verif = $1
            ORDER BY b.nom_batiment, a.numero_appart`, [dateVerif]);
        res.json({ journal: result.rows, date: dateVerif });
    } catch (err) {
        console.error('[RAPPORTS] journal:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/loues-jour', verifyToken, isEmploye, async (req, res) => {
    try {
        const result = await query('SELECT * FROM vue_apparts_loues_jour ORDER BY jours_ecoules DESC');
        res.json({ loues: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/historique', verifyToken, isEmploye, async (req, res) => {
    const { periode = 'mensuel', annee, mois } = req.query;
    const a = annee || new Date().getFullYear();
    const m = mois  || new Date().getMonth() + 1;
    try {
        let sql, params = [m, a];
        if (periode === 'journalier') {
            sql = `
                SELECT DATE(r.created_at) AS jour,
                       COUNT(*) AS nb_reservations,
                       SUM(r.montant_total) AS total,
                       b.nom_batiment
                FROM reservation r
                LEFT JOIN appartement a2 ON a2.id_appart = r.id_appartement
                LEFT JOIN batiment b ON b.id_batiment = a2.id_batiment
                WHERE r.statut != 'annulee'
                  AND EXTRACT(MONTH FROM r.created_at) = $1
                  AND EXTRACT(YEAR  FROM r.created_at) = $2
                GROUP BY jour, b.nom_batiment ORDER BY jour DESC`;
        } else if (periode === 'hebdomadaire') {
            sql = `
                SELECT DATE_TRUNC('week', r.created_at) AS semaine,
                       COUNT(*) AS nb_reservations,
                       SUM(r.montant_total) AS total
                FROM reservation r
                WHERE r.statut != 'annulee'
                  AND EXTRACT(YEAR FROM r.created_at) = $2
                GROUP BY semaine ORDER BY semaine DESC`;
        } else {
            sql = `SELECT * FROM vue_historique_mensuel WHERE EXTRACT(YEAR FROM mois) = $2`;
        }
        const result = await query(sql, params);
        res.json({ historique: result.rows, periode, mois: m, annee: a });
    } catch (err) {
        console.error('[RAPPORTS] historique:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/resume', verifyToken, isEmploye, async (req, res) => {
    try {
        const { mois, annee } = req.query;
        const m = mois  || new Date().getMonth() + 1;
        const a = annee || new Date().getFullYear();
        const resume = await query(`
            SELECT
                COUNT(r.id_reservation) FILTER (WHERE r.statut != 'annulee')    AS total_reservations,
                COUNT(r.id_reservation) FILTER (WHERE r.statut = 'en_cours')    AS en_cours,
                COUNT(r.id_reservation) FILTER (WHERE r.statut = 'terminee')    AS terminees,
                COUNT(r.id_reservation) FILTER (WHERE r.statut = 'annulee')     AS annulees,
                COALESCE(SUM(r.montant_total) FILTER (WHERE r.statut != 'annulee'), 0) AS montant_total_prevu,
                COALESCE(SUM(p.montant), 0) AS montant_encaisse,
                COUNT(DISTINCT r.id_appartement) AS apparts_utilises,
                ROUND(AVG(r.nombre_jours) FILTER (WHERE r.statut != 'annulee'), 1) AS duree_moyenne
            FROM reservation r
            LEFT JOIN paiement p ON p.id_reservation = r.id_reservation
                AND EXTRACT(MONTH FROM p.date_paiement) = $1
                AND EXTRACT(YEAR  FROM p.date_paiement) = $2
            WHERE EXTRACT(MONTH FROM r.date_entree) = $1
              AND EXTRACT(YEAR  FROM r.date_entree) = $2`, [m, a]);
        const parBatiment = await query(`
            SELECT b.nom_batiment,
                   COUNT(r.id_reservation) AS nb,
                   COALESCE(SUM(r.montant_total), 0) AS total
            FROM reservation r
            JOIN appartement ap ON ap.id_appart = r.id_appartement
            JOIN batiment b     ON b.id_batiment = ap.id_batiment
            WHERE EXTRACT(MONTH FROM r.date_entree) = $1
              AND EXTRACT(YEAR  FROM r.date_entree) = $2
              AND r.statut != 'annulee'
            GROUP BY b.nom_batiment ORDER BY total DESC`, [m, a]);
        res.json({ resume: resume.rows[0], par_batiment: parBatiment.rows, mois: m, annee: a });
    } catch (err) {
        console.error('[RAPPORTS] resume:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/logs', verifyToken, isGestionnaire, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const result = await query(`
            SELECT l.*, u.email
            FROM logs_activite l
            LEFT JOIN users u ON u.id_user = l.id_user
            ORDER BY l.created_at DESC
            LIMIT $1 OFFSET $2`, [limit, offset]);
        res.json({ logs: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/export-csv', verifyToken, isEmploye, async (req, res) => {
    try {
        const { type = 'reservations', date_debut, date_fin } = req.query;
        let result;
        if (type === 'loues') {
            result = await query('SELECT * FROM vue_apparts_loues_jour');
        } else if (type === 'journal') {
            result = await query(
                'SELECT * FROM journal_journalier WHERE date_verif = $1',
                [new Date().toISOString().split('T')[0]]
            );
        } else {
            result = await query(`
                SELECT r.id_reservation, c.nom_client, c.numero_cni, c.telephone as tel_client,
                       a.numero_appart, b.nom_batiment, r.date_entree, r.date_sortie,
                       r.nombre_jours, r.prix_unitaire, r.montant_total, r.statut, r.created_at
                FROM reservation r
                JOIN client c      ON c.id_client     = r.id_client
                JOIN appartement a ON a.id_appart      = r.id_appartement
                LEFT JOIN batiment b ON b.id_batiment  = a.id_batiment
                WHERE ($1::date IS NULL OR r.date_entree >= $1)
                  AND ($2::date IS NULL OR r.date_entree <= $2)
                ORDER BY r.date_entree DESC`,
                [date_debut || null, date_fin || null]
            );
        }
        if (!result.rows.length) return res.status(404).json({ error: 'Aucune donnée à exporter' });
        const headers = Object.keys(result.rows[0]).join(';');
        const rows    = result.rows.map(r =>
            Object.values(r).map(v => (v === null ? '' : String(v).replace(/;/g, ','))).join(';')
        );
        const csv = [headers, ...rows].join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=export_${type}_${Date.now()}.csv`);
        res.send('\uFEFF' + csv);
    } catch (err) {
        console.error('[RAPPORTS] export-csv:', err.message);
        res.status(500).json({ error: 'Erreur lors de l\'export' });
    }
});

module.exports = router;
