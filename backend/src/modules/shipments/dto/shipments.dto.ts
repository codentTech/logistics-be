import { IsNotEmpty, IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { ShipmentStatus } from '../../../infra/db/entities/Shipment';

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @IsString()
  @IsNotEmpty()
  deliveryAddress: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;
}

export class AssignDriverDto {
  @IsUUID()
  @IsNotEmpty()
  driverId: string;
}

export class UpdateShipmentStatusDto {
  @IsEnum(ShipmentStatus)
  @IsNotEmpty()
  status: ShipmentStatus;
}

export class ShipmentResponseDto {
  id: string;
  tenantId: string;
  driverId: string | null;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
  assignedAt: Date | null;
  pendingApproval: boolean;
  approvedAt: Date | null;
  cancelledAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

