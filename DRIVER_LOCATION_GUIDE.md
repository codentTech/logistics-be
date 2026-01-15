# Driver Location Integration Guide

This guide explains how drivers can send their real-time GPS location to the OpsCore backend, which will then display on the admin dashboard in real-time.

## Quick Start: Web Browser (Easiest Method)

**✅ Already Available in Frontend!**

Drivers can share their location directly from a web browser:

1. **Navigate to:** `http://localhost:3000/driver-location` (or your frontend URL)
2. **Login** as a driver
3. **Click "Start Sharing Location"**
4. **Allow location permissions** when prompted
5. **Location is automatically sent** every 30 seconds

The web interface:
- Uses browser's Geolocation API
- Automatically sends location via REST API
- Shows current coordinates
- Displays last update time
- Works on any device with a modern browser (mobile, tablet, desktop)

**No mobile app needed!** Drivers can use this from their phone's browser.

## Overview

The OpsCore backend supports **two methods** for drivers to send their location:

1. **REST API** - HTTP POST request (best for mobile apps)
2. **MQTT** - Lightweight messaging protocol (best for IoT devices, GPS trackers)

Both methods:
- Store location in Redis (real-time cache)
- Broadcast to admin dashboard via Socket.IO
- Update maps in real-time
- Support automatic location updates

---

## Method 1: REST API (Recommended for Mobile Apps)

### Endpoint
```
POST /v1/drivers/{driverId}/location
```

### Authentication
- Requires JWT token in `Authorization` header
- Driver must be authenticated and belong to the tenant

### Request Format

**Headers:**
```
Authorization: Bearer {driver_jwt_token}
Content-Type: application/json
```

**Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-15T10:30:00Z"  // Optional, defaults to current time
}
```

### Example: JavaScript/React Native

```javascript
// Get driver's current GPS location
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        });
      },
      (error) => reject(error)
    );
  });
};

// Send location to backend
const sendDriverLocation = async (driverId, token) => {
  try {
    const location = await getCurrentLocation();
    
    const response = await fetch(`http://your-backend-url/v1/drivers/${driverId}/location`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(location),
    });
    
    const data = await response.json();
    console.log('Location sent:', data);
  } catch (error) {
    console.error('Error sending location:', error);
  }
};

// Send location every 30 seconds
setInterval(() => {
  sendDriverLocation(driverId, driverToken);
}, 30000);
```

### Example: Android (Kotlin)

```kotlin
import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class LocationService(private val driverId: String, private val token: String) {
    private val client = OkHttpClient()
    private val fusedLocationClient: FusedLocationProviderClient
    
    fun startLocationUpdates() {
        val locationRequest = LocationRequest.create().apply {
            interval = 30000 // 30 seconds
            fastestInterval = 10000 // 10 seconds
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
        }
        
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    sendLocationToBackend(location)
                }
            }
        }
        
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        }
    }
    
    private fun sendLocationToBackend(location: Location) {
        val json = JSONObject().apply {
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("timestamp", java.time.Instant.now().toString())
        }
        
        val requestBody = json.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("http://your-backend-url/v1/drivers/$driverId/location")
            .addHeader("Authorization", "Bearer $token")
            .post(requestBody)
            .build()
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("LocationService", "Failed to send location", e)
            }
            
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    Log.d("LocationService", "Location sent successfully")
                }
            }
        })
    }
}
```

### Example: iOS (Swift)

```swift
import CoreLocation
import Foundation

class LocationService: NSObject, CLLocationManagerDelegate {
    private let driverId: String
    private let token: String
    private let locationManager = CLLocationManager()
    
    init(driverId: String, token: String) {
        self.driverId = driverId
        self.token = token
        super.init()
        setupLocationManager()
    }
    
    func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestWhenInUseAuthorization()
    }
    
    func startLocationUpdates() {
        locationManager.startUpdatingLocation()
        
        // Send location every 30 seconds
        Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            if let location = self.locationManager.location {
                self.sendLocationToBackend(location: location)
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        sendLocationToBackend(location: location)
    }
    
    private func sendLocationToBackend(location: CLLocation) {
        let url = URL(string: "http://your-backend-url/v1/drivers/\(driverId)/location")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("Error sending location: \(error)")
            } else if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                print("Location sent successfully")
            }
        }.resume()
    }
}
```

---

## Method 2: MQTT (Recommended for IoT Devices/GPS Trackers)

### MQTT Broker Connection

**Connection Details:**
- **Broker URL:** `mqtt://163.172.43.58:1883` (or your MQTT broker URL)
- **Username:** (if required by your MQTT broker)
- **Password:** (if required by your MQTT broker)

### Topic Format
```
tenant/{tenantId}/driver/{driverId}/location
```

### Message Format (JSON)
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Example: Using mosquitto_pub (Command Line)

```bash
# Install mosquitto-clients (if not installed)
# Ubuntu/Debian: sudo apt-get install mosquitto-clients
# macOS: brew install mosquitto

# Publish location update
mosquitto_pub -h 163.172.43.58 -p 1883 \
  -t "tenant/YOUR_TENANT_ID/driver/YOUR_DRIVER_ID/location" \
  -m '{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-15T10:30:00Z"}'
```

### Example: Python MQTT Client

