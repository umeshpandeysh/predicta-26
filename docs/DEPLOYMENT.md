# PREDICTA DEPLOYMENT & OPERATION GUIDE (v2.0.0-SIH2026-RC1)

## Environment Requirements
- **Node.js**: v18.0.0+ or v20.0.0+
- **Python**: 3.10+
- **RAM**: Minimum 512 MB, Recommended 2 GB
- **OS**: Linux / Windows Server / Vercel Serverless

## Quickstart Serverless Deployment
```bash
npm install
npm run build
npm start
```

## Verification Health Endpoint
- **URL**: `GET /api/health`
- **Expected Status**: `200 OK`
- **Payload**: `{"status": "healthy", "version": "v2.0.0-SIH2026-RC1"}`
