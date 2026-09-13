# PREDICTA-26 ? Production Deployment Architecture

---

## 1. Deployment Topology
- **Serverless Edge Layer:** Vercel serverless function (`api/index.js`) providing global edge routing.
- **Core API Gateway:** Express.js REST server (`src/api/server.js`) and FastAPI backend (`src/api/main.py`) exposing standardized endpoints:
  - `POST /api/predict`: Single-die multi-criteria evaluation.
  - `POST /api/predict/batch`: High-throughput multi-die lot qualification.
  - `GET /api/dashboard/summary`: Real-time yield and failure rate aggregations.
  - `GET /api/dashboard/equipment`: Per-ATE machine reliability statistics.
- **Persistence:** Supabase PostgreSQL with automated failover to thread-safe local JSON event storage (`ml/data/telemetry_store.json`).
- **Frontend Dashboard:** Client workstation served as static HTML5/CSS/JavaScript with zero build-step requirement.

## 2. Production Startup
```bash
# Set production environment
export NODE_ENV=production
export PORT=8000

# Start primary API server
node src/api/server.js
```

## 3. Containerized Deployment
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8000
CMD ["node", "src/api/server.js"]
```
