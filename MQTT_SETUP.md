# 📡 MQTT Setup Guide

## What is MQTT?

MQTT is a messaging protocol used for real-time location updates from drivers. Your app can receive driver locations via:

- **REST API** (POST /v1/drivers/:id/location)
- **MQTT** (publish to topic)

Both methods work the same way - they update driver location in Redis and emit Socket.IO events.

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Start MQTT Broker (EMQX)

**Option A: Using Docker (Easiest)**

```bash
docker-compose up -d emqx
```

**Option B: Install Locally**

```bash
# macOS
brew install emqx
emqx start
```

**Check if it's running:**

```bash
# Should show "pong" if running
docker exec opscore-emqx emqx ping
# OR
emqx ping
```

### Step 2: Verify Connection

Your app **automatically connects** when you start the server. Check server logs:

```bash
npm run dev
```

You should see:

```
✅ MQTT subscriber connected
✅ Subscribed to driver location topics
```

### Step 3: Test It

**Publish a test message:**

```bash
# Install mosquitto tools (if not installed)
brew install mosquitto

# Publish location update
mosquitto_pub -h localhost -p 1883 \
  -t "tenant/YOUR_TENANT_ID/driver/YOUR_DRIVER_ID/location" \
  -m '{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-01T12:00:00Z"}'
```

**Replace:**

- `YOUR_TENANT_ID` - Get from `npm run seed` output
- `YOUR_DRIVER_ID` - Get from `npm run seed` output

---

## 📋 Complete Example

### 1. Get Your IDs

```bash
npm run seed
```

Output will show:

```
Tenant ID: 4e96cd4d-acee-45b8-ac00-acb0d0abd908
Driver ID: 9f2380f2-46e7-4255-b5b0-9ed7292efe30
```

### 2. Start MQTT Broker

```bash
docker-compose up -d emqx
```

### 3. Start Your Server

```bash
npm run dev
```

Look for:

```
✅ MQTT subscriber connected
```

### 4. Send Location via MQTT

```bash
mosquitto_pub -h localhost -p 1883 \
  -t "tenant/4e96cd4d-acee-45b8-ac00-acb0d0abd908/driver/9f2380f2-46e7-4255-b5b0-9ed7292efe30/location" \
  -m '{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-01T12:00:00Z"}'
```

### 5. Verify It Worked

Check your server logs - you should see the location was processed.

---

## 🔍 MQTT Topic Format

**Topic Pattern:**

```
tenant/{tenantId}/driver/{driverId}/location
```

**Example:**

```
tenant/4e96cd4d-acee-45b8-ac00-acb0d0abd908/driver/9f2380f2-46e7-4255-b5b0-9ed7292efe30/location
```

**Message Format (JSON):**

```json
{
  "latitude": 40.7128,
  "longitude": -74.006,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## 🌐 Access EMQX Dashboard

**URL:** http://localhost:18083

**Default Login:**

- Username: `admin`
- Password: `public`

**What you can see:**

- Connected clients
- Published messages
- Topics
- Real-time monitoring

---

## 🧪 Testing Without Command Line

### Using Postman

1. Create a new request
2. Method: **WebSocket** (if supported) or use MQTT client
3. Or use REST API instead: `POST /v1/drivers/:id/location`

### Using Online MQTT Client

1. Go to: http://www.hivemq.com/demos/websocket-client/
2. Connect to: `ws://localhost:8083`
3. Subscribe to: `tenant/+/driver/+/location` (to see all messages)
4. Publish to: `tenant/YOUR_TENANT_ID/driver/YOUR_DRIVER_ID/location`

---

## ⚙️ Configuration (Optional)

Edit `.env` file if needed:

```env
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=  # Leave empty for local (no auth)
MQTT_PASSWORD=  # Leave empty for local (no auth)
```

**Default values work for local development!**

---

## 🐛 Troubleshooting

### "MQTT not available" in logs

- **Fix:** Start EMQX: `docker-compose up -d emqx`
- **Check:** `docker ps` should show `opscore-emqx`

### "Connection refused"

- **Fix:** Make sure EMQX is running on port 1883
- **Check:** `docker logs opscore-emqx`

### "Topic not found"

- **Fix:** Check topic format: `tenant/{tenantId}/driver/{driverId}/location`
- **Fix:** Make sure tenantId and driverId are correct UUIDs

### Can't install mosquitto_pub

- **Alternative:** Use REST API instead: `POST /v1/drivers/:id/location`
- **Alternative:** Use online MQTT client (websocket)

---

## 📊 How It Works

```
Driver Device → MQTT Broker (EMQX) → Your App → Redis + Socket.IO
```

1. Driver device publishes location to MQTT topic
2. EMQX broker receives message
3. Your app subscribes to topic and receives message
4. App processes location (saves to Redis, emits Socket.IO event)
5. Frontend receives real-time update via Socket.IO

---

## ✅ Quick Checklist

- [ ] EMQX is running (`docker-compose up -d emqx`)
- [ ] Server shows "✅ MQTT subscriber connected"
- [ ] You have Tenant ID and Driver ID
- [ ] You can publish messages (or use REST API instead)

---

## 💡 Pro Tip

**Don't want to set up MQTT?**

Just use the REST API:

```bash
POST /v1/drivers/:id/location
{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

Both methods do the same thing! MQTT is just for real-time devices that prefer pub/sub.

---

## 📚 More Info

- **EMQX Docs:** https://www.emqx.io/docs
- **MQTT Protocol:** https://mqtt.org/
- **Your App Code:** `src/infra/mqtt/mqtt.subscriber.ts`
