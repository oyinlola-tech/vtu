import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { createReservedAccount } from '../utils/monnify.js';
import { sendReservedAccountEmail } from '../utils/email.js';
import { isValidPin, setTransactionPin, verifyTransactionPin, getPinStatus } from '../utils/pin.js';
import { logAudit } from '../utils/audit.js';
import bcrypt from 'bcryptjs';
import { QUESTIONS, normalizeAnswer } from '../utils/securityQuestions.js';

const router = express.Router();

router.get('/profile', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Get user profile and reserved account'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Profile', schema: { $ref: '#/definitions/UserProfile' } }
    #swagger.responses[404] = { description: 'Not found', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.kyc_level, u.kyc_status, u.kyc_payload,
            r.account_number, r.bank_name, r.account_name
     FROM users u
     LEFT JOIN reserved_accounts r ON r.user_id = u.id
     WHERE u.id = ?`,
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  return res.json(rows[0]);
});

router.put('/profile', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Update profile'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/UpdateProfileRequest' }
    }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
    #swagger.responses[400] = { description: 'Validation error', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const { fullName, phone } = req.body || {};
  if (!fullName || !phone) return res.status(400).json({ error: 'Missing fields' });

  await pool.query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [
    fullName,
    phone,
    req.user.sub,
  ]);
  return res.json({ message: 'Profile updated' });
});

router.put('/kyc', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Submit KYC data'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/KycRequest' }
    }
    #swagger.responses[200] = { description: 'Submitted', schema: { $ref: '#/definitions/MessageResponse' } }
    #swagger.responses[400] = { description: 'Validation error', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const { level, payload } = req.body || {};
  if (!level || !payload) return res.status(400).json({ error: 'Missing KYC data' });
  if (![1, 2].includes(Number(level))) return res.status(400).json({ error: 'Invalid level' });
  if (Number(level) === 1) {
    if (!payload.bvn && !payload.nin) {
      return res.status(400).json({ error: 'BVN or NIN is required for Level 1' });
    }
  }
  if (Number(level) === 2) {
    if (!payload.dob || !payload.address) {
      return res.status(400).json({ error: 'DOB and address required for Level 2' });
    }
  }

  await pool.query(
    'UPDATE users SET kyc_level = ?, kyc_status = ?, kyc_payload = ? WHERE id = ?',
    [Number(level), 'pending', JSON.stringify(payload), req.user.sub]
  );

  if (Number(level) === 1) {
    const bvn = payload.bvn;
    const nin = payload.nin;
    if (bvn || nin) {
      const [existing] = await pool.query(
        'SELECT id FROM reserved_accounts WHERE user_id = ? LIMIT 1',
        [req.user.sub]
      );
      if (!existing.length) {
        const [[user]] = await pool.query(
          'SELECT full_name, email FROM users WHERE id = ?',
          [req.user.sub]
        );
        try {
          const accountReference = `GLY-${req.user.sub}`;
          const reserved = await createReservedAccount({
            accountReference,
            accountName: user.full_name,
            customerName: user.full_name,
            customerEmail: user.email,
            bvn,
            nin,
          });
          const account = reserved?.accounts?.[0] || {};
          await pool.query(
            `INSERT INTO reserved_accounts
             (id, user_id, provider, account_reference, reservation_reference, account_name, account_number, bank_name, bank_code, status, raw_response)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.user.sub,
              'monnify',
              accountReference,
              reserved?.reservationReference || null,
              reserved?.accountName || user.full_name,
              account.accountNumber || reserved?.accountNumber || '',
              account.bankName || reserved?.bankName || '',
              account.bankCode || null,
              reserved?.status || 'ACTIVE',
              JSON.stringify(reserved || {}),
            ]
          );
          if (user?.email) {
            sendReservedAccountEmail({
              to: user.email,
              name: user.full_name,
              accountNumber: account.accountNumber || reserved?.accountNumber,
              bankName: account.bankName || reserved?.bankName,
            }).catch(console.error);
          }
        } catch (err) {
          // Keep KYC submission; reserved account can be retried later.
        }
      }
    }
  }
  return res.json({ message: 'KYC submitted' });
});

router.get('/security', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Get security status'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Security status',
      schema: { type: 'object', properties: { pinSet: { type: 'boolean' }, biometricEnabled: { type: 'boolean' } } }
    }
  */
  const status = await getPinStatus(req.user.sub);
  if (!status) return res.status(404).json({ error: 'Not found' });
  const [[row]] = await pool.query(
    'SELECT security_question_enabled FROM users WHERE id = ?',
    [req.user.sub]
  );
  return res.json({ ...status, securityQuestionEnabled: Boolean(row?.security_question_enabled) });
});

