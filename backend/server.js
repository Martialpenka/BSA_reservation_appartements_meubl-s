require('dotenv').config();
const { pool } = require('./config/db');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
    try {
        await pool.query('SELECT 1');
        console.log('[DB] Connexion PostgreSQL OK');
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(sql);
        console.log('[DB] Base de données initialisée avec succès');
    } catch (err) {
        console.error('[DB] ERREUR CONNEXION:', err.message);
        console.error('[DB] Host:', process.env.DB_HOST);
        console.error('[DB] Port:', process.env.DB_PORT);
        console.error('[DB] Name:', process.env.DB_NAME);
        console.error('[DB] User:', process.env.DB_USER);
    }
}
initDatabase();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('[:date[clf]] :method :url :status :response-time ms'));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? [process.env.APP_URL] : '*',
    credentials: true
}));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: { error: 'Trop de requêtes, réessayez plus tard' }
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Trop de tentatives' } });

app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Fichiers statiques (frontend) ────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Routes API ────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/appartements', require('./routes/appartements'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/employes',     require('./routes/employes'));
app.use('/api/paiements',    require('./routes/paiements'));
app.use('/api/rapports',     require('./routes/rapports'));

// ── CRON manuel (gestionnaire) ────────────────────────────────
const { verifyToken, isGestionnaire } = require('./middleware/auth');
const { lancerVerificationJournaliere } = require('./cron/verificationJournaliere');

app.post('/api/admin/cron/verif', verifyToken, isGestionnaire, async (req, res) => {
    const result = await lancerVerificationJournaliere();
    res.json(result);
});

// ── Santé de l'API ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Gestion erreurs ───────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERREUR]', err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Erreur interne du serveur' });
});

// ── Démarrage ─────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════════════╗`);
    console.log(`║  🏠 Gestion Appartements Meublés           ║`);
    console.log(`║  Serveur : http://localhost:${PORT}           ║`);
    console.log(`╚═══════════════════════════════════════════╝\n`);
    const { planifier } = require('./cron/verificationJournaliere');
    planifier();
});

module.exports = app;
