
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

const teamMembers = [
    { name: 'Junior Sales', email: 'jusales3270@gmail.com' },
    { name: 'Morgana', email: 'morgana.comunicacao@gmail.com' },
    { name: 'Brunera', email: 'brunoproospere@gmail.com' },
    { name: 'Vitoria', email: 'vc.lauriano28817@gmail.com' },
    { name: 'Douglas', email: 'douglasboituva@gmail.com' },
    { name: 'Matheus', email: 'matheus_97oliver@hotmail.com' }
];

const DEFAULT_PASSWORD = '@1234';

async function createTeamUsers() {
    const client = await pool.connect();
    try {
        console.log('Starting team user creation...');

        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        for (const member of teamMembers) {
            console.log(`Processing ${member.name} (${member.email})...`);

            // Check if user exists
            const checkRes = await client.query("SELECT id FROM users WHERE email = $1", [member.email]);

            if (checkRes.rows.length > 0) {
                console.log(`User ${member.email} already exists. Updating role to admin/team AND resetting password...`);
                // Update role AND password
                await client.query(
                    "UPDATE users SET role = 'admin', is_active = true, password = $2 WHERE email = $1",
                    [member.email, hashedPassword]
                );
            } else {
                console.log(`Creating new user ${member.email}...`);
                await client.query(
                    `INSERT INTO users (email, password, name, role, is_active) 
                     VALUES ($1, $2, $3, 'admin', true)`,
                    [member.email, hashedPassword, member.name]
                );
            }
        }

        console.log('All team members processed successfully.');

    } catch (err) {
        console.error('Failed to create users:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

createTeamUsers();
