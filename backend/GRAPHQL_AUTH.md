# 🔐 GraphQL Authentication Guide

## How to Use GraphQL with Authentication

GraphQL requires authentication via JWT token, just like REST endpoints.

---

## 🌐 Method 1: GraphQL Playground (Browser)

### Step 1: Get Your Token

Login via REST API first:
```bash
POST /v1/auth/login
{
  "email": "admin@tenant1.com",
  "password": "password123",
  "tenantId": "YOUR_TENANT_ID"
}
```

Copy the `token` from response.

### Step 2: Open GraphQL Playground

**URL:** http://localhost:3000/graphql

### Step 3: Add Authorization Header

In GraphQL Playground, look for **"HTTP HEADERS"** section (usually at bottom).

Add:
```json
{
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

### Step 4: Run Query

```graphql
query {
  opsSummary {
    totalShipments
    activeShipments
    deliveredToday
    driversOnline
  }
}
```

---

## 💻 Method 2: cURL

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "query { opsSummary { totalShipments activeShipments } }"
  }'
```

---

## 📝 Method 3: Postman

1. **Set Authorization:**
   - Type: Bearer Token
   - Token: Your JWT token

2. **Request:**
   - Method: POST
   - URL: http://localhost:3000/graphql
   - Body (GraphQL):
     ```graphql
     query {
       opsSummary {
         totalShipments
         activeShipments
       }
     }
     ```

---

## 🔍 Available Queries

### Get Dashboard Summary
```graphql
query {
  opsSummary {
    tenantId
    totalShipments
    activeShipments
    deliveredToday
    driversOnline
    lastUpdated
  }
}
```

### Get Shipments
```graphql
query {
  shipmentDashboard {
    id
    status
    pickupAddress
    deliveryAddress
    customerName
    driver {
      id
      name
      phone
    }
  }
}
```

### Get Shipments by Status
```graphql
query {
  shipmentDashboard(status: ASSIGNED) {
    id
    status
    customerName
  }
}
```

---

## ❌ Common Errors

### "Authentication required"
- **Fix:** Add `Authorization: Bearer YOUR_TOKEN` header
- **Fix:** Make sure token is valid (not expired)
- **Fix:** Login again to get a new token

### "Invalid or expired token"
- **Fix:** Token expired (default: 7 days)
- **Fix:** Login again to get a new token

### "User not authenticated"
- **Fix:** Token is missing or invalid
- **Fix:** Check token format: `Bearer YOUR_TOKEN` (with space)

---

## 🧪 Quick Test

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tenant1.com",
    "password": "password123",
    "tenantId": "YOUR_TENANT_ID"
  }' | jq -r '.token')

# 2. Query GraphQL
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "query { opsSummary { totalShipments } }"
  }'
```

---

## 📚 More Info

- **GraphQL Playground:** http://localhost:3000/graphql
- **REST API Docs:** http://localhost:3000/docs
- **Login Guide:** `LOGIN_GUIDE.md`

