export type AuthoritativePhysicalState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export type ValveTransitionState =
  'OPENING' | 'CLOSING' | 'DISPENSING' | 'WAITING_CONFIRMATION' | null;

export const ACTIVE_VALVE_COMMAND_STATUSES = [
  'PENDING',
  'QUEUED',
  'SENT',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
];

/**
 * Derives the active in-flight valve transition state for smooth,
 * human-readable UI feedback during command submission and execution.
 */
export function deriveValveTransitionState(
  activeCommand?: { status: string; action?: string } | null,
  isSubmitting?: boolean,
  submittingAction?: 'DISPENSE' | 'OPEN' | 'CLOSE' | string | null
): ValveTransitionState {
  if (isSubmitting) {
    if (submittingAction === 'OPEN') return 'OPENING';
    if (submittingAction === 'CLOSE') return 'CLOSING';
    if (submittingAction === 'DISPENSE') return 'DISPENSING';
    return 'WAITING_CONFIRMATION';
  }

  if (!activeCommand || !ACTIVE_VALVE_COMMAND_STATUSES.includes(activeCommand.status)) {
    return null;
  }

  const action = activeCommand.action;
  if (action === 'OPEN') return 'OPENING';
  if (action === 'CLOSE') return 'CLOSING';
  if (action === 'DISPENSE') return 'DISPENSING';

  return 'WAITING_CONFIRMATION';
}
