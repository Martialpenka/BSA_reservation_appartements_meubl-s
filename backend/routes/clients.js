const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { verifyToken, isClient, isEmploye, isGestionnaire, logAction } = require('../middleware/auth');

router.get('/', verifyToken, isEmploye, async (req, res) => {
    try {
        const { statut, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        let conditions = [], params = [];
        if (statut) { conditions.push(`c.statut = $${conditions.length+1}`); params.push(statut); }
        if (search) {
            conditions.push(`(c.nom_client ILIKE $${conditions.length+1} OR c.numero_cni ILIKE $${conditions.length+1})`);
            params.push(`%${search}%`);
        }
        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        params.push(limit, offset);
        const result = await query(`
            SELECT c.*, a.numero_appart, a.categorie, b.nom_batiment
            FROM client c
            LEFT JOIN appartement a ON a.id_appart = c.id_appartement
            LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
            ${where}
            ORDER BY c.created_at DESC
            LIMIT $${params.length-1} OFFSET $${params.length}`, params);
        res.json({ clients: result.rows, total: result.rowCount });
    } catch (err) {
        console.error('[CLIENTS] GET:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/:id', verifyToken, isClient, async (req, res) => {
    try {
        const result = await query(`
            SELECT c.*, a.numero_appart, a.categorie, a.prix_unitaire as appart_prix,
                   a.accomodation, b.nom_batiment
            FROM client c
            LEFT JOIN appartement a ON a.id_appart = c.id_appartement
            LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
            WHERE c.id_client = $1`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Client introuvable' });
        if (req.user.role === 'client') {
            const c = await query('SELECT id_client FROM client WHERE id_user = $1', [req.user.id_user]);
            if (!c.rows.length || c.rows[0].id_client !== parseInt(req.params.id)) {
                return res.status(403).json({ error: 'Accès refusé' });
            }
        }
        res.json({ client: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/:id', verifyToken, isEmploye, async (req, res) => {
    const { nom_client, adresse_client, telephone, statut } = req.body;
    try {
        const result = await query(`
            UPDATE client SET
                nom_client     = COALESCE($1, nom_client),
                adresse_client = COALESCE($2, adresse_client),
                telephone      = COALESCE($3, telephone),
                statut         = COALESCE($4, statut),
                updated_at     = NOW()
            WHERE id_client = $5 RETURNING *`,
            [nom_client, adresse_client, telephone, statut, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Client introuvable' });
        await logAction(req, 'UPDATE_CLIENT', 'client', req.params.id);
        res.json({ client: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur de mise à jour' });
    }
});

module.exports = router;