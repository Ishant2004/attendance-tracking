const nodemailer = require('nodemailer');

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }
    // Dev fallback: Ethereal test inbox (no real emails).
    const acct = await nodemailer.createTestAccount();
    console.log('[mailer] Ethereal test account:', acct.user);
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: acct.user, pass: acct.pass },
    });
  })();
  return transporterPromise;
}

async function sendMail({ to, subject, text, html }) {
  const transporter = await getTransporter();
  const from = process.env.EMAIL_FROM || 'Attendance <no-reply@attendance.local>';
  const info = await transporter.sendMail({ from, to, subject, text, html });
  const preview = nodemailer.getTestMessageUrl(info); // Ethereal only
  if (preview) console.log('[mailer] preview URL:', preview);
  return { messageId: info.messageId, preview };
}

module.exports = { sendMail };
