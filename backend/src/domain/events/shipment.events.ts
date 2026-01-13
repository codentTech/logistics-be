export enum ShipmentEventType {
  CREATED = "shipment.created",
  ASSIGNED = "shipment.assigned",
  PICKED_UP = "shipment.picked_up",
  IN_TRANSIT = "shipment.in_transit",
  DELIVERED = "shipment.delivered",
  STATUS_CHANGED = "shipment.status.changed",
}

export interface ShipmentEventPayload {
  shipmentId: string;
  tenantId: string;
  status: string;
  previousStatus?: string;
  driverId?: string | null;
  metadata?: Record<string, any>;
}

export class ShipmentEvent {
  constructor(
    public eventType: ShipmentEventType,
    public payload: ShipmentEventPayload,
    public timestamp: Date = new Date()
  ) {}
}
