# Audit Pipeline Skill

## Purpose
Read new leads from the Randi Agency CRM Google Sheet and generate an AI Visibility Audit for each one.

## Sheet Details
- **Spreadsheet ID:** `19hCNdwhOmqdgp1tqZl1AMyBmRL7ne3ZlsEoMKELz4A4`
- **Audit Leads tab:** `Audit Leads`
- **Contact Submissions tab:** `Contact Submissions`

## Audit Leads Column Map (1-indexed)
| Col | Header |
|-----|--------|
| A (1) | Timestamp |
| B (2) | Business Name |
| C (3) | Business Type |
| D (4) | City |
| E (5) | Website |
| F (6) | Contact Name |
| G (7) | Email |
| H (8) | Biggest Challenge |
| I (9) | Lead Score ← Randi fills in |
| J (10) | GBP Verified ← Randi fills in |
| K (11) | GBP Rating ← Randi fills in |
| L (12) | GBP Reviews ← Randi fills in |
| M (13) | AI Overview ← Randi fills in |
| N (14) | Competitor 1 ← Randi fills in |
| O (15) | Competitor 2 ← Randi fills in |
| P (16) | Competitor 3 ← Randi fills in |
| Q (17) | Top Quick Win ← Randi fills in |
| R (18) | Status (NEW → IN_PROGRESS → DONE) |

## How to Fetch New Leads
Use `GOOGLESHEETS_GET_VALUES` with:
- `spreadsheet_id`: `19hCNdwhOmqdgp1tqZl1AMyBmRL7ne3ZlsEoMKELz4A4`
- `range`: `Audit Leads!A2:R` (skip header row)

Filter rows where column R (index 17) equals `"NEW"` — those are unprocessed leads.

## How to Generate the Audit
For each NEW lead row, produce an AI Visibility Audit with the following sections:

### 1. Business Snapshot
- Business Name, Type, City, Website
- Contact: Name + Email
- Biggest Challenge (verbatim from form)

### 2. Lead Score (1–10)
Score based on:
- Local business type (higher score = more dependent on local search)
- Has a website (yes/no)
- Stated challenge suggests urgency
- City size / market competitiveness

### 3. Google Business Profile Assessment
- GBP Verified: Yes / No / Unknown
- GBP Rating: estimated or "needs verification"
- GBP Reviews: estimated count or "needs verification"
- Key GBP gaps to address

### 4. AI Overview Visibility
- Is the business likely cited in Google AI Overviews? (Yes / No / Unlikely)
- What would it take to get cited?

### 5. Top 3 Competitors
- List likely local competitors based on business type + city
- Note their estimated AI visibility advantage

### 6. Top Quick Win
- Single highest-impact action the business can take immediately
- Should be specific and actionable (e.g., "Claim and verify GBP listing", "Add FAQ schema markup to homepage", "Respond to all GBP reviews within 24h")

### 7. Recommended Next Step
- Invite the prospect to a discovery call or direct them to randi.agency/pricing

## How to Write Back to the Sheet
After generating the audit, use `GOOGLESHEETS_UPDATE_VALUES` to fill in columns I–R for that row:
- `spreadsheet_id`: `19hCNdwhOmqdgp1tqZl1AMyBmRL7ne3ZlsEoMKELz4A4`
- `range`: e.g., `Audit Leads!I{row}:R{row}` (replace {row} with the actual row number, starting at 2)
- Values: `[leadScore, gbpVerified, gbpRating, gbpReviews, aiOverview, competitor1, competitor2, competitor3, topQuickWin, "DONE"]`

## Trigger Phrases
When the user says any of the following, execute this pipeline:
- "process new leads"
- "run the audit pipeline"
- "check the sheet for new leads"
- "process audit leads"
- "generate audits"
- "what's in the sheet"

## Example Prompt to Self
"Read the Audit Leads tab from spreadsheet 19hCNdwhOmqdgp1tqZl1AMyBmRL7ne3ZlsEoMKELz4A4. Find all rows where Status is NEW. For each one, generate an AI Visibility Audit using the business details in columns B–H. Write the audit results back to columns I–Q and set Status to DONE."
