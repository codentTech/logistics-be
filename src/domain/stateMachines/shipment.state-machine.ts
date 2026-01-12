import { ShipmentStatus } from '../../infra/db/entities/Shipment';
import { AppError, ErrorCode } from '../../shared/errors/error-handler';

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [ShipmentStatus.ASSIGNED],
  [ShipmentStatus.ASSIGNED]: [ShipmentStatus.PICKED_UP],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [], // Terminal state
};

export class ShipmentStateMachine {
  /**
   * Check if a state transition is valid
   */
  static canTransition(currentStatus: ShipmentStatus, nextStatus: ShipmentStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];
    return allowedTransitions?.includes(nextStatus) ?? false;
  }

  /**
   * Validate and throw error if transition is invalid
   */
  static validateTransition(currentStatus: ShipmentStatus, nextStatus: ShipmentStatus): void {
    if (!this.canTransition(currentStatus, nextStatus)) {
      const validTransitions = VALID_TRANSITIONS[currentStatus] || [];
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
          stateFlow: 'CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED'
        }
      );
    }
  }

  /**
   * Get all valid next states for a given status
   */
  static getValidNextStates(currentStatus: ShipmentStatus): ShipmentStatus[] {
    return VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Check if status is terminal (no further transitions)
   */
  static isTerminalState(status: ShipmentStatus): boolean {
    return VALID_TRANSITIONS[status]?.length === 0;
  }
}

