# 🔧 Troubleshooting Database Connection Issues

## Problem: `ECONNREFUSED` when connecting to PostgreSQL

This means PostgreSQL is either:
1. Not running
2. Not configured to accept remote connections
3. Firewall is blocking the connection

---

## ✅ Step-by-Step Fix

### 1. SSH into Your Server

```bash
ssh ayyaz@163.172.43.58
```

### 2. Check if PostgreSQL is Running

```bash
sudo systemctl status postgresql
```

**If not running, start it:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Check PostgreSQL Configuration

**Edit PostgreSQL config to allow remote connections:**

```bash
# Find PostgreSQL version
sudo ls /etc/postgresql/

# Edit postgresql.conf (replace X.X with your version, e.g., 15)
sudo nano /etc/postgresql/15/main/postgresql.conf
```

**Find and change:**
```conf
# Change from:
listen_addresses = 'localhost'

# To:
listen_addresses = '*'
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### 4. Configure Client Authentication

**Edit pg_hba.conf:**

```bash
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

**Add this line at the end (replace X.X with your version):**
```
host    all             all             0.0.0.0/0               md5
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### 5. Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

### 6. Check Firewall

**Allow PostgreSQL port:**

```bash
# Check firewall status
sudo ufw status

# Allow PostgreSQL port
sudo ufw allow 5432/tcp

# If firewall was inactive, enable it
sudo ufw enable
```

### 7. Verify Database and User Exist

```bash
sudo -u postgres psql
```

**In PostgreSQL prompt:**
```sql
-- Check if database exists
\l

-- If opscore_db doesn't exist, create it:
CREATE DATABASE opscore_db;

-- Check if user exists
\du

-- If opscore_user doesn't exist, create it:
CREATE USER opscore_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE opscore_db TO opscore_user;

-- Exit
\q
```

### 8. Test Connection from Server

```bash
# Test local connection
psql -h localhost -U opscore_user -d opscore_db

# If that works, test from your local machine:
# (Run this on your Mac, not on server)
psql -h 163.172.43.58 -U opscore_user -d opscore_db
```

---

## 🔍 Quick Diagnostic Commands

**On your Ubuntu server, run these:**

```bash
# 1. Check if PostgreSQL is running
sudo systemctl status postgresql

# 2. Check if PostgreSQL is listening on port 5432
sudo netstat -tlnp | grep 5432
# OR
sudo ss -tlnp | grep 5432

# 3. Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# 4. Test local connection
sudo -u postgres psql -c "SELECT version();"
```

---

## 📋 Common Issues

### Issue 1: PostgreSQL only listening on localhost

**Fix:** Set `listen_addresses = '*'` in `postgresql.conf`

### Issue 2: pg_hba.conf not allowing remote connections

**Fix:** Add `host all all 0.0.0.0/0 md5` to `pg_hba.conf`

### Issue 3: Firewall blocking port 5432

**Fix:** Run `sudo ufw allow 5432/tcp`

### Issue 4: Wrong password

**Fix:** Reset password:
```sql
ALTER USER opscore_user WITH PASSWORD 'new_password';
```

---

## ✅ After Fixing

Once PostgreSQL is configured, test from your local machine:

```bash
# From your Mac terminal
psql -h 163.172.43.58 -U opscore_user -d opscore_db
```

If connection works, your Node.js app should connect too!

---

## 🔒 Security Note

For production, consider:
- Using SSL connections
- Restricting IP addresses in `pg_hba.conf` instead of `0.0.0.0/0`
- Using strong passwords
- Setting up a VPN or SSH tunnel for database access

