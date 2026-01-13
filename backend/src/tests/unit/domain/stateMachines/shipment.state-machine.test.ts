import { ShipmentStateMachine } from '../../../../domain/stateMachines/shipment.state-machine';
import { ShipmentStatus } from '../../../../infra/db/entities/Shipment';
import { AppError, ErrorCode } from '../../../../shared/errors/error-handler';

describe('ShipmentStateMachine', () => {
  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.CREATED, ShipmentStatus.ASSIGNED)).toBe(true);
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.ASSIGNED, ShipmentStatus.PICKED_UP)).toBe(true);
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT)).toBe(true);
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED)).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.CREATED, ShipmentStatus.DELIVERED)).toBe(false);
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.ASSIGNED, ShipmentStatus.CREATED)).toBe(false);
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.DELIVERED, ShipmentStatus.IN_TRANSIT)).toBe(false);
    });

    it('should return false for same status', () => {
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.CREATED, ShipmentStatus.CREATED)).toBe(false);
      expect(ShipmentStateMachine.canTransition(ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERED)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => {
        ShipmentStateMachine.validateTransition(ShipmentStatus.CREATED, ShipmentStatus.ASSIGNED);
      }).not.toThrow();
    });

    it('should throw AppError for invalid transitions', () => {
      expect(() => {
        ShipmentStateMachine.validateTransition(ShipmentStatus.CREATED, ShipmentStatus.DELIVERED);
      }).toThrow(AppError);

      try {
        ShipmentStateMachine.validateTransition(ShipmentStatus.CREATED, ShipmentStatus.DELIVERED);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).errorCode).toBe(ErrorCode.INVALID_SHIPMENT_STATE);
        expect((error as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('getValidNextStates', () => {
    it('should return correct next states for each status', () => {
      expect(ShipmentStateMachine.getValidNextStates(ShipmentStatus.CREATED)).toEqual([ShipmentStatus.ASSIGNED]);
      expect(ShipmentStateMachine.getValidNextStates(ShipmentStatus.ASSIGNED)).toEqual([ShipmentStatus.PICKED_UP]);
      expect(ShipmentStateMachine.getValidNextStates(ShipmentStatus.PICKED_UP)).toEqual([ShipmentStatus.IN_TRANSIT]);
      expect(ShipmentStateMachine.getValidNextStates(ShipmentStatus.IN_TRANSIT)).toEqual([ShipmentStatus.DELIVERED]);
      expect(ShipmentStateMachine.getValidNextStates(ShipmentStatus.DELIVERED)).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should return true for DELIVERED status', () => {
      expect(ShipmentStateMachine.isTerminalState(ShipmentStatus.DELIVERED)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(ShipmentStateMachine.isTerminalState(ShipmentStatus.CREATED)).toBe(false);
      expect(ShipmentStateMachine.isTerminalState(ShipmentStatus.ASSIGNED)).toBe(false);
      expect(ShipmentStateMachine.isTerminalState(ShipmentStatus.PICKED_UP)).toBe(false);
      expect(ShipmentStateMachine.isTerminalState(ShipmentStatus.IN_TRANSIT)).toBe(false);
    });
  });
});

