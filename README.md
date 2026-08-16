# Footprint — MSc Digital Exposure Prototype

Footprint is a privacy-oriented MSc research prototype that allows authenticated users to search for publicly indexed information associated with verified personal identifiers, understand the potential risk of detected exposure, and prepare user-controlled removal-request drafts.

The project separates identity verification, public-web discovery, risk assessment and removal assistance so that each stage can be evaluated independently.

## Implemented

- React + Vite + Tailwind frontend
- Node / Express backend
- Supabase Auth, Postgres and private Storage
- Email/password registration with confirmation support
- Documentary full-name verification using Tesseract.js OCR
- Verified account-email scanning
- Phone OTP verification using Vonage Verify
- Full-name variation checks
- Pre-search identity review for substantial name mismatches
- Explicit consent gate before scanning
- Brave Search API discovery
- Bounded public-web search scope
- No direct scraping of selected social-media domains
- Axios + Cheerio retrieval for accessible ordinary web pages
- Indexed-snippet fallback when direct retrieval is unavailable
- compromise.js lightweight contextual entity extraction
- Source-category classification
- ENISA-adapted transparent risk scoring
- Low / Medium / High / Very High risk presentation
- Visible score components and rationale
- Recommended actions
- Scan history
- SerpAPI Google Lens reference-image discovery
- Identifier-corroborated image filtering
- Manual review workflow for uncertain image ownership
- Removal-request draft generation
- Copy / download support for removal drafts
- Draft / sent / acknowledged / removed / rejected tracking lifecycle
- Protected administrative review routes
- Temporary deletion of uploaded identity documents and reference photographs

## Supported scan identifiers

The current prototype supports:

- documentary-verified full name
- authenticated account email
- OTP-verified phone number
- optional reference photograph

A reference photograph cannot be searched alone.

It must accompany at least one verified name, email address or phone number.

## Documentary name verification

Before a name-based public-web scan can be performed, the account holder must complete documentary name verification.

The user uploads an identity document to a private Supabase Storage bucket.

The backend:

1. downloads the temporary document;
2. applies English OCR using Tesseract.js;
3. compares the recognised text with the registered account name;
4. records the documentary verification result;
5. deletes the temporary document.

This is documentary name matching for the MSc prototype and should not be interpreted as full identity / KYC verification.

Permitted name variations include examples such as:

- `Maya Eleanor Thompson`
- `Maya E Thompson`
- `Maya Thompson`

A substantially different name is blocked before any public-web search occurs and is recorded in the pre-search identity-review workflow.

## Email verification boundary

For the current prototype, email scans are restricted to the authenticated Supabase account email.

A user cannot submit an unrelated email address for scanning.

## Phone verification

Phone-number ownership is verified using Vonage Verify.

Verification state is held temporarily in backend memory.

This is suitable for the prototype but would normally be replaced by short-lived persistent server-side storage in a production implementation.

## Reference-image boundary

Reference-image discovery uses Google Lens through SerpAPI.

A submitted photograph is stored temporarily in the private `scan-images` bucket.

Google Lens visual results are treated only as candidates.

A candidate is retained only when its associated page also contains a verified identifier supplied for that scan.

For example:

reference image candidate

- # documentary-verified name on associated page
  candidate may become a Footprint finding

A visually similar image without identifier corroboration is discarded.

Even corroborated image findings remain `needs_review` until an authorised reviewer confirms ownership.

This conservative approach prevents visual similarity alone from being treated as proof of identity.

The temporary reference photograph is deleted after image processing.

## Public-web discovery

Footprint uses Brave Search API for indexed public-web discovery.

Searches may include:

- permitted name variations
- authenticated account email
- verified phone number
- selected combinations of verified identifiers

The search is bounded using configurable limits such as:

- `MAX_SEARCH_RESULTS_PER_QUERY`
- `MAX_PAGES_PER_SCAN`

The discovery layer is isolated from the rest of the application so the search provider can be replaced without rewriting the dashboard.

## Page retrieval

Accessible ordinary HTML pages may be retrieved using Axios and parsed with Cheerio.

Selected social-media domains are not directly scraped.

If direct page retrieval is unavailable, the indexed search-engine title and snippet are retained for identifier detection.

Only results containing permitted scan identifiers are converted into findings.

## Risk model

Footprint uses the following transparent prototype score:

`SE = DPC × EI + CB`

### DPC

Data / contextual sensitivity.

The base score is raised where the surrounding source context indicates potentially more sensitive information, such as financial or health-related content.

### EI

Ease of identification.

Current values reflect the number of distinct matched identifiers:

- one identifier: 0.5
- two identifiers: 0.75
- three or more identifiers: 1

### CB

Exposure circumstances.

The model considers source reach and an additional adjustment for exploitative personal-information aggregators.

### Risk tiers

- Low: `< 2`
- Medium: `2 to < 3`
- High: `3 to < 4`
- Very High: `>= 4`

The interface displays:

- DPC
- EI
- CB
- SE
- risk rationale
- recommended action

The classifier uses general source categories rather than relying only on hard-coded websites.

See:

`backend/src/services/sourceClassifier.js`

and:

`backend/src/services/riskService.js`

## Review workflows

Footprint contains two separate review mechanisms.

### Pre-search identity reviews

Stored in:

`identity_reviews`

These are created when a submitted name does not sufficiently match the documentary-verified name.

No public-web search is performed while the request is blocked.

### Post-search finding reviews

Stored in:

`admin_reviews`

These are used for findings where ownership cannot safely be automatically confirmed, particularly reference-image findings.

Administrative endpoints are protected by backend role checks.

Normal users cannot approve or reject their own ownership claims.

## Removal requests

Removal-request drafts may only be created for findings whose ownership status is `verified`.

The prototype generates a user-facing request referring to Article 17 UK GDPR where the right to erasure applies.

Footprint does not send requests automatically and does not guarantee removal.

Users may copy or download the draft and manually track the request as:

- Draft
- Sent
- Acknowledged
- Removed
- Rejected

These statuses represent user-recorded workflow states.

## Supabase

The prototype uses Supabase for:

- authentication
- PostgreSQL persistence
- profiles
- scans
- findings
- identity reviews
- administrative finding reviews
- removal requests
- temporary private file storage

Private storage buckets include:

- `name-verification-docs`
- `scan-images`

Temporary verification documents and reference photographs are deleted after processing.

The final reproducible database definition is stored in:

`supabase/schema.sql`

## Environment variables

### Frontend

Example:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
```