router.post('/pin/setup', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Create transaction PIN'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/PinSetupRequest' } }
    #swagger.responses[200] = { description: 'Created', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { pin } = req.body || {};
  if (!isValidPin(pin)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  const [[row]] = await pool.query(
    'SELECT transaction_pin_hash FROM users WHERE id = ?',
    [req.user.sub]
  );
  if (row?.transaction_pin_hash) {
    return res.status(409).json({ error: 'Transaction PIN already set' });
  }
  await setTransactionPin(req.user.sub, pin);
  logAudit({
    actorType: 'user',
    actorId: req.user.sub,
    action: 'pin.setup',
    entityType: 'user',
    entityId: req.user.sub,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Transaction PIN created' });
});

router.post('/pin/change', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Change transaction PIN'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/PinChangeRequest' } }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
    #swagger.responses[400] = { description: 'Invalid PIN', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const { currentPin, newPin } = req.body || {};
  if (!isValidPin(newPin)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  try {
    await verifyTransactionPin(req.user.sub, currentPin);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  await setTransactionPin(req.user.sub, newPin);
  logAudit({
    actorType: 'user',
    actorId: req.user.sub,
    action: 'pin.changed',
    entityType: 'user',
    entityId: req.user.sub,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Transaction PIN updated' });
});

router.post('/pin/verify', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Verify transaction PIN'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/PinVerifyRequest' } }
    #swagger.responses[200] = {
      description: 'Verification result',
      schema: { type: 'object', properties: { valid: { type: 'boolean' } } }
    }
    #swagger.responses[400] = { description: 'Invalid PIN', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const { pin } = req.body || {};
  if (!isValidPin(pin)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  try {
    await verifyTransactionPin(req.user.sub, pin);
    return res.json({ valid: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/biometric', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['User']
    #swagger.summary = 'Enable or disable biometric login'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/BiometricRequest' } }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { enabled } = req.body || {};
  const [[row]] = await pool.query(
    'SELECT transaction_pin_hash FROM users WHERE id = ?',
    [req.user.sub]
  );
  if (!row?.transaction_pin_hash) {
    return res.status(400).json({ error: 'Set a transaction PIN first' });
  }
  await pool.query('UPDATE users SET biometric_enabled = ? WHERE id = ?', [
    enabled ? 1 : 0,
    req.user.sub,
  ]);
  logAudit({
    actorType: 'user',
    actorId: req.user.sub,
    action: enabled ? 'biometric.enabled' : 'biometric.disabled',
    entityType: 'user',
    entityId: req.user.sub,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Biometric preference updated' });
});

router.get('/security-questions', requireUser, async (req, res) => {
  return res.json(QUESTIONS);
});

router.get('/security-question', requireUser, async (req, res) => {
  const [[row]] = await pool.query(
    'SELECT security_question, security_updated_at, security_question_enabled FROM users WHERE id = ?',
    [req.user.sub]
  );
  return res.json({
    question: row?.security_question || null,
    updatedAt: row?.security_updated_at || null,
    enabled: Boolean(row?.security_question_enabled),
  });
});

router.post('/security-question/set', requireUser, async (req, res) => {
  const { question, answer } = req.body || {};
  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required' });
  }
  if (!QUESTIONS.includes(question)) {
    return res.status(400).json({ error: 'Invalid security question' });
  }
  const answerHash = await bcrypt.hash(normalizeAnswer(answer), 12);
  await pool.query(
    'UPDATE users SET security_question = ?, security_answer_hash = ?, security_updated_at = NOW() WHERE id = ?',
    [question, answerHash, req.user.sub]
  );
  logAudit({
    actorType: 'user',
    actorId: req.user.sub,
    action: 'security.question.set',
    entityType: 'user',
    entityId: req.user.sub,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Security question updated' });
});

router.post('/security-question/enable', requireUser, async (req, res) => {
  const { enabled } = req.body || {};
  const [[row]] = await pool.query(
    'SELECT security_question FROM users WHERE id = ?',
    [req.user.sub]
  );
  if (enabled && !row?.security_question) {
    return res.status(400).json({ error: 'Set a security question first' });
  }
  await pool.query('UPDATE users SET security_question_enabled = ? WHERE id = ?', [
    enabled ? 1 : 0,
    req.user.sub,
  ]);
  logAudit({
    actorType: 'user',
    actorId: req.user.sub,
    action: enabled ? 'security.question.enabled' : 'security.question.disabled',
    entityType: 'user',
    entityId: req.user.sub,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: enabled ? 'Security question enabled' : 'Security question disabled' });
});

router.post('/security-question/verify', requireUser, async (req, res) => {
  const { answer } = req.body || {};
  if (!answer) return res.status(400).json({ error: 'Answer required' });
  const [[row]] = await pool.query(
    'SELECT security_answer_hash FROM users WHERE id = ?',
    [req.user.sub]
  );
  if (!row?.security_answer_hash) {
    return res.status(400).json({ error: 'Security question not set' });
  }
  const ok = await bcrypt.compare(normalizeAnswer(answer), row.security_answer_hash);
  if (!ok) return res.status(400).json({ error: 'Incorrect answer' });
  return res.json({ valid: true });
});

export default router;
