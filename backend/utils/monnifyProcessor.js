import { pool } from '../config/db.js';
import { logAudit } from './audit.js';
import { sendReceiptEmail } from './email.js';

export async function processMonnifyEvent(payload, meta = {}) {
  const eventData = payload.eventData || payload.responseBody || {};
  const paymentReference =
    eventData.paymentReference ||
    eventData.transactionReference ||
    eventData.paymentReferenceNumber ||
    eventData.payment?.paymentReference;
  const amount = Number(eventData.amountPaid || eventData.amount || 0);
  const currency = eventData.currencyCode || 'NGN';
  const paidOn = eventData.paidOn || eventData.paymentDate;
  const accountReference =
    eventData.product?.reference ||
    eventData.accountReference ||
    eventData.customer?.accountReference;
  const accountNumber =
    eventData.destinationAccountInformation?.accountNumber ||
    eventData.accountNumber;

  if (!paymentReference || amount <= 0) {
    return { received: true, skipped: true };
  }

  const [existing] = await pool.query(
    'SELECT id, status, attempts FROM monnify_events WHERE payment_reference = ? LIMIT 1',
    [paymentReference]
  );
  if (!existing.length) {
    await pool.query(
      `INSERT INTO monnify_events
       (id, payment_reference, account_reference, amount, currency, paid_on, raw_payload, status, attempts)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'received', 1)`,
      [
        paymentReference,
        accountReference || null,
        amount,
        currency,
        paidOn || null,
        JSON.stringify(payload),
      ]
    );
  } else if (existing[0].status === 'processed') {
    return { received: true, duplicate: true };
  } else {
    await pool.query(
      'UPDATE monnify_events SET attempts = attempts + 1, raw_payload = ?, status = ? WHERE payment_reference = ?',
      [JSON.stringify(payload), 'received', paymentReference]
    );
  }

  const [accounts] = await pool.query(
    `SELECT r.user_id, r.account_reference, r.account_number
     FROM reserved_accounts r
     WHERE r.account_reference = ? OR r.account_number = ?
     LIMIT 1`,
    [accountReference || '', accountNumber || '']
  );
  if (!accounts.length) {
    await pool.query(
      'UPDATE monnify_events SET status = ?, last_error = ? WHERE payment_reference = ?',
      ['failed', 'Account not found', paymentReference]
    );
    return { received: true, unmatched: true };
  }

  const userId = accounts[0].user_id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE monnify_events SET status = ?, last_error = NULL WHERE payment_reference = ?',
      ['received', paymentReference]
    );
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [
      amount,
      userId,
    ]);
    const reference = `MON-${paymentReference}`;
    await conn.query(
      'INSERT INTO transactions (id, user_id, type, amount, fee, total, status, reference, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        'topup',
        amount,
        0,
        amount,
        'success',
        reference,
        JSON.stringify({ provider: 'monnify', paymentReference }),
      ]
    );
    await conn.commit();
    await pool.query(
      'UPDATE monnify_events SET status = ? WHERE payment_reference = ?',
      ['processed', paymentReference]
    );

    const [[user]] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [
      userId,
    ]);
    if (user?.email) {
      sendReceiptEmail({
        to: user.email,
        name: user.full_name,
        title: 'Wallet Credit Successful',
        details: [
          `Amount: NGN ${amount.toFixed(2)}`,
          `Reference: ${paymentReference}`,
          `Channel: Monnify Transfer`,
        ],
      }).catch(console.error);
    }
    logAudit({
      actorType: 'system',
      actorId: null,
      action: 'wallet.credit',
      entityType: 'transaction',
      entityId: reference,
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: { paymentReference },
    }).catch(console.error);
  } catch (err) {
    await conn.rollback();
    await pool.query(
      'UPDATE monnify_events SET status = ?, last_error = ? WHERE payment_reference = ?',
      ['failed', String(err.message || 'Processing error').slice(0, 255), paymentReference]
    );
    return { error: 'Processing failed' };
  } finally {
    conn.release();
  }

  return { received: true };
}
