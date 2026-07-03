import { prisma } from '../config/prisma';
import { createQueue } from '../queue/Queue';
import { emailService } from '../services/EmailService';
import { createLogger } from '../utils/logger';

const log = createLogger('campaignWorker');

interface CampaignJob {
  campaignId: string;
}

const queue = createQueue<CampaignJob>('email-campaign', 2);

/** Queue a campaign for background delivery. */
export async function enqueueCampaign(campaignId: string): Promise<string> {
  return queue.add({ campaignId }, { attempts: 2 });
}

/**
 * Register the worker that sends a queued campaign to all pending recipients,
 * updating per-recipient status and rolling campaign counters as it goes.
 */
export function registerCampaignWorker(): void {
  queue.process(async ({ campaignId }) => {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: { recipients: { where: { status: 'PENDING' } } },
    });

    if (!campaign) {
      log.warn('Campaign job skipped: not found', { campaignId });
      return;
    }
    if (campaign.status !== 'QUEUED' && campaign.status !== 'SENDING') {
      log.debug('Campaign job skipped: not in a sendable state', {
        campaignId,
        status: campaign.status,
      });
      return;
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    });

    log.info('Sending campaign', {
      campaignId,
      pending: campaign.recipients.length,
    });

    let sent = 0;
    let failed = 0;

    for (const recipient of campaign.recipients) {
      try {
        const result = await emailService.send({
          to: recipient.email,
          from: campaign.fromEmail,
          subject: campaign.subject,
          html: campaign.html,
          text: campaign.text ?? undefined,
        });
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: result.accepted ? 'SENT' : 'FAILED',
            sentAt: new Date(),
            error: null,
          },
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
          },
        });
        log.warn('Recipient send failed', { recipient: recipient.email });
      }
    }

    // Roll counters and decide final campaign status.
    const remaining = await prisma.campaignRecipient.count({
      where: { campaignId, status: 'PENDING' },
    });
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        sentCount: { increment: sent },
        failedCount: { increment: failed },
        status: remaining > 0 ? 'SENDING' : failed > 0 && sent === 0 ? 'FAILED' : 'SENT',
      },
    });

    log.info('Campaign batch complete', { campaignId, sent, failed, remaining });
  });

  log.info('Campaign worker registered');
}
