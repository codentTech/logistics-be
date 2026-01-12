import { Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { EventOutbox, EventOutboxStatus } from '../db/entities/EventOutbox';
import { RabbitMQClient } from './rabbitmq.client';
import { retryWithBackoff } from '../resilience/retry.util';

export class EventPublisherService {
  private outboxRepository: Repository<EventOutbox>;
  private rabbitmq: RabbitMQClient;

  constructor() {
    this.outboxRepository = AppDataSource.getRepository(EventOutbox);
    this.rabbitmq = new RabbitMQClient();
  }

  async initialize(): Promise<void> {
    await this.rabbitmq.connect();
  }

  /**
   * Publish event using transactional outbox pattern
   * 1. Store event in outbox (within transaction)
   * 2. Background processor will publish to RabbitMQ
   */
  async publishEvent(
    tenantId: string,
    eventType: string,
    aggregateId: string,
    payload: Record<string, any>
  ): Promise<void> {
    // Store in event outbox
    const event = this.outboxRepository.create({
      tenantId,
      eventType,
      aggregateId,
      payload,
      status: EventOutboxStatus.PENDING,
    });

    await this.outboxRepository.save(event);
  }

  /**
   * Process pending events from outbox and publish to RabbitMQ
   * This should be called by a background job/processor
   */
  async processOutboxEvents(): Promise<void> {
    try {
      const pendingEvents = await this.outboxRepository.find({
        where: {
          status: EventOutboxStatus.PENDING,
        },
        order: {
          createdAt: 'ASC',
        },
        take: 100, // Process in batches
      });

      for (const event of pendingEvents) {
        try {
          await retryWithBackoff(
            async () => {
              const message = Buffer.from(
                JSON.stringify({
                  eventType: event.eventType,
                  aggregateId: event.aggregateId,
                  payload: event.payload,
                  timestamp: event.createdAt.toISOString(),
                })
              );

              const routingKey = this.getRoutingKey(event.eventType);
              const published = await this.rabbitmq.publish(
                'opscore.events',
                routingKey,
                message
              );

              if (!published) {
                throw new Error('Failed to publish to RabbitMQ');
              }
            },
            {
              maxRetries: 3,
              initialDelay: 1000,
              maxDelay: 10000,
              multiplier: 2,
            }
          );

          // Mark as processed
          event.status = EventOutboxStatus.PROCESSED;
          event.processedAt = new Date();
          await this.outboxRepository.save(event);
        } catch (error) {
          // Increment retry count
          event.retryCount++;

          if (event.retryCount >= 5) {
            // Move to dead letter
            event.status = EventOutboxStatus.DEAD_LETTER;
            event.errorMessage = error instanceof Error ? error.message : String(error);
          } else {
            event.status = EventOutboxStatus.FAILED;
          }

          await this.outboxRepository.save(event);
        }
      }
    } catch (error: any) {
      // Handle case where table doesn't exist yet (database not initialized)
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        // Table doesn't exist - this is expected if DB_SYNC is false and migrations haven't run
        // Silently skip processing until tables are created
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }

  private getRoutingKey(eventType: string): string {
    // Convert event type to routing key
    // e.g., "shipment.created" -> "shipment.created"
    return eventType.replace(/\./g, '.');
  }

  async close(): Promise<void> {
    await this.rabbitmq.close();
  }
}
