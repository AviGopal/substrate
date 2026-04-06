import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email service
 */
export function initEmailService(): nodemailer.Transporter | null {
  try {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };

    // Skip email setup if credentials not provided
    if (!config.auth.user || !config.auth.pass) {
      console.warn('Email service not configured - SMTP credentials missing');
      return null;
    }

    transporter = nodemailer.createTransport(config);

    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        console.error('Email service verification failed:', error);
        transporter = null;
      } else {
        console.log('Email service connected successfully');
      }
    });

    return transporter;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    return null;
  }
}

/**
 * Get email transporter
 */
export function getEmailTransporter(): nodemailer.Transporter | null {
  return transporter;
}

/**
 * Send email
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate,
  fromEmail?: string
): Promise<boolean> {
  try {
    if (!transporter) {
      console.warn('Email service not available - email not sent');
      return false;
    }

    const fromAddress = fromEmail || process.env.FROM_EMAIL || 'noreply@metabob.com';

    const mailOptions = {
      from: fromAddress,
      to,
      subject: template.subject,
      text: template.text,
      html: template.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Generate password reset email template
 */
export function generatePasswordResetTemplate(
  userName: string,
  resetToken: string,
  baseUrl: string = 'http://localhost:3000'
): EmailTemplate {
  const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
  
  return {
    subject: 'Reset Your Password - Metabob Dashboard',
    text: `
Hi ${userName},

You requested to reset your password for the Metabob Dashboard.

To reset your password, click the link below or copy and paste it into your browser:
${resetLink}

This link will expire in 24 hours for security reasons.

If you didn't request this password reset, please ignore this email.

Best regards,
Metabob Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .content {
      padding: 20px 0;
    }
    .reset-button {
      display: inline-block;
      background-color: #007bff;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .reset-button:hover {
      background-color: #0056b3;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #666;
      font-size: 14px;
    }
    .warning {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 12px;
      border-radius: 4px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reset Your Password</h1>
    <p>Metabob Dashboard</p>
  </div>
  
  <div class="content">
    <p>Hi <strong>${userName}</strong>,</p>
    
    <p>You requested to reset your password for the Metabob Dashboard.</p>
    
    <p>To reset your password, click the button below:</p>
    
    <div style="text-align: center;">
      <a href="${resetLink}" class="reset-button">Reset Password</a>
    </div>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
      ${resetLink}
    </p>
    
    <div class="warning">
      <strong>Important:</strong> This link will expire in 24 hours for security reasons.
    </div>
    
    <p>If you didn't request this password reset, please ignore this email.</p>
  </div>
  
  <div class="footer">
    <p>Best regards,<br>Metabob Team</p>
    <p><em>This is an automated email. Please do not reply to this message.</em></p>
  </div>
</body>
</html>
    `.trim()
  };
}

/**
 * Generate welcome email template
 */
export function generateWelcomeTemplate(
  userName: string,
  dashboardUrl: string = 'http://localhost:3000'
): EmailTemplate {
  return {
    subject: 'Welcome to Metabob Dashboard',
    text: `
Hi ${userName},

Welcome to the Metabob Dashboard! Your account has been successfully created.

You can access your dashboard at: ${dashboardUrl}

If you have any questions or need assistance, please don't hesitate to reach out to our support team.

Best regards,
Metabob Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Metabob Dashboard</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #28a745;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .content {
      padding: 20px 0;
    }
    .dashboard-button {
      display: inline-block;
      background-color: #007bff;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .dashboard-button:hover {
      background-color: #0056b3;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to Metabob!</h1>
    <p>Your account is ready to use</p>
  </div>
  
  <div class="content">
    <p>Hi <strong>${userName}</strong>,</p>
    
    <p>Welcome to the Metabob Dashboard! Your account has been successfully created.</p>
    
    <p>You can access your dashboard by clicking the button below:</p>
    
    <div style="text-align: center;">
      <a href="${dashboardUrl}" class="dashboard-button">Go to Dashboard</a>
    </div>
    
    <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
  </div>
  
  <div class="footer">
    <p>Best regards,<br>Metabob Team</p>
  </div>
</body>
</html>
    `.trim()
  };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetToken: string,
  baseUrl?: string
): Promise<boolean> {
  try {
    const template = generatePasswordResetTemplate(userName, resetToken, baseUrl);
    return await sendEmail(email, template);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string,
  dashboardUrl?: string
): Promise<boolean> {
  try {
    const template = generateWelcomeTemplate(userName, dashboardUrl);
    return await sendEmail(email, template);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    if (!transporter) {
      console.log('Email service not configured');
      return false;
    }

    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return false;
  }
}