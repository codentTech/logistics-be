import mqtt, { MqttClient } from 'mqtt';
import { mqttConfig } from '../../config';
import { LocationProcessorService } from '../../modules/drivers/services/location-processor.service';
import { AppError, ErrorCode } from '../../shared/errors/error-handler';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';

export class MQTTSubscriber {
  private client: MqttClient | null = null;
  private locationProcessor: LocationProcessorService;
  private io: SocketIOServer | null = null;

  constructor(redis: Redis, io?: SocketIOServer) {
    this.locationProcessor = new LocationProcessorService(redis);
    this.io = io || null;
  }

  connect(): void {
    const options = {
      host: mqttConfig.brokerUrl.replace('mqtt://', '').split(':')[0],
      port: parseInt(mqttConfig.brokerUrl.split(':')[2] || '1883', 10),
      username: mqttConfig.username,
      password: mqttConfig.password,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    };

    this.client = mqtt.connect(mqttConfig.brokerUrl, options);

    this.client.on('connect', () => {
      // MQTT connected
      // Subscribe to driver location topics
      // Pattern: tenant/{tenantId}/driver/{driverId}/location
      this.client!.subscribe('tenant/+/driver/+/location', { qos: 1 }, (err) => {
        if (err) {
          console.error('MQTT subscription error:', err);
        } else {
          // Subscribed to driver location topics
        }
      });
    });

    this.client.on('message', async (topic, message) => {
      await this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      // MQTT connection error - will retry
    });

    this.client.on('offline', () => {
      // MQTT client went offline
    });

    this.client.on('reconnect', () => {
      // MQTT reconnecting
    });

    this.client.on('close', () => {
      // MQTT connection closed
    });

    this.client.on('reconnect', () => {
      // MQTT reconnecting
    });
  }

  private async handleMessage(topic: string, message: Buffer): Promise<void> {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      try {
        // Parse topic: tenant/{tenantId}/driver/{driverId}/location
        const topicMatch = topic.match(/^tenant\/([^/]+)\/driver\/([^/]+)\/location$/);
        if (!topicMatch) {
          // Invalid topic format - skipping
          return; // Acknowledge to prevent redelivery
        }

        const [, tenantId, driverId] = topicMatch;

        // Parse message payload
        const locationData = JSON.parse(message.toString());

        // Validate payload
        if (
          typeof locationData.latitude !== 'number' ||
          typeof locationData.longitude !== 'number'
        ) {
          throw new Error('Invalid location data format');
        }

        // Process location
        await this.locationProcessor.processLocation(
          tenantId,
          driverId,
          {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            timestamp: locationData.timestamp || new Date().toISOString(),
          },
          'MQTT'
        );

        // Emit Socket.IO event
        if (this.io) {
          this.io.to(`tenant:${tenantId}`).emit('driver-location-update', {
            driverId,
            location: {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              timestamp: locationData.timestamp || new Date().toISOString(),
            },
            source: 'MQTT',
          });
        }

        // Success - message will be acknowledged automatically (qos: 1)
        return;
      } catch (error) {
        retryCount++;

        if (retryCount > maxRetries) {
          // Max retries exceeded
          console.error('MQTT message processing failed after retries', {
            topic,
            error: error instanceof Error ? error.message : error,
            retryCount,
          });
          // Acknowledge to prevent infinite redelivery
          // In production, you might want to store in DLQ
          return;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}
