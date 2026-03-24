# Firehose Web Monitoring Skill

## Purpose
Monitor the web in real-time for signals relevant to the Randi Agency and its clients.
Use Firehose to track AI Overview appearances, competitor mentions, brand signals,
and local business news that affects client visibility.

## API Base URL
https://api.firehose.com

## Authentication
- Management key (fhm_ prefix): stored in FIREHOSE_MANAGEMENT_KEY env var — use to manage taps
- Tap token (fh_ prefix): stored in FIREHOSE_TAP_TOKEN env var — use to manage rules and stream

## Randi Agency Monitoring Rules to Create

### 1. AI Overview Monitoring
Track when Google AI Overviews mention local business categories:
`("AI overview" OR "AI overviews") AND ("local business" OR "near me" OR "plumber" OR "dentist" OR "restaurant") AND language:"en"`
Tag: `ai-overviews`

### 2. Competitor Agency Monitoring
Track mentions of competing AI/SEO agencies:
`("AI SEO" OR "AI visibility" OR "local SEO AI") AND page_category:"/News" AND language:"en"`
Tag: `competitor-intel`

### 3. Google Algorithm Updates
Track Google search algorithm news:
`(title:"google" OR title:"search") AND ("algorithm" OR "core update" OR "AI overview") AND page_category:"/News" AND language:"en"`
Tag: `google-updates`

### 4. Client Brand Monitoring (per client)
When onboarding a new client, create a rule:
`"[CLIENT_BUSINESS_NAME]" AND (domain:[CITY].com OR page_category:"/News")`
Tag: `client-[business-name]`

## How to Set Up a New Tap
1. Call FIREHOSE_CREATE_TAP with name "Randi Agency Monitor"
2. Save the returned tap token
3. Use the tap token to call FIREHOSE_CREATE_RULE for each rule above
4. Stream events with FIREHOSE_GET_STREAM

## How to Process Stream Events
When an update event arrives:
1. Extract document.url, document.title, document.markdown, matched query_id
2. Map query_id to the rule tag to understand what was matched
3. If tag is `google-updates`: summarize and alert via Telegram
4. If tag is `ai-overviews`: log to the Randi Agency Google Sheet for trend analysis
5. If tag is `competitor-intel`: summarize competitive intelligence
6. If tag is `client-*`: notify the relevant client contact

## Trigger Phrases
- "check firehose for updates"
- "what's new in the stream"
- "set up monitoring for [topic]"
- "create a firehose rule for [topic]"
- "monitor [business name] mentions"
