import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@glyvtu.ng';
const BRAND = 'GLY VTU';
const WINE = '#6b0f2e';
const BLACK = '#0b0b0b';
const WHITE = '#ffffff';
const LIGHT = '#f6f1f3';
const BORDER = '#e7d9df';
const LOGO_URL = process.env.EMAIL_LOGO_URL || '';
const BRAND_URL = process.env.BRAND_URL || '';
const SUPPORT_URL = process.env.SUPPORT_URL || '';
const PRIVACY_URL = process.env.PRIVACY_URL || '';
const TERMS_URL = process.env.TERMS_URL || '';

function transporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
}

function baseTemplate({ title, body, footer, highlight }) {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;background:${BLACK};font-family:Arial,sans-serif;color:${WHITE};">
      <div style="max-width:620px;margin:0 auto;padding:28px;background:${BLACK};">
        <div style="background:linear-gradient(135deg, ${WINE}, ${BLACK});padding:22px;border-radius:18px;color:${WHITE};display:flex;align-items:center;gap:14px;">
          ${
            LOGO_URL
              ? `<img src="${LOGO_URL}" alt="${BRAND}" style="width:42px;height:42px;border-radius:10px;background:${WHITE};padding:6px;" />`
              : ''
          }
          <div>
            <h1 style="margin:0;font-size:22px;letter-spacing:0.4px;">${BRAND}</h1>
            <p style="margin:6px 0 0;font-size:12px;letter-spacing:0.6px;">Nigeria Bill Payments & Wallet</p>
          </div>
        </div>
        <div style="background:${WHITE};color:${BLACK};padding:26px;border-radius:18px;margin-top:16px;border:1px solid ${BORDER};">
          <h2 style="margin-top:0;color:${WINE};">${title}</h2>
          ${highlight ? `<div style="background:${LIGHT};border:1px solid ${BORDER};padding:14px;border-radius:12px;margin:14px 0;color:${BLACK};">${highlight}</div>` : ''}
          ${body}
        </div>
        <p style="font-size:12px;color:#cfcfcf;margin-top:14px;line-height:1.5;">
          ${footer}<br />Need help? Reply to this email.
        </p>
        <div style="font-size:12px;color:#cfcfcf;display:flex;gap:12px;flex-wrap:wrap;">
          ${BRAND_URL ? `<a href="${BRAND_URL}" style="color:#cfcfcf;">Website</a>` : ''}
          ${SUPPORT_URL ? `<a href="${SUPPORT_URL}" style="color:#cfcfcf;">Support</a>` : ''}
          ${PRIVACY_URL ? `<a href="${PRIVACY_URL}" style="color:#cfcfcf;">Privacy</a>` : ''}
          ${TERMS_URL ? `<a href="${TERMS_URL}" style="color:#cfcfcf;">Terms</a>` : ''}
        </div>
      </div>
    </body>
  </html>`;
}

async function sendEmail({ to, subject, html, attachments = [] }) {
  const tx = transporter();
  if (!tx) {
    console.log('Email skipped. Configure SMTP to send:', subject, to);
    return;
  }
  await tx.sendMail({ from: EMAIL_FROM, to, subject, html, attachments });
}

function createReceiptPdf({ title, name, details }) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fillColor(WINE).fontSize(20).text(BRAND, { align: 'left' });
    doc.moveDown(0.5);
    doc.fillColor(BLACK).fontSize(14).text(title);
    doc.moveDown();
    doc.fontSize(12).fillColor(BLACK).text(`Customer: ${name || 'Customer'}`);
    doc.moveDown();
    doc.fontSize(12).text('Details:');
    doc.moveDown(0.5);
    details.forEach((line) => {
      doc.circle(doc.x + 3, doc.y + 6, 2).fill(WINE);
      doc.fillColor(BLACK).text(`  ${line}`, { continued: false });
    });
    doc.moveDown(2);
    doc.fillColor('#666').fontSize(10).text('Thank you for using GLY VTU.');
    doc.end();
  });
}

export async function sendWelcomeEmail({ to, name, accountNumber, bankName }) {
  const html = baseTemplate({
    title: 'Welcome to GLY VTU',
    body: `<p>Hello ${name || 'there'},</p>
      <p>Welcome to GLY VTU, your Nigerian wallet for airtime, data, TV, electricity, and more.</p>
      <p>We are ready to help you pay bills faster and smarter.</p>
      ${
        accountNumber
          ? `<p>Your reserved account is ready:</p>
             <p><strong>${bankName || 'Bank'}:</strong> ${accountNumber}</p>`
          : ''
      }`,
    highlight: '<strong>Quick tip:</strong> Complete your KYC to unlock higher limits.',
    footer: 'If you did not create this account, please contact support immediately.',
  });
  await sendEmail({ to, subject: 'Welcome to GLY VTU', html });
}

export async function sendOtpEmail({ to, code, purpose }) {
  const title =
    purpose === 'password_reset' ? 'Reset Your Password' : 'Verify New Device';
  const html = baseTemplate({
    title,
    highlight: `<div style="font-size:28px;font-weight:700;letter-spacing:6px;color:${WINE};text-align:center;">${code}</div>`,
    body: `<p>Use this one-time code to continue.</p>
      <p>This code expires in 10 minutes and can be used once.</p>`,
    footer: 'If you did not request this, you can ignore this email.',
  });
  await sendEmail({ to, subject: `${BRAND} OTP Code`, html });
}

export async function sendReceiptEmail({ to, name, title, details }) {
  const pdf = await createReceiptPdf({ title, name, details });
  const html = baseTemplate({
    title,
    body: `<p>Hello ${name || 'there'},</p>
      <p>Your transaction was successful. Here are the details:</p>
      <ul style="padding-left:18px;line-height:1.6;">${details
        .map((d) => `<li>${d}</li>`)
        .join('')}</ul>`,
    highlight: '<strong>Status:</strong> Successful',
    footer: 'Thank you for using GLY VTU.',
  });
  await sendEmail({
    to,
    subject: `${BRAND} Receipt`,
    html,
    attachments: [{ filename: `glyvtu-receipt-${Date.now()}.pdf`, content: pdf }],
  });
}

export async function sendSecurityEmail({ to, title, message }) {
  const html = baseTemplate({
    title,
    body: `<p>${message}</p>`,
    footer: 'If this was not you, please secure your account immediately.',
  });
  await sendEmail({ to, subject: `${BRAND} Security Alert`, html });
}

export async function sendKycStatusEmail({ to, name, status, reason = '' }) {
  const pretty = status === 'verified' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending';
  const html = baseTemplate({
    title: `KYC ${pretty}`,
    highlight: `<strong>Status:</strong> ${pretty}`,
    body: `<p>Hello ${name || 'there'},</p>
      <p>Your KYC verification is now <strong>${pretty}</strong>.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}`,
    footer: 'Thanks for keeping your account secure.',
  });
  await sendEmail({ to, subject: `${BRAND} KYC ${pretty}`, html });
}

export async function sendBillFailedEmail({ to, name, details }) {
  const html = baseTemplate({
    title: 'Bill Payment Failed',
    highlight: '<strong>Status:</strong> Failed',
    body: `<p>Hello ${name || 'there'},</p>
      <p>Your bill payment could not be completed.</p>
      <ul style="padding-left:18px;line-height:1.6;">${details
        .map((d) => `<li>${d}</li>`)
        .join('')}</ul>`,
    footer: 'You can try again or contact support if this persists.',
  });
  await sendEmail({ to, subject: `${BRAND} Bill Payment Failed`, html });
}

export async function sendLoginFailedEmail({ to, ip, userAgent }) {
  const html = baseTemplate({
    title: 'Failed Login Attempt',
    highlight: '<strong>Security notice</strong>',
    body: `<p>We detected a failed login attempt on your account.</p>
      <p>IP: ${ip || 'Unknown'}<br/>Device: ${userAgent || 'Unknown'}</p>
      <p>If this wasn’t you, reset your password immediately.</p>`,
    footer: 'We’re watching for suspicious activity to protect your account.',
  });
  await sendEmail({ to, subject: `${BRAND} Failed Login Attempt`, html });
}
