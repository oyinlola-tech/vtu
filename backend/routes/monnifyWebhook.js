import express from 'express';
import crypto from 'crypto';
import { processMonnifyEvent } from '../utils/monnifyProcessor.js';

const router = express.Router();

function verifySignature(req) {
  const secret = process.env.MONNIFY_WEBHOOK_SECRET || process.env.MONNIFY_SECRET_KEY || '';
  if (!secret) return true;
  const signature = (req.headers['monnify-signature'] || '').toString();
  if (!signature || !req.rawBody) return false;
  const hash = crypto
    .createHash('sha512')
    .update(secret + req.rawBody)
    .digest('hex');
  return hash === signature;
}

function ipAllowed(req) {
  const ips = (process.env.MONNIFY_WEBHOOK_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ips.length) return true;
  const ip = (req.ip || '').replace('::ffff:', '');
  return ips.includes(ip);
}

router.post('/', async (req, res) => {
  /*
    #swagger.tags = ['Monnify Webhook']
    #swagger.summary = 'Receive Monnify webhook events'
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { type: 'object' } }
    #swagger.responses[200] = { description: 'Processed', schema: { type: 'object' } }
    #swagger.responses[401] = { description: 'Invalid signature' }
    #swagger.responses[403] = { description: 'Forbidden' }
  */
  if (!ipAllowed(req)) return res.status(403).send('Forbidden');
  if (!verifySignature(req)) return res.status(401).send('Invalid signature');

  const payload = req.body || {};
  const result = await processMonnifyEvent(payload, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  if (result?.error) return res.status(500).json(result);
  return res.json(result);
});

export default router;
