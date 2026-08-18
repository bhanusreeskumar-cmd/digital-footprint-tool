# Footprint — MSc Digital Exposure Prototype

Footprint is a privacy-oriented MSc research prototype that helps authenticated users discover publicly indexed information associated with verified personal identifiers, assess the potential privacy risk of detected exposure, and prepare user-controlled removal-request drafts.

The system separates identity verification, public-web discovery, risk assessment and removal assistance so that each stage can be evaluated independently.

## Live deployment

**Application:**  
https://digital-footprint-tool.vercel.app

The React/Vite frontend is deployed on Vercel.

**Backend API host:**  
https://digital-footprint-tool-production.up.railway.app

The Express/Node.js backend is deployed on Railway and supports the application's API operations. The Railway URL is an API host rather than a standalone user interface, so visiting the root URL may return a response such as `Cannot GET /` if no root route is defined.

Authentication, database persistence and private file storage are provided by Supabase.

## Implemented

- React + Vite + Tailwind frontend
- Node.js + Express backend
- Supabase Authentication, PostgreSQL and private Storage
- Email/password registration with confirmation support
- Password-recovery workflow
- Documentary full-name verification using Tesseract.js OCR
- Authenticated account-email scanning
- Phone OTP verification using Vonage Verify
- Full-name variation checks
- Pre-search blocking of substantial name mismatches
- Explicit consent gate before scanning
- Brave Search API public-web discovery
- Bounded public-web search scope
- No direct scraping of selected social-media domains
- Axios + Cheerio retrieval for accessible ordinary web pages
- Indexed-snippet fallback when direct retrieval is unavailable
- compromise.js lightweight contextual entity extraction
- Source-category classification
- ENISA-adapted transparent risk scoring
- Low / Medium / High / Very High risk presentation
- Visible score components and risk rationale
- Recommended actions
- Scan history
- SerpAPI Google Lens reference-image discovery
- Identifier-corroborated image filtering
- Review-status handling for uncertain image ownership
- Removal-request draft generation
- Copy/download support for removal drafts
- Draft / sent / acknowledged / removed / rejected removal tracking
- Scaffolded administrative review interface and supporting routes
- Temporary deletion of uploaded identity documents and reference photographs

## Supported scan identifiers

The current prototype supports:

- documentary-verified full name
- authenticated account email
- OTP-verified phone number
- optional reference photograph

A reference photograph cannot be searched alone. It must accompany at least one verified name, email address or phone number.

## Documentary name verification

Before a name-based public-web scan can be performed, the account holder must complete documentary name verification.

The user uploads an identity document to a private Supabase Storage bucket.

The backend:

1. downloads the temporary document;
2. applies English OCR using Tesseract.js;
3. compares the recognised text with the registered account name;
4. records the documentary verification result; and
5. deletes the temporary document.

This is documentary name matching for the MSc prototype and should not be interpreted as full identity or KYC verification.

Permitted name variations include examples such as:

- `Maya Eleanor Thompson`
- `Maya E Thompson`
- `Maya Thompson`

A substantially different name is blocked before any public-web search occurs.

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

Google Lens visual results are treated only as candidates. A candidate is retained only when its associated page also contains a verified identifier supplied for that scan.

For example:

1. A reference-image candidate is returned by Google Lens.
2. The associated page contains a documentary-verified name or another verified identifier.
3. The candidate may then become a Footprint finding.

A visually similar image without identifier corroboration is discarded.

Corroborated image findings may be marked `needs_review` where ownership cannot be sufficiently established automatically.

The codebase contains a scaffolded administrative-review interface and supporting routes intended to support manual review in a future iteration. Full administrator-review integration is outside the evaluated core prototype.

This conservative approach prevents visual similarity alone from being treated as proof of identity.

The temporary reference photograph is deleted after image processing.

## Public-web discovery

Footprint uses the Brave Search API for indexed public-web discovery.

Searches may include:

- permitted name variations
- authenticated account email
- verified phone number
- selected combinations of verified identifiers

The search is bounded using configurable limits such as:

- `MAX_SEARCH_RESULTS_PER_QUERY`
- `MAX_PAGES_PER_SCAN`

The discovery layer is isolated from the rest of the application so that the search provider can be replaced without rewriting the remainder of the system.

## Page retrieval and identifier detection

Accessible ordinary HTML pages may be retrieved using Axios and parsed with Cheerio.

Selected social-media domains are not directly scraped.

If direct page retrieval is unavailable, the indexed search-engine title and snippet may be retained for identifier detection.

Only results satisfying the prototype's identifier-detection requirements are converted into findings.

## Risk model

Footprint uses the following transparent prototype exposure score:

`SE = DPC × EI + CB`

### DPC

**Data / contextual sensitivity**

The base score may be raised where the surrounding source context indicates potentially more sensitive information, such as financial or health-related content.

### EI

**Ease of identification**

