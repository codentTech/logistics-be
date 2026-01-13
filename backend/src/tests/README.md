# Test Suite Documentation

This directory contains comprehensive test suites for the OpsCore backend platform.

## Test Structure

```
tests/
├── setup.ts                    # Jest setup and environment configuration
├── helpers/
│   └── test-helpers.ts         # Test utilities and mock factories
├── unit/                       # Unit tests (isolated component testing)
│   ├── domain/
│   │   └── stateMachines/     # State machine logic tests
│   ├── modules/
│   │   ├── auth/              # Authentication service tests
│   │   ├── shipments/         # Shipment service tests
│   │   └── drivers/           # Driver location processing tests
│   └── shared/
│       ├── errors/             # Error handling tests
│       └── middleware/         # Middleware tests (idempotency, etc.)
└── integration/               # Integration tests (end-to-end flows)
    ├── modules/
    │   ├── auth/              # Auth controller integration tests
    │   └── shipments/         # Shipment controller integration tests
    ├── graphql/               # GraphQL resolver tests
    └── health-check.test.ts   # Health check endpoint tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- shipment.state-machine.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should create shipment"
```

## Test Categories

### Unit Tests

Unit tests focus on isolated components without external dependencies:

- **State Machine Tests**: Validate shipment state transitions
- **Service Tests**: Test business logic in services (auth, shipments, drivers)
- **Middleware Tests**: Test idempotency, error handling
- **Error Handler Tests**: Test error formatting and codes

### Integration Tests

Integration tests verify end-to-end flows with mocked dependencies:

- **Controller Tests**: Test HTTP endpoints with authentication
- **GraphQL Tests**: Test GraphQL queries and resolvers
- **Health Check Tests**: Test system health endpoints

## Test Utilities

### Mock Factories

Located in `helpers/test-helpers.ts`:

- `createMockTenant()` - Creates mock tenant entities
- `createMockUser()` - Creates mock user entities
- `createMockDriver()` - Creates mock driver entities
- `createMockShipment()` - Creates mock shipment entities
- `createMockRequest()` - Creates mock Fastify requests
- `createMockReply()` - Creates mock Fastify replies
- `createMockJWT()` - Creates mock JWT tokens

### Example Usage

```typescript
import { createMockShipment, createMockUser } from '../helpers/test-helpers';

const shipment = createMockShipment({
  status: ShipmentStatus.IN_TRANSIT,
  tenantId: 'tenant-1',
});
```

## Mocking Strategy

### Database

- TypeORM repositories are mocked using `jest.mock()`
- Query runners are mocked for transaction testing
- Entities are created using factory functions

### External Services

- **Redis**: Mocked using `jest.Mocked<Redis>`
- **RabbitMQ**: Mocked at the client level
- **MQTT**: Mocked at the subscriber level

### Authentication

- JWT verification is mocked in request objects
- User context is injected via `request.user`

## Test Coverage Goals

- **Unit Tests**: >80% coverage for services, domain logic, middleware
- **Integration Tests**: Cover all API endpoints and GraphQL queries
- **Edge Cases**: Test error scenarios, invalid inputs, state transitions

## Writing New Tests

### Unit Test Template

```typescript
import { ServiceName } from '../../../../path/to/service';
import { createMockEntity } from '../../../helpers/test-helpers';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: any;

  beforeEach(() => {
    mockDependency = {
      method: jest.fn(),
    };
    service = new ServiceName(mockDependency);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      mockDependency.method.mockResolvedValue({ success: true });
      
      const result = await service.methodName();
      
      expect(result).toBeDefined();
      expect(mockDependency.method).toHaveBeenCalled();
    });

    it('should handle error case', async () => {
      mockDependency.method.mockRejectedValue(new Error('Test error'));
      
      await expect(service.methodName()).rejects.toThrow();
    });
  });
});
```

### Integration Test Template

```typescript
import { buildApp } from '../../../../app';

describe('ControllerName Integration', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/endpoint',
      headers: {
        authorization: 'Bearer token',
      },
      payload: { data: 'test' },
    });

    expect(response.statusCode).toBe(200);
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies, not the code under test
3. **Naming**: Use descriptive test names: `should [expected behavior] when [condition]`
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Cleanup**: Always clear mocks in `afterEach`
6. **Coverage**: Aim for high coverage but focus on meaningful tests

## Continuous Integration

Tests are designed to run in CI/CD pipelines:

- No external dependencies required (all mocked)
- Fast execution (< 30 seconds for full suite)
- Deterministic results (no flaky tests)

## Troubleshooting

### Tests failing with "Cannot find module"

- Ensure `tsconfig.json` includes test files
- Check `jest.config.js` paths are correct

### Mock not working

- Verify mock is set before the code under test runs
- Check mock implementation matches actual interface

### Integration test timeouts

- Increase timeout in `jest.config.js`
- Check for unclosed connections or async operations

