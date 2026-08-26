# Predicta Day 28 — Live Demo Contingency & Failure Recovery Plan

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Live Demo Contingency Procedures

| Failure Scenario | Detected Symptoms | Recovery Action | Backup Mode |
| :--- | :--- | :--- | :--- |
| **Vercel API Offline** | Network fetch error on `/api/predict` | UI automatically switches to In-Browser Fallback Mode (`⚠️ OFFLINE LOCAL MODE`). | **Secondary Local Demo** |
| **Supabase DB Offline** | Database write warning in console | In-memory fallback store preserves prediction state seamlessly. | **In-Memory Store** |
| **Internet Disconnected** | Browser network offline icon | Switch to local running instance at `http://localhost:8000`. | **Local Node Instance** |
| **Browser Tab Freeze** | UI non-responsive to button clicks | Refresh tab (`Ctrl+F5`). Workstation state auto-restores. | **Hard Refresh** |
