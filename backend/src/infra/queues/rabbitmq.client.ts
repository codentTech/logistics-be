import * as amqp from 'amqplib';
import { ConsumeMessage, Options } from 'amqplib';
import { rabbitmqConfig } from '../../config';

export class RabbitMQClient {
  private connection: any = null; // amqp.Connection
  private channel: any = null; // amqp.Channel

  async connect(): Promise<void> {
    try {
      const connectionUrl = `amqp://${rabbitmqConfig.user}:${rabbitmqConfig.password}@${rabbitmqConfig.url.replace('amqp://', '')}`;
      this.connection = await amqp.connect(connectionUrl, {
        heartbeat: 60, // Heartbeat every 60 seconds
        clientProperties: {
          connection_name: 'opscore-backend',
        },
      });

      if (this.connection) {
        this.connection.on('error', (err: Error) => {
          // Connection error handled by retry mechanism
        });

        this.connection.on('close', () => {
          // Connection closed, will reconnect
          this.channel = null;
        });

        // Create confirm channel for reliable publishing
        this.channel = await this.connection.createConfirmChannel();
        
        // Set channel prefetch for fair dispatch
        await this.channel.prefetch(10);
      }
      await this.setupExchangesAndQueues();
    } catch (error) {
      // Don't throw - let the caller handle it gracefully
      // Connection failed, handled gracefully
      throw error;
    }
  }

  private async setupExchangesAndQueues(): Promise<void> {
    if (!this.channel) return;

    // Create main exchange
    await this.channel.assertExchange('opscore.events', 'topic', {
      durable: true,
    });

    // Create Dead Letter Exchange
    await this.channel.assertExchange('opscore.dlx', 'direct', {
      durable: true,
    });

    // Create Dead Letter Queue
    await this.channel.assertQueue('dead-letter-queue', {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours
      },
    });

    await this.channel.bindQueue('dead-letter-queue', 'opscore.dlx', 'dead-letter');

    // Create shipment events queue
    await this.channel.assertQueue('shipment-events', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'opscore.dlx',
        'x-dead-letter-routing-key': 'dead-letter',
      },
    });

    await this.channel.bindQueue('shipment-events', 'opscore.events', 'shipment.*');

    // RabbitMQ exchanges and queues setup complete
  }

  async publish(exchange: string, routingKey: string, message: Buffer, options?: Options.Publish): Promise<boolean> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    return new Promise((resolve, reject) => {
      try {
        const published = this.channel.publish(exchange, routingKey, message, {
          persistent: true,
          ...options,
        }, (err: Error | null, ok: boolean) => {
          if (err) {
            reject(err);
          } else {
            resolve(ok);
          }
        });

        if (!published) {
          // Channel buffer is full
          this.channel.once('drain', () => {
            resolve(true);
          });
        } else {
          resolve(true);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async consume(
    queue: string,
    onMessage: (msg: ConsumeMessage | null) => void,
    options?: Options.Consume
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    await this.channel.consume(queue, onMessage, {
      noAck: false,
      ...options,
    });
  }

  async ack(message: ConsumeMessage): Promise<void> {
    if (!this.channel) return;
    this.channel.ack(message);
  }

  async nack(message: ConsumeMessage, requeue = false): Promise<void> {
    if (!this.channel) return;
    this.channel.nack(message, false, requeue);
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }

  getChannel(): any {
    return this.channel;
  }
}
