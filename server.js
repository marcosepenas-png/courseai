// CourseAI — Backend completo
// npm install express mercadopago cors dotenv nodemailer bcryptjs jsonwebtoken
require('dotenv').config();
const express     = require('express');
const path = require('path');
const cors        = require('cors');
const nodemailer  = require('nodemailer');
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Mercado Pago ─────────────────────────────────────────────────────────────
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 }
});
const preference = new Preference(mp);
const payment    = new Payment(mp);

// ── Nodemailer transporter ────────────────────────────────────────────────────
// Soporta: Gmail, Brevo (ex SendinBlue), cualquier SMTP
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS   // para Gmail: App Password de 16 chars
    }
  });
}

// ── Email templates ───────────────────────────────────────────────────────────
function buildPurchaseEmail({ buyerName, courseTitle, courseSubtitle, accessLink, supportEmail, fromName }) {
  return {
    subject: `✅ ¡Tu acceso a "${courseTitle}" está listo!`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#0d0d0f;font-family:'Helvetica Neue',Arial,sans-serif;}
  .wrap{max-width:560px;margin:0 auto;padding:32px 16px;}
  .card{background:#141417;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;}
  .header{background:#1c1c21;padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.07);}
  .logo{display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;}
  .logo-mark{width:32px;height:32px;border-radius:8px;background:#c8f060;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;color:#000;}
  .logo-text{font-size:18px;color:#f0efe8;font-weight:500;}
  h1{margin:0;font-size:22px;color:#f0efe8;font-weight:500;line-height:1.3;}
  .body{padding:28px 32px;}
  p{margin:0 0 16px;font-size:14px;color:#9b9a94;line-height:1.7;}
  .highlight{color:#f0efe8;}
  .cta{display:block;text-align:center;background:#c8f060;color:#000;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;margin:24px 0;}
  .cta:hover{background:#a8d040;}
  .divider{height:1px;background:rgba(255,255,255,0.07);margin:20px 0;}
  .footer{padding:20px 32px;text-align:center;}
  .footer p{font-size:11px;color:#5a5955;margin:4px 0;}
  .chip{display:inline-block;background:rgba(200,240,96,0.08);border:1px solid rgba(200,240,96,0.18);color:#c8f060;font-size:12px;padding:4px 12px;border-radius:20px;margin-bottom:12px;}
</style>
</head><body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <div class="logo">
        <div class="logo-mark">✦</div>
        <span class="logo-text">${fromName || 'CourseAI'}</span>
      </div>
      <span class="chip">Compra confirmada</span>
      <h1>¡Hola ${buyerName || 'alumno'}! Tu curso está listo 🎉</h1>
    </div>
    <div class="body">
      <p>Gracias por tu compra. Tu pago fue procesado exitosamente y ya tenés acceso completo a:</p>
      <p style="font-size:18px;color:#f0efe8;font-weight:500;margin:8px 0 4px;">${courseTitle}</p>
      ${courseSubtitle ? `<p style="margin:0 0 20px;font-size:13px;">${courseSubtitle}</p>` : ''}
      <a class="cta" href="${accessLink || '#'}">Acceder al curso ahora →</a>
      <div class="divider"></div>
      <p style="font-size:13px;">¿Tenés alguna pregunta? Respondé este email o escribinos a <span class="highlight">${supportEmail || 'soporte@courseai.com'}</span> y te respondemos en menos de 24 horas.</p>
    </div>
    <div class="footer">
      <p>Este email fue enviado porque realizaste una compra en ${fromName || 'CourseAI'}.</p>
      <p>Si creés que fue un error, contactanos al instante.</p>
    </div>
  </div>
</div>
</body></html>`
  };
}

function buildWelcomeSeriesEmail(n, { buyerName, courseTitle, tip, fromName }) {
  const series = [
    { subject: `📚 Día 1: Cómo sacarle el máximo provecho a "${courseTitle}"`, heading: 'Empezá con el pie derecho', body: `Muchos alumnos cometen el error de ver todo el contenido de una sola vez. Te recomendamos dedicar <strong style="color:#f0efe8">30 minutos por día</strong> y aplicar cada lección antes de pasar a la siguiente.` },
    { subject: `💡 Tip rápido: Lo que el 80% de alumnos ignora`, heading: 'El secreto de los que más aprenden', body: `Los alumnos que mejor resultado obtienen son los que <strong style="color:#f0efe8">toman notas activas</strong> y se hacen preguntas. Mientras mirás cada clase, preguntate: ¿cómo aplico esto en mi situación concreta?` },
    { subject: `✅ ¿Cómo vas con "${courseTitle}"?`, heading: 'Chequeamos tu avance', body: `A esta altura ya deberías haber completado los primeros módulos. Si todavía no empezaste, <strong style="color:#f0efe8">este es el mejor momento</strong>. El conocimiento no expira, pero el impulso sí.` }
  ];
  const s = series[Math.min(n, series.length-1)];
  return {
    subject: s.subject,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{margin:0;padding:0;background:#0d0d0f;font-family:'Helvetica Neue',Arial,sans-serif;}.wrap{max-width:560px;margin:0 auto;padding:32px 16px;}.card{background:#141417;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;}.header{background:#1c1c21;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.07);}.logo{display:inline-flex;align-items:center;gap:9px;margin-bottom:14px;}.logo-mark{width:28px;height:28px;border-radius:7px;background:#c8f060;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:#000;}.logo-text{font-size:16px;color:#f0efe8;}.body{padding:24px 32px;}p{margin:0 0 14px;font-size:14px;color:#9b9a94;line-height:1.7;}h2{margin:0 0 6px;font-size:18px;color:#f0efe8;font-weight:500;}.tip-box{background:rgba(200,240,96,0.06);border:1px solid rgba(200,240,96,0.15);border-radius:10px;padding:14px 18px;margin:16px 0;font-size:13px;color:#c8f060;}.footer{padding:16px 32px;text-align:center;}.footer p{font-size:11px;color:#5a5955;margin:3px 0;}</style></head>
<body><div class="wrap"><div class="card">
  <div class="header"><div class="logo"><div class="logo-mark">✦</div><span class="logo-text">${fromName||'CourseAI'}</span></div><h2>${s.heading}</h2></div>
  <div class="body">
    <p>Hola ${buyerName||''}${courseTitle?`, recordamos que tenés acceso a <strong style="color:#f0efe8">${courseTitle}</strong>`:''}</p>
    <p>${s.body}</p>
    ${tip ? `<div class="tip-box">💡 ${tip}</div>` : ''}
    <p style="font-size:13px;">¡Mucho éxito! 🚀</p>
  </div>
  <div class="footer"><p>${fromName||'CourseAI'} · Emails de seguimiento automático</p></div>
</div></div></body></html>`
  };
}

// ── Enviar email de compra confirmada ─────────────────────────────────────────
app.post('/api/send-purchase-email', async (req, res) => {
  try {
    const { to, buyerName, courseTitle, courseSubtitle, accessLink } = req.body;
    if (!to) return res.status(400).json({ error: 'Falta el email del comprador' });
    const transporter = createTransporter();
    const { subject, html } = buildPurchaseEmail({
      buyerName, courseTitle, courseSubtitle, accessLink,
      supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_USER,
      fromName: process.env.FROM_NAME || 'CourseAI'
    });
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME||'CourseAI'}" <${process.env.SMTP_USER}>`,
      to, subject, html
    });
    console.log(`✉ Email de compra enviado a ${to}`);
    res.json({ ok: true, message: 'Email enviado' });
  } catch (err) {
    console.error('Error enviando email:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Enviar email de la serie de bienvenida ────────────────────────────────────
app.post('/api/send-welcome-series', async (req, res) => {
  try {
    const { to, buyerName, courseTitle, seriesIndex = 0, tip } = req.body;
    if (!to) return res.status(400).json({ error: 'Falta el email' });
    const transporter = createTransporter();
    const { subject, html } = buildWelcomeSeriesEmail(seriesIndex, {
      buyerName, courseTitle, tip,
      fromName: process.env.FROM_NAME || 'CourseAI'
    });
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME||'CourseAI'}" <${process.env.SMTP_USER}>`,
      to, subject, html
    });
    console.log(`✉ Email de serie #${seriesIndex} enviado a ${to}`);
    res.json({ ok: true, seriesIndex });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test email ────────────────────────────────────────────────────────────────
app.post('/api/test-email', async (req, res) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME||'CourseAI'}" <${process.env.SMTP_USER}>`,
      to: req.body.to || process.env.SMTP_USER,
      subject: '✅ CourseAI — Test de email funcionando',
      html: '<div style="font-family:sans-serif;background:#0d0d0f;color:#f0efe8;padding:24px;border-radius:12px;max-width:400px"><h2 style="color:#c8f060">✦ CourseAI</h2><p>El sistema de emails está configurado correctamente.</p></div>'
    });
    res.json({ ok: true, message: 'Email de prueba enviado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AUTH: Login admin ─────────────────────────────────────────────────────────
let ADMIN_HASH;
setTimeout(() => {
  ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH ||
    bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'courseai2024', 10);
}, 0);
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Contraseña requerida' });
    const valid = await bcrypt.compare(password, ADMIN_HASH);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });
    const token = jwt.sign(
      { role: 'admin', iat: Date.now() },
      process.env.JWT_SECRET || 'courseai-secret-change-me',
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );
    res.json({ token, expiresIn: process.env.JWT_EXPIRES || '8h' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AUTH: Verificar token ─────────────────────────────────────────────────────
app.get('/api/auth/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ valid: false });
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'courseai-secret-change-me');
    res.json({ valid: true, role: decoded.role });
  } catch {
    res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
  }
});

// ── AUTH middleware para rutas protegidas ─────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.admin = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'courseai-secret-change-me');
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ── Mercado Pago: crear preferencia ──────────────────────────────────────────
app.post('/api/create-payment', async (req, res) => {
  try {
    const { courseTitle, courseSubtitle, price, currency='ARS', courseId, buyerEmail } = req.body;
    if (!courseTitle || !price || !courseId) return res.status(400).json({ error: 'Faltan campos requeridos' });
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const prefData = {
      items: [{ id: courseId, title: courseTitle, description: courseSubtitle||courseTitle, category_id:'education', quantity:1, currency_id:currency, unit_price:parseFloat(price) }],
      back_urls: { success:`${baseUrl}/success.html`, failure:`${baseUrl}/failure.html`, pending:`${baseUrl}/pending.html` },
      auto_return: 'approved',
      notification_url: `${baseUrl}/api/webhook`,
      statement_descriptor: 'CourseAI',
      metadata: { course_id:courseId, course_title:courseTitle }
    };
    if (buyerEmail) prefData.payer = { email: buyerEmail };
    const result = await preference.create({ body: prefData });
    res.json({ preferenceId:result.id, initPoint:result.init_point, sandboxInitPoint:result.sandbox_init_point });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mercado Pago: estado de un pago ──────────────────────────────────────────
app.get('/api/payment-status/:id', async (req, res) => {
  try {
    const result = await payment.get({ id: req.params.id });
    res.json({ id:result.id, status:result.status, statusDetail:result.status_detail, amount:result.transaction_amount, currency:result.currency_id, payerEmail:result.payer?.email, approvedAt:result.date_approved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mercado Pago: listar pagos (protegido) ────────────────────────────────────
app.get('/api/payments', requireAuth, async (req, res) => {
  try {
    const { limit=50, status } = req.query;
    // Nota: PaymentSearch puede variar según versión del SDK
    const searchParams = { options:{ limit:parseInt(limit), sort:'date_created', criteria:'desc' } };
    if (status) searchParams.options.status = status;
    const result = await payment.search(searchParams).catch(()=>({ elements:[] }));
    const payments = (result.elements||[]).map(p=>({ id:p.id, courseName:p.description||p.metadata?.course_title||'Curso', payerEmail:p.payer?.email, amount:p.transaction_amount, currency:p.currency_id, status:p.status, date:p.date_approved||p.date_created }));
    res.json({ payments, total:result.total||payments.length });
  } catch (err) {
    res.json({ payments:[], total:0 });
  }
});

// ── Webhook Mercado Pago: auto-email al comprador ────────────────────────────
app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200); // responder rápido a MP
  const { type, data } = req.body;
  if (type !== 'payment') return;
  try {
    const result = await payment.get({ id: data.id });
    console.log('Webhook pago:', result.status, result.id);
    if (result.status === 'approved') {
      const buyerEmail = result.payer?.email;
      const courseTitle = result.metadata?.course_title || result.description || 'tu curso';
      if (buyerEmail && process.env.SMTP_USER) {
        const transporter = createTransporter();
        // Email 1: confirmación inmediata
        const { subject, html } = buildPurchaseEmail({
          buyerName: result.payer?.first_name || '',
          courseTitle,
          accessLink: process.env.COURSE_ACCESS_URL || process.env.BASE_URL || '#',
          supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_USER,
          fromName: process.env.FROM_NAME || 'CourseAI'
        });
        await transporter.sendMail({ from:`"${process.env.FROM_NAME||'CourseAI'}" <${process.env.SMTP_USER}>`, to:buyerEmail, subject, html });
        console.log(`✉ Email de compra enviado a ${buyerEmail}`);

        // Email 2: serie de bienvenida — día 1 (24hs después)
        setTimeout(async () => {
          try {
            const { subject:s2, html:h2 } = buildWelcomeSeriesEmail(0, { buyerName:result.payer?.first_name||'', courseTitle, fromName:process.env.FROM_NAME||'CourseAI' });
            await transporter.sendMail({ from:`"${process.env.FROM_NAME||'CourseAI'}" <${process.env.SMTP_USER}>`, to:buyerEmail, subject:s2, html:h2 });
            console.log(`✉ Serie email #1 enviado a ${buyerEmail}`);
          } catch(e){ console.error('Error serie email 1:', e.message); }
        }, 24*60*60*1000);

        // Email 3: serie día 3
        setTimeout(async () => {
          try {
            const { subject:s3, html:h3 } = buildWelcomeSeriesEmail(1, { buyerName:result.payer?.first_name||'', courseTitle, fromName:process.env.FROM_NAME||'CourseAI' });
            await transporter.sendMail({ from:`"${process.env.FROM_NAME||'CourseAI'}" <${process.env.SMTP_USER}>`, to:buyerEmail, subject:s3, html:h3 });
            console.log(`✉ Serie email #2 enviado a ${buyerEmail}`);
          } catch(e){ console.error('Error serie email 2:', e.message); }
        }, 3*24*60*60*1000);
      }
    }
  } catch (err) {
    console.error('Error en webhook:', err.message);
  }
});

// ── Anthropic proxy (protegido) ───────────────────────────────────────────────
app.post('/api/generate-course', requireAuth, async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-api-key':process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify(req.body)
    });
    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect('/creador-cursos-ia.html');
});
app.get('/api/health', (req, res) => {
  res.json({ status:'ok', mp:!!process.env.MP_ACCESS_TOKEN, anthropic:!!process.env.ANTHROPIC_API_KEY, email:!!process.env.SMTP_USER, timestamp:new Date().toISOString() });
});
process.on('uncaughtException', err => { console.error('ERROR:', err.message, err.stack); });
process.on('unhandledRejection', r => { console.error('REJECTION:', r); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CourseAI corriendo en http://localhost:${PORT}`);
  console.log(`   Mercado Pago: ${process.env.MP_ACCESS_TOKEN?'✓':'✗'}`);
  console.log(`   Anthropic:    ${process.env.ANTHROPIC_API_KEY?'✓':'✗'}`);
  console.log(`   Email SMTP:   ${process.env.SMTP_USER?'✓':'✗'}`);
  console.log(`   Admin pass:   ${process.env.ADMIN_PASSWORD?'personalizada':'courseai2024 (cambiar en .env)'}\n`);
});
