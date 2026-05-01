const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { verifyToken, isEmploye, isGestionnaire, logAction } = require('../middleware/auth');

router.get('/', verifyToken, isGestionnaire, async (req, res) => {
    try {
        const result = await query(`
            SELECT e.*, u.email, u.role, u.is_active, u.last_login
            FROM employee e
            LEFT JOIN users u ON u.id_user = e.id_user
            ORDER BY e.nom_employee`);
        res.json({ employes: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/:id', verifyToken, isEmploye, async (req, res) => {
    try {
        const result = await query(`
            SELECT e.*, u.email, u.is_active, u.last_login
            FROM employee e
            LEFT JOIN users u ON u.id_user = e.id_user
            WHERE e.id_employee = $1`, [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Employé introuvable' });
        res.json({ employe: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/', verifyToken, isGestionnaire, async (req, res) => {
    const { email, password, nom_employee, adresse_employee, telephone, poste } = req.body;
    if (!email || !password || !nom_employee) {
        return res.status(400).json({ error: 'Email, mot de passe et nom requis' });
    }
    try {
        const existing = await query('SELECT id_user FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Email déjà utilisé' });
        const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        const user = await query(
            `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'employe') RETURNING id_user`,
            [email, hash]
        );
        const emp = await query(`
            INSERT INTO employee (id_user, nom_employee, adresse_employee, telephone, poste)
            VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [user.rows[0].id_user, nom_employee, adresse_employee || '', telephone || '', poste || '']
        );
        await logAction(req, 'CREATE_EMPLOYE', 'employee', emp.rows[0].id_employee);
        res.status(201).json({ employe: emp.rows[0] });
    } catch (err) {
        console.error('[EMPLOYE] POST:', err.message);
        res.status(500).json({ error: 'Erreur de création de l\'employé' });
    }
});

router.put('/:id', verifyToken, isGestionnaire, async (req, res) => {
    const { nom_employee, adresse_employee, telephone, poste } = req.body;
    try {
        const result = await query(`
            UPDATE employee SET
                nom_employee     = COALESCE($1, nom_employee),
                adresse_employee = COALESCE($2, adresse_employee),
                telephone        = COALESCE($3, telephone),
                poste            = COALESCE($4, poste)
            WHERE id_employee = $5 RETURNING *`,
            [nom_employee, adresse_employee, telephone, poste, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Employé introuvable' });
        await logAction(req, 'UPDATE_EMPLOYE', 'employee', req.params.id);
        res.json({ employe: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erreur de mise à jour' });
    }
});

router.patch('/:id/acces', verifyToken, isGestionnaire, async (req, res) => {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active doit être true ou false' });
    }
    try {
        const emp = await query('SELECT id_user FROM employee WHERE id_employee = $1', [req.params.id]);
        if (!emp.rows.length) return res.status(404).json({ error: 'Employé introuvable' });
        await query('UPDATE users SET is_active = $1 WHERE id_user = $2', [is_active, emp.rows[0].id_user]);
        await logAction(req, is_active ? 'ACTIVATE_ACCOUNT' : 'DEACTIVATE_ACCOUNT', 'users', emp.rows[0].id_user);
        res.json({ message: is_active ? 'Compte activé' : 'Compte désactivé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.patch('/:id/reset-password', verifyToken, isGestionnaire, async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
        return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });
    }
    try {
        const emp = await query('SELECT id_user FROM employee WHERE id_employee = $1', [req.params.id]);
        if (!emp.rows.length) return res.status(404).json({ error: 'Employé introuvable' });
        const hash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        await query('UPDATE users SET password_hash = $1 WHERE id_user = $2', [hash, emp.rows[0].id_user]);
        await logAction(req, 'RESET_PASSWORD', 'users', emp.rows[0].id_user);
        res.json({ message: 'Mot de passe réinitialisé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.delete('/:id', verifyToken, isGestionnaire, async (req, res) => {
    try {
        const emp = await query('SELECT id_user FROM employee WHERE id_employee = $1', [req.params.id]);
        if (!emp.rows.length) return res.status(404).json({ error: 'Employé introuvable' });
        await query('DELETE FROM employee WHERE id_employee = $1', [req.params.id]);
        await query('UPDATE users SET is_active = FALSE WHERE id_user = $1', [emp.rows[0].id_user]);
        await logAction(req, 'DELETE_EMPLOYE', 'employee', req.params.id);
        res.json({ message: 'Employé supprimé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur de suppression' });
    }
});

module.exports = router;