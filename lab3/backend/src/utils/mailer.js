import nodemailer from 'nodemailer';
import { logger } from '../logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mailpit',
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: process.env.SMTP_SECURE === 'true', // false для порта 1025
  // Игнорируем auth, так как локальный Mailpit не требует пароля
});

const defaultFrom = process.env.SMTP_FROM || '"Movie App" <noreply@example.com>';

export async function sendResetPasswordEmail(email, resetToken) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${baseUrl}?resetToken=${resetToken}`;

  const mailOptions = {
    from: defaultFrom,
    to: email,
    subject: 'Сброс пароля',
    text: `Для сброса пароля перейдите по ссылке: ${resetLink}\nСсылка действительна 15 минут.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Восстановление доступа</h2>
        <p>Вы запросили сброс пароля. Перейдите по ссылке ниже для установки нового пароля:</p>
        <p style="margin: 20px 0;">
          <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 18px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Сбросить пароль
          </a>
        </p>
        <p>Или скопируйте ссылку в адресную строку браузера:</p>
        <p><code style="background: #f4f4f4; padding: 5px 10px; border-radius: 3px;">${resetLink}</code></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p><small style="color: #777;">Ссылка действительна в течение 15 минут.</small></p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  logger.info({ messageId: info.messageId, email }, 'Reset password email sent to local SMTP');

  return info;
}