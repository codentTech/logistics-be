# 🔐 Login Guide

## Test Credentials

After running `npm run seed`, you can use these credentials:

- **Email:** `admin@tenant1.com`
- **Password:** `password123`
- **Tenant ID:** `4e96cd4d-acee-45b8-ac00-acb0d0abd908` (will be different each time you run seed)

---

## Method 1: Swagger UI (Easiest) 🌐

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Open Swagger UI:**
   - Navigate to: http://localhost:3000/docs

3. **Find the login endpoint:**
   - Look for `POST /v1/auth/login` under the "auth" section
   - Click on it to expand

4. **Click "Try it out"**

5. **Enter the credentials:**
   ```json
   {
     "email": "admin@tenant1.com",
     "password": "password123",
     "tenantId": "4e96cd4d-acee-45b8-ac00-acb0d0abd908"
   }
   ```
   > **Note:** Replace the `tenantId` with the one shown when you run `npm run seed`

6. **Click "Execute"**

7. **Copy the token:**
   - In the response, you'll see a `token` field
   - Copy this token for use in authenticated requests

8. **Use the token:**
   - In Swagger UI, click the "Authorize" button (top right)
   - Paste your token in the "Value" field
   - Click "Authorize"
   - Now all authenticated endpoints will use this token

---

## Method 2: Using cURL 💻

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@tenant1.com",
    "password": "password123",
    "tenantId": "4e96cd4d-acee-45b8-ac00-acb0d0abd908"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "2a3be209-3d55-487c-bd22-18fba46163f3",
    "email": "admin@tenant1.com",
    "role": "ops_admin",
    "tenantId": "4e96cd4d-acee-45b8-ac00-acb0d0abd908"
  }
}
```

**Using the token in subsequent requests:**
```bash
curl -X GET http://localhost:3000/v1/shipments \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'
```

---

## Method 3: Using Postman 📮

1. **Import the collection:**
   - Open Postman
   - Import `postman_collection.json` from the project root

2. **Set variables:**
   - The collection has a `tenantId` variable
   - Update it with your tenant ID from the seed output

3. **Run the login request:**
   - Find "Authentication > Login - Ops Admin"
   - Click "Send"
   - The token will be automatically saved to the `authToken` variable

4. **Use authenticated endpoints:**
   - All other requests in the collection will automatically use the token

---

## Method 4: Using JavaScript/Fetch 🌐

```javascript
// Login
const loginResponse = await fetch('http://localhost:3000/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'admin@tenant1.com',
    password: 'password123',
    tenantId: '4e96cd4d-acee-45b8-ac00-acb0d0abd908'
  })
});

const { token, user } = await loginResponse.json();
console.log('Token:', token);
console.log('User:', user);

// Use token in subsequent requests
const shipmentsResponse = await fetch('http://localhost:3000/v1/shipments', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const shipments = await shipmentsResponse.json();
console.log('Shipments:', shipments);
```

---

## Getting Your Tenant ID

If you need to get your tenant ID again, you can:

1. **Check the seed output:**
   ```bash
   npm run seed
   ```
   The tenant ID will be shown at the end.

2. **Query the database:**
   ```sql
   SELECT id, name, slug FROM tenants;
   ```

3. **Use the Swagger UI:**
   - After logging in, check the response - it includes `tenantId` in the user object

---

## Troubleshooting

### "Invalid credentials" error
- Make sure you've run `npm run seed` first
- Double-check the email, password, and tenantId

### "Tenant not found" error
- The tenantId might be incorrect
- Run `npm run seed` again to create a new tenant and get the ID

### "Unauthorized" error on protected endpoints
- Make sure you're including the token in the Authorization header
- Format: `Authorization: Bearer YOUR_TOKEN_HERE`
- Check that the token hasn't expired (default: 24 hours)

---

## Next Steps

After logging in, you can:
- Create shipments: `POST /v1/shipments`
- List shipments: `GET /v1/shipments`
- Assign drivers: `POST /v1/shipments/:id/assign-driver`
- Update shipment status: `PATCH /v1/shipments/:id/status`
- View dashboard: `GET /v1/dashboard/summary`
- Use GraphQL: `POST /graphql`

All endpoints are documented in Swagger UI at http://localhost:3000/docs

