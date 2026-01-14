# Redis Connection Troubleshooting for Windows

## Common Issues on Windows

### 1. Redis Not Running
**Symptoms:** `Command timed out`, `ECONNRESET`, `Redis connection failed`

**Solutions:**
- **Option A: Install Redis for Windows**
  - Download from: https://github.com/microsoftarchive/redis/releases
  - Or use Memurai (Redis-compatible): https://www.memurai.com/
  - Start Redis service after installation

- **Option B: Use Docker (Recommended)**
  ```bash
  docker run -d -p 6379:6379 --name redis redis:7-alpine
  ```
  Or use docker-compose:
  ```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  ```
  Then run: `docker-compose up -d redis`

- **Option C: Use WSL2 (Best for Development)**
  ```bash
  wsl --install
  # Then in WSL:
  sudo apt update
  sudo apt install redis-server
  sudo service redis-server start
  ```
  In `.env`, use: `REDIS_HOST=localhost` (WSL2 shares localhost with Windows)

### 2. Firewall Blocking Port 6379
**Symptoms:** Connection timeout, connection refused

**Solution:**
- Open Windows Firewall
- Add inbound rule for port 6379 (TCP)
- Or temporarily disable firewall for testing

### 3. Redis Running on Different Host/Port
**Symptoms:** Connection timeout

**Check your `.env` file:**
```env
REDIS_HOST=localhost    # or your Redis server IP
REDIS_PORT=6379         # default Redis port
REDIS_PASSWORD=          # leave empty if no password
```

**Test connection:**
```bash
# If Redis is on localhost
redis-cli ping
# Should return: PONG

# If Redis is on remote server
redis-cli -h your-redis-host -p 6379 ping
```

### 4. Network Configuration Issues
**Symptoms:** `ECONNRESET`, intermittent connection failures

**Solutions:**
- Check if Redis is bound to `127.0.0.1` only (won't accept external connections)
- If using Docker, ensure port mapping is correct: `-p 6379:6379`
- Check Windows network adapter settings
- Try using `127.0.0.1` instead of `localhost` in `.env`

### 5. Redis Password Configuration
**Symptoms:** Authentication errors

**If Redis has a password:**
```env
REDIS_PASSWORD=your_redis_password
```

**If Redis has no password:**
```env
REDIS_PASSWORD=
# or remove the line entirely
```

## Quick Diagnostic Steps

1. **Check if Redis is running:**
   ```bash
   # Windows (if installed)
   redis-cli ping
   
   # Docker
   docker ps | grep redis
   
   # WSL2
   sudo service redis-server status
   ```

2. **Test connection from Node.js:**
   ```bash
   cd backend
   node -e "const Redis = require('ioredis'); const r = new Redis({host: 'localhost', port: 6379}); r.ping().then(console.log).catch(console.error);"
   ```

3. **Check .env configuration:**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

4. **Check Windows Firewall:**
   - Windows Security → Firewall & network protection
   - Allow an app through firewall
   - Check if Redis/Node.js is allowed

## Recommended Setup for Windows

### Option 1: Docker (Easiest)
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Option 2: WSL2 (Best Performance)
```bash
# Install WSL2
wsl --install

# In WSL2 terminal
sudo apt update
sudo apt install redis-server
sudo service redis-server start

# In Windows .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Option 3: Memurai (Windows Native)
- Download from: https://www.memurai.com/
- Install and start service
- Use default port 6379

## Environment Variables (.env)

Make sure your `.env` file has:
```env
# Redis Configuration
REDIS_HOST=localhost          # or 127.0.0.1 or your server IP
REDIS_PORT=6379               # default Redis port
REDIS_PASSWORD=               # leave empty if no password set
```

## Application Behavior

The application is designed to **continue without Redis** if connection fails. You'll see warnings but the app will still run. However, these features won't work:
- ❌ Real-time location updates (Socket.IO)
- ❌ Idempotency (duplicate request prevention)
- ❌ Dashboard caching
- ❌ Route simulation data storage

## Still Having Issues?

1. Check Redis logs (if using Docker):
   ```bash
   docker logs redis
   ```

2. Check Windows Event Viewer for Redis errors

3. Try connecting with Redis CLI:
   ```bash
   redis-cli -h localhost -p 6379
   ```

4. Verify port is not in use:
   ```bash
   netstat -an | findstr 6379
   ```

5. Check if antivirus is blocking the connection

