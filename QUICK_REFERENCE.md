# Quick Reference - Implementation Checklist

## Day-by-Day Breakdown

### Day 1: Bootstrap + Auth + Tenant Isolation
- [ ] Project setup (package.json, tsconfig, docker-compose)
- [ ] TypeORM configuration + entities (Tenant, User, Driver)
- [ ] Fastify app setup (CORS, helmet, error handler)
- [ ] JWT auth plugin + login endpoint
- [ ] Tenant isolation middleware

**Key Files**: `app.ts`, `data-source.ts`, `auth.controller.ts`, `tenant.decorator.ts`

---

### Day 2: Shipments + State Machine + Idempotency + RabbitMQ + MQTT
- [ ] Shipment entity + ShipmentStatusHistory
- [ ] State machine logic (domain layer)
- [ ] REST endpoints: create, assign-driver, update-status
- [ ] Idempotency middleware (Redis SETNX)
- [ ] Driver location: REST endpoint (Redis storage)
- [ ] Driver location: MQTT subscriber (Redis storage)
- [ ] Unified location processor (both sources)
- [ ] Event outbox entity
- [ ] RabbitMQ setup + consumer
- [ ] Event publishing to RabbitMQ

**Key Files**: `shipment.state-machine.ts`, `shipments.controller.ts`, `idempotency.middleware.ts`

---

### Day 3: Redis + Socket.IO + GraphQL + CQRS
- [ ] Redis plugin + client setup
- [ ] Socket.IO with Redis adapter
- [ ] Real-time event broadcasting
- [ ] GraphQL schema + resolvers (Mercurius)
- [ ] CQRS dashboard read model
- [ ] GET /v1/dashboard/summary

**Key Files**: `redis.client.ts`, `socket.ts`, `schema.graphql`, `dashboard.resolver.ts`

---

### Day 4: Swagger + Postman + Polish
- [ ] Swagger/OpenAPI documentation
- [ ] Postman collection updates
- [ ] Error handling standardization
- [ ] End-to-end testing
- [ ] README updates
- [ ] Demo preparation

**Key Files**: `swagger.ts`, `error-handler.ts`, `postman_collection.json`

---

## API Endpoints Summary

### REST (All versioned `/v1`, tenant-isolated)

| Method | Endpoint | Idempotent | Description |
|--------|----------|------------|-------------|
| POST | `/v1/auth/login` | No | JWT token generation |
| POST | `/v1/shipments` | Yes | Create shipment |
| POST | `/v1/shipments/{id}/assign-driver` | Yes | Assign driver to shipment |
| POST | `/v1/shipments/{id}/status` | Yes | Update shipment status (state machine) |
| POST | `/v1/drivers/{id}/location` | No | Update driver GPS location (Redis) |
| GET | `/v1/dashboard/summary` | No | CQRS dashboard summary |

### GraphQL

- `ShipmentDashboard` query
- `OpsSummary` query

---

## Database Entities

1. **Tenant** - Multi-tenant isolation
2. **User** - Authentication (ops_admin, dispatcher, driver)
3. **Driver** - Driver profiles
4. **Shipment** - Core shipment entity with status
5. **ShipmentStatusHistory** - State machine audit trail
6. **EventOutbox** - Async event simulation
7. **DashboardSummary** - CQRS read model

---

## State Machine Transitions

```
CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

Invalid transitions return: `{ "error_code": "INVALID_SHIPMENT_STATE" }`

---

## Redis Keys Pattern

- Driver location: `driver:{tenantId}:{driverId}:location` (TTL: 1 hour)
- Idempotency: `idempotency:{tenantId}:{key}` (TTL: 1 hour)
- Socket.IO: Redis adapter for multi-instance scaling

---

## Error Format (Unified)

```json
{
  "success": false,
  "error_code": "ERROR_CODE",
  "message": "Human readable message"
}
```

Common error codes:
- `INVALID_SHIPMENT_STATE`
- `TENANT_NOT_FOUND`
- `DRIVER_NOT_FOUND`
- `UNAUTHORIZED`
- `IDEMPOTENCY_KEY_REQUIRED`

---

## Socket.IO Events

- `driver:location` - Real-time driver GPS updates
- `shipment:status` - Shipment status changes

---

## Key Dependencies

```bash
npm install fastify @fastify/jwt @fastify/swagger @fastify/mercurius
npm install typeorm pg ioredis socket.io socket.io-redis
npm install bcrypt class-validator class-transformer
```

---

## Docker Services

```bash
docker-compose up -d  # Starts Postgres + Redis + RabbitMQ + EMQX
```

- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- RabbitMQ: `localhost:5672` (AMQP), `localhost:15672` (Management UI)
- EMQX (MQTT): `localhost:1883` (MQTT), `localhost:18083` (Dashboard)

---

## Testing Flow

1. Login → Get JWT token
2. Create shipment (CREATED)
3. Assign driver (ASSIGNED)
4. Update status: PICKED_UP
5. Update status: IN_TRANSIT
6. Update driver location (Redis + Socket.IO)
7. Update status: DELIVERED
8. Query dashboard (CQRS)
9. GraphQL queries

---

## Success Criteria

✅ Swagger UI accessible  
✅ Postman collection works  
✅ Redis stores driver locations  
✅ Socket.IO broadcasts updates  
✅ Idempotency prevents duplicates  
✅ State machine validates transitions  
✅ Tenant isolation enforced  
✅ GraphQL queries return data  
✅ Retry mechanisms working  
✅ Circuit breaker pattern implemented  
✅ Dead Letter Queue configured  
✅ Health checks functional  

