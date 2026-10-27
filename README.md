# ShiftSync AI — Workforce & Campus Transparency Platform

**ShiftSync AI** is a responsive workforce and campus transparency web platform designed to make work and education fair, safe, and organized for **Construction Workers**, **Construction Admins**, **College Students**, and **College Admins**.

---

## Architecture

ShiftSync AI follows a layered, zero-trust full-stack architecture:

```
[ React 19 + Tailwind CSS Frontend (Code-Split via React.lazy) ]
                          │
                          ▼
[ Input Validation & Sanitization Layer (src/security/validation.ts) ]
                          │
                          ▼
[ Express Backend API & Session Controller (server.ts + src/security/authEngine.ts) ]
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
[ Firebase Auth & Firestore ]   [ Server-Side Gemini AI Proxy ]
(Hardened ABAC Security Rules)  (API Keys Isolated on Server)
```

1. **Frontend Layer (`/src/App.tsx`, `/src/components/*`)**:
   - Single responsive web application adapting seamlessly across desktop, laptop, tablet, and mobile viewports.
   - 3-Step Guided Login Flow: **Step 1: Organization Selection (`College / School` or `Construction Site`) → Step 2: Role Selection (`Student`/`Worker` or `Admin`) → Step 3: Role-Validated Sign-In**.
   - Role portals are dynamically code-split using `React.lazy` and `Suspense`.
2. **Backend Layer (`/server.ts`, `/src/security/authEngine.ts`)**:
   - Express server on port `3000` handling `/api/auth/login`, `/api/auth/verify-session`, `/api/auth/logout`, and `/api/ai/*` routes.
   - Applies security headers (`X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`).
3. **Database Layer (`Firebase Firestore` + `firestore.rules`)**:
   - Stores attendance logs, safety/campus complaints, skill passport records, and user profiles with strict Attribute-Based Access Control (ABAC) rules.
4. **Authentication Layer**:
   - Root Administrator accounts are verified through the backend authentication engine using server-side configuration (`.env.example`) and never expose plaintext passwords in frontend bundles or session tokens.
   - Students and Workers cannot self-register; their accounts, IDs (`CSE101`, `W001`), usernames, and passwords are provisioned exclusively by their respective Admins.

---

## Security

### Security Practices Implemented
- **Zero Hardcoded Frontend Passwords**: All hardcoded passwords have been removed from frontend data files (`/src/data/demoData.ts`). Credential verification runs through `/api/auth/login` and `/src/security/authEngine.ts`, which strips password fields (`stripPassword`) before issuing session objects.
- **Role-Based Access Control (RBAC) & URL Route Guards**:
  - Four strictly isolated roles: `college_admin`, `construction_admin`, `college_student`, and `construction_worker`.
  - Every role maps to a dedicated route (`/portal/college-admin`, `/portal/construction-admin`, `/portal/college-student`, `/portal/construction-worker`).
  - Manual URL tampering (e.g., a Worker changing the URL to `/portal/construction-admin` or `/portal/college-admin`) is intercepted by `canAccessRolePortal` and `resolveRoleFromPath`, immediately blocking unauthorized access and reverting the route.
- **Strict Input Validation & XSS Sanitization (`/src/security/validation.ts`)**:
  - `sanitizeInput()` strips `<script>` blocks, HTML tags, `javascript:` URIs, inline event handlers (`onload=`, `onerror=`), and control characters.
  - `validateIdentifier()`, `validatePassword()`, and `validateBadgeId()` enforce strict regex whitelists and length bounds on usernames, passwords, Worker IDs (`W001`), and Student IDs (`CSE101`).
  - `validateUserProvisioning()` prevents duplicate Worker IDs, Student IDs, or usernames across accounts.
- **Session Management**:
  - Login requests issue time-bounded session tokens (`ss_tok_<role>_<issuedAt>_<nonce>`) with automatic expiration checks (`isSessionValid`).
- **Environment & Secret Isolation**:
  - API keys (`GEMINI_API_KEY`) and admin credentials are documented in `/.env.example` and accessed exclusively on the server.

