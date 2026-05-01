const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'appart_meuble',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: false
});

pool.on('error', (err) => {
    console.error('[DB] Erreur PostgreSQL:', err.message);
});

const query = async (text, params) => {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (err) {
        console.error('[DB] Erreur requête:', err.message);
        throw err;
    }
};

const transaction = async (queries) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const results = [];
        for (const q of queries) {
            const result = await client.query(q.text, q.params);
            results.push(result);
        }
        await client.query('COMMIT');
        return results;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { pool, query, transaction };