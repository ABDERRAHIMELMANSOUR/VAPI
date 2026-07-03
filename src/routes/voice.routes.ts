import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { twilioIncomingCall } from '../controllers/call.controller';

/**
 * Public Twilio voice webhook routes. These are called by Twilio (not the app
 * frontend), so they are unauthenticated and validated leniently. Configure
 * your Twilio number's "A Call Comes In" webhook to POST /voice/incoming.
 */
export const voiceRouter = Router();

voiceRouter.post('/incoming', asyncHandler(twilioIncomingCall));
// Twilio can be configured with GET in some consoles; support both.
voiceRouter.get('/incoming', asyncHandler(twilioIncomingCall));
