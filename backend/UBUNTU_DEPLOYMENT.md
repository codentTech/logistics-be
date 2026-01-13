# 🐧 Ubuntu Server Services Setup Guide

**For DevOps/Infrastructure Team**

Complete guide for setting up services (PostgreSQL, Redis, RabbitMQ, MQTT) on Ubuntu server.

**Note:** This is for setting up services only. Developers will connect to these services from their local machines using connection strings.

## 📋 Prerequisites

Your Ubuntu server should have:

- ✅ Ubuntu 20.04+ or 22.04+
- ✅ sudo access
- ✅ Internet connection

---

## 🚀 Step-by-Step Services Setup

### Step 1: Connect to Your Ubuntu Server

```bash
ssh user@your-server-ip
```

---

### Step 2: Install PostgreSQL

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

**In PostgreSQL prompt:**

```sql
CREATE DATABASE opscore_db;
CREATE USER opscore_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE opscore_db TO opscore_user;
\q
```

**Configure remote access (if needed):**

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
# Set: listen_addresses = '*'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host all all 0.0.0.0/0 md5

sudo systemctl restart postgresql
```

---

### Step 3: Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: bind 0.0.0.0 (if remote access needed)
# Set: requirepass your_redis_password (if password needed)

# Start and enable Redis
sudo systemctl start redis
sudo systemctl enable redis

# Test Redis
redis-cli ping  # Should return "PONG"
```

---

### Step 4: Install RabbitMQ

```bash
# Install RabbitMQ
sudo apt install -y rabbitmq-server

# Enable management plugin
sudo rabbitmq-plugins enable rabbitmq_management

# Create user
sudo rabbitmqctl add_user opscore_user rabbitmqpassword@123
sudo rabbitmqctl set_user_tags opscore_user administrator
sudo rabbitmqctl set_permissions -p / opscore_user ".*" ".*" ".*"

# Start and enable RabbitMQ
sudo systemctl start rabbitmq-server
sudo systemctl enable rabbitmq-server

# Access management UI: http://your-server-ip:15672
```

---

### Step 5: Install EMQX (MQTT) - Optional

**Using Docker (Recommended):**

```bash
# Install Docker
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

# Run EMQX
sudo docker run -d --name emqx \
  -p 1883:1883 \
  -p 8083:8083 \
  -p 18083:18083 \
  emqx/emqx:5.3.0
```

**Or install directly:**

```bash
# See: https://www.emqx.io/downloads
```

---

### Step 6: Configure Firewall

```bash
# Allow PostgreSQL (if remote access)
sudo ufw allow 5432/tcp

# Allow Redis (if remote access - use with caution)
sudo ufw allow 6379/tcp

# Allow RabbitMQ
sudo ufw allow 5672/tcp
sudo ufw allow 15672/tcp  # Management UI

# Allow MQTT
sudo ufw allow 1883/tcp
sudo ufw allow 8083/tcp   # WebSocket
sudo ufw allow 18083/tcp # Dashboard

# Enable firewall
sudo ufw enable
```

---

### Step 7: Verify Services

```bash
# Check PostgreSQL
sudo systemctl status postgresql
psql -h localhost -U opscore_user -d opscore_db

# Check Redis
sudo systemctl status redis
redis-cli ping

# Check RabbitMQ
sudo systemctl status rabbitmq-server
# Management UI: http://your-server-ip:15672

# Check EMQX (if installed)
sudo docker ps | grep emqx
# Dashboard: http://your-server-ip:18083
```

---

### Step 8: Share Connection Details

**Provide developers with connection strings:**

```env
# Database
POSTGRES_HOST=163.172.43.58
POSTGRES_PORT=5432
POSTGRES_USER=opscore_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=opscore_db

# Redis
REDIS_HOST=163.172.43.58
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# RabbitMQ
RABBITMQ_URL=amqp://163.172.43.58:5672
RABBITMQ_USER=opscore_user
RABBITMQ_PASSWORD=rabbitmqpassword@123

# MQTT (if installed)
MQTT_BROKER_URL=mqtt://163.172.43.58:1883
```

---

## 🔒 Security Best Practices

### PostgreSQL Security

```bash
# Use strong passwords
# Limit remote access to specific IPs in pg_hba.conf
# Use SSL connections in production
```

### Redis Security

```bash
# Set password: requirepass your_strong_password
# Bind to specific IPs if possible
# Use firewall rules
```

### RabbitMQ Security

```bash
# Use strong passwords
# Limit management UI access
# Use SSL/TLS in production
```

