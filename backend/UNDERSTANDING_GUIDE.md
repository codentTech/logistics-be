# OpsCore Backend - Complete Understanding Guide

## 📖 Introduction

This document explains everything about the OpsCore backend system in simple terms, using real-world examples. Think of it as a guide that helps you understand what each piece does and how everything works together.

---

## 🎯 What is OpsCore?

**Real-world example:** Imagine you run a delivery company like FedEx or UPS. You need to:

- Track where your delivery drivers are in real-time
- Manage shipments (packages) from pickup to delivery
- Know which driver is handling which shipment
- See a dashboard showing how many deliveries are in progress

OpsCore is the backend system that makes all of this possible. It's like the brain that coordinates everything behind the scenes.

---

## 🏗️ Architecture Overview (The Big Picture)

Think of the system like a restaurant:

- **PostgreSQL Database** = The kitchen pantry (stores all ingredients/data permanently)
- **Redis** = The counter where ready-to-serve dishes are kept (fast access to current info)
- **RabbitMQ** = The order slip system (passes messages between kitchen stations)
- **MQTT** = The delivery driver's walkie-talkie (receives location updates)
- **Socket.IO** = The waiter who tells you when your food is ready (real-time updates to users)
- **Fastify** = The restaurant manager (coordinates everything)

---

## 📦 Packages and Technologies Explained

### 1. Node.js and TypeScript

**What it is:** The programming language and runtime environment.

**Real-world example:**

- Node.js is like the engine of a car - it runs your code
- TypeScript is like having a spell-checker for code - it catches errors before they happen

**Why we use it:**

- Fast and efficient
- Works well for real-time applications
- TypeScript helps prevent bugs

---

### 2. Fastify

**What it is:** A web framework - the foundation that handles HTTP requests.

**Real-world example:**
Think of Fastify as a receptionist at a hotel. When someone knocks on the door (makes an API request), Fastify:

- Opens the door (receives the request)
- Checks who they are (authentication)
- Routes them to the right room (endpoint)
- Sends a response back

**Why we use it:**

- Very fast (faster than Express)
- Built-in features for security and validation
- Easy to extend with plugins

---

### 3. PostgreSQL

**What it is:** A relational database - stores data in tables with relationships.

**Real-world example:**
Like a filing cabinet with organized folders:

- **Tenants table** = Folder for each company using the system
- **Users table** = Folder with employee information
- **Shipments table** = Folder with all delivery records
- **Drivers table** = Folder with driver information

**What we store:**

- User accounts and passwords
- Shipment details (pickup address, delivery address, status)
- Driver information
- Historical records (who did what and when)

**Why we use it:**

- Reliable and proven
- Handles complex relationships
- ACID compliant (data integrity guaranteed)

---

### 4. Redis

**What it is:** An in-memory database - stores data in RAM for super-fast access.

**Real-world example:**
Like a whiteboard in an office:

- Information is written quickly
- Everyone can see it immediately
- It gets erased after some time (TTL - Time To Live)
- Much faster than looking in a filing cabinet

**What we use it for:**

- **Driver locations:** Current GPS coordinates (expires after 1 hour)
- **Idempotency keys:** Prevents duplicate operations
- **Socket.IO adapter:** Helps multiple servers share real-time updates
- **Rate limiting:** Prevents too many requests

**Why we use it:**

- Extremely fast (microseconds vs milliseconds)
- Perfect for temporary data
- Supports pub/sub (publish/subscribe) for real-time features

**Example:** When a driver's location updates, we store it in Redis. If someone asks "Where is driver X?", we get the answer instantly from Redis instead of searching the database.

---

### 5. RabbitMQ

**What it is:** A message queue - passes messages between different parts of the system asynchronously.

**Real-world example:**
Like a post office:

- One part of the system puts a message in a mailbox (publishes)
- Another part picks it up later (consumes)
- Messages are delivered reliably even if the receiver is busy
- If delivery fails, it retries

**What we use it for:**

- **Event publishing:** When a shipment status changes, we publish an event
- **Async processing:** Heavy tasks don't block the main system
- **Reliability:** Messages are stored until processed

**Why we use it:**

- Decouples different parts of the system
- Handles high volumes
- Ensures messages aren't lost

**Example:** When a shipment is delivered, we publish a "shipment.delivered" event. Other systems (like notifications, analytics) can listen to this event and react accordingly.

---

### 6. MQTT

**What it is:** A lightweight messaging protocol for IoT devices.

**Real-world example:**
Like a walkie-talkie for GPS trackers:

- Driver's phone/tracker sends location updates
- Uses very little battery and data
- Works even with poor internet connection
- Perfect for devices that send small messages frequently

**What we use it for:**

- Receiving GPS coordinates from driver devices
- Real-time location tracking
- Low bandwidth, high frequency updates

**Why we use it:**

- Designed for IoT devices
- Very efficient
- Works with unreliable networks
- Low overhead (small message size)

**Example:** A driver's phone sends location every 5 seconds: "I'm at latitude 40.7128, longitude -74.0060". MQTT delivers this efficiently.

---

### 7. Socket.IO

**What it is:** A library for real-time, bidirectional communication between server and clients.

**Real-world example:**
Like a live news ticker:

- Server pushes updates instantly
- No need to refresh the page
- Multiple users see updates simultaneously
- Like WhatsApp's "typing..." indicator

**What we use it for:**

- Broadcasting driver location updates
- Real-time shipment status changes
- Live dashboard updates
- Instant notifications

**Why we use it:**

- Real-time updates without polling
- Automatic reconnection if connection drops
- Works across browsers and devices
- Supports rooms (like chat rooms for different tenants)

**Example:** When a driver's location updates, all dispatchers watching that driver see the update instantly on their map without refreshing.

---

### 8. TypeORM

**What it is:** An Object-Relational Mapping tool - translates between JavaScript objects and database tables.

**Real-world example:**
Like a translator:

- You write code in JavaScript: `user.name = "John"`
- TypeORM translates it to SQL: `UPDATE users SET name = 'John'`
- You don't need to write SQL manually

**What we use it for:**

- Defining database tables as TypeScript classes
- Querying data with JavaScript code
- Managing relationships between tables
- Database migrations (updating database structure)

**Why we use it:**

- Type-safe (TypeScript catches errors)
- Less SQL code to write
- Handles relationships automatically
- Database-agnostic (works with PostgreSQL, MySQL, etc.)

---

### 9. JWT (JSON Web Tokens)

**What it is:** A way to securely identify users without storing sessions.

**Real-world example:**
Like a concert wristband:

- You get it when you enter (login)
- You show it to access different areas (API endpoints)
- It expires after some time
- No need to check a list every time

**What we use it for:**

