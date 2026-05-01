require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'appart_meuble',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false
});

async function init() {
    const client = await pool.connect();
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║  Initialisation base de données       ║');
    console.log('╚══════════════════════════════════════╝\n');

    try {
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        await client.query('BEGIN');
        await client.query(sql);

        const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashGest = await bcrypt.hash('Gestionnaire@123', rounds);
        const hashEmp  = await bcrypt.hash('Employe@123', rounds);
        const hashCli  = await bcrypt.hash('Client@123', rounds);

        await client.query(`UPDATE users SET password_hash = $1 WHERE email = 'gestionnaire@appart.com'`, [hashGest]);
        await client.query(`UPDATE users SET password_hash = $1 WHERE email = 'employe1@appart.com'`,    [hashEmp]);
        await client.query(`UPDATE users SET password_hash = $1 WHERE email = 'client1@test.com'`,       [hashCli]);

        await client.query(`
            INSERT INTO employee (id_user, nom_employee, adresse_employee, telephone, poste)
            SELECT id_user, 'Jean Employé', 'Quartier Bastos, Yaoundé', '+237690000001', 'Réceptionniste'
            FROM users WHERE email = 'employe1@appart.com'
            ON CONFLICT DO NOTHING`);

        await client.query(`
            INSERT INTO employee (id_user, nom_employee, adresse_employee, telephone, poste)
            SELECT id_user, 'Marie Gestionnaire', 'Quartier Omnisport, Yaoundé', '+237690000002', 'Gestionnaire'
            FROM users WHERE email = 'gestionnaire@appart.com'
            ON CONFLICT DO NOTHING`);

        await client.query(`
            INSERT INTO client (id_user, nom_client, numero_cni, adresse_client, telephone, email)
            SELECT id_user, 'Paul Client', 'CM-TEST-001', 'Quartier Melen, Yaoundé', '+237677000001', 'client1@test.com'
            FROM users WHERE email = 'client1@test.com'
            ON CONFLICT (numero_cni) DO NOTHING`);

        await client.query('COMMIT');

        console.log('✅ Schéma SQL créé avec succès');
        console.log('✅ Utilisateurs de test créés\n');
        console.log('═══════════════════════════════════════');
        console.log('  Comptes de test :');
        console.log('  Gestionnaire : gestionnaire@appart.com / Gestionnaire@123');
        console.log('  Employé      : employe1@appart.com    / Employe@123');
        console.log('  Client       : client1@test.com       / Client@123');
        console.log('═══════════════════════════════════════\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur :', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

init();