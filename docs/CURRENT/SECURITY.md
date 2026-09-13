# PREDICTA-26 ? Security & Adversarial Defense Architecture

---

## 1. Attack Surface Hardening
The platform underwent hostile red-team penetration testing across 15 attack scenarios (`tests/test_adversarial_security.js`):
- **Timing-Safe Authentication:** Session tokens and credentials verified using `crypto.timingSafeEqual` to eliminate timing side channels.
- **Strict Payload Ceilings:** 1 MB body size cap enforced at the HTTP stream layer, rejecting oversized payloads with HTTP 413 without socket destruction.
- **Pre-Inference Data Quality Gate:** Intercepts out-of-bounds telemetry, non-numeric strings, NaNs, and infinities with HTTP 400.
- **Rate Limiting:** IP-based windowed request throttling preventing denial-of-service floods (HTTP 429).
- **Fail-Closed Policy:** Missing model artifacts or SHA-256 mismatches trigger immediate `CONFIGURATION_ERROR` instead of substituting insecure defaults.

## 2. Secret Hygiene
- Zero service-role keys or secret tokens are bundled in client assets or public repositories.
- Client credentials utilize least-privilege anonymous access protected by Supabase Row Level Security (RLS) policies.
