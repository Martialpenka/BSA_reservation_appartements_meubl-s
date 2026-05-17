require('dotenv').config();

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

// ── Routes API ────────────────────────────────────────────────
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

// ── Route setup utilisateurs ──────────────────────────────────
app.get('/api/setup', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const { query } = require('./config/db');

        const hashGest = await bcrypt.hash('Gestionnaire@123', 12);
        const hashEmp  = await bcrypt.hash('Employe@123', 12);
        const hashCli  = await bcrypt.hash('Client@123', 12);

        await query(
            `INSERT INTO users (email, password_hash, role)
             SELECT 'gestionnaire@appart.com', $1, 'gestionnaire'
             WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'gestionnaire@appart.com')`,
            [hashGest]
        );
        await query(
            `INSERT INTO users (email, password_hash, role)
             SELECT 'employe1@appart.com', $1, 'employe'
             WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'employe1@appart.com')`,
            [hashEmp]
        );
        await query(
            `INSERT INTO users (email, password_hash, role)
             SELECT 'client1@test.com', $1, 'client'
             WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'client1@test.com')`,
            [hashCli]
        );
        await query(
            `INSERT INTO employee (id_user, nom_employee, poste)
             SELECT u.id_user, 'Marie Gestionnaire', 'Gestionnaire'
             FROM users u
             WHERE u.email = 'gestionnaire@appart.com'
             AND NOT EXISTS (SELECT 1 FROM employee e WHERE e.id_user = u.id_user)`
        );
        await query(
            `INSERT INTO employee (id_user, nom_employee, poste)
             SELECT u.id_user, 'Jean Employe', 'Receptionniste'
             FROM users u
             WHERE u.email = 'employe1@appart.com'
             AND NOT EXISTS (SELECT 1 FROM employee e WHERE e.id_user = u.id_user)`
        );
        await query(
            `INSERT INTO client (id_user, nom_client, numero_cni, email)
             SELECT u.id_user, 'Paul Client', 'CM-TEST-001', 'client1@test.com'
             FROM users u
             WHERE u.email = 'client1@test.com'
             AND NOT EXISTS (SELECT 1 FROM client c WHERE c.id_user = u.id_user)`
        );

        res.json({ message: 'Utilisateurs crees avec succes !',
            comptes: [
                { email: 'gestionnaire@appart.com', password: 'Gestionnaire@123', role: 'gestionnaire' },
                { email: 'employe1@appart.com',     password: 'Employe@123',      role: 'employe' },
                { email: 'client1@test.com',         password: 'Client@123',       role: 'client' }
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── SPA fallback (TOUJOURS EN DERNIER) ───────────────────────
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