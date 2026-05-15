# TASK-011 Manual Testing Checklist
## Notifications System — Manual Test Coverage

**Date:** 2026-05-15  
**Test Environment:** Development (Backend: port 3000, Frontend: port 3001)  
**Tester:** Claude Code Agent  
**Status:** PENDING EXECUTION

---

## Pre-Test Environment Setup

### Prerequisites
- [ ] Backend running on port 3000: `npm run dev` (backend)
- [ ] Frontend running on port 3001: `npm run dev` (frontend in separate terminal)
- [ ] PostgreSQL 15 running on 127.0.0.1:5433
- [ ] Redis 7 running on localhost:6379
- [ ] Demo user available: `demo@aeo-suite.local` / `Demo@2026!`
- [ ] Stress client available: `cmonwtk9r00002ku9q59ge1h4`

### Database State Reset
```bash
# Optional: Reset notifications table if needed
psql -h 127.0.0.1 -p 5433 -U aeo -d aeo_suite -c "DELETE FROM notification CASCADE;"

# Optional: Reset Redis for rate limiter testing
redis-cli -p 6379 FLUSHDB
```

---

## Test 1: Dashboard Badge Updates Every 30 Seconds

**Objective:** Verify that the notifications badge on the dashboard refreshes unread count via SWR polling every 30 seconds.

### Setup
1. [ ] Navigate to dashboard: `http://localhost:3001/dashboard`
2. [ ] Log in with demo user: `demo@aeo-suite.local` / `Demo@2026!`
3. [ ] Locate notifications bell icon (top-right or header)
4. [ ] Record initial badge count (if any)

### Steps
1. [ ] Open browser dev tools → Network tab (filter XHR/Fetch)
2. [ ] Observe GET requests to `/notifications/unread-count?clientId=...` at 30-second intervals
3. [ ] Manually create a notification via curl:
   ```bash
   curl -X POST http://localhost:3000/notifications \
     -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "clientId":"cmonwtk9r00002ku9q59ge1h4",
       "type":"citation_drop",
       "severity":"critical",
       "title":"Test Citation Drop Alert",
       "body":"Your citation rate dropped 5 points."
     }'
   ```
   **Note:** You'll need to extract the access token from a login session (check localStorage in dev tools)

4. [ ] Wait up to 30 seconds for the next SWR poll
5. [ ] Verify badge count increments by 1

### Expected Result
- Badge count updates within 30 seconds of creating a notification
- SWR polling calls appear in Network tab every ~30s
- No console errors

### Pass/Fail
- **Pass:** [ ] Badge updates within 30 seconds
- **Fail:** [ ] Badge does not update or takes longer than 60 seconds

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Test 2: Mark-Read Toggles Notification

**Objective:** Verify that marking a notification as read/unread updates the `is_read` flag in the database.

### Setup
1. [ ] Ensure at least one unread notification exists from Test 1
2. [ ] Open notifications panel on dashboard (click bell icon)
3. [ ] Observe list of unread notifications

### Steps
1. [ ] Click on an unread notification → Should display "Mark as read" action
2. [ ] Click "Mark as read" button
3. [ ] Verify notification moves to "read" section or grey out
4. [ ] Query database to verify flag:
   ```bash
   psql -h 127.0.0.1 -p 5433 -U aeo -d aeo_suite -c \
     "SELECT id, title, is_read, created_at FROM notification ORDER BY created_at DESC LIMIT 5;"
   ```
5. [ ] Confirm `is_read` column shows `true` for the marked notification
6. [ ] Click "Mark as unread" (if available) and repeat database check
7. [ ] Verify `is_read` toggles back to `false`

### Expected Result
- Notification UI updates immediately when marking as read/unread
- Database `is_read` flag reflects the UI state
- Toggle is idempotent (can be repeated without errors)

### Pass/Fail
- **Pass:** [ ] is_read flag toggles correctly in database
- **Fail:** [ ] is_read flag does not update or UI does not reflect changes

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Test 3: Critical Notifications Sent Immediately

**Objective:** Verify that Critical severity notifications trigger email delivery within 10 seconds.

### Setup
1. [ ] Enable email logging in MailService (check logs or add debug output)
2. [ ] Open terminal and monitor backend logs:
   ```bash
   npm run dev # Watch logs for MailService output
   ```
3. [ ] Have access to SendGrid dashboard (or check application logs)

### Steps
1. [ ] Emit a critical event manually via debug endpoint or code:
   ```bash
   curl -X POST http://localhost:3000/debug/emit-event \
     -H "Content-Type: application/json" \
     -d '{
       "event": "payment.failed",
       "clientId": "cmonwtk9r00002ku9q59ge1h4",
       "tenantId": "<TEST_TENANT_ID>",
       "amount": 5000,
       "currency": "INR"
     }'
   ```
   **Alternative:** Trigger from a module directly in code (e.g., call BillingService.handleFailedPayment)

2. [ ] Record timestamp of event emission
3. [ ] Monitor MailService logs for:
   - `Sent notification email for payment_failed to ...`
   - Or email delivery confirmation
4. [ ] Record timestamp of email sent log
5. [ ] Calculate elapsed time: `sent_time - emit_time`
6. [ ] Check SendGrid Activity dashboard (if account linked):
   - Navigate to SendGrid → Activity
   - Search for email sent in the past minute

### Expected Result
- Email is sent within 10 seconds of event emission
- MailService logs confirm delivery
- No errors in email template or SendGrid API call
- Email contains:
  - Proper subject line (e.g., "Payment Failed")
  - Descriptive body text
  - "View Details" CTA button with deep link

### Pass/Fail
- **Pass:** [ ] Email sent within 10 seconds, logs confirm delivery
- **Fail:** [ ] Email not sent, sent after >10 seconds, or SendGrid API error

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Test 4: High Notifications Batched in Digest at 9 AM IST

**Objective:** Verify that High severity notifications are batched and sent once daily at 9 AM IST via digest email.

### Setup
1. [ ] Note current time (HH:MM UTC)
2. [ ] Calculate next 9 AM IST in UTC: `9:00 AM IST = 3:30 AM UTC`
3. [ ] Plan to either:
   - Wait until actual 9 AM IST (if testing live)
   - Manually trigger digest job for testing (recommended)

### Steps (Manual Trigger Method — Recommended)
1. [ ] Create 5 HIGH severity notifications via API:
   ```bash
   for i in {1..5}; do
     curl -X POST http://localhost:3000/notifications \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{
         \"clientId\":\"cmonwtk9r00002ku9q59ge1h4\",
         \"type\":\"content_draft_ready\",
         \"severity\":\"high\",
         \"title\":\"Content Draft $i Ready\",
         \"body\":\"Draft $i is ready for review.\"
       }"
   done
   ```

2. [ ] Verify all 5 notifications created in database:
   ```bash
   psql -h 127.0.0.1 -p 5433 -U aeo -d aeo_suite -c \
     "SELECT id, title, severity, email_sent FROM notification WHERE severity='high' ORDER BY created_at DESC LIMIT 5;"
   ```
   All should show `email_sent=false`

3. [ ] Manually trigger the digest cron job (add a test endpoint or call directly):
   ```typescript
   // In a test or debug endpoint:
   const diestJob = app.get(DigestCronJob);
   await digestJob.handle();
   ```
   OR via HTTP if exposed:
   ```bash
   curl -X PATCH http://localhost:3000/notifications/send-digest
   ```

4. [ ] Monitor MailService logs for:
   - `Sent digest email to ...`
   - Email recipient count
   - Number of notifications included

5. [ ] Query database to verify all 5 marked as sent:
   ```bash
   psql -h 127.0.0.1 -p 5433 -U aeo -d aeo_suite -c \
     "SELECT id, title, email_sent FROM notification WHERE severity='high' ORDER BY created_at DESC LIMIT 5;"
   ```
   All should show `email_sent=true`

6. [ ] Check SendGrid Activity for 1 digest email (not 5 separate emails)

### Steps (Live 9 AM IST Wait Method)
1. [ ] Create 5 HIGH notifications as above
2. [ ] Verify they are stored with `email_sent=false`
3. [ ] Wait until 9 AM IST the next day (or adjust server time)
4. [ ] Observe cron job execution in logs
5. [ ] Verify digest email sent and all marked `email_sent=true`

### Expected Result
- 5 notifications created → 1 batched digest email sent
- All 5 marked `email_sent=true` after digest send
- Email contains all 5 notifications in a single message
- No duplicate emails (each notif sent only once)
- Digest sent at exactly 9 AM IST (or within 1 minute)

### Pass/Fail
- **Pass:** [ ] 5 High notifs → 1 digest email, all marked sent
- **Fail:** [ ] 5 separate emails, or not all marked sent, or email sent at wrong time

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Test 5: Rate Limit Blocks Duplicate in 4 Hours

**Objective:** Verify that emitting the same event twice rapidly creates only 1 notification; second is blocked for 4 hours.

### Setup
1. [ ] Open Redis CLI to monitor keys:
   ```bash
   redis-cli -p 6379
   > MONITOR  # Watch all operations
   ```
2. [ ] Open second terminal for curl commands
3. [ ] Reset rate limiter cache:
   ```bash
   redis-cli -p 6379 FLUSHDB
   ```

### Steps
1. [ ] Emit the same event twice rapidly (within 1 second):
   ```bash
   # Event 1
   curl -X POST http://localhost:3000/debug/emit-event \
     -H "Content-Type: application/json" \
     -d '{
       "event": "citation.drop",
       "clientId": "cmonwtk9r00002ku9q59ge1h4",
       "tenantId": "<TEST_TENANT>",
       "citationDropPoints": 12
     }'

   # Event 2 (immediately after)
   curl -X POST http://localhost:3000/debug/emit-event \
     -H "Content-Type: application/json" \
     -d '{
       "event": "citation.drop",
       "clientId": "cmonwtk9r00002ku9q59ge1h4",
       "tenantId": "<TEST_TENANT>",
       "citationDropPoints": 12
     }'
   ```

2. [ ] Check notification count in database:
   ```bash
   psql -h 127.0.0.1 -p 5433 -U aeo -d aeo_suite -c \
     "SELECT COUNT(*) FROM notification WHERE type='citation_drop' AND client_id='cmonwtk9r00002ku9q59ge1h4';"
   ```
   Should return `1` (not 2)

3. [ ] Check backend logs for rate limit message:
   ```
   "Rate limit blocked: cmonwtk9r00002ku9q59ge1h4:citation_drop:critical. Wait XXXX seconds."
   ```

4. [ ] Check Redis for rate limit key:
   ```bash
   redis-cli -p 6379 KEYS "notif:*"
   ```
   Should show: `notif:cmonwtk9r00002ku9q59ge1h4:citation_drop:critical`

5. [ ] Check TTL on key:
   ```bash
   redis-cli -p 6379 TTL "notif:cmonwtk9r00002ku9q59ge1h4:citation_drop:critical"
   ```
   Should be between 0 and 14400 seconds (4 hours)

6. [ ] Emit 100 identical events rapidly (stress test):
   ```bash
   for i in {1..100}; do
     curl -s -X POST http://localhost:3000/debug/emit-event \
       -H "Content-Type: application/json" \
       -d '{
         "event": "citation.drop",
         "clientId": "cmonwtk9r00002ku9q59ge1h4",
         "tenantId": "<TEST_TENANT>",
         "citationDropPoints": 12
       }' &
   done
   wait
   ```

7. [ ] Check notification count again:
   ```bash
   psql -h 127.0.0.1 -p 5433 -U aeo -d aeo_suite -c \
     "SELECT COUNT(*) FROM notification WHERE type='citation_drop';"
   ```
   Should still be `1` (all 100 blocked)

8. [ ] Wait 4+ hours OR manually expire Redis key:
   ```bash
   redis-cli -p 6379 DEL "notif:cmonwtk9r00002ku9q59ge1h4:citation_drop:critical"
   ```

9. [ ] Emit same event again:
   ```bash
   curl -X POST http://localhost:3000/debug/emit-event \
     -H "Content-Type: application/json" \
     -d '{
       "event": "citation.drop",
       "clientId": "cmonwtk9r00002ku9q59ge1h4",
       "tenantId": "<TEST_TENANT>",
       "citationDropPoints": 12
     }'
   ```

10. [ ] Check notification count:
    ```bash
    psql -h 127.0.0.1 -p 5433 -U aeo -d aeo_suite -c \
      "SELECT COUNT(*) FROM notification WHERE type='citation_drop' AND client_id='cmonwtk9r00002ku9q59ge1h4';"
    ```
    Should now be `2` (new notification created after 4h window expired)

### Expected Result
- Event 1 → Notification created, Redis key set
- Event 2 → Blocked, logged, no notification created
- 100 rapid events → Only 1 notification created
- After 4h+ → Can create duplicate again
- Critical severity bypasses rate limit (can send multiple in 4h)

### Pass/Fail
- **Pass:** [ ] 2 rapid → 1 created, 1 blocked; expires after 4h
- **Fail:** [ ] Both created, or never expires, or Critical not bypassing

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Test 6: Deep Links Navigate Correctly

**Objective:** Verify that notification deep links navigate to the correct dashboard section.

### Setup
1. [ ] Create a notification with a known deep link value
2. [ ] Open browser and be logged into dashboard

### Steps
1. [ ] Create notification with deep link via API:
   ```bash
   curl -X POST http://localhost:3000/notifications \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "clientId":"cmonwtk9r00002ku9q59ge1h4",
       "type":"gap_report",
       "severity":"high",
       "title":"Gap Report Generated",
       "body":"New gap analysis available.",
       "deepLink":"/dashboard/diagnostics/gaps"
     }'
   ```

2. [ ] Open notifications panel
3. [ ] Click the notification → Should navigate or open modal/drawer
4. [ ] Locate "View Details" or similar button
5. [ ] Click it and observe URL in address bar
6. [ ] Verify URL matches expected deep link:
   - Should be: `http://localhost:3001/dashboard/diagnostics/gaps`

7. [ ] Test with another deep link (e.g., analytics):
   ```bash
   curl -X POST http://localhost:3000/notifications \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "clientId":"cmonwtk9r00002ku9q59ge1h4",
       "type":"citation_drop",
       "severity":"critical",
       "title":"Citation Drop Alert",
       "deepLink":"/dashboard/analytics#citation-trends"
     }'
   ```

8. [ ] Click "View Details" and verify URL navigation
9. [ ] Confirm hash anchor (`#citation-trends`) is handled correctly

### Expected Result
- Notification UI shows "View Details" button
- Clicking navigates to exact deep link URL
- Browser URL bar shows correct path + hash
- Page loads without errors
- User is taken to correct dashboard section/tab

### Pass/Fail
- **Pass:** [ ] All deep links navigate correctly, URL matches
- **Fail:** [ ] Navigation fails, wrong URL, or page not found

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Test 7: All 12 SendGrid Email Templates Render

**Objective:** Verify that all 12 notification types generate valid, properly formatted HTML emails.

### Setup
1. [ ] Have access to backend logs (MailService)
2. [ ] Optional: Have SendGrid account to view Activity → Email Log
3. [ ] Prepare to create notifications for each type

### Steps - Critical Notifications (5 types)

1. **CITATION_DROP**
   - [ ] Create notification: `type: "citation_drop", severity: "critical"`
   - [ ] Verify email sent
   - [ ] Check email subject: Should be descriptive (e.g., "Citation Rate Drop Alert")
   - [ ] Verify HTML is valid (no rendering errors in email client preview)
   - [ ] Confirm "View Details" button appears

2. **COMPETITOR_SPIKE**
   - [ ] Create notification: `type: "competitor_spike", severity: "critical"`
   - [ ] Verify email rendering

3. **NEGATIVE_REVIEW_24H**
   - [ ] Create notification: `type: "negative_review_24h", severity: "critical"`
   - [ ] Verify email rendering

4. **PAYMENT_FAILED**
   - [ ] Create notification: `type: "payment_failed", severity: "critical"`
   - [ ] Verify email rendering, especially billing link

5. **PROMPT_FAILURE_RATE**
   - [ ] Create notification: `type: "prompt_failure_rate", severity: "critical"`
   - [ ] Verify email rendering

### Steps - High Notifications (4 types)

6. **COMMUNITY_THREAD**
   - [ ] Create notification: `type: "community_thread", severity: "high"`
   - [ ] Will be batched in digest (not sent immediately)
   - [ ] Trigger digest manually to verify rendering in digest email

7. **CONTENT_DRAFT_READY**
   - [ ] Create notification: `type: "content_draft_ready", severity: "high"`
   - [ ] Verify in digest email

8. **GAP_REPORT**
   - [ ] Create notification: `type: "gap_report", severity: "high"`
   - [ ] Verify in digest email

9. **COMPETITOR_DOMAIN**
   - [ ] Create notification: `type: "competitor_domain", severity: "high"`
   - [ ] Verify in digest email

### Steps - Medium Notifications (3 types)
**Note:** Medium notifications are stored for weekly brief (not sent via notifications system yet)

10. **AGGREGATOR_SCORE**
    - [ ] Create notification: `type: "aggregator_score", severity: "medium"`
    - [ ] Verify stored in database with correct type/severity

11. **REVIEW_BACKLOG**
    - [ ] Create notification: `type: "review_backlog", severity: "medium"`
    - [ ] Verify stored in database

12. **PR_OPPORTUNITY**
    - [ ] Create notification: `type: "pr_opportunity", severity: "medium"`
    - [ ] Verify stored in database

### Template Validation Checklist (for each email)
- [ ] Subject line is descriptive and actionable
- [ ] HTML is valid (W3C validate, or preview in email client)
- [ ] Email header shows tenant/brand name (if applicable)
- [ ] Footer contains unsubscribe or contact info
- [ ] "View Details" CTA links to correct deep link
- [ ] Text is readable (font size, color contrast)
- [ ] Images (if any) load correctly
- [ ] No template placeholders left unfilled (e.g., `{{name}}` should be replaced)
- [ ] Responsive design (test on mobile preview if available)
- [ ] No 8-bit encoding or special character issues

### Expected Result
- All 12 notification types render valid HTML emails
- All 5 Critical emails sent immediately with proper formatting
- All 4 High emails batched in digest email with proper formatting
- All 3 Medium emails stored correctly
- No email rendering errors in backend logs
- SendGrid Activity shows no failed deliveries due to template errors

### Pass/Fail
- **Pass:** [ ] All 12 types render correctly, no template errors
- **Fail:** [ ] Any type fails to render, template errors, or unsubstituted placeholders

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Bug Fix Log

If any test fails, document the bug and fix here:

### Bug #1 (if found)
- **Test:** (Which test failed)
- **Root Cause:** (What went wrong)
- **Fix Applied:** (Code/config change)
- **Commit SHA:** (git commit hash)
- **Re-test Result:** PASS / FAIL

```
_________________________________________________________________
_________________________________________________________________
```

### Bug #2 (if found)
- **Test:** (Which test failed)
- **Root Cause:** (What went wrong)
- **Fix Applied:** (Code/config change)
- **Commit SHA:** (git commit hash)
- **Re-test Result:** PASS / FAIL

```
_________________________________________________________________
_________________________________________________________________
```

---

## Test Results Summary

