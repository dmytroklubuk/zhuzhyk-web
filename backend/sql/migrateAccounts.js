require('dotenv').config();

const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { createPostgresPool } = require('../repository/postgresDatabase');

async function migrate() {
    const sql = await readFile(path.join(__dirname, 'add_customer_accounts.sql'), 'utf8');
    const pool = createPostgresPool();
    try {
        await pool.query(sql);
        console.log('Таблиці особистого кабінету готові.');
    } finally {
        await pool.end();
    }
}

migrate().catch(error => {
    console.error('Не вдалося виконати міграцію:', error.message);
    process.exitCode = 1;
});
