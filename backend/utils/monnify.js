import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';
const API_KEY = process.env.MONNIFY_API_KEY || '';
const SECRET_KEY = process.env.MONNIFY_SECRET_KEY || '';
const CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE || '';

function authHeader() {
  const token = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64');
  return `Basic ${token}`;
}

async function getAccessToken() {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monnify auth failed: ${text}`);
  }
  const data = await res.json();
  return data?.responseBody?.accessToken;
}

export async function createReservedAccount({
  accountReference,
  accountName,
  customerName,
  customerEmail,
  bvn,
  nin,
}) {
  if (!API_KEY || !SECRET_KEY || !CONTRACT_CODE) {
    throw new Error('Monnify credentials missing');
  }
  if (!bvn && !nin) {
    throw new Error('BVN or NIN required for reserved account');
  }

  const token = await getAccessToken();
  const payload = {
    accountReference,
    accountName,
    currencyCode: 'NGN',
    contractCode: CONTRACT_CODE,
    customerEmail,
    customerName,
    getAllAvailableBanks: true,
  };
  if (bvn) payload.bvn = bvn;
  if (nin) payload.nin = nin;

  const res = await fetch(`${BASE_URL}/api/v2/bank-transfer/reserved-accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monnify reserve failed: ${text}`);
  }
  const data = await res.json();
  return data?.responseBody;
}