### Authentication Flow
1. User selects Organization (`College / School` or `Construction Site`) and Role (`Student`, `Worker`, or `Admin`).
2. Frontend validates and sanitizes the identifier and password before sending a `POST /api/auth/login` request.
3. Backend verifies credentials against the target role and returns a sanitized `AuthSession` (without password fields).
4. Admin users can provision, edit, or delete Student/Worker accounts; provisioned accounts can immediately authenticate into their respective portal.

### Data Protection Approach
- Principle of Least Privilege enforced in both `firestore.rules` (default-deny catch-all, owner/admin verification, schema key whitelisting) and application-level RBAC guards.

---

## Performance

- **Route & Portal Code Splitting (`React.lazy` + `Suspense`)**:
  - `ConstructionWorkerPortal`, `CollegeStudentPortal`, `ConstructionAdminPortal`, `CollegeAdminPortal`, and `AITransparencyStudio` are lazy-loaded on demand so initial page load only downloads the lightweight login shell.
- **Memoized Selectors & Aggregations (`useMemo`)**:
  - Attendance totals, overtime pay calculations, filtered worker rosters, and department statistics are memoized to avoid redundant recalculations during form typing.
- **Duplicate Request Prevention**:
  - Login and AI endpoints track in-flight state (`isAuthenticating` / loading states) and disable duplicate submissions.
- **Low-End Device & Mobile Optimization**:
  - Pure CSS charts (zero heavy charting library bloat), hardware-friendly transitions, and `@media (prefers-reduced-motion: reduce)` support.

---

## Testing

Automated unit and integration tests are located in `/tests` and run via `npm test`:

```bash
npm test
```

### Test Suites Included (`/tests`)
1. **Authentication Tests (`/tests/auth.test.ts`)**:
   - Valid College Admin and Construction Admin login and password stripping verification.
   - Invalid password rejection.
   - Unauthorized role access and manual URL tampering blocked via RBAC (`canAccessRolePortal`, `resolveRoleFromPath`).
   - Session token creation and expiration enforcement (`isSessionValid`).
2. **Form Validation & Sanitization Tests (`/tests/forms.test.ts`)**:
   - Empty field rejection across login, account provisioning, safety hazard, and skill passport forms.
   - XSS `<script>` and SQL injection character sanitization (`sanitizeInput`, `validateIdentifier`).
   - Duplicate Worker ID and duplicate username rejection (`validateUserProvisioning`).
3. **Dashboard & Permission Tests (`/tests/dashboard.test.ts`)**:
   - College Admin provisioning Student (`Rahul / CSE101 / rahul101`) and immediate Student login & portal access.
   - Construction Admin provisioning Worker (`Ravi / W001 / ravi001`) and immediate Worker login & 1.5x overtime calculation.
   - Strict Admin permission boundaries (Workers and Students blocked from creating accounts; Cross-organization account creation blocked).

---

## Accessibility

ShiftSync AI is engineered for inclusive access across technical literacy levels:

- **Explicit Form Labels**: Every `<input>`, `<select>`, and `<textarea>` is paired with a semantic `<label htmlFor="...">` and matching `id`.
- **Keyboard Navigation & Skip Links**:
  - Includes a keyboard-accessible **"Skip to main content"** link at the top of every view.
  - High-contrast `3px solid #2563EB` `:focus-visible` outline rings on all interactive elements.
- **ARIA Landmarks & Live Regions**:
  - `role="banner"`, `role="main"`, `role="contentinfo"`, `aria-label` on navigation menus and data tables, `aria-current="page"` / `aria-current="step"`, and `role="alert"` / `aria-live="polite"` on form validation and status banners.
- **WCAG AA Color Contrast & Worker-First UX**:
  - Warm daylight palette (`#F8F5F0` background, `#FFFFFF` cards, `#111827` text, `#2563EB` primary actions) with large `48px–52px` touch targets, voice dictation for hazard reporting, and text-to-speech shift briefings for workers with low technical literacy.
