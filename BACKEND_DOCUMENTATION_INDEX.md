# DevBob Backend Documentation Index

Welcome! This documentation explains your shared Metabob RPC-API backend architecture and how to use it with DevBob agents.

## 📋 Quick Navigation

### Getting Started (Start Here!)
1. **[BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md)** ⭐ START HERE
   - Executive overview of your shared backend architecture
   - Key features and benefits
   - Quick start instructions
   - Common operations

### Implementation & Setup
2. **[DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md)**
   - Detailed architecture diagram
   - Complete backend service documentation
   - Health checks and monitoring
   - Volume management
   - Advanced debugging

3. **[START_BACKEND.sh](./START_BACKEND.sh)** - Startup Script
   - Automated backend startup
   - Validates configuration
   - Waits for health checks
   - Shows status and next steps
   - Run: `./START_BACKEND.sh`

### Current Status & Verification
4. **[BACKEND_SETUP_STATUS.md](./BACKEND_SETUP_STATUS.md)**
   - Current infrastructure status
   - Container and network status
   - Environment configuration check
   - Current situation assessment
   - Troubleshooting checklist

5. **[verify-devbob-backend.sh](./verify-devbob-backend.sh)** - Verification Script
   - Automated configuration verification
   - Network and port checks
   - Service validation
   - Run: `./verify-devbob-backend.sh`

### Quick Reference
6. **[DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md)**
   - Essential commands
   - Debugging checklist
   - Port reference
   - Common issues and solutions
   - Performance tips

---

## 📖 Documentation Structure

### For Different User Types

#### 🚀 **I want to get the backend running NOW**
→ Read: [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "Getting Started" section  
→ Run: `./START_BACKEND.sh`  
→ Reference: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md)

