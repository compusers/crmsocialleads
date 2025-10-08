// ============================================
// SERVICIO DE EMAIL - NODEMAILER
// ============================================

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.from = process.env.EMAIL_FROM || 'noreply@crmsocialleads.com';
    this.appName = process.env.APP_NAME || 'CRM Social Leads';
    this.appUrl = process.env.APP_URL || 'https://crmsocialleads.onrender.com';
    this.initialize();
  }

  initialize() {
    // Configurar transporter según el proveedor
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

    if (emailProvider === 'smtp') {
      // SMTP genérico (Hostinger, Gmail, etc.)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true para puerto 465, false para otros
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        connectionTimeout: 10000, // 10 segundos
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    } else if (emailProvider === 'gmail') {
      // Gmail
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD, // App Password, no la contraseña normal
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    }

    console.log(`📧 Email service initialized with provider: ${emailProvider}`);
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      if (!this.transporter) {
        console.error('❌ Email transporter not configured');
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: `"${this.appName}" <${this.from}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent:', info.messageId);
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(email, resetToken, userName = 'Usuario') {
    const resetLink = `${this.appUrl}/reset-password?token=${resetToken}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar Contraseña</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.appName}</h1>
    </div>
    <div class="content">
      <h2>¡Hola ${userName}!</h2>
      <p>Recibimos una solicitud para recuperar tu contraseña.</p>
      <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Recuperar Contraseña</a>
      </div>
      
      <p>O copia y pega este enlace en tu navegador:</p>
      <p style="background: white; padding: 10px; border: 1px solid #ddd; border-radius: 3px; word-break: break-all;">
        ${resetLink}
      </p>
      
      <div class="warning">
        <strong>⚠️ Importante:</strong>
        <ul>
          <li>Este enlace es válido por <strong>1 hora</strong></li>
          <li>Si no solicitaste este cambio, ignora este correo</li>
          <li>Tu contraseña actual seguirá siendo válida</li>
        </ul>
      </div>
      
      <p>Si tienes problemas, contacta con soporte.</p>
      
      <p>Saludos,<br>Equipo de ${this.appName}</p>
    </div>
    <div class="footer">
      <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
      <p>&copy; ${new Date().getFullYear()} ${this.appName}. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Hola ${userName},

Recibimos una solicitud para recuperar tu contraseña.

Para crear una nueva contraseña, visita el siguiente enlace:
${resetLink}

Este enlace es válido por 1 hora.

Si no solicitaste este cambio, ignora este correo y tu contraseña actual seguirá siendo válida.

Saludos,
Equipo de ${this.appName}
    `;

    return await this.sendEmail(
      email,
      `Recuperar Contraseña - ${this.appName}`,
      html,
      text
    );
  }

  async sendWelcomeEmail(email, userName, temporaryPassword = null) {
    const loginLink = `${this.appUrl}/login`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bienvenido a ${this.appName}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .credentials { background: white; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido a ${this.appName}! 🎉</h1>
    </div>
    <div class="content">
      <h2>¡Hola ${userName}!</h2>
      <p>Tu cuenta ha sido creada exitosamente.</p>
      
      ${temporaryPassword ? `
      <div class="credentials">
        <h3>Tus credenciales de acceso:</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
        <p style="color: #f44336;"><strong>⚠️ Por seguridad, cambia tu contraseña después del primer inicio de sesión.</strong></p>
      </div>
      ` : ''}
      
      <div style="text-align: center;">
        <a href="${loginLink}" class="button">Iniciar Sesión</a>
      </div>
      
      <p>¡Gracias por unirte a nosotros!</p>
      
      <p>Saludos,<br>Equipo de ${this.appName}</p>
    </div>
  </div>
</body>
</html>
    `;

    return await this.sendEmail(
      email,
      `Bienvenido a ${this.appName}`,
      html
    );
  }

  // Método auxiliar para quitar HTML
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Verificar configuración
  async verifyConnection() {
    try {
      if (!this.transporter) {
        return { success: false, message: 'Email transporter not configured' };
      }
      await this.transporter.verify();
      console.log('✅ Email server connection verified');
      return { success: true, message: 'Email server ready' };
    } catch (error) {
      console.error('❌ Email server connection failed:', error.message);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