- User authentication
- Authorization (checking permissions)
- Stateless authentication (server doesn't store session)

**Why we use it:**

- Stateless (scales better)
- Secure (signed, can't be tampered)
- Contains user info (no need to query database)
- Standard format

**Example:** User logs in, gets a token. Every API request includes this token. Server verifies it and knows who the user is.

---

### 10. Swagger/OpenAPI

**What it is:** Documentation and testing interface for APIs.

**Real-world example:**
Like a restaurant menu:

- Shows all available dishes (endpoints)
- Describes what each dish contains (request/response)
- You can order right from the menu (test APIs)
- Always up-to-date

**What we use it for:**

- API documentation
- Testing endpoints
- Client code generation
- API contract definition

**Why we use it:**

- Interactive documentation
- Always in sync with code
- Easy to test APIs
- Professional presentation

---

## 🔄 Complete System Flow

### Flow 1: User Login

**Step-by-step:**

1. **User sends login request**

   - Frontend: User enters email and password
   - Request: `POST /v1/auth/login` with email, password, tenantId

2. **Backend validates**

   - Checks if user exists in database
   - Verifies password (hashed comparison)
   - Checks if user is active

3. **Backend creates JWT token**

   - Contains: userId, tenantId, email, role
   - Expires in 7 days
   - Signed with secret key

4. **Backend responds**

   - Returns token and user info
   - Frontend stores token

5. **Future requests**
   - Frontend includes token in header: `Authorization: Bearer {token}`
   - Backend verifies token and extracts user info

**Real-world analogy:** Like showing ID at a club - you prove who you are once, get a wristband, then use it all night.

---

### Flow 2: Creating a Shipment

**Step-by-step:**

1. **Dispatcher creates shipment**

   - Frontend: Dispatcher fills form (pickup address, delivery address, customer info)
   - Request: `POST /v1/shipments` with shipment data
   - Includes: `Idempotency-Key: create-123` (prevents duplicates)

2. **Backend checks idempotency**

   - Checks Redis: "Have we seen key 'create-123' before?"
   - If yes: Returns cached response (prevents duplicate shipment)
   - If no: Continues processing

3. **Backend validates data**

   - Checks required fields
   - Validates addresses
   - Ensures user has permission

4. **Backend creates shipment**

   - Saves to PostgreSQL database
   - Status: CREATED
   - Creates history record

5. **Backend publishes event**

   - Publishes "shipment.created" to RabbitMQ
   - Other systems can react (send notification, update analytics)

6. **Backend caches idempotency**

   - Stores response in Redis with TTL
   - If same request comes again, returns cached response

7. **Backend responds**
   - Returns shipment details with ID
   - Frontend can now track this shipment

**Real-world analogy:** Like ordering a pizza - you place order (create shipment), get order number (shipment ID), kitchen starts preparing (status: CREATED), and you can track it.

---

### Flow 3: Assigning Driver to Shipment

**Step-by-step:**

1. **Dispatcher assigns driver**

   - Frontend: Dispatcher selects driver from list
   - Request: `POST /v1/shipments/{id}/assign-driver` with driverId
   - Includes: `Idempotency-Key: assign-456`

2. **Backend checks idempotency**

   - Checks Redis for duplicate request
   - If duplicate: Returns cached response

3. **Backend validates state**

   - Checks current status (must be CREATED)
   - Validates driver exists and is available
   - Uses state machine to ensure valid transition

4. **Backend updates shipment**

   - Changes status: CREATED → ASSIGNED
   - Sets assignedAt timestamp
   - Links driver to shipment
   - Creates history record

5. **Backend publishes event**

   - Publishes "shipment.assigned" to RabbitMQ
   - Notifies driver (via notification system)

6. **Backend responds**
   - Returns updated shipment with driver info

**Real-world analogy:** Like a dispatcher assigning a delivery to a driver - checks if order is ready, assigns to available driver, updates system, notifies driver.

---

### Flow 4: Driver Location Update (REST API)

**Step-by-step:**

1. **Driver app sends location**

   - Driver's phone gets GPS coordinates
   - App sends: `POST /v1/drivers/{id}/location` with latitude, longitude

2. **Backend processes location**

   - Validates coordinates (must be numbers)
   - Gets current user (driver) from token
   - Ensures driver ID matches token

3. **Backend stores in Redis**

   - Key: `driver:location:{tenantId}:{driverId}`
   - Value: JSON with lat, long, timestamp
   - TTL: 1 hour (expires automatically)

4. **Backend broadcasts via Socket.IO**

   - Emits event: `driver:location` to tenant room
   - All connected clients (dispatchers) receive update
   - Frontend updates map in real-time

5. **Backend responds**
   - Returns success confirmation

**Real-world analogy:** Like a delivery app showing "Driver is 2 minutes away" - phone sends location, system stores it, and everyone tracking sees the update instantly.

---

### Flow 5: Driver Location Update (MQTT)

**Step-by-step:**

1. **Driver device gets GPS**

   - Phone/tracker gets coordinates from GPS chip
   - Example: latitude 40.7128, longitude -74.0060

2. **Device publishes to MQTT**

   - Connects to MQTT broker: `mqtt://163.172.43.58:1883`
   - Topic: `tenant/{tenantId}/driver/{driverId}/location`
   - Payload: `{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-01T12:00:00Z"}`

3. **Backend receives message**

   - MQTT subscriber is listening to pattern: `tenant/+/driver/+/location`
   - Extracts tenantId and driverId from topic
   - Parses JSON payload

4. **Backend validates and processes**

   - Validates latitude and longitude are numbers
   - Calls location processor (same as REST API)
   - Stores in Redis
   - Broadcasts via Socket.IO

5. **Result**
   - Same as REST API flow
   - Location stored and broadcasted

**Real-world analogy:** Like a GPS tracker in a delivery truck - it automatically sends location every few seconds without the driver doing anything.

---

### Flow 6: Updating Shipment Status

**Step-by-step:**

1. **Driver updates status**

   - Driver app: "I picked up the package"
   - Request: `POST /v1/shipments/{id}/status` with status: PICKED_UP

2. **Backend validates state machine**

   - Current status: ASSIGNED
   - Requested status: PICKED_UP
   - State machine checks: Can we go from ASSIGNED → PICKED_UP? ✅ Yes
   - If invalid: Returns error with valid transitions

3. **Backend updates shipment**

   - Changes status: ASSIGNED → PICKED_UP
   - Sets pickedUpAt timestamp
   - Creates history record

4. **Backend publishes event**

   - Publishes "shipment.picked_up" to RabbitMQ
   - Customer gets notification: "Your package has been picked up"

5. **Backend broadcasts via Socket.IO**

   - Emits event to tenant room
   - Dispatchers see status change in real-time

6. **Backend responds**
   - Returns updated shipment

**Real-world analogy:** Like package tracking - when driver picks up, status changes from "Order confirmed" to "Picked up", and you get a notification.

---

### Flow 7: Dashboard Summary (CQRS Read)

**Step-by-step:**

1. **User requests dashboard**

   - Frontend: User opens dashboard page
   - Request: `GET /v1/dashboard/summary`

2. **Backend queries read model**

   - Uses CQRS pattern (separate read model)
   - Queries optimized view (DashboardSummary table)
   - Gets: total shipments, active shipments, completed today, etc.

3. **Backend responds**
   - Returns aggregated data
   - Frontend displays charts and statistics

**Why CQRS?**

- Write operations (create/update) are separate from reads
- Read model is optimized for queries (faster)
- Like having a summary report separate from detailed records

**Real-world analogy:** Like a manager's dashboard - shows summary stats (total sales today, active orders) without needing to count every individual record.

---

### Flow 8: GraphQL Query

**Step-by-step:**

1. **User makes GraphQL query**

   - Frontend: User wants shipment details with driver info
   - Query: `{ shipment(id: "123") { id, status, driver { name, phone } } }`

2. **Backend processes query**

   - GraphQL resolver receives query
   - Fetches shipment from database
   - Fetches related driver data
   - Combines into response

3. **Backend responds**
   - Returns only requested fields
   - Frontend gets exactly what it needs

**Why GraphQL?**

- Client requests only needed data
- Single endpoint for complex queries
- Reduces over-fetching

**Real-world analogy:** Like ordering at a restaurant - you order exactly what you want (specific fields), not a fixed combo meal (entire object).

---

## 🔐 Security Concepts

### Authentication vs Authorization

**Authentication:** "Who are you?"

- Verifying user identity
- Example: Login with email/password
- Result: JWT token proving identity

**Authorization:** "What can you do?"

- Checking permissions
- Example: Can this user create shipments?
- Result: Allow or deny action

**Real-world analogy:**

- Authentication = Showing ID to enter a building
- Authorization = Having keycard access to specific floors

---

### Idempotency

**What it is:** Making the same request multiple times has the same effect as making it once.

**Real-world example:**
Like a light switch - pressing it multiple times has the same result (light on or off). Pressing "submit order" twice doesn't create two orders.

**How we implement it:**

- Client sends `Idempotency-Key` header (unique per operation)
- Server checks Redis: "Have I seen this key?"
- If yes: Returns cached response
- If no: Processes request and caches response

**Why important:**

- Prevents duplicate operations
- Safe to retry failed requests
- Critical for payment/order systems

---

### Tenant Isolation

**What it is:** Each company (tenant) can only see their own data.

**Real-world example:**
Like apartment buildings - each tenant has their own apartment and can't access others. Company A can't see Company B's shipments.

**How we implement it:**

- Every request includes tenantId (from JWT token)
- All database queries filter by tenantId
- Redis keys include tenantId
- Socket.IO rooms are tenant-specific

**Why important:**

- Multi-tenant system requirement
- Data security and privacy
- Compliance (GDPR, etc.)

---

## 📊 Data Flow Patterns

### CQRS (Command Query Responsibility Segregation)

**What it is:** Separating read and write operations.

**Real-world example:**
Like a library:

- **Write side:** Librarian adds books (complex, slow)
- **Read side:** Catalog shows available books (optimized, fast)
- They're separate systems serving different purposes

**In our system:**

- **Write:** Create/update shipments (normal tables)
- **Read:** Dashboard queries (optimized summary table)

**Why use it:**

- Reads are faster (optimized views)
- Writes don't slow down reads
- Can scale independently

---

### Event-Driven Architecture

**What it is:** System reacts to events instead of direct calls.

**Real-world example:**
Like a doorbell:

- Someone rings doorbell (event)
- Multiple things happen: lights turn on, dog barks, you answer door
- Each system reacts independently

**In our system:**

- Shipment status changes → Event published
- Multiple listeners: notifications, analytics, logging
- Each reacts independently

**Why use it:**

- Loose coupling (systems don't depend on each other)
- Scalable (add new listeners easily)
- Resilient (if one fails, others continue)

---

### State Machine

**What it is:** Defines valid transitions between states.

**Real-world example:**
Like a traffic light:

- Red → Green ✅ (valid)
- Green → Yellow ✅ (valid)
- Red → Yellow ❌ (invalid, must go through Green first)

**In our system:**

- CREATED → ASSIGNED ✅
- ASSIGNED → PICKED_UP ✅
- CREATED → DELIVERED ❌ (must go through all steps)

**Why use it:**

- Prevents invalid state changes
- Ensures business logic is followed
- Clear error messages

---

## 🗄️ Database Structure

### Entities Explained

**Tenant:**

- Represents a company using the system
- Example: "ABC Logistics", "XYZ Delivery"
- Each tenant is isolated (can't see other tenants' data)

**User:**

- People who use the system
- Roles: ops_admin (manager), dispatcher (assigns shipments), driver (delivers)
- Belongs to a tenant

**Driver:**

- Delivery drivers
- Has vehicle info, license, status
- Belongs to a tenant

**Shipment:**

- A delivery order
- Has pickup address, delivery address, customer info
- Has status (CREATED, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED)
- Linked to driver and tenant

**ShipmentStatusHistory:**

- Records every status change
- Like an audit log
- Shows: who changed status, when, from what to what

**EventOutbox:**

- Stores events to be published
- Ensures events aren't lost
- Published to RabbitMQ asynchronously

**DashboardSummary:**

- Optimized read model for dashboards
- Pre-calculated statistics
- Updated when shipments change

---

## 🔄 Real-World Complete Example

**Scenario:** A customer orders a package, it gets delivered.

**Step 1: Customer places order**

- Customer app creates shipment via API
- Backend: Creates shipment, status = CREATED
- Event: "shipment.created" published

**Step 2: Dispatcher assigns driver**

- Dispatcher sees new shipment in dashboard
- Assigns driver John
- Backend: Updates shipment, status = ASSIGNED, links to driver John
- Event: "shipment.assigned" published
- Driver John gets notification

**Step 3: Driver picks up package**

- Driver arrives at pickup location
- Driver app: Updates status to PICKED_UP
- Backend: Validates transition, updates status
- Event: "shipment.picked_up" published
- Customer gets notification: "Package picked up"

**Step 4: Driver delivers package**

- Driver arrives at delivery location
- Driver app: Updates status to DELIVERED
- Backend: Validates transition, updates status, sets deliveredAt
- Event: "shipment.delivered" published
- Customer gets notification: "Package delivered"
- Dashboard updates: Completed count increases

**Throughout: Location tracking**

- Driver's phone sends GPS every 5 seconds via MQTT
- Backend stores in Redis
- Dispatcher sees driver moving on map in real-time via Socket.IO

---

## 🛠️ Development Tools

### TypeScript

- JavaScript with type checking
- Catches errors before running code
- Like spell-check for code

### ESLint

- Code quality checker
- Enforces coding standards
- Like a grammar checker

### Jest

- Testing framework
- Runs automated tests
- Ensures code works correctly

### Nodemon/TSX Watch

- Auto-restarts server on code changes
- Speeds up development
- Like auto-refresh in browser

---

## 📝 Common Terms Dictionary

**API (Application Programming Interface):**

- How different software components communicate
- Like a menu at a restaurant - shows what you can order

**Endpoint:**

- A specific URL that does a specific thing
- Example: `/v1/shipments` creates a shipment

**Payload:**

- Data sent in a request
- Like the contents of a package

**Middleware:**

- Code that runs before/after main logic
- Like security check before entering a building

**Plugin:**

- Add-on functionality
- Like browser extensions

**Repository:**

- Code that handles database operations
- Like a librarian who knows where books are

**Service:**

- Business logic layer
- Contains the "how to do it" code

**Controller:**

- Handles HTTP requests
- Like a receptionist who routes visitors

**DTO (Data Transfer Object):**

- Structure of data being sent/received
- Like a form template

**Entity:**

- Database table representation
- Like a blueprint for a table

**Migration:**

- Changes to database structure
- Like renovating a building

**Query:**

- Requesting data from database
- Like asking "show me all shipments"

**Mutation:**

- Changing data in database
- Like updating a shipment status

**Resolver:**

- GraphQL function that fetches data
- Like a helper who gets information for you

**Pub/Sub (Publish/Subscribe):**

- Message pattern where publishers send messages and subscribers receive them
- Like a radio station (publisher) and listeners (subscribers)

**TTL (Time To Live):**

- How long data stays in cache before expiring
- Like expiration date on food

**ACID:**

- Database properties: Atomicity, Consistency, Isolation, Durability
- Guarantees data integrity

**ORM (Object-Relational Mapping):**

- Tool that translates between code objects and database tables
- Like a translator between languages

---

## 🎓 Learning Path

If you're new to this system, understand in this order:

1. **Basic Concepts:** What is an API, database, server
2. **Technologies:** Understand each package (PostgreSQL, Redis, etc.)
3. **Flows:** Follow one complete flow end-to-end (like creating a shipment)
4. **Architecture:** Understand how pieces fit together
5. **Advanced:** CQRS, event-driven, state machines

---

## 💡 Key Takeaways

1. **Backend receives data, doesn't generate it** - GPS comes from devices, not backend
2. **Everything is tenant-isolated** - Each company's data is separate
3. **Real-time updates use Socket.IO** - No need to refresh pages
4. **Idempotency prevents duplicates** - Safe to retry operations
5. **State machine enforces business rules** - Can't skip steps
6. **Events enable loose coupling** - Systems react independently
7. **Redis is for speed** - Temporary, fast-access data
8. **PostgreSQL is for permanence** - Long-term storage
9. **MQTT is for devices** - Efficient for IoT/GPS trackers
10. **GraphQL is for flexibility** - Clients request only what they need

---

## ❓ Frequently Asked Questions

**Q: Where does GPS data come from?**
A: From driver's phone or GPS tracker device. They publish to MQTT, backend receives it.

**Q: What if Redis is down?**
A: System continues but some features degrade (no idempotency, no real-time location cache). Database still works.

**Q: What if RabbitMQ is down?**
A: Events are stored in EventOutbox table. When RabbitMQ is back, events are processed.

**Q: How does multi-tenancy work?**
A: Every request includes tenantId from JWT. All queries filter by tenantId.

**Q: Why use both REST and GraphQL?**
A: REST for commands (create/update), GraphQL for complex reads (dashboards).

**Q: What's the difference between MQTT and RabbitMQ?**
A: MQTT for device-to-server (GPS trackers), RabbitMQ for server-to-server (events).

**Q: How does Socket.IO work?**
A: Server pushes updates to connected clients. Like a live chat - messages appear instantly.

**Q: What is idempotency for?**
A: Prevents duplicate operations if request is retried. Critical for payments/orders.

---

## 🎯 Conclusion

This system is like a well-orchestrated symphony:

- Each component has a specific role
- They work together seamlessly
- Real-time updates keep everyone informed
- Reliability ensures nothing is lost
- Security protects data
- Scalability handles growth

Understanding each piece helps you understand the whole. Start with one flow, then expand your knowledge.

---

_This document is a living guide. As the system evolves, so should this document._
