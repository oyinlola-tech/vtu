import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { normalizeAnswer } from './securityQuestions.js';

const REQUIRE_PIN_CHANGE = (process.env.SECURITY_QUESTION_REQUIRE_PIN_CHANGE || 'true') === 'true';
const REQUIRE_DEVICE_VERIFY =
  (process.env.SECURITY_QUESTION_REQUIRE_DEVICE_VERIFY || 'true') === 'true';
const REQUIRE_PASSWORD_RESET =
  (process.env.SECURITY_QUESTION_REQUIRE_PASSWORD_RESET || 'true') === 'true';
const TRANSFER_LIMIT = Number(process.env.SECURITY_QUESTION_TRANSFER_LIMIT || 0);

function isRequired(flow, amount) {
  if (flow === 'pin_change') return REQUIRE_PIN_CHANGE;
  if (flow === 'device_verify') return REQUIRE_DEVICE_VERIFY;
  if (flow === 'password_reset') return REQUIRE_PASSWORD_RESET;
  if (flow === 'transfer') return TRANSFER_LIMIT > 0 && Number(amount) >= TRANSFER_LIMIT;
  return false;
}

async function enforceSecurityQuestion({ userId, answer, flow, amount }) {
  if (!isRequired(flow, amount)) return { ok: true, required: false };

  const [[row]] = await pool.query(
    'SELECT security_question, security_answer_hash, security_question_enabled FROM users WHERE id = ?',
    [userId]
  );
  if (!row?.security_question_enabled) {
    return { ok: true, required: false };
  }
  if (!row?.security_answer_hash) {
    return {
      ok: false,
      status: 403,
      message: 'Security question not set. Please set one in Settings.',
      code: 'SECURITY_QUESTION_NOT_SET',
    };
  }
  if (!answer) {
    return {
      ok: false,
      status: 403,
      message: 'Security answer required for this action.',
      code: 'SECURITY_ANSWER_REQUIRED',
    };
  }
  const ok = await bcrypt.compare(normalizeAnswer(answer), row.security_answer_hash);
  if (!ok) {
    return {
      ok: false,
      status: 400,
      message: 'Incorrect security answer.',
      code: 'SECURITY_ANSWER_INVALID',
    };
  }
  return { ok: true, required: true };
}

export { enforceSecurityQuestion, isRequired };
