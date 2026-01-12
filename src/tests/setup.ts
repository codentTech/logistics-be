import "reflect-metadata";

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.RABBITMQ_URL = "amqp://localhost:5672";
process.env.MQTT_BROKER_URL = "mqtt://localhost:1883";

// Global test timeout
jest.setTimeout(10000);
