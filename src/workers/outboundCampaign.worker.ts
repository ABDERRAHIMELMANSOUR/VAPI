import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { createQueue } from '../queue/Queue';
import { twilioService, type TwilioCredentials } from '../services/TwilioService';
import { enqueuePostCallSummary } from './postCall.worker';
import { createLogger } from '../utils/logger';

const log = createLogger('outboundCampaignWorker');

interface CampaignJob {
  campaignId: string;
}

const queue = createQueue<CampaignJob>('voice-campaign', 2);

/** Queue an outbound voice campaign for background dialing. */
export async function enqueueVoiceCampaign(campaignId: string): Promise<string> {
  return queue.add({ campaignId }, { attempts: 2 });
}

/**
 * Dial every pending lead in a campaign. For each lead a Call row is created
 * and the agent is connected via Twilio. When telephony is not configured the
 * call is simulated end-to-end (a short synthetic transcript) so campaigns
 * still produce analyzable call logs.
 */
export function registerOutboundCampaignWorker(): void {
  queue.process(async ({ campaignId }) => {
    const campaign = await prisma.voiceCampaign.findUnique({
      where: { id: campaignId },
      include: {
        agent: true,
        phoneNumber: true,
        leads: { where: { status: 'QUEUED' } },
      },
    });

    if (!campaign) {
      log.warn('Voice campaign job skipped: not found', { campaignId });
      return;
    }
    if (campaign.status !== 'QUEUED' && campaign.status !== 'SENDING') {
      log.debug('Voice campaign job skipped: not sendable', {
        campaignId,
        status: campaign.status,
      });
      return;
    }

    await prisma.voiceCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    });

    const fromNumber = campaign.phoneNumber?.number ?? 'unknown';
    const credentials: TwilioCredentials | undefined =
      campaign.phoneNumber?.twilioAccountSid && campaign.phoneNumber?.twilioAuthToken
        ? {
            accountSid: campaign.phoneNumber.twilioAccountSid,
            authToken: campaign.phoneNumber.twilioAuthToken,
          }
        : undefined;

    log.info('Dialing campaign leads', { campaignId, pending: campaign.leads.length });

    let completed = 0;
    let failed = 0;

    for (const lead of campaign.leads) {
      try {
        const result = await twilioService.placeCall({
          to: lead.phone,
          from: fromNumber,
          agentId: campaign.agentId,
          userId: campaign.userId,
          credentials,
        });

        if (result.simulated) {
          // No live telephony: synthesize a completed call for demo/analytics.
          const call = await createSimulatedCall(campaign, lead.phone, lead.name);
          await prisma.voiceCampaignLead.update({
            where: { id: lead.id },
            data: { status: 'COMPLETED', callId: call.id },
          });
          await enqueuePostCallSummary(call.id);
          completed += 1;
        } else {
          // Live call: Twilio drives it via the webhook/stream; log it as ringing.
          const call = await prisma.call.create({
            data: {
              userId: campaign.userId,
              agentId: campaign.agentId,
              campaignId: campaign.id,
              direction: 'OUTBOUND',
              status: 'RINGING',
              fromNumber,
              toNumber: lead.phone,
              twilioCallSid: result.sid,
              startedAt: new Date(),
            },
          });
          await prisma.voiceCampaignLead.update({
            where: { id: lead.id },
            data: { status: 'RINGING', callId: call.id },
          });
        }
      } catch (err) {
        failed += 1;
        await prisma.voiceCampaignLead.update({
          where: { id: lead.id },
          data: {
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
          },
        });
        log.warn('Lead dial failed', { lead: lead.phone });
      }
    }

    const remaining = await prisma.voiceCampaignLead.count({
      where: { campaignId, status: 'QUEUED' },
    });

    await prisma.voiceCampaign.update({
      where: { id: campaignId },
      data: {
        completedCalls: { increment: completed },
        failedCalls: { increment: failed },
        status: remaining > 0 ? 'SENDING' : 'SENT',
      },
    });

    log.info('Campaign dial batch complete', { campaignId, completed, failed, remaining });
  });

  log.info('Outbound campaign worker registered');
}

/** Build a short, plausible synthetic call for the simulated path. */
async function createSimulatedCall(
  campaign: { id: string; userId: string; agentId: string; agent: { firstMessage: string } },
  toNumber: string,
  leadName: string | null,
) {
  const now = Date.now();
  const greeting = campaign.agent.firstMessage;
  const transcript = [
    { role: 'assistant', text: greeting, at: new Date(now).toISOString() },
    {
      role: 'user',
      text: leadName ? `Hi, this is ${leadName}.` : 'Hello, who is this?',
      at: new Date(now + 4000).toISOString(),
    },
    {
      role: 'assistant',
      text: 'I am calling on behalf of the team to follow up on your interest. Is now a good time?',
      at: new Date(now + 8000).toISOString(),
    },
    {
      role: 'user',
      text: 'Sure, tell me more.',
      at: new Date(now + 12000).toISOString(),
    },
  ];

  return prisma.call.create({
    data: {
      userId: campaign.userId,
      agentId: campaign.agentId,
      campaignId: campaign.id,
      direction: 'OUTBOUND',
      status: 'COMPLETED',
      toNumber,
      durationSec: 18 + Math.floor(Math.random() * 120),
      startedAt: new Date(now),
      endedAt: new Date(now + 16000),
      endedReason: 'completed',
      transcript: transcript as unknown as Prisma.InputJsonValue,
    },
  });
}
