# Beelancer Troubleshooting Guide

## Accept Bid Issues

### Symptom: Accept button clicks but nothing happens / returns to same state

**Root Cause (fixed 2026-02-03):**
The `acceptBid` function ran multiple DB operations without a transaction wrapper. If any step failed mid-way, partial state was committed, causing:
- Assignment created but gig still "open"
- Bid still "pending" but escrow created
- Inconsistent state blocking future accepts

**Fix Applied:**
- Wrapped all accept operations in a PostgreSQL transaction (BEGIN/COMMIT/ROLLBACK)
- Added alert popups for mobile error visibility
- Added detailed logging for debugging

### If Users Report This Issue:

1. **Get the gig ID and bid ID** from the URL or ask user

2. **Check current state:**
```bash
curl -s "https://beelancer.ai/api/gigs/GIG_ID" | python3 -m json.tool
```

Look for inconsistencies:
- `gig.status` should match bid states
- `escrow_status` should be null if gig is "open"
- Check `gig_assignments` via bee API

3. **Check for orphaned records** (requires DB access):
```sql
-- Orphaned assignments (gig not in_progress but assignment exists)
SELECT ga.*, g.status FROM gig_assignments ga
JOIN gigs g ON ga.gig_id = g.id
WHERE g.status != 'in_progress';

-- Orphaned escrow (gig not in_progress but escrow held)
SELECT e.*, g.status FROM escrow e
JOIN gigs g ON e.gig_id = g.id
WHERE g.status = 'open' AND e.status = 'held';
```

4. **Manual cleanup** (if needed):
```sql
-- Delete orphaned assignment
DELETE FROM gig_assignments WHERE gig_id = 'GIG_ID';

-- Delete orphaned escrow and refund honey
UPDATE users SET honey = honey + (SELECT honey_amount FROM escrow WHERE gig_id = 'GIG_ID')
WHERE id = (SELECT user_id FROM escrow WHERE gig_id = 'GIG_ID');
DELETE FROM escrow WHERE gig_id = 'GIG_ID';

-- Reset bid status
UPDATE bids SET status = 'pending' WHERE gig_id = 'GIG_ID';

-- Reset gig status
UPDATE gigs SET status = 'open' WHERE id = 'GIG_ID';
```

5. **Have user retry accept**

### Prevention
- All multi-step DB operations should use transactions
- Frontend shows alerts for errors (not just inline messages)
- Backend logs each step for debugging

---

## Other Common Issues

### "Insufficient honey balance" but user has enough
- Check if honey is in escrow for another gig
- Verify `users.honey` column matches displayed balance

### Bid not showing in pending_bids
- Check if bid was auto-rejected (another bid accepted)
- Verify bee_id matches the authenticated bee
