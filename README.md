# OpsCore - Real-Time Logistics Management Platform

A full-stack, production-grade logistics management system with real-time driver tracking, shipment management, and operational dashboards.

## 🏗️ Project Structure

```
opsCore/
├── backend/          # Node.js/TypeScript backend (Fastify)
├── frontend/         # Next.js/React frontend
└── README.md         # This file
```

## 🚀 Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (see [backend/README.md](backend/README.md)):
```bash
cp .env.example .env
# Edit .env with your server connection strings
```

4. Initialize database:
```bash
npm run seed
```

5. Start backend server:
```bash
npm run dev
```

Backend runs on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Create .env.local
NEXT_PUBLIC_MAIN_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

4. Start frontend server:
```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

## 📚 Documentation

### Backend
- **[Complete Developer Guide](backend/DEVELOPER_GUIDE.md)** - Comprehensive backend documentation
- **[API Testing Guide](backend/API_TESTING_GUIDE.md)** - How to test all APIs
- **[Login Guide](backend/LOGIN_GUIDE.md)** - Authentication instructions
- **[State Machine](backend/STATE_MACHINE.md)** - Shipment state transitions
- **[MQTT Setup](backend/MQTT_SETUP.md)** - MQTT configuration
- **[GraphQL Auth](backend/GRAPHQL_AUTH.md)** - GraphQL authentication
- **[Ubuntu Deployment](backend/UBUNTU_DEPLOYMENT.md)** - Server services setup
- **[Route Simulation](ROUTE_SIMULATION.md)** - Automatic driver movement simulation

### Frontend
- **[Frontend README](frontend/README.md)** - Complete frontend documentation

## 🎯 Key Features

### Backend
- ✅ Multi-tenant architecture with tenant isolation
- ✅ RESTful API with versioning (`/v1/*`)
- ✅ GraphQL endpoint for complex queries
- ✅ Real-time updates via Socket.IO
- ✅ MQTT integration for IoT devices
- ✅ State machine for shipment lifecycle
- ✅ Idempotency support
- ✅ Event-driven architecture (RabbitMQ)
- ✅ CQRS pattern for reads
- ✅ Redis for caching and real-time data
- ✅ **Route Simulation** - Automatic driver movement from pickup to delivery
- ✅ **OSRM Routing** - Real road-based routes (not straight lines)
- ✅ **Modular Architecture** - Separated routes, schemas, controllers, services

### Frontend
- ✅ Real-time driver location tracking
- ✅ Interactive maps (React-Leaflet)
- ✅ Driver location sharing from web interface
- ✅ Shipment management (create, assign, track)
- ✅ Dashboard with live statistics
- ✅ Custom UI components
- ✅ Responsive design
- ✅ Redux Toolkit for state management
- ✅ **Map-based Address Picker** - Select pickup/delivery addresses on map
- ✅ **Driver Filter Dropdown** - Filter drivers on map view
- ✅ **Sticky Sidebar & Navbar** - Fixed navigation for better UX
- ✅ **Real-time Route Simulation** - Watch drivers move along actual roads

## 🔧 Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Message Queue**: RabbitMQ 3.12+
- **MQTT**: EMQX
- **GraphQL**: Mercurius
- **Real-time**: Socket.IO

### Frontend
- **Framework**: Next.js 15.3.1
- **UI Library**: React 19
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **Maps**: React-Leaflet, Leaflet
- **Real-time**: Socket.IO Client
- **Forms**: React Hook Form, Yup
- **HTTP Client**: Axios

## 📡 API Endpoints

### Authentication
- `POST /v1/auth/login` - Login and get JWT token

### Shipments
- `GET /v1/shipments` - Get all shipments
- `GET /v1/shipments/:id` - Get shipment by ID
- `POST /v1/shipments` - Create shipment
- `POST /v1/shipments/:id/assign-driver` - Assign driver
- `POST /v1/shipments/:id/status` - Update status

### Drivers
- `GET /v1/drivers` - Get all drivers
- `GET /v1/drivers/:id` - Get driver by ID
- `POST /v1/drivers/:id/location` - Update driver location

### Dashboard
- `GET /v1/dashboard/summary` - Get operational summary

### GraphQL
- `POST /graphql` - GraphQL endpoint
- `GET /graphql` - GraphiQL playground (development)

## 🔐 Authentication

All API endpoints (except login) require JWT authentication:
```
Authorization: Bearer <token>
```

Get token from `/v1/auth/login` endpoint.

## 🌐 Real-Time Features

### Socket.IO Events

- `driver-location-update` - Real-time driver location updates
- `shipment-status-update` - Shipment status changes

### MQTT Topics

- `tenant/{tenantId}/driver/{driverId}/location` - Driver location updates

## 📖 Usage Examples

### Create Shipment
```bash
POST /v1/shipments
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-request-id
Body:
{
  "pickupAddress": "123 Main St",
  "deliveryAddress": "456 Oak Ave",
  "customerName": "John Doe",
  "customerPhone": "+1234567890"
}
```

### Share Driver Location (Frontend)
1. Navigate to `/driver-location` page
2. Click "Start Sharing Location"
3. Allow browser location permissions
4. Location automatically sent to backend

### View Real-Time Dashboard
1. Login as admin
2. Navigate to `/dashboard`
3. View live driver locations on map
4. Monitor shipment statistics

## 🧪 Testing

### Backend
```bash
cd backend
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
```

### Frontend
```bash
cd frontend
npm run lint          # Run ESLint
npm run type-check    # TypeScript type checking
```

## 📝 Development Workflow

1. **Backend Development**
   - Make changes in `backend/src/`
   - Code is organized by modules (auth, shipments, drivers, dashboard)
   - Each module has: controllers, routes, schemas, services, dto, repositories
   - Run `npm run dev` for hot reload

2. **Frontend Development**
   - Make changes in `frontend/src/`
   - Components organized by feature
   - Custom components in `common/components/`
   - Run `npm run dev` for hot reload

3. **Database Changes**
   - Update entities in `backend/src/infra/db/entities/`
   - Run migrations: `npm run migration:generate`
   - Apply: `npm run migration:run`

## 🐛 Troubleshooting

### Backend Issues
- Check [TROUBLESHOOT_CONNECTION.md](backend/TROUBLESHOOT_CONNECTION.md)
- Verify environment variables in `.env`
- Check server connection strings
- Review logs for errors

### Frontend Issues
- Check browser console for errors
- Verify `NEXT_PUBLIC_MAIN_URL` and `NEXT_PUBLIC_SOCKET_URL`
- Ensure backend is running
- Check network tab for API errors

## 📄 License

Proprietary - All rights reserved

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

**Last Updated**: 2024  
**Version**: 1.0.0

