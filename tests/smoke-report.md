# FlipQuik Smoke Test Report

**Date:** 2026-04-08
**Target:** https://flipquik.com
**Runner:** Playwright (Chromium, headless)

---

## Summary

| Metric | Value |
|---|---|
| Total tests | 50 |
| Passed | 3 |
| Failed | 0 |
| Blocked (auth) | 47 |
| Health score | **N/A — blocked by invalid credentials** |

---

## Results

### AUTH (no-auth tests — passed)

| # | Test | Status |
|---|---|---|
| 3 | /inventory without auth redirects to login | PASS |
| 4 | /quikeval without auth redirects to login | PASS |
| 5 | /flip-it without auth redirects to login | PASS |

### AUTH (login-dependent tests — blocked)

| # | Test | Status | Reason |
|---|---|---|---|
| 1 | Login with valid credentials redirects to home | BLOCKED | Invalid login credentials |
| 2 | Logout redirects to login page | BLOCKED | Login failed |

### NAV, HOME PAGE, QUIKEVAL, FLIP IT, MULTIEVAL, INVENTORY, UI/BRANDING, REDIRECT (tests 6–50)

All 45 tests **BLOCKED** — they depend on successful authentication via storageState, which requires the auth setup to pass first.

---

## Root Cause

The test credentials provided were rejected by Supabase with:

> **"Invalid login credentials"**

- **Email:** slamd694@gmail.com
- **Password:** (provided password was rejected)

The login form loads correctly, fields are filled properly, and the Sign In button is clicked successfully. Supabase returns an auth error, preventing any authenticated tests from running.

---

## How to Fix and Re-run

Update the password in one of these ways:

### Option 1: Environment variable (recommended)
```bash
FLIPQUIK_EMAIL="slamd694@gmail.com" FLIPQUIK_PASSWORD="correct_password" npx playwright test
```

### Option 2: Edit the fallback directly
Update the password in `tests/auth.setup.js` line 6 and `tests/smoke.test.js` line 8.

### Then run all tests
```bash
npx playwright test
```

---

## Verified Working

- Route protection is fully functional (3/3 protected routes redirect to /login)
- Login page loads correctly with all form elements
- Supabase auth integration is working (validates credentials server-side)
- Test infrastructure is complete and ready — just needs valid credentials
