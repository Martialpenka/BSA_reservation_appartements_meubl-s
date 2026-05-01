const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'appart_meuble',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false
});

const query = async (text, params) => {
    const res = await pool.query(text, params);
    return res;
};

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requis' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await query(
            'SELECT id_user, email, role, is_active FROM users WHERE id_user = $1',
            [decoded.id_user]
        );
        if (result.rows.length === 0 || !result.rows[0].is_active) {
            return res.status(401).json({ error: 'Compte inactif ou introuvable' });
        }
        req.user = result.rows[0];
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expirée' });
        }
        return res.status(401).json({ error: 'Token invalide' });
    }
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        next();
    };
};

const isClient      = requireRole('client', 'employe', 'gestionnaire');
const isEmploye     = requireRole('employe', 'gestionnaire');
const isGestionnaire = requireRole('gestionnaire');

const logAction = async (req, action, tableCible = null, idCible = null, details = {}) => {
    try {
        await query(
            `INSERT INTO logs_activite (id_user, action, table_cible, id_cible, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user?.id_user || null, action, tableCible, idCible, JSON.stringify(details), req.ip]
        );
    } catch (err) {
        console.error('[LOG] Erreur:', err.message);
    }
};

module.exports = { query, verifyToken, requireRole, isClient, isEmploye, isGestionnaire, logAction };