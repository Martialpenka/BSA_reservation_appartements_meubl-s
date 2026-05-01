const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { verifyToken, logAction } = require('../middleware/auth');

router.post('/register', async (req, res) => {
    const { email, password, nom_client, numero_cni, adresse_client, telephone } = req.body;
    if (!email || !password || !nom_client || !numero_cni) {
        return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
    }
    try {
        const existing = await query('SELECT id_user FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email déjà utilisé' });
        }
        const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        const userResult = await query(
            `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'client') RETURNING id_user`,
            [email, hash]
        );
        const id_user = userResult.rows[0].id_user;
        const clientResult = await query(
            `INSERT INTO client (id_user, nom_client, numero_cni, adresse_client, telephone, email)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_client`,
            [id_user, nom_client, numero_cni, adresse_client || '', telephone || '', email]
        );
        res.status(201).json({ message: 'Compte créé avec succès', id_client: clientResult.rows[0].id_client });
    } catch (err) {
        console.error('[AUTH] register:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    try {
        const result = await query(
            'SELECT id_user, email, password_hash, role, is_active FROM users WHERE email = $1',
            [email]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }
        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ error: 'Compte désactivé.' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }
        await query('UPDATE users SET last_login = NOW() WHERE id_user = $1', [user.id_user]);
        let profil = {};
        if (user.role === 'client') {
            const c = await query('SELECT id_client, nom_client FROM client WHERE id_user = $1', [user.id_user]);
            if (c.rows.length > 0) profil = c.rows[0];
        } else {
            const e = await query('SELECT id_employee, nom_employee FROM employee WHERE id_user = $1', [user.id_user]);
            if (e.rows.length > 0) profil = e.rows[0];
        }
        const token = jwt.sign(
            { id_user: user.id_user, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );
        res.json({ message: 'Connexion réussie', token, user: { id_user: user.id_user, email: user.email, role: user.role, ...profil } });
    } catch (err) {
        console.error('[AUTH] login:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/me', verifyToken, async (req, res) => {
    res.json({ user: req.user });
});

router.post('/change-password', verifyToken, async (req, res) => {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
        return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
    }
    try {
        const result = await query('SELECT password_hash FROM users WHERE id_user = $1', [req.user.id_user]);
        const valid = await bcrypt.compare(old_password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
        const hash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        await query('UPDATE users SET password_hash = $1 WHERE id_user = $2', [hash, req.user.id_user]);
        res.json({ message: 'Mot de passe modifié avec succès' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;