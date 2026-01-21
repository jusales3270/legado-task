
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

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

async function seedAdmin() {
    const client = await pool.connect();
    try {
        const email = 'admin@demo.com';
        const password = '1234';
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log(`Seeding admin user: ${email}`);

        // CLEANUP: Delete the corrupted row where I accidentally put the email in the password column
        await client.query("DELETE FROM users WHERE password = $1", [email]);

        // Also delete any existing valid admin to ensure clean slate update
        await client.query("DELETE FROM users WHERE email = $1", [email]);

        // Insert new correctly
        console.log('Inserting correct admin user...');
        await client.query(
            `INSERT INTO users (email, password, name, role, is_active) 
       VALUES ($1, $2, 'Administrador', 'admin', true)`,
            [email, hashedPassword] // CORRECT ORDER: $1=email, $2=hash
        );
        console.log('Admin user created successfully.');

    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedAdmin();
