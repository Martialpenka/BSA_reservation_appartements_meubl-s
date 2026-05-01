const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { verifyToken, isEmploye, logAction } = require('../middleware/auth');

router.get('/', verifyToken, isEmploye, async (req, res) => {
    try {
        const { id_client, id_reservation, date_debut, date_fin } = req.query;
        let conditions = [], params = [];
        if (id_client)     { conditions.push(`p.id_client = $${conditions.length+1}`);           params.push(id_client); }
        if (id_reservation){ conditions.push(`p.id_reservation = $${conditions.length+1}`);      params.push(id_reservation); }
        if (date_debut)    { conditions.push(`DATE(p.date_paiement) >= $${conditions.length+1}`); params.push(date_debut); }
        if (date_fin)      { conditions.push(`DATE(p.date_paiement) <= $${conditions.length+1}`); params.push(date_fin); }
        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const result = await query(`
            SELECT p.*, c.nom_client, a.numero_appart
            FROM paiement p
            JOIN client c ON c.id_client = p.id_client
            LEFT JOIN reservation r ON r.id_reservation = p.id_reservation
            LEFT JOIN appartement a ON a.id_appart = r.id_appartement
            ${where}
            ORDER BY p.date_paiement DESC`, params);
        res.json({ paiements: result.rows });
    } catch (err) {
        console.error('[PAIEMENT] GET:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/', verifyToken, isEmploye, async (req, res) => {
    const { id_reservation, id_client, montant, type_paiement, mode_paiement, reference, notes } = req.body;
    if (!id_client || !montant) return res.status(400).json({ error: 'Client et montant requis' });
    try {
        const result = await query(`
            INSERT INTO paiement (id_reservation, id_client, montant, type_paiement, mode_paiement, reference, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [id_reservation, id_client, montant, type_paiement || 'avance',
             mode_paiement || 'especes', reference, notes]
        );
        await query(`
            UPDATE client SET
                avance_paye   = avance_paye + $1,
                solde_restant = montant_total - (avance_paye + $1),
                updated_at    = NOW()
            WHERE id_client = $2`, [montant, id_client]);
        await logAction(req, 'CREATE_PAIEMENT', 'paiement', result.rows[0].id_paiement, { montant });
        res.status(201).json({ paiement: result.rows[0] });
    } catch (err) {
        console.error('[PAIEMENT] POST:', err.message);
        res.status(500).json({ error: 'Erreur d\'enregistrement du paiement' });
    }
});

module.exports = router;
