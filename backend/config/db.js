import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
export const DB_NAME = process.env.DB_NAME || 'gly_vtu';

export const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  multipleStatements: true,
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function seedDefaults(conn) {
  const [rows] = await conn.query('SELECT seeded FROM schema_meta WHERE id = 1');
  if (rows.length && rows[0].seeded === 1) return;

  await conn.query(
    `INSERT IGNORE INTO bill_categories (code, name, description, active) VALUES
      ('airtime', 'Airtime', 'Top up mobile airtime for Nigerian networks', 1),
      ('data', 'Data Bundles', 'Buy data plans for Nigerian networks', 1),
      ('tv', 'Cable TV', 'Pay for DStv, GOtv, StarTimes and more', 1),
      ('electricity', 'Electricity', 'Pay prepaid and postpaid electricity', 1),
      ('education', 'Education', 'School fees and exam payments', 1),
      ('betting', 'Betting', 'Fund betting wallets and wagers', 1),
      ('internet', 'Internet', 'Pay ISP and fibre subscriptions', 1)`
  );

  await conn.query(
    `INSERT IGNORE INTO bill_providers (category_id, name, code, active)
     SELECT id, 'MTN', 'mtn', 1 FROM bill_categories WHERE code='airtime'
     UNION ALL SELECT id, 'Airtel', 'airtel', 1 FROM bill_categories WHERE code='airtime'
     UNION ALL SELECT id, 'Glo', 'glo', 1 FROM bill_categories WHERE code='airtime'
     UNION ALL SELECT id, '9mobile', '9mobile', 1 FROM bill_categories WHERE code='airtime'
     UNION ALL SELECT id, 'MTN Data', 'mtn-data', 1 FROM bill_categories WHERE code='data'
     UNION ALL SELECT id, 'Airtel Data', 'airtel-data', 1 FROM bill_categories WHERE code='data'
     UNION ALL SELECT id, 'Glo Data', 'glo-data', 1 FROM bill_categories WHERE code='data'
     UNION ALL SELECT id, '9mobile Data', '9mobile-data', 1 FROM bill_categories WHERE code='data'
     UNION ALL SELECT id, 'DStv', 'dstv', 1 FROM bill_categories WHERE code='tv'
     UNION ALL SELECT id, 'GOtv', 'gotv', 1 FROM bill_categories WHERE code='tv'
     UNION ALL SELECT id, 'StarTimes', 'startimes', 1 FROM bill_categories WHERE code='tv'
     UNION ALL SELECT id, 'IKEDC', 'ikedc', 1 FROM bill_categories WHERE code='electricity'
     UNION ALL SELECT id, 'EKEDC', 'ekedc', 1 FROM bill_categories WHERE code='electricity'
     UNION ALL SELECT id, 'AEDC', 'aedc', 1 FROM bill_categories WHERE code='electricity'
     UNION ALL SELECT id, 'WAEC', 'waec', 1 FROM bill_categories WHERE code='education'
     UNION ALL SELECT id, 'JAMB', 'jamb', 1 FROM bill_categories WHERE code='education'
     UNION ALL SELECT id, 'Bet9ja', 'bet9ja', 1 FROM bill_categories WHERE code='betting'
     UNION ALL SELECT id, 'SportyBet', 'sportybet', 1 FROM bill_categories WHERE code='betting'
     UNION ALL SELECT id, 'Spectranet', 'spectranet', 1 FROM bill_categories WHERE code='internet'
     UNION ALL SELECT id, 'Smile', 'smile', 1 FROM bill_categories WHERE code='internet'`
  );

  await conn.query(
    `INSERT IGNORE INTO bill_pricing (provider_id, base_fee, markup_type, markup_value, currency, active)
     SELECT id, 0, 'flat', 10, 'NGN', 1 FROM bill_providers`
  );

  await conn.query('UPDATE schema_meta SET seeded = 1 WHERE id = 1');
}

