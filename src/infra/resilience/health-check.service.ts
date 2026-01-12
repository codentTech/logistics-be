import { AppDataSource } from '../db/data-source';
import Redis from 'ioredis';
import { RabbitMQClient } from '../queues/rabbitmq.client';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: ServiceHealth;
    redis: ServiceHealth;
    rabbitmq?: ServiceHealth;
  };
  timestamp: string;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  message?: string;
  latency?: number;
}

export class HealthCheckService {
  private redis: Redis;
  private rabbitmq?: RabbitMQClient;

  constructor(redis: Redis, rabbitmq?: RabbitMQClient) {
    this.redis = redis;
    this.rabbitmq = rabbitmq;
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      ...(this.rabbitmq && { rabbitmq: await this.checkRabbitMQ() }),
    };

    const allHealthy = Object.values(checks).every((check) => check.status === 'healthy');
    const anyUnhealthy = Object.values(checks).some((check) => check.status === 'unhealthy');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) {
      status = 'healthy';
    } else if (anyUnhealthy) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await AppDataSource.query('SELECT 1');
      const latency = Date.now() - startTime;
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - startTime;
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  private async checkRabbitMQ(): Promise<ServiceHealth> {
    if (!this.rabbitmq) {
      return {
        status: 'unhealthy',
        message: 'RabbitMQ client not initialized',
      };
    }

    const startTime = Date.now();
    try {
      const channel = this.rabbitmq.getChannel();
      if (!channel) {
        return {
          status: 'unhealthy',
          message: 'RabbitMQ channel not available',
        };
      }
      const latency = Date.now() - startTime;
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'RabbitMQ connection failed',
      };
    }
  }
}
