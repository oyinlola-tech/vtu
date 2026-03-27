import { pool } from '../config/db.js';
import { fetchBanks } from './monnify.js';

const CACHE_TTL_MINUTES = Number(process.env.BANKS_CACHE_TTL_MINUTES || 1440);

async function getLastRefresh() {
  const [[row]] = await pool.query('SELECT refreshed_at FROM bank_cache_meta WHERE id = 1');
  return row?.refreshed_at ? new Date(row.refreshed_at) : null;
}

async function setLastRefresh() {
  await pool.query('UPDATE bank_cache_meta SET refreshed_at = NOW() WHERE id = 1');
}

export async function refreshBankCache() {
  const banks = await fetchBanks();
  if (!Array.isArray(banks) || !banks.length) return 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE banks SET active = 0');
    for (const bank of banks) {
      const name = bank.name || bank.bankName || bank.bank_name;
      const code = bank.code || bank.bankCode || bank.bank_code;
      if (!name || !code) continue;
      await conn.query(
        `INSERT INTO banks (name, code, active)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), active = 1`,
        [name, code]
      );
    }
    await conn.commit();
    await setLastRefresh();
    return banks.length;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getCachedBanks() {
  const lastRefresh = await getLastRefresh();
  const stale =
    !lastRefresh ||
    Date.now() - lastRefresh.getTime() > CACHE_TTL_MINUTES * 60 * 1000;
  if (stale) {
    try {
      await refreshBankCache();
    } catch (err) {
      // Keep stale cache if refresh fails
    }
  }
  const [rows] = await pool.query('SELECT name, code FROM banks WHERE active = 1 ORDER BY name');
  return rows;
}
