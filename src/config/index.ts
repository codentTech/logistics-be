import { config } from 'dotenv';

config();

export const appConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
};

export const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'opscore',
  password: process.env.POSTGRES_PASSWORD || 'opscore_dev',
  database: process.env.POSTGRES_DB || 'opscore_db',
};

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production_min_32_chars',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

export const rabbitmqConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  user: process.env.RABBITMQ_USER || 'opscore',
  password: process.env.RABBITMQ_PASSWORD || 'opscore_dev',
};

export const mqttConfig = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
};

export const swaggerConfig = {
  enabled: process.env.SWAGGER_ENABLED !== 'false',
  host: process.env.SWAGGER_HOST || 'localhost:3000',
};

export const retryConfig = {
  maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
  initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '1000', 10),
  maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '10000', 10),
  multiplier: parseFloat(process.env.RETRY_MULTIPLIER || '2'),
};

export const circuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
  timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000', 10),
  halfOpenTimeout: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT || '30000', 10),
};
