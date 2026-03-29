import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('smtp.host'),
      port: config.get<number>('smtp.port'),
      auth: config.get<string>('smtp.user')
        ? {
            user: config.get<string>('smtp.user'),
            pass: config.get<string>('smtp.pass'),
          }
        : undefined,
    });
    this.from = config.get<string>('smtp.from') ?? 'noreply@platform.local';
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Reset your password',
        text: `Click the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
        html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
      });
    } catch (err) {
      this.logger.error({ err, to }, 'Failed to send password reset email');
    }
  }

  async sendStaffInvite(to: string, inviteUrl: string, tenantName: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `You've been invited to join ${tenantName}`,
        text: `You've been invited to join ${tenantName} as a staff member.\n\nAccept the invitation and set your password here:\n\n${inviteUrl}\n\nThis invitation expires in 48 hours.`,
        html: `<p>You've been invited to join <strong>${tenantName}</strong> as a staff member.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This invitation expires in 48 hours.</p>`,
      });
    } catch (err) {
      this.logger.error({ err, to }, 'Failed to send staff invite email');
    }
  }
}
