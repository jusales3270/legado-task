
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

async function createUserViews() {
    const client = await pool.connect();
    try {
        console.log('Creating organization views...');

        // 1. View for Team Members (Admins)
        console.log('Creating VIEW: vw_team_members');
        await client.query(`
            CREATE OR REPLACE VIEW vw_team_members AS
            SELECT id, name, email, role, is_active, last_login_at, created_at
            FROM users
            WHERE role = 'admin'
            ORDER BY name ASC;
        `);

        // 2. View for Clients
        console.log('Creating VIEW: vw_clients');
        await client.query(`
            CREATE OR REPLACE VIEW vw_clients AS
            SELECT id, name, email, company, phone, role, is_active, last_login_at, created_at
            FROM users
            WHERE role = 'client'
            ORDER BY name ASC;
        `);

        console.log('✅ Views created successfully!');
        console.log('You can now see "vw_team_members" and "vw_clients" in your Supabase Table Editor.');

    } catch (err) {
        console.error('Failed to create views:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

createUserViews();
