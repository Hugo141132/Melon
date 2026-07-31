import { z } from 'zod';

export const baseMessageSchema = z.object({
  version: z.string().default('1.0'),
  messageId: z.string().uuid(),
  deviceId: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  sequence: z.number().int().nonnegative().optional(),
});

export type BaseMessage = z.infer<typeof baseMessageSchema>;

export class MessageValidator {
  public validateBaseMessage(rawPayload: Buffer | string): {
    valid: boolean;
    data?: BaseMessage;
    error?: string;
  } {
    try {
      const parsed = JSON.parse(rawPayload.toString('utf-8'));
      const result = baseMessageSchema.safeParse(parsed);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        return { valid: false, error: `Invalid message payload: ${issues}` };
      }
      return { valid: true, data: result.data };
    } catch {
      return { valid: false, error: 'Payload must be valid JSON' };
    }
  }
}

export const messageValidator = new MessageValidator();