#### 🔍 **I want to understand the architecture**
→ Read: [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "How It Works" section  
→ Read: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Architecture Diagram"  
→ Reference: [BACKEND_SETUP_STATUS.md](./BACKEND_SETUP_STATUS.md) "Your Shared Backend Architecture"

#### 🐛 **Something is broken, I need to debug**
→ Reference: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Troubleshooting Checklist"  
→ Read: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Common Issues & Solutions"  
→ Run: `./verify-devbob-backend.sh` for diagnostics  
→ Check: [BACKEND_SETUP_STATUS.md](./BACKEND_SETUP_STATUS.md) "Debugging & Logs"

#### 📊 **I want to monitor and maintain the backend**
→ Read: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Health Checks" section  
→ Reference: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Monitoring Logs"  
→ Reference: [BACKEND_SETUP_STATUS.md](./BACKEND_SETUP_STATUS.md) "Maintenance Tasks"

#### 🤔 **I have a specific question**
→ See "FAQ by Topic" below

---

## 🎯 FAQ by Topic

### Starting the Backend
**Q: How do I start the backend?**
- Quick way: `./START_BACKEND.sh`
- Manual way: See [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "Getting Started - Option 2"

**Q: What if the automated script fails?**
- See [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Backend Status"

**Q: Do I need to start all agents?**
- No! Start just the backend first: `./START_BACKEND.sh`
- Then add agents as needed

### Architecture & Design
**Q: What's the difference between shared and isolated backends?**
- See [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "What You Have" and "Benefits"

**Q: Why use a shared backend?**
- See [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "Benefits of This Architecture"

**Q: How do agents communicate with the backend?**
- See [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "How It Works"

### Configuration
**Q: Where is the configuration file?**
- Location: `configs/docker-compose.devbob.yaml`
- Environment: `.env.devbob`
- See: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Environment Configuration"

**Q: What environment variables are important?**
- See: [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "Configuration"

**Q: How do I change the log level?**
- Edit `.env.devbob`: Set `LOG_LEVEL=DEBUG` or `LOG_LEVEL=INFO`
- Restart services: `docker-compose restart`

### Networking & Connectivity
**Q: What ports are used?**
- See: [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "Port Mapping"
- Reference: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Port Reference"

**Q: How do I access the backend from outside Docker?**
- HTTP: `http://localhost:8080`
- Internal (from agent): `http://api-server-dev:80`

**Q: What networks are involved?**
- See: [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "How It Works" - Network Architecture

**Q: How do I test connectivity?**
- See: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Backend Status"

### Logs & Monitoring
**Q: Where are the logs?**
- Backend: `docker logs api-server-dev`
- Redis: `docker logs metabob-redis`
- Agent: `docker logs devbob-opencode`
- See: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Monitoring Logs"

**Q: How do I monitor resource usage?**
- See: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Backend Stability & Debugging"
- Command: `docker stats`

**Q: What health checks are in place?**
- See: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Health Checks"

### Troubleshooting
**Q: Backend won't start**
- See: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Backend Not Starting"
- Run: `./verify-devbob-backend.sh`

**Q: Agent can't connect to backend**
- See: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Agent Can't Connect to Backend"

**Q: Redis is not responding**
- See: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Redis Connection Error"

**Q: High memory usage**
- See: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "High Memory Usage"

### Data & Persistence
**Q: Where is data stored?**
- See: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Volume Management"
- See: [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) "Data Persistence"

**Q: How do I backup the data?**
- See: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) "Extract Backend Data for Analysis"

**Q: Can I delete data?**
- See: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Cleanup & Maintenance"

---

## 🔄 Workflow Examples

### Scenario 1: Start Everything for Development
```bash
1. cd /home/avi/documents/work/exp-repo/metabob-devbob
2. ./START_BACKEND.sh
3. docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d devbob-opencode
4. docker-compose logs -f
```

### Scenario 2: Add a New Agent to Running Backend
```bash
1. docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d devbob-cli
2. docker logs -f devbob-cli
```

### Scenario 3: Restart Just the Backend
```bash
1. docker-compose -f configs/docker-compose.devbob.yaml restart redis metabob-rpc-api-server
2. Wait for health checks
3. curl http://localhost:8080/status
```

### Scenario 4: Debug Backend Issues
```bash
1. Run: ./verify-devbob-backend.sh
2. Check: docker logs api-server-dev | grep -i error
3. Check: docker exec metabob-redis redis-cli ping
4. Reference: DEVBOB_QUICK_REFERENCE.md troubleshooting
```

---

## 📚 Document Details

| Document | Length | Focus | Audience |
|----------|--------|-------|----------|
| BACKEND_SUMMARY.md | 5 min read | Quick overview & start | Everyone |
| DEVBOB_BACKEND_CONFIGURATION_GUIDE.md | 15 min read | Deep technical details | DevOps/Developers |
| BACKEND_SETUP_STATUS.md | 10 min read | Current status & context | Operators |
| DEVBOB_QUICK_REFERENCE.md | 5 min read | Command reference | Everyone |
| START_BACKEND.sh | 1 min run | Automated startup | Everyone |
| verify-devbob-backend.sh | 2 min run | Verification checks | Operators |

---

## 🎓 Learning Path

### Complete Understanding (Recommended First Time)
1. Read: [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) - 5 minutes
2. Run: `./START_BACKEND.sh` - 1-2 minutes
3. Run: `./verify-devbob-backend.sh` - 2 minutes
4. Read: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md) - 15 minutes
5. Bookmark: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) for future reference

### Just Get It Running
1. Run: `./START_BACKEND.sh`
2. Done! Use [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) as needed

### Troubleshoot Issues
1. Run: `./verify-devbob-backend.sh`
2. Reference: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Troubleshooting Checklist"
3. Deep dive: [DEVBOB_BACKEND_CONFIGURATION_GUIDE.md](./DEVBOB_BACKEND_CONFIGURATION_GUIDE.md)

---

## 🔗 Key Links

- **Project Root**: `/home/avi/documents/work/exp-repo/metabob-devbob`
- **Docker Compose**: `configs/docker-compose.devbob.yaml`
- **Environment**: `.env.devbob`
- **Backend URL**: `http://localhost:8080` (external) / `http://api-server-dev:80` (internal)

---

## 📞 Support

### If you need help:
1. Check the FAQ by Topic section above
2. Run: `./verify-devbob-backend.sh` for diagnostics
3. Reference: [DEVBOB_QUICK_REFERENCE.md](./DEVBOB_QUICK_REFERENCE.md) "Troubleshooting Checklist"
4. Check logs: `docker logs -f api-server-dev`

---

## 📝 Document Updates

- **Generated**: 2026-01-30
- **Status**: Current and comprehensive
- **Last Verified**: 2026-01-30

---

**Happy developing! 🚀**

*Your DevBob environment is configured and ready to go. See [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) for next steps.*
