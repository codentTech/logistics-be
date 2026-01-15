# How to Install Redis on Windows

## Option 1: Using Docker (Recommended - Easiest)

### Prerequisites
- Install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/

### Steps
1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Run the installer and follow the setup wizard
   - Restart your computer if prompted

2. **Start Docker Desktop**
   - Open Docker Desktop from Start menu
   - Wait for it to fully start (whale icon in system tray)

3. **Run Redis Container**
   ```bash
   docker run -d -p 6379:6379 --name redis redis:7-alpine
   ```

4. **Verify Redis is Running**
   ```bash
   docker ps
   ```
   You should see a container named "redis" running.

5. **Test Redis Connection**
   ```bash
   docker exec -it redis redis-cli ping
   ```
   Should return: `PONG`

6. **Configure .env**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

---

## Option 2: Using WSL2 (Best Performance)

### Prerequisites
- Windows 10 version 2004+ or Windows 11
- Administrator access

### Steps

1. **Install WSL2**
   ```powershell
   # Run PowerShell as Administrator
   wsl --install
   ```
   - This installs WSL2 and Ubuntu by default
   - Restart your computer when prompted

2. **Open Ubuntu Terminal**
   - Search for "Ubuntu" in Start menu
   - Open Ubuntu app

3. **Update Package List**
   ```bash
   sudo apt update
   ```

4. **Install Redis**
   ```bash
   sudo apt install redis-server -y
   ```

5. **Start Redis Service**
   ```bash
   sudo service redis-server start
   ```

6. **Enable Redis to Start on Boot**
   ```bash
   sudo systemctl enable redis-server
   ```

7. **Test Redis**
   ```bash
   redis-cli ping
   ```
   Should return: `PONG`

8. **Configure .env**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

**Note:** WSL2 shares localhost with Windows, so `localhost` works from Windows apps.

---

## Option 3: Using Memurai (Windows Native)

### Steps

1. **Download Memurai**
   - Visit: https://www.memurai.com/
   - Click "Download" → "Developer Edition" (free)

2. **Install Memurai**
   - Run the installer
   - Follow the installation wizard
   - Choose "Install as a Windows Service" when prompted

3. **Start Memurai Service**
   - Open Services (Win + R → `services.msc`)
   - Find "Memurai" service
   - Right-click → Start (if not already running)
   - Set Startup type to "Automatic"

4. **Test Redis Connection**
   ```bash
   # Memurai includes redis-cli
   redis-cli ping
   ```
   Should return: `PONG`

5. **Configure .env**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

---

## Option 4: Using Chocolatey (Package Manager)

### Prerequisites
- Install Chocolatey: https://chocolatey.org/install

### Steps

1. **Install Redis via Chocolatey**
   ```powershell
   # Run PowerShell as Administrator
   choco install redis-64 -y
   ```

2. **Start Redis**
   ```powershell
   redis-server
   ```

3. **Test Redis**
   ```powershell
   redis-cli ping
   ```
   Should return: `PONG`

4. **Configure .env**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

---

## Verification Steps

After installation, verify Redis is working:

### 1. Test from Command Line
```bash
redis-cli ping
# Should return: PONG
```

### 2. Test from Node.js
```bash
cd backend
node -e "const Redis = require('ioredis'); const r = new Redis({host: 'localhost', port: 6379}); r.ping().then(console.log).catch(console.error);"
# Should print: PONG
```

### 3. Check if Port is Listening
```powershell
netstat -an | findstr 6379
# Should show: TCP    0.0.0.0:6379    0.0.0.0:0    LISTENING
```

### 4. Test from Your Application
Start your backend and check logs:
```bash
cd backend
npm run dev
```

You should see:
```
✅ Redis connected
✅ Redis ready
```

---

## Troubleshooting

### Issue: "Connection refused" or "ECONNRESET"

**Solution:**
1. Check if Redis is running:
   ```bash
   # Docker
   docker ps | findstr redis
   
   # WSL2
   sudo service redis-server status
   
   # Windows Service
   services.msc (look for Redis/Memurai)
   ```

2. Check Windows Firewall:
   - Windows Security → Firewall & network protection
   - Allow an app through firewall
   - Add Redis or allow port 6379

3. Try `127.0.0.1` instead of `localhost`:
   ```env
   REDIS_HOST=127.0.0.1
   ```

### Issue: Port 6379 already in use

**Solution:**
```powershell
# Find what's using the port
netstat -ano | findstr :6379

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Issue: Docker container keeps stopping

**Solution:**
```bash
# Check logs
docker logs redis

# Restart container
docker restart redis

# Run with restart policy
docker run -d -p 6379:6379 --name redis --restart unless-stopped redis:7-alpine
```

---

## Recommended Setup

**For Development:**
- **Docker** (easiest, isolated, easy to remove)
- **WSL2** (best performance, native-like experience)

**For Production:**
- **WSL2** or **Memurai** (better Windows integration)

---

## Quick Start Commands

### Docker
```bash
# Start Redis
docker run -d -p 6379:6379 --name redis --restart unless-stopped redis:7-alpine

# Stop Redis
docker stop redis

# Start Redis again
docker start redis

# Remove Redis
docker rm -f redis
```

### WSL2
```bash
# Start Redis
sudo service redis-server start

# Stop Redis
sudo service redis-server stop

# Restart Redis
sudo service redis-server restart

# Check status
sudo service redis-server status
```

---

## Next Steps

After Redis is installed and running:

1. **Update your `.env` file:**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

2. **Restart your backend:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Verify connection in logs:**
   Look for: `✅ Redis connected` and `✅ Redis ready`