### Firewall Rules

```bash
# Only allow necessary ports
# Restrict access to specific IPs if possible
# Use fail2ban for additional security
```

---

## 📊 Service Management

### PostgreSQL

```bash
# Start/Stop
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl restart postgresql

# Check status
sudo systemctl status postgresql

# View logs
sudo journalctl -u postgresql -f
```

### Redis

```bash
# Start/Stop
sudo systemctl start redis
sudo systemctl stop redis
sudo systemctl restart redis

# Check status
sudo systemctl status redis

# Test connection
redis-cli ping
```

### RabbitMQ

```bash
# Start/Stop
sudo systemctl start rabbitmq-server
sudo systemctl stop rabbitmq-server
sudo systemctl restart rabbitmq-server

# Check status
sudo systemctl status rabbitmq-server

# Management UI
# http://your-server-ip:15672
```

---

## 🔄 Maintenance

### Database Backup

```bash
# Backup database
pg_dump -h localhost -U opscore_user opscore_db > backup.sql

# Restore database
psql -h localhost -U opscore_user opscore_db < backup.sql
```

### Redis Backup

```bash
# Redis persists data automatically
# Manual backup
redis-cli --rdb /path/to/backup.rdb
```

### RabbitMQ Backup

```bash
# Backup definitions
sudo rabbitmqctl export_definitions /path/to/backup.json

# Restore definitions
sudo rabbitmqctl import_definitions /path/to/backup.json
```

---

## 🔐 Security Checklist

- [ ] Use strong passwords for all services
- [ ] Enable firewall (UFW) with minimal open ports
- [ ] Restrict remote access to specific IPs where possible
- [ ] Use SSL/TLS for database connections in production
- [ ] Set up regular backups
- [ ] Monitor service logs
- [ ] Keep services updated
- [ ] Use fail2ban for additional security

---

## 🐛 Troubleshooting

### PostgreSQL Issues

```bash
# Check if running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U opscore_user -d opscore_db

# View logs
sudo journalctl -u postgresql -f

# Check configuration
sudo nano /etc/postgresql/*/main/postgresql.conf
```

### Database connection errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U your_user -d your_db

# Check PostgreSQL config
sudo nano /etc/postgresql/*/main/postgresql.conf
```

### Redis connection errors

```bash
# Check Redis is running
sudo systemctl status redis
redis-cli ping

# Check Redis config
sudo nano /etc/redis/redis.conf
```

### RabbitMQ connection errors

```bash
# Check RabbitMQ is running
sudo systemctl status rabbitmq-server

# Check RabbitMQ logs
sudo journalctl -u rabbitmq-server

# Check management UI
# http://your-server-ip:15672
```

---

## 📋 Services Setup Checklist

- [ ] PostgreSQL installed and configured
- [ ] Database and user created
- [ ] Remote access configured (if needed)
- [ ] Redis installed and configured
- [ ] Redis password set (if needed)
- [ ] RabbitMQ installed and configured
- [ ] RabbitMQ user created
- [ ] Management UI accessible
- [ ] EMQX/MQTT installed (optional)
- [ ] Firewall configured
- [ ] Connection strings shared with developers
- [ ] Services tested and verified

---

## 📊 Service Management Commands

### PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

### Redis

```bash
sudo systemctl start redis
sudo systemctl stop redis
sudo systemctl restart redis
sudo systemctl status redis
redis-cli ping
```

### RabbitMQ

```bash
sudo systemctl start rabbitmq-server
sudo systemctl stop rabbitmq-server
sudo systemctl restart rabbitmq-server
sudo systemctl status rabbitmq-server
```

---

## 🔄 Maintenance

### Regular Backups

```bash
# PostgreSQL backup (add to cron)
pg_dump -h localhost -U opscore_user opscore_db > /backups/opscore_$(date +%Y%m%d).sql

# Redis backup
redis-cli --rdb /backups/redis_$(date +%Y%m%d).rdb
```

### Monitoring

```bash
# Check service status
sudo systemctl status postgresql redis rabbitmq-server

# View logs
sudo journalctl -u postgresql -f
sudo journalctl -u redis -f
sudo journalctl -u rabbitmq-server -f
```

---

## 📚 Additional Resources

- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Redis Docs:** https://redis.io/docs/
- **RabbitMQ Docs:** https://www.rabbitmq.com/documentation.html
- **EMQX Docs:** https://www.emqx.io/docs

---

**Note for Developers:** After services are set up, you'll receive connection strings to use in your `.env` file. You don't need to install these services locally.