async function seedAdmin(conn) {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPasswordHash = process.env.ADMIN_SEED_PASSWORD_HASH;
  if (!adminEmail || !adminPasswordHash) return;

  await conn.query(
    'INSERT IGNORE INTO admin_users (id, name, email, password_hash, role) VALUES (UUID(), ?, ?, ?, ?)',
    ['Super Admin', adminEmail, adminPasswordHash, 'superadmin']
  );
}

export async function initDatabase() {
  const bootstrap = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await bootstrap.end();

  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        id INT PRIMARY KEY,
        seeded TINYINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(120) NOT NULL UNIQUE,
        phone VARCHAR(20) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        kyc_level TINYINT NOT NULL DEFAULT 1,
        kyc_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
        kyc_payload JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(40) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id CHAR(36) PRIMARY KEY,
        actor_type ENUM('user','admin','system') NOT NULL,
        actor_id CHAR(36) NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80) NULL,
        entity_id VARCHAR(120) NULL,
        ip_address VARCHAR(60) NULL,
        user_agent VARCHAR(255) NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_actor (actor_type, actor_id),
        INDEX idx_audit_action (action),
        INDEX idx_audit_entity (entity_type, entity_id)
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        balance DECIMAL(14,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_wallet_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NULL,
        admin_id CHAR(36) NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_refresh_user (user_id),
        INDEX idx_refresh_admin (admin_id)
      );

      CREATE TABLE IF NOT EXISTS email_otps (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NULL,
        email VARCHAR(120) NOT NULL,
        purpose ENUM('device_login','password_reset') NOT NULL,
        code_hash CHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        consumed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_otp_email (email),
        INDEX idx_otp_user (user_id)
      );

      CREATE TABLE IF NOT EXISTS user_devices (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        device_id VARCHAR(120) NOT NULL,
        label VARCHAR(120) NULL,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        ip_address VARCHAR(60) NULL,
        user_agent VARCHAR(255) NULL,
        trusted TINYINT NOT NULL DEFAULT 1,
        UNIQUE KEY uniq_user_device (user_id, device_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reserved_accounts (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        provider VARCHAR(40) NOT NULL DEFAULT 'monnify',
        account_reference VARCHAR(120) NOT NULL UNIQUE,
        reservation_reference VARCHAR(120) NULL,
        account_name VARCHAR(120) NOT NULL,
        account_number VARCHAR(20) NOT NULL,
        bank_name VARCHAR(120) NOT NULL,
        bank_code VARCHAR(20) NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
        raw_response JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_reserved_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        type ENUM('send','receive','bill','topup','request') NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        fee DECIMAL(14,2) NOT NULL DEFAULT 0,
        total DECIMAL(14,2) NOT NULL,
        status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
        reference VARCHAR(80) NOT NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tx_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS bill_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NOT NULL,
        active TINYINT NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS bill_providers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        code VARCHAR(80) NOT NULL UNIQUE,
        active TINYINT NOT NULL DEFAULT 1,
        FOREIGN KEY (category_id) REFERENCES bill_categories(id)
      );

      CREATE TABLE IF NOT EXISTS bill_pricing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider_id INT NOT NULL UNIQUE,
        base_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
        markup_type ENUM('flat','percent') NOT NULL DEFAULT 'flat',
        markup_value DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        active TINYINT NOT NULL DEFAULT 1,
        FOREIGN KEY (provider_id) REFERENCES bill_providers(id)
      );

      CREATE TABLE IF NOT EXISTS bill_orders (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        provider_id INT NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        fee DECIMAL(14,2) NOT NULL,
        total DECIMAL(14,2) NOT NULL,
        status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
        reference VARCHAR(80) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (provider_id) REFERENCES bill_providers(id)
      );
    `);

    await conn.query('INSERT IGNORE INTO schema_meta (id, seeded) VALUES (1, 0)');
    await seedDefaults(conn);
    await seedAdmin(conn);
  } finally {
    conn.release();
  }
}

export { hashToken };