```python
import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime

# GPS location (in real app, get from GPS module)
def get_current_location():
    # Replace with actual GPS reading
    return {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

# MQTT Configuration
MQTT_BROKER = "163.172.43.58"
MQTT_PORT = 1883
TENANT_ID = "your-tenant-id"
DRIVER_ID = "your-driver-id"
TOPIC = f"tenant/{TENANT_ID}/driver/{DRIVER_ID}/location"

# Create MQTT client
client = mqtt.Client()
# client.username_pw_set("username", "password")  # If authentication required

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
    else:
        print(f"Failed to connect, return code {rc}")

def on_publish(client, userdata, mid):
    print(f"Location published: {mid}")

client.on_connect = on_connect
client.on_publish = on_publish

# Connect to broker
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

# Publish location every 30 seconds
try:
    while True:
        location = get_current_location()
        payload = json.dumps(location)
        
        result = client.publish(TOPIC, payload, qos=1)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"Published: {payload}")
        else:
            print(f"Failed to publish: {result.rc}")
        
        time.sleep(30)  # Send every 30 seconds
except KeyboardInterrupt:
    print("Stopping...")
    client.loop_stop()
    client.disconnect()
```

### Example: Node.js MQTT Client

```javascript
const mqtt = require('mqtt');
const GPS = require('gps'); // Example GPS library

const MQTT_BROKER = 'mqtt://163.172.43.58:1883';
const TENANT_ID = 'your-tenant-id';
const DRIVER_ID = 'your-driver-id';
const TOPIC = `tenant/${TENANT_ID}/driver/${DRIVER_ID}/location`;

// Connect to MQTT broker
const client = mqtt.connect(MQTT_BROKER, {
  // username: 'your-username',  // If authentication required
  // password: 'your-password',  // If authentication required
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  // Send location every 30 seconds
  setInterval(() => {
    // Get GPS location (replace with actual GPS reading)
    const location = {
      latitude: 40.7128,  // Replace with actual GPS reading
      longitude: -74.0060, // Replace with actual GPS reading
      timestamp: new Date().toISOString(),
    };
    
    // Publish to MQTT
    client.publish(TOPIC, JSON.stringify(location), { qos: 1 }, (error) => {
      if (error) {
        console.error('Failed to publish location:', error);
      } else {
        console.log('Location published:', location);
      }
    });
  }, 30000); // 30 seconds
});

client.on('error', (error) => {
  console.error('MQTT error:', error);
});
```

### Example: Arduino/ESP32 (C++)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPS++.h>  // GPS library

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "163.172.43.58";
const int mqtt_port = 1883;

const char* tenant_id = "your-tenant-id";
const char* driver_id = "your-driver-id";

WiFiClient espClient;
PubSubClient client(espClient);
TinyGPSPlus gps;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
  
  // Connect to MQTT
  client.setServer(mqtt_server, mqtt_port);
  while (!client.connected()) {
    if (client.connect("ESP32Driver")) {
      Serial.println("MQTT connected");
    } else {
      delay(5000);
    }
  }
}

void loop() {
  client.loop();
  
  // Read GPS data
  while (Serial.available() > 0) {
    gps.encode(Serial.read());
  }
  
  if (gps.location.isValid()) {
    // Create JSON payload
    StaticJsonDocument<200> doc;
    doc["latitude"] = gps.location.lat();
    doc["longitude"] = gps.location.lng();
    doc["timestamp"] = getCurrentTimestamp();
    
    char payload[200];
    serializeJson(doc, payload);
    
    // Publish to MQTT
    char topic[100];
    sprintf(topic, "tenant/%s/driver/%s/location", tenant_id, driver_id);
    client.publish(topic, payload);
    
    delay(30000); // Send every 30 seconds
  }
}
```

---

## Real-Time Updates Flow

1. **Driver Device** → Gets GPS coordinates
2. **Driver Device** → Sends to backend (REST API or MQTT)
3. **Backend** → Stores in Redis
4. **Backend** → Broadcasts via Socket.IO to admin dashboard
5. **Admin Dashboard** → Updates map in real-time

---

## Best Practices

### Update Frequency
- **Recommended:** Every 30 seconds for active drivers
- **Minimum:** Every 60 seconds
- **Maximum:** Every 5 seconds (to avoid overwhelming the system)

### Error Handling
- Retry failed requests with exponential backoff
- Cache location locally if network is unavailable
- Send cached locations when connection is restored

### Battery Optimization
- Use lower update frequency when driver is stationary
- Increase frequency when driver is moving
- Stop updates when driver is offline/inactive

### Security
- Always use HTTPS for REST API calls
- Use MQTT over TLS (mqtts://) in production
- Authenticate drivers with JWT tokens
- Validate driver belongs to tenant

---

## Testing Location Updates

### Test with REST API (cURL)

```bash
# Get driver token first (from login)
TOKEN="your-driver-jwt-token"
DRIVER_ID="your-driver-id"
BACKEND_URL="http://localhost:5000"

# Send location update
curl -X POST "${BACKEND_URL}/v1/drivers/${DRIVER_ID}/location" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

### Test with MQTT (mosquitto_pub)

```bash
mosquitto_pub -h 163.172.43.58 -p 1883 \
  -t "tenant/YOUR_TENANT_ID/driver/YOUR_DRIVER_ID/location" \
  -m '{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-15T10:30:00Z"}'
```

---

## Driver Mobile App Requirements

To build a driver mobile app, you'll need:

1. **Authentication**
   - Login endpoint: `POST /v1/auth/login`
   - Store JWT token securely

2. **Location Permissions**
   - Request GPS location permissions
   - Handle permission denials gracefully

3. **Background Location Updates**
   - Use background location services
   - Handle app background/foreground states

4. **Network Handling**
   - Handle offline scenarios
   - Queue location updates when offline
   - Sync when connection restored

5. **Battery Optimization**
   - Adjust update frequency based on movement
   - Use significant location changes when possible

---

## Summary

✅ **REST API** - Best for mobile apps (React Native, Flutter, native apps)
✅ **MQTT** - Best for IoT devices, GPS trackers, embedded systems

Both methods:
- Store location in Redis
- Broadcast to admin dashboard in real-time
- Update maps automatically
- Support continuous location tracking

The admin dashboard will automatically show driver locations on the map as soon as they're received!

