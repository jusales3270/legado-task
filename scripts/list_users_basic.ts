
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function listUsers() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, email, name, role, is_active FROM users ORDER BY created_at DESC');
        console.table(res.rows);
    } catch (err) {
        console.error('Error listing users:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

listUsers();
