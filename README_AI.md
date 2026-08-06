# AI SOFTWARE DEVELOPMENT CONSTITUTION & OPERATING MANUAL
## GOC STUDIO CRM — LIVE PRODUCTION SYSTEM

> [!IMPORTANT]
> **CRITICAL DIRECTIVE FOR ALL AI ASSISTANTS**:
> This CRM is **LIVE IN PRODUCTION**. Real customers and active businesses rely on it 24/7.
> **Protecting production stability is ALWAYS more important than implementing new features.**
> Breaking production functionality is **NEVER ACCEPTABLE**.

---

## 1. Mandatory Pre-Execution Document Reading Order

Before writing code, inspecting issues, or taking any modification actions, **every AI session MUST read the following documentation files in this EXACT order**:

1. [AI_DEVELOPMENT_RULES.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/AI_DEVELOPMENT_RULES.md) — Production safety policy & engineering rules.
2. [SYSTEM_ARCHITECTURE.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/SYSTEM_ARCHITECTURE.md) — System design, data flows & lifecycle.
3. [PROTECTED_MODULES.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/PROTECTED_MODULES.md) — Production-critical code & lockdown protocols.
4. [FEATURE_REGISTRY.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/FEATURE_REGISTRY.md) — Complete feature inventory & component mapping.
5. [API_REGISTRY.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/API_REGISTRY.md) — Full API endpoint schema & security map.
6. [DATABASE_SCHEMA.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/DATABASE_SCHEMA.md) — Database tables, foreign keys & constraints.
7. [DEPENDENCY_MAP.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/DEPENDENCY_MAP.md) — Dependency graph from route to external APIs.
8. [TEST_CHECKLIST.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/TEST_CHECKLIST.md) — Production regression testing checklist.
9. [CHANGELOG_AI.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/CHANGELOG_AI.md) — AI development audit trail.
10. [DEPLOYMENT_GUIDE.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/DEPLOYMENT_GUIDE.md) — Build, deployment & PM2 restart guide.
11. [META_TOKEN_ARCHITECTURE.md](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/META_TOKEN_ARCHITECTURE.md) — Meta Single Source of Truth architecture.

Only after reading and understanding all system documentation may code inspection and engineering work begin.

---

## 2. Core Golden Rules for AI Development

1. **Minimum Change Principle**: Modify ONLY the files directly relevant to the user's specific request. Never perform refactorings or file reorganizations outside the task scope.
2. **Zero Regression Policy**: A task is successful ONLY if the requested change works AND every pre-existing feature continues working without regression.
3. **Feature Isolation**: Create new decoupled components, utilities, or services rather than modifying working production logic whenever possible.
4. **Database as Single Source of Truth**: Never fallback to `.env` variables when database configurations exist (especially for Meta Lead Ads credentials).
5. **Zero Error Swallowing**: Never return `null` silently or catch errors without full structured diagnostic context (`ExternalApiError`).

---

## 3. System Quick Reference

- **Live Production VPS**: `72.61.243.180`
- **Backend Tech Stack**: Node.js, Express, TypeScript, MySQL (`goc_studio`), PM2
- **Frontend Tech Stack**: React, Vite, TypeScript, TailwindCSS
- **Deployment Command**: `powershell -ExecutionPolicy Bypass -Command "node deploy_live.js"`