| Test # | Test Name | Expected | Status | Notes |
|--------|-----------|----------|--------|-------|
| 1 | Dashboard Badge Updates | Real-time or <30s | PENDING | |
| 2 | Mark-Read Toggle | DB flag updates | PENDING | |
| 3 | Critical Email Immediate | <10s delivery | PENDING | |
| 4 | High Digest Batch | 5 notifs → 1 email @ 9 AM | PENDING | |
| 5 | Rate Limit 4h Window | 2 rapid → 1 created, 1 blocked | PENDING | |
| 6 | Deep Links Navigate | Correct URL in browser | PENDING | |
| 7 | Email Templates Render | All 12 types valid HTML | PENDING | |

---

## Overall Test Coverage

- **Total Tests:** 7 major test categories
- **Sub-tests:** 30+ detailed checks
- **Estimated Time:** 2-3 hours (with waiting periods for time-based tests)

---

## Success Criteria

To mark Task 12 as **COMPLETE**:

- [x] Manual testing document created at `docs/TASK-011-manual-testing-checklist.md`
- [ ] All 7 test categories executed (checkboxes marked above)
- [ ] All 7 tests PASS (or bugs documented and fixed)
- [ ] Bug fix commits created (if any failures found)
- [ ] No regressions in existing tests (`npm test` still 100% passing)
- [ ] Ready for code review (Task 13)

---

## Execution Notes

### How to Run Tests

1. **Prepare environment:**
   ```bash
   npm run dev  # Terminal 1 (backend)
   npm run dev  # Terminal 2 (frontend)
   redis-cli -p 6379 MONITOR  # Terminal 3 (for Test 5)
   ```

2. **For each test:**
   - Follow setup steps
   - Execute test steps
   - Record pass/fail and notes
   - If fail, investigate root cause and create bug fix

3. **After all tests:**
   - Summarize results in "Test Results Summary" table
   - Create PR with this document and any bug-fix commits
   - Request code review (Task 13)

### Debugging Tips

**If Test 1 fails (badge not updating):**
- Check SWR polling interval in frontend code (should be 30s)
- Verify Access Token is valid and has correct tenantId
- Check `/notifications/unread-count` endpoint returns correct count
- Monitor Network tab for XHR errors

**If Test 3 fails (email not sent):**
- Verify MAIL_FROM, SENDGRID_API_KEY env vars are set
- Check MailService is imported in NotificationsModule
- Monitor backend logs for MailService errors
- Test email sending separately with a simple test case

**If Test 4 fails (digest not sent):**
- Verify DigestCronJob is registered in NotificationsModule
- Check cron expression is correct for 9 AM IST
- Manually trigger with `await digestJob.handle()` for testing
- Verify `findBatchableHigh` query returns correct notifications

**If Test 5 fails (rate limiter not working):**
- Verify Redis is running and connected
- Check RateLimiterService is injected with Redis client
- Verify rate limit key format in Redis: `notif:clientId:type:severity`
- Check TTL is set correctly (14400 seconds = 4 hours)

**If Test 6 fails (deep links not working):**
- Verify deepLink field is set in notification creation
- Check frontend passes deepLink to navigation handler
- Verify URL encoding (spaces become %20, etc.)
- Test with and without hash anchors

**If Test 7 fails (email template errors):**
- Check email template string for syntax errors
- Verify tenant/client data is fetched correctly
- Test email rendering in email client simulator
- Check for unescaped HTML characters
- Validate template placeholders are replaced

---

## Next Steps After Task 12

Once all tests pass or bugs are fixed:

1. **Create commit for this checklist:**
   ```bash
   git add docs/TASK-011-manual-testing-checklist.md
   git commit -m "[TASK-011] docs: add manual testing checklist (Task 12)"
   ```

2. **Proceed to Task 13: Code Review and Merge**
   - Create PR with all notification system commits
   - Request review
   - Merge to main after approval

---

**Document Version:** 1.0  
**Created:** 2026-05-15  
**Last Updated:** 2026-05-15
