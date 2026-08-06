# PERMANENT ENGINEERING RULEBOOK & CONSTITUTION
## GOC STUDIO CRM — LIVE PRODUCTION SYSTEM

---

## 1. Production Safety Policy
- This CRM is actively running in production and managing real-time business operations, customer data, and lead pipelines.
- **Rule 1.1**: Every change must be treated as a live deployment change.
- **Rule 1.2**: Never make speculative, unverified, or temporary code changes.
- **Rule 1.3**: Never delete or truncate production database tables or columns without explicit user approval.
- **Rule 1.4**: Never alter production credentials, secret keys (`JWT_SECRET`), or PM2 startup parameters.

---

## 2. Zero Regression Policy
- A task is considered **FAILED** if any existing functionality breaks, even if the new feature works.
- Before completing any task, the AI MUST execute a full build check (`npm run build` on backend and frontend) and verify zero compilation or runtime regressions.

---

## 3. Minimum Change Principle
- Modify **only** the lines and files strictly required to accomplish the requested objective.
- Do NOT perform unsolicited code refactoring, variable renaming, or directory restructuring.
- Keep diffs atomic, clean, and easily auditable.

---

## 4. Feature Isolation Principle
- When adding new capabilities, prefer creating new modular components, controller endpoints, or utility helpers rather than embedding complex conditional logic inside existing core methods.
- Isolate experimental or new flows behind safe feature flags or independent service functions.

---

## 5. Backward Compatibility
- Existing API response structures, database schema definitions, route definitions, and frontend prop contracts must maintain 100% backward compatibility.
- Never remove fields from JSON responses or database schemas that may be consumed by active frontend sessions or external webhooks.

---

## 6. Error Transparency Directive
- **Swallowing errors or returning silent `null` fallbacks is strictly prohibited.**
- Every external API call failure (Meta, WhatsApp, MSG91, Anthropic) MUST capture and throw structured diagnostic metadata:
  - Provider Name & Request URL
  - HTTP Status Code & Headers
  - Response Body & Meta FB Trace ID
  - Error Code, Subcode, and Error Message
  - Actionable Recommendation for resolution.

---

## 7. Meta Integration Single Source of Truth
- The MySQL database table `meta_integration_settings` is the **EXCLUSIVE SINGLE SOURCE OF TRUTH** for Meta Lead Ads credentials (Page Access Token, App Secret, App ID).
- The system must **NEVER** silently revert to `.env` tokens when database settings exist.
- Tokens must be loaded dynamically on every request (zero in-memory token caching).

---

## 8. Pre-Implementation Analysis Mandate
Before writing code for any request, the AI must formulate:
1. **Understanding**: Concise summary of what needs to be changed.
2. **Implementation Plan**: Clear step-by-step modification plan.
3. **Affected Files**: Specific list of files to edit or create.
4. **Protected Files**: Verification that no protected modules are broken.
5. **Risk Analysis**: Potential regression risks and mitigation steps.

---

## 9. Post-Implementation Verification & Checklist
Upon completing code modifications:
- Run `npm run build` in `backend` and `frontend`.
- Run deployment script `node deploy_live.js` to sync with live production VPS.
- Verify status via PM2 diagnostic startup checks.
- Append task details to `CHANGELOG_AI.md`.
