import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@glyvtu.ng';
const BRAND = 'GLY VTU';
const WINE = '#6b0f2e';
const DEEP = '#2b0a17';
const BLACK = '#0b0b0b';
const WHITE = '#ffffff';
const LIGHT = '#f6f1f3';
const BORDER = '#e7d9df';
const SLATE = '#6e6a73';
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

function baseTemplate({ title, body, footer, highlight, cta }) {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;background:${LIGHT};font-family:Arial,sans-serif;color:${BLACK};">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
        <div style="background:linear-gradient(135deg, ${WINE}, ${DEEP});padding:24px;border-radius:20px;color:${WHITE};display:flex;align-items:center;gap:14px;box-shadow:0 14px 34px rgba(27,7,16,0.28);">
          ${
            LOGO_URL
              ? `<img src="${LOGO_URL}" alt="${BRAND}" style="width:46px;height:46px;border-radius:12px;background:${WHITE};padding:6px;" />`
              : ''
          }
          <div>
            <h1 style="margin:0;font-size:22px;letter-spacing:0.6px;">${BRAND}</h1>
            <p style="margin:6px 0 0;font-size:12px;letter-spacing:0.8px;opacity:0.9;">Nigeria Bill Payments & Wallet</p>
          </div>
        </div>
        <div style="background:${WHITE};color:${BLACK};padding:28px;border-radius:20px;margin-top:18px;border:1px solid ${BORDER};box-shadow:0 12px 30px rgba(33,12,20,0.08);">
          <h2 style="margin-top:0;color:${WINE};font-size:20px;">${title}</h2>
          ${highlight ? `<div style="background:${LIGHT};border:1px solid ${BORDER};padding:14px;border-radius:12px;margin:14px 0;color:${BLACK};">${highlight}</div>` : ''}
          ${body}
          ${
            cta?.label && cta?.href
              ? `<div style="margin-top:18px;">
                  <a href="${cta.href}" style="display:inline-block;background:${WINE};color:${WHITE};text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">${cta.label}</a>
                </div>`
              : ''
          }
        </div>
        <p style="font-size:12px;color:${SLATE};margin-top:16px;line-height:1.6;">
          ${footer}<br />Need help? Reply to this email or visit support.
        </p>
        <div style="font-size:12px;color:${SLATE};display:flex;gap:12px;flex-wrap:wrap;">
          ${BRAND_URL ? `<a href="${BRAND_URL}" style="color:${SLATE};">Website</a>` : ''}
          ${SUPPORT_URL ? `<a href="${SUPPORT_URL}" style="color:${SLATE};">Support</a>` : ''}
          ${PRIVACY_URL ? `<a href="${PRIVACY_URL}" style="color:${SLATE};">Privacy</a>` : ''}
          ${TERMS_URL ? `<a href="${TERMS_URL}" style="color:${SLATE};">Terms</a>` : ''}
        </div>
      </div>
    </body>
  </html>`;
}

async function sendEmail({ to, subject, html, attachments = [] }) {
  const tx = transporter();
  if (!tx) {
    const safeSubject = String(subject ?? '').replace(/\r|\n/g, '');
    const safeTo = String(to ?? '').replace(/\r|\n/g, '');
    console.log(
      'Email skipped. Configure SMTP to send:',
      safeSubject,
      safeTo,
    );
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

function createStatementPdf({
  name,
  startDate,
  endDate,
  openingBalance = 0,
  closingBalance = 0,
  transactions,
}) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const columns = [
      { label: 'Date', width: 75 },
      { label: 'Type', width: 50 },
      { label: 'Status', width: 50 },
      { label: 'Amount', width: 65 },
      { label: 'Fee', width: 50 },
      { label: 'Total', width: 65 },
      { label: 'Balance', width: 65 },
      { label: 'Reference', width: 75 },
    ];

    const formatMoney = (value) => `NGN ${Number(value || 0).toFixed(2)}`;
    const formatDate = (value) => new Date(value).toLocaleDateString();

    const addHeader = () => {
      doc.fillColor(WINE).fontSize(20).text(BRAND, { align: 'left' });
      doc.moveDown(0.4);
      doc.fillColor(BLACK).fontSize(14).text('Account Statement');
      doc
        .fontSize(10)
        .fillColor('#666')
        .text(`Customer: ${name || 'Customer'}`);
      doc
        .fontSize(10)
        .fillColor('#666')
        .text(`Period: ${startDate} to ${endDate}`);
      doc.moveDown(0.8);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
      doc.moveDown(0.6);
    };

    const addTableHeader = () => {
      let x = 50;
      doc.fillColor(BLACK).fontSize(9).font('Helvetica-Bold');
      columns.forEach((col) => {
        doc.text(col.label, x, doc.y, { width: col.width });
        x += col.width;
      });
      doc.font('Helvetica');
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eee').stroke();
      doc.moveDown(0.4);
    };

    const addRow = (row) => {
      let x = 50;
      const values = [
        formatDate(row.created_at),
        String(row.type || '').toUpperCase(),
        String(row.status || '').toUpperCase(),
        formatMoney(row.amount),
        formatMoney(row.fee),
        formatMoney(row.total),
        formatMoney(row.running_balance),
        row.reference || '-',
      ];
      doc.fillColor(BLACK).fontSize(9);
      values.forEach((value, idx) => {
        doc.text(value, x, doc.y, { width: columns[idx].width });
        x += columns[idx].width;
      });
      doc.moveDown(0.6);
    };

    addHeader();
    addTableHeader();

    if (!transactions.length) {
      doc.fillColor('#666').fontSize(10).text('No transactions in this period.');
      doc.end();
      return;
    }

    transactions.forEach((row) => {
      if (doc.y > 720) {
        doc.addPage();
        addHeader();
        addTableHeader();
      }
      addRow(row);
    });

    doc.moveDown(1);
    const totalValue = transactions.reduce(
      (sum, row) => sum + Number(row.total || 0),
      0
    );
    doc
      .fillColor(BLACK)
      .fontSize(10)
      .text(`Opening balance: NGN ${Number(openingBalance || 0).toFixed(2)}`);
    doc
      .fillColor(BLACK)
      .fontSize(10)
      .text(`Closing balance: NGN ${Number(closingBalance || 0).toFixed(2)}`);
    doc
      .fillColor(BLACK)
      .fontSize(10)
      .text(`Total transactions: ${transactions.length}`);
    doc
      .fillColor(BLACK)
      .fontSize(10)
      .text(`Total value: NGN ${totalValue.toFixed(2)}`);
    doc.moveDown(0.6);
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

export async function sendReservedAccountEmail({ to, name, accountNumber, bankName }) {
  const html = baseTemplate({
    title: 'Your Reserved Account is Ready',
    body: `<p>Hello ${name || 'there'},</p>
      <p>Your GLY VTU reserved account has been created successfully.</p>
      <p><strong>${bankName || 'Bank'}:</strong> ${accountNumber}</p>`,
    highlight: '<strong>Tip:</strong> Use this account number to top up your wallet anytime.',
    footer: 'If you did not request this, please contact support immediately.',
  });
  await sendEmail({ to, subject: `${BRAND} Reserved Account Created`, html });
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

export async function sendStatementEmail({
  to,
  name,
  startDate,
  endDate,
  openingBalance,
  closingBalance,
  transactions = [],
}) {
  const totalCount = transactions.length;
  const totalValue = transactions.reduce(
    (sum, row) => sum + Number(row.total || 0),
    0
  );
  const pdf = await createStatementPdf({
    name,
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    transactions,
  });
  const html = baseTemplate({
    title: 'Your Account Statement',
    highlight: `<strong>Statement period:</strong> ${startDate} to ${endDate}<br/>
      <strong>Total transactions:</strong> ${totalCount}<br/>
      <strong>Total value:</strong> NGN ${totalValue.toFixed(2)}<br/>
      <strong>Closing balance:</strong> NGN ${Number(closingBalance || 0).toFixed(2)}`,
    body: `<p>Hello ${name || 'there'},</p>
      <p>Your requested account statement is attached as a PDF.</p>
      <p>For your security, please keep this document private.</p>`,
    footer: 'If you did not request this statement, contact support immediately.',
  });
  await sendEmail({
    to,
    subject: `${BRAND} Account Statement`,
    html,
    attachments: [{ filename: `glyvtu-statement-${Date.now()}.pdf`, content: pdf }],
  });
}

export async function generateStatementPdf({
  name,
  startDate,
  endDate,
  openingBalance,
  closingBalance,
  transactions = [],
}) {
  return createStatementPdf({
    name,
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    transactions,
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
