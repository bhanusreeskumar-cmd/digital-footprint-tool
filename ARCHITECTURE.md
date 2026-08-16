# Architecture

User
-> React / Vite frontend
-> Supabase Auth
-> Supabase private Storage for temporary uploads
-> Express API
-> authentication / role middleware
-> documentary name verification with Tesseract.js
-> Vonage phone OTP verification
-> Brave Search API
-> Axios / Cheerio page retrieval
-> verified identifier detection + compromise.js
-> source-category classifier
-> ENISA-adapted risk scorer
-> Supabase persistence
-> SerpAPI Google Lens reference-image discovery
-> identifier-corroborated image filtering
-> pre-search identity review workflow
-> post-search ownership review workflow
-> removal-request draft generator

## Main processing stages

### 1. Authentication

Users authenticate through Supabase Auth.

The Express backend validates the Supabase access token before protected API requests are processed.

### 2. Identifier verification

Supported scan identifiers are:

- full name
- authenticated account email
- OTP-verified phone number
- optional reference photograph

Full-name searching requires documentary verification.

The uploaded identity document is processed using Tesseract.js OCR and compared with the registered account name. The temporary document is deleted after processing.

Email scanning is limited to the authenticated account email.

Phone ownership is verified through Vonage Verify.

A reference photograph cannot be searched independently. It must accompany at least one verified name, email address or phone number.

### 3. Pre-search identity gate

A submitted name is compared with the documentary-verified account name before any public-web search occurs.

Accepted variations include, for example:

- full documentary name
- first name + surname
- middle-name initials

A substantially different submitted name is blocked before discovery and recorded in `identity_reviews`.

No Brave Search or Google Lens request is performed for a blocked name.

### 4. Public-web discovery

Brave Search API is used to discover indexed public-web results.

Search scope is deliberately bounded by configurable per-query and per-scan limits.

Direct scraping is avoided for selected social-media domains.

### 5. Page retrieval and detection

Axios and Cheerio retrieve accessible HTML pages.

If direct retrieval is unavailable, indexed search snippets are used instead.

The detection service checks whether permitted verified identifiers are actually present in the title, snippet or retrieved page text.

`compromise.js` is used for lightweight extraction of nearby people, places and organisations.

### 6. Reference-image discovery

An optional reference photograph is uploaded to a private Supabase Storage bucket.

The backend creates a short-lived signed URL and sends it to Google Lens through SerpAPI.

Google Lens results are treated only as image candidates.

A candidate is discarded unless the associated page also contains at least one verified identifier supplied for that scan.

Even after identifier corroboration, image findings remain subject to manual ownership review because contextual identifier evidence does not prove that a particular person shown in an image is the account holder.

The uploaded reference photograph is deleted after image processing.

### 7. Risk scoring

Confirmed findings are classified by source context.

Risk is calculated using:

`SE = DPC × EI + CB`

where:

- DPC = data sensitivity / contextual sensitivity
- EI = ease of identification
- CB = contextual / exposure circumstances

Findings are mapped to:

- Low
- Medium
- High
- Very High

The UI exposes the score components, rationale and recommended action.

### 8. Ownership review

Two review workflows are separated.

#### Pre-search identity review

`identity_reviews`

Used when a submitted name does not sufficiently match the documentary-verified identity.

The public-web search is blocked before discovery.

#### Post-search finding review

`admin_reviews`

Used when a discovered finding cannot safely be treated as automatically verified, particularly reference-image findings.

Administrative routes are protected using backend role checks.

### 9. Removal assistance

Verified findings may be used to generate a user-facing Article 17 erasure-request draft.

Footprint does not automatically send the request.

Users may track the request through:

- draft
- sent
- acknowledged
- removed
- rejected

These are user-recorded tracking states rather than independently verified outcomes.

## Persistence and hosting

- Frontend: React / Vite
- Backend: Node / Express
- Authentication: Supabase Auth
- Database: Supabase Postgres
- Temporary file storage: private Supabase Storage
- Search discovery: Brave Search API
- Image discovery: SerpAPI Google Lens
- Phone verification: Vonage Verify
- Frontend hosting: Vercel
- Backend hosting: Railway

Stages are deliberately separated so discovery, verification, NLP, scoring and image-search components can be modified independently without rewriting the dashboard.