Current values reflect the number of distinct matched identifiers:

- one identifier: `0.5`
- two identifiers: `0.75`
- three or more identifiers: `1`

### CB

**Exposure circumstances**

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
- risk level
- risk rationale
- recommended action

The classifier uses general source categories rather than relying solely on hard-coded websites.

Relevant implementation files include:

- `backend/src/services/sourceClassifier.js`
- `backend/src/services/riskService.js`

## Review handling

Footprint distinguishes between pre-search identity checking and post-search findings that may require additional review.

### Pre-search identity reviews

Pre-search review records are stored in:

`identity_reviews`

These may be created when a submitted name does not sufficiently match the documentary-verified name.

A substantially different name is prevented from proceeding automatically to public-web discovery.

### Post-search finding reviews

Review records for findings may be stored in:

`admin_reviews`

These are intended for findings where ownership cannot safely be confirmed automatically, particularly reference-image findings.

The codebase contains an administrative interface, supporting routes and backend role checks for this workflow. Full development, integration and evaluation of administrator review are outside the evaluated core prototype and are left for a future iteration.

## Removal requests

Removal-request drafts may be created for eligible findings whose ownership requirements have been satisfied.

The prototype can generate a user-facing removal-request draft that refers to the right to erasure under Article 17 UK GDPR where applicable.

Footprint does not automatically submit removal requests and does not guarantee that information will be removed.

Users retain control of the request and may copy or download the generated draft.

The prototype supports the following user-recorded workflow states:

- Draft
- Sent
- Acknowledged
- Removed
- Rejected

These statuses represent tracking information recorded by the user rather than independently verified actions by the organisation receiving the request.

## Supabase

The prototype uses Supabase for:

- authentication
- PostgreSQL persistence
- user profiles
- scans
- findings
- identity-review records
- administrative finding-review records
- removal requests
- temporary private file storage

Private storage buckets include:

- `name-verification-docs`
- `scan-images`

Temporary identity-verification documents and reference photographs are deleted after their relevant processing stage.

The reproducible database definition is stored in:

`supabase/schema.sql`

## Environment variables

Secrets and production credentials are not committed to the repository.

### Frontend

Example:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
```

### Backend

The backend requires environment variables for the services enabled in the prototype. These include Supabase and the external discovery and verification providers.

Use:

`backend/.env.example`

as the configuration template.

Do not commit a populated `.env` file, API credentials or private keys.

## Running locally

### Backend

From the repository root:

```bash
cd backend
npm install
npm run dev
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The Vite development server normally runs at:

`http://localhost:5173`

The local frontend must be configured to communicate with the local backend through the appropriate `VITE_API_URL`.

## Testing

Automated risk-scoring tests are located in:

`backend/tests/scoring.test.js`

The prototype was also functionally tested across core workflows including authentication, password recovery, identifier verification, scanning and deployed frontend/backend communication.

Functional developer testing was conducted separately from the ethics-approved usability evaluation.

The usability evaluation used predefined exposure scenarios and mock findings; research participants were not required to conduct live searches using their own personal identifiers.

## Prototype scope and limitations

Footprint is an MSc research prototype rather than a production identity-verification, legal-compliance or automated data-removal service.

Important limitations include:

- discovery is limited to information surfaced by the configured search provider and accessible public-web sources;
- selected social-media platforms are not directly scraped;
- documentary name matching is not equivalent to formal identity or KYC verification;
- reference-image discovery does not perform biometric facial recognition;
- risk scoring is a transparent prototype model rather than an externally validated measure of individual harm;
- removal-request drafts do not establish that a legal right to erasure necessarily applies in every case;
- removal requests are not automatically submitted;
- the administrator-review workflow is scaffolded but is outside the evaluated core prototype; and
- production-scale security, monitoring and identity-verification infrastructure would require further development.

## Deployment architecture

The deployed prototype uses:

- **Frontend:** React/Vite on Vercel
- **Backend:** Express/Node.js on Railway
- **Authentication, database and private storage:** Supabase
- **Public-web discovery:** Brave Search API
- **Page retrieval:** Axios + Cheerio
- **OCR:** Tesseract.js
- **Phone verification:** Vonage Verify
- **Reference-image discovery:** Google Lens through SerpAPI

A more detailed architectural description is available in:

`ARCHITECTURE.md`

## Research context

Footprint was developed as an MSc Computer Science research prototype concerned with digital-footprint discovery, interpretable privacy-risk assessment and user-controlled remediation.

The usability evaluation was conducted separately from live personal-data scanning. Participants evaluated predefined exposure scenarios and mock findings rather than submitting their own identifiers for public-web searches.

## Disclaimer

Footprint is an academic research prototype.

Risk classifications are informational prototype assessments and should not be interpreted as legal, financial, security or professional advice.

Generated removal-request drafts are provided to assist the user in preparing their own request. The user remains responsible for reviewing, editing and submitting any request.
