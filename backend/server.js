require('dotenv').config();

// ── Debug variables ───────────────────────────────────────────
console.log('[ENV] DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINIE' : 'NON DEFINIE');
console.log('[ENV] DB_HOST:', process.env.DB_HOST || 'NON DEFINI');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV || 'NON DEFINI');
console.log('[ENV] PORT:', process.env.PORT || 'NON DEFINI');

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const { pool }  = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

async function initDatabase() {
    try {
        await pool.query('SELECT 1');
        console.log('[DB] Connexion PostgreSQL OK');
        const fs = require('fs');
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(sql);
        console.log('[DB] Base de donnees initialisee avec succes');
    } catch (err) {
        console.error('[DB] ERREUR:', err.message);
    }
}

initDatabase();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('[:date[clf]] :method :url :status :response-time ms'));
app.use(cors({ origin: '*', credentials: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Trop de requetes' }
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Trop de tentatives' }
});

app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/appartements', require('./routes/appartements'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/employes',     require('./routes/employes'));
app.use('/api/paiements',    require('./routes/paiements'));
app.use('/api/rapports',     require('./routes/rapports'));

const { verifyToken, isGestionnaire } = require('./middleware/auth');
const { lancerVerificationJournaliere } = require('./cron/verificationJournaliere');

app.post('/api/admin/cron/verif', verifyToken, isGestionnaire, async (req, res) => {
    const result = await lancerVerificationJournaliere();
    res.json(result);
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((err, req, res, next) => {
    console.error('[ERREUR]', err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  BSA - Beautiful Stay by Alliance          ║');
    console.log('║  Serveur : http://0.0.0.0:' + PORT + '           ║');
    console.log('╚═══════════════════════════════════════════╝\n');
    const { planifier } = require('./cron/verificationJournaliere');
    planifier();
});
module.exports = app;