const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { verifyToken, isClient, isEmploye, isGestionnaire, logAction } = require('../middleware/auth');

router.get('/', async (req, res) => {
    try {
        const { categorie, batiment, capacite, disponible, prix_max, prix_min } = req.query;
        let conditions = [], params = [];
        if (categorie)  { conditions.push(`a.categorie = $${conditions.length+1}`); params.push(categorie); }
        if (capacite)   { conditions.push(`a.capacite = $${conditions.length+1}`); params.push(capacite); }
        if (batiment)   { conditions.push(`b.nom_batiment = $${conditions.length+1}`); params.push(batiment); }
        if (disponible !== undefined) { conditions.push(`a.disponible = $${conditions.length+1}`); params.push(disponible === 'true'); }
        if (prix_min)   { conditions.push(`a.prix_unitaire >= $${conditions.length+1}`); params.push(prix_min); }
        if (prix_max)   { conditions.push(`a.prix_unitaire <= $${conditions.length+1}`); params.push(prix_max); }
        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const result = await query(
            `SELECT a.*, b.nom_batiment, b.email as bat_email, b.telephone as bat_tel
             FROM appartement a
             LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
             ${where}
             ORDER BY a.categorie, a.prix_unitaire`, params);
        res.json({ appartements: result.rows });
    } catch (err) {
        console.error('[APPART] GET:', err.message);
        res.status(500).json({ error: 'Erreur de récupération des appartements' });
    }
});

router.get('/dashboard', verifyToken, isEmploye, async (req, res) => {
    try {
        const dashboard = await query('SELECT * FROM vue_dashboard');
        const loues = await query('SELECT * FROM vue_apparts_loues_jour ORDER BY jours_ecoules DESC LIMIT 20');
        res.json({ dashboard: dashboard.rows[0], loues_aujourd_hui: loues.rows });
    } catch (err) {
        console.error('[APPART] dashboard:', err.message);
        res.status(500).json({ error: 'Erreur dashboard' });
    }
});

router.get('/batiments/all', async (req, res) => {
    try {
        const result = await query('SELECT * FROM batiment ORDER BY nom_batiment');
        res.json({ batiments: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const result = await query(
            `SELECT a.*, b.nom_batiment, b.email as bat_email, b.telephone as bat_tel, b.adresse as bat_adresse
             FROM appartement a
             LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
             WHERE a.id_appart = $1`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Appartement introuvable' });
        res.json({ appartement: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/', verifyToken, isGestionnaire, async (req, res) => {
    const { id_batiment, categorie, prix_unitaire, capacite, telephone_appart, numero_appart, accomodation, restriction } = req.body;
    if (!categorie || !prix_unitaire || !capacite) {
        return res.status(400).json({ error: 'Catégorie, prix et capacité requis' });
    }
    try {
        const result = await query(
            `INSERT INTO appartement (id_batiment, categorie, prix_unitaire, capacite, telephone_appart, numero_appart, accomodation, restriction)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [id_batiment, categorie, prix_unitaire, capacite, telephone_appart, numero_appart, accomodation, restriction]
        );
        await logAction(req, 'CREATE_APPARTEMENT', 'appartement', result.rows[0].id_appart);
        res.status(201).json({ appartement: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur de création' });
    }
});

router.put('/:id', verifyToken, isGestionnaire, async (req, res) => {
    const { categorie, prix_unitaire, capacite, telephone_appart, accomodation, restriction, disponible } = req.body;
    try {
        const result = await query(
            `UPDATE appartement SET
                categorie        = COALESCE($1, categorie),
                prix_unitaire    = COALESCE($2, prix_unitaire),
                capacite         = COALESCE($3, capacite),
                telephone_appart = COALESCE($4, telephone_appart),
                accomodation     = COALESCE($5, accomodation),
                restriction      = COALESCE($6, restriction),
                disponible       = COALESCE($7, disponible)
             WHERE id_appart = $8 RETURNING *`,
            [categorie, prix_unitaire, capacite, telephone_appart, accomodation, restriction, disponible, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Appartement introuvable' });
        await logAction(req, 'UPDATE_APPARTEMENT', 'appartement', req.params.id);
        res.json({ appartement: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur de mise à jour' });
    }
});

router.delete('/:id', verifyToken, isGestionnaire, async (req, res) => {
    try {
        const reserv = await query(
            `SELECT id_reservation FROM reservation
             WHERE id_appartement = $1 AND statut IN ('en_cours','confirmee')`,
            [req.params.id]
        );
        if (reserv.rows.length > 0) {
            return res.status(409).json({ error: 'Impossible de supprimer : des réservations actives existent' });
        }
        await query('DELETE FROM appartement WHERE id_appart = $1', [req.params.id]);
        await logAction(req, 'DELETE_APPARTEMENT', 'appartement', req.params.id);
        res.json({ message: 'Appartement supprimé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur de suppression' });
    }
});

router.post('/batiments', verifyToken, isGestionnaire, async (req, res) => {
    const { nom_batiment, email, telephone, categorie_batiment, adresse } = req.body;
    try {
        const result = await query(
            `INSERT INTO batiment (nom_batiment, email, telephone, categorie_batiment, adresse)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [nom_batiment, email, telephone, categorie_batiment, adresse]
        );
        res.status(201).json({ batiment: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur de création du bâtiment' });
    }
});

module.exports = router;