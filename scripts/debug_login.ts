
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

async function debugLogin() {
    const client = await pool.connect();
    try {
        console.log('--- DEBUG LOGIN ---');
        const email = 'jusales3270@gmail.com'; // Testing this specific user
        const password = '@1234';

        console.log(`Checking user: ${email}`);
        const res = await client.query("SELECT * FROM users WHERE email = $1", [email]);

        if (res.rows.length === 0) {
            console.error('USER NOT FOUND IN DATABASE!');
            return;
        }

        const user = res.rows[0];
        console.log('User found:', {
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            has_password: !!user.password
        });

        console.log('Comparing provided password with stored hash...');
        const isValid = await bcrypt.compare(password, user.password);

        console.log(`Password match result: ${isValid}`);

        if (isValid) {
            console.log('SUCCESS: The password in the DB matches @1234');
        } else {
            console.error('FAILURE: The password in the DB DOES NOT match @1234');

            // Re-hash check
            const newHash = await bcrypt.hash(password, 10);
            console.log('New hash generated for comparison:', newHash);
        }

        // Also check admin@demo.com for reference
        console.log('\n--- REFERENCE CHECK ---');
        const adminRes = await client.query("SELECT * FROM users WHERE email = 'admin@demo.com'");
        if (adminRes.rows.length > 0) {
            const admin = adminRes.rows[0];
            const adminValid = await bcrypt.compare('1234', admin.password);
            console.log(`admin@demo.com password '1234' match: ${adminValid}`);
        }

    } catch (err) {
        console.error('Debug script failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

debugLogin();
