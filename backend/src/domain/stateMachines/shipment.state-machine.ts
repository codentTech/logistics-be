import { ShipmentStatus } from '../../infra/db/entities/Shipment';
import { AppError, ErrorCode } from '../../shared/errors/error-handler';

// Legacy status for backward compatibility (old data may still have this)
const PICKED_UP_LEGACY = 'PICKED_UP' as ShipmentStatus;

const VALID_TRANSITIONS: Record<string, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [ShipmentStatus.ASSIGNED, ShipmentStatus.CANCEL_BY_CUSTOMER],
  [ShipmentStatus.ASSIGNED]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCEL_BY_CUSTOMER, ShipmentStatus.CANCEL_BY_DRIVER],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [], // Terminal state
  // Cancelled shipments can be reassigned (transition back to ASSIGNED)
  [ShipmentStatus.CANCEL_BY_CUSTOMER]: [ShipmentStatus.ASSIGNED],
  [ShipmentStatus.CANCEL_BY_DRIVER]: [ShipmentStatus.ASSIGNED],
  // Legacy PICKED_UP status - can be cancelled (for backward compatibility with old data)
  [PICKED_UP_LEGACY]: [ShipmentStatus.CANCEL_BY_CUSTOMER, ShipmentStatus.CANCEL_BY_DRIVER, ShipmentStatus.IN_TRANSIT],
};

export class ShipmentStateMachine {
  /**
   * Check if a state transition is valid
   */
  static canTransition(currentStatus: ShipmentStatus | string, nextStatus: ShipmentStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[currentStatus as string];
    return allowedTransitions?.includes(nextStatus) ?? false;
  }

  /**
   * Validate and throw error if transition is invalid
   */
  static validateTransition(currentStatus: ShipmentStatus | string, nextStatus: ShipmentStatus): void {
    if (!this.canTransition(currentStatus, nextStatus)) {
      const validTransitions = VALID_TRANSITIONS[currentStatus as string] || [];
      const validTransitionsStr = validTransitions.length > 0 
        ? validTransitions.join(', ') 
        : 'none (terminal state)';
      
      throw new AppError(
        ErrorCode.INVALID_SHIPMENT_STATE,
        `Cannot transition from ${currentStatus} to ${nextStatus}. Valid next states: ${validTransitionsStr}`,
        400,
        {
          currentStatus,
          attemptedStatus: nextStatus,
          validTransitions: validTransitions,
          stateFlow: 'CREATED → ASSIGNED → IN_TRANSIT → DELIVERED (or CANCEL_BY_CUSTOMER/CANCEL_BY_DRIVER from CREATED/ASSIGNED)'
        }
      );
    }
  }

  /**
   * Get all valid next states for a given status
   */
  static getValidNextStates(currentStatus: ShipmentStatus | string): ShipmentStatus[] {
    return VALID_TRANSITIONS[currentStatus as string] || [];
  }

  /**
   * Check if status is terminal (no further transitions)
   */
  static isTerminalState(status: ShipmentStatus | string): boolean {
    return VALID_TRANSITIONS[status as string]?.length === 0;
  }
}

