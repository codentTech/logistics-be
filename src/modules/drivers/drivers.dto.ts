import { IsNotEmpty, IsNumber, IsString, IsISO8601, IsOptional } from 'class-validator';

export class UpdateDriverLocationDto {
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @IsISO8601()
  @IsOptional()
  timestamp?: string;
}

export class DriverLocationResponseDto {
  driverId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  source: 'REST' | 'MQTT';
}

