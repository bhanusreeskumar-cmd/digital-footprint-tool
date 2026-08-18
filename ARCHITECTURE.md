# Footprint Architecture

Footprint is a three-tier digital-footprint management prototype consisting of a React/Vite frontend, an Express/Node.js backend, and Supabase-based authentication, persistence and private storage.

The architecture separates identity verification, public-web discovery, identifier detection, risk assessment and removal assistance so that individual components can be modified or evaluated independently.

## High-level architecture

```text
User
│
├── React / Vite frontend
│   ├── Registration and authentication
│   ├── Password recovery
│   ├── Identifier verification
│   ├── Scan creation and consent
│   ├── Results and risk presentation
│   ├── Scan history
│   ├── Review-status presentation
│   └── Removal-request management
│
├── Supabase
│   ├── Authentication
│   ├── PostgreSQL persistence
│   ├── Row Level Security
│   └── Private Storage for temporary uploads
│
└── Express / Node.js API
    ├── Authentication and role middleware
    ├── Documentary name verification
    │   └── Tesseract.js OCR
    ├── Phone ownership verification
    │   └── Vonage Verify
    ├── Public-web discovery
    │   └── Brave Search API
    ├── Page retrieval
    │   └── Axios + Cheerio
    ├── Identifier detection
    │   └── Exact identifier checks + compromise.js
    ├── Source-category classification
    ├── ENISA-adapted risk scoring
    ├── Reference-image discovery
    │   └── SerpAPI Google Lens
    ├── Identifier-corroborated image filtering
    ├── Identity/review-status handling
    └── Removal-request draft generation
```

## Main processing stages

### 1. Authentication and account access

Users register and authenticate through Supabase Auth.

The React frontend obtains the authenticated Supabase session, while the Express backend validates the supplied Supabase access token before protected API requests are processed.

The authentication workflow supports:

- account registration;
- email/password sign-in;
- email confirmation where configured;
- protected application routes; and
- password recovery and password reset.

Application data is associated with the authenticated user so that one user cannot normally access another user's scans, findings or removal-request records.

Supabase Row Level Security provides an additional database-level access-control boundary for user-owned records.

### 2. Identifier verification

Footprint supports the following scan identifiers:

- documentary-verified full name;
- authenticated account email;
- OTP-verified phone number; and
- optional reference photograph.

Different ownership controls are applied depending on the identifier type.

#### Full name

Full-name searching requires documentary name verification.

The user temporarily uploads an identity document to private Supabase Storage. The backend processes the document using Tesseract.js OCR and compares the recognised text with the name registered to the account.

The temporary identity-document image is deleted after the verification process.

This mechanism provides documentary name matching for the research prototype. It is not intended to constitute formal identity verification or KYC.

#### Email address

Email scanning is restricted to the email address associated with the authenticated Supabase account.

An authenticated user cannot use the standard scan workflow to submit an unrelated email address.

#### Phone number

Phone-number ownership is verified using Vonage Verify.

An OTP is sent to the submitted number and must be successfully verified before the phone number can be used as a verified scan identifier.

The current prototype keeps relevant phone-verification state temporarily in backend memory. A production system would normally replace this with appropriately secured, short-lived persistent server-side state.

#### Reference photograph

A reference photograph is optional and cannot be searched independently.

It must accompany at least one verified name, email address or phone number.

### 3. Pre-search identity gate

For name-based scans, the submitted scan name is compared with the documentary-verified account name before public-web discovery occurs.

Permitted variations may include:

- the full documentary name;
- first name and surname; and
- permitted middle-name or initial variations.

For example, a verified name such as:

`Maya Eleanor Thompson`

may permit variants such as:

- `Maya Eleanor Thompson`
- `Maya E Thompson`
- `Maya Thompson`

A substantially different submitted name is prevented from proceeding automatically to public-web discovery.

A corresponding review record may be stored in:

`identity_reviews`

The purpose of this gate is to reduce the possibility of using Footprint to search for unrelated individuals.

No ordinary public-web discovery should proceed for a name that fails the required ownership check.

### 4. Public-web discovery

Footprint uses the Brave Search API for indexed public-web discovery.

Verified identifiers are converted into bounded search queries.

Queries may include:

- permitted name variations;
- authenticated account email;
- verified phone number; and
- selected combinations of verified identifiers.

Search scope is deliberately bounded using configurable limits such as:

- `MAX_SEARCH_RESULTS_PER_QUERY`
- `MAX_PAGES_PER_SCAN`

This limits the number of search results and pages processed during a scan.

The discovery service is separated from the remainder of the application so that the search provider can be replaced without redesigning the frontend or risk-assessment workflow.

### 5. Page retrieval and identifier detection

Candidate search results are not automatically treated as confirmed Footprint findings.

For accessible ordinary web pages, Axios is used for HTTP retrieval and Cheerio is used to parse the returned HTML.

Direct scraping is avoided for selected social-media domains.

Where direct page retrieval is unavailable or inappropriate, indexed search-result information such as the title and snippet may be used for identifier detection.

The detection stage checks whether permitted scan identifiers are present in the available candidate content.

`compromise.js` provides lightweight contextual entity extraction for nearby information such as people, places and organisations.

Only candidates satisfying the prototype's identifier-detection requirements are converted into findings.

This stage is deliberately separated from risk scoring: detection determines whether a candidate is sufficiently relevant to the verified scan identifiers, while the subsequent classification and scoring stages estimate the relative privacy risk of that finding.

### 6. Reference-image discovery

Reference-image discovery is an optional additional discovery stage.

The submitted reference photograph is uploaded temporarily to the private Supabase `scan-images` Storage bucket.

The backend creates a short-lived signed URL and supplies it to Google Lens through SerpAPI.

Google Lens results are treated only as image candidates.

The system does not treat visual similarity alone as proof that a person shown in an image is the authenticated user.

For example:

1. Google Lens returns a reference-image candidate.
2. Footprint examines the associated page or available indexed context.
3. The candidate must also be corroborated by at least one verified identifier supplied for the scan.
4. A candidate without sufficient identifier corroboration is discarded.
5. A corroborated candidate may become a Footprint finding or be marked as requiring additional review, depending on the available ownership evidence.

Footprint does not perform biometric facial recognition or face matching.

Contextual identifier corroboration also does not prove that a particular person visible in an image is the authenticated account holder. The codebase therefore contains review-status handling and a scaffolded administrative-review mechanism intended to support more conservative handling of uncertain image findings.

Full administrator-review integration is outside the evaluated core prototype and remains a future iteration.

The temporary reference photograph is deleted after image processing.

### 7. Source classification

Confirmed candidate findings are classified according to their source context.

Rather than relying solely on a large list of individually hard-coded websites, Footprint uses general source categories.

The classifier provides contextual information required by the risk-scoring stage, including characteristics associated with source reach and potentially exploitative personal-information aggregation.

The relevant implementation is located in:

`backend/src/services/sourceClassifier.js`

### 8. Risk scoring

Findings that pass the detection stage are assessed using an ENISA-adapted prototype exposure-risk model.

The score is calculated as:

`SE = DPC × EI + CB`

where:

- **DPC** = data/contextual sensitivity;
- **EI** = ease of identification; and
- **CB** = contextual/exposure circumstances.

DPC reflects the sensitivity of the information and surrounding context.

EI reflects how readily the matched identifiers may single out the user. In the current implementation, the value increases as additional distinct identifiers are matched.

CB reflects exposure circumstances such as source reach and may include an additional adjustment for exploitative personal-information aggregators.

The resulting score is mapped to one of four risk tiers:

- **Low:** `< 2`
- **Medium:** `2 to < 3`
- **High:** `3 to < 4`
- **Very High:** `>= 4`

The frontend presents:

- the overall risk level;
- DPC;
- EI;
- CB;
- SE;
- a risk rationale; and
- a recommended action.

The purpose of exposing these components is to make the prototype's assessment more interpretable than a risk label or colour alone.

The relevant implementation is located in:

`backend/src/services/riskService.js`

### 9. Persistence

Supabase PostgreSQL provides persistence for application records.

Persisted data includes records associated with:

- user profiles;
- scans;
- findings;
- identity-review status;
- finding-review status; and
- removal requests.

User-owned records are associated with authenticated Supabase users.

Row Level Security is used as a database-level control to restrict access to appropriate user-owned data.

Private Supabase Storage is used for temporary identity-document and reference-image processing.

Temporary verification images are deleted following the relevant processing stage rather than being retained as ordinary scan-history content.

### 10. Review handling

Footprint distinguishes between two forms of review-related handling.

#### Pre-search identity review

Relevant records are stored in:

`identity_reviews`

This mechanism is associated with cases where a submitted name does not sufficiently match the documentary-verified account identity.

The important security boundary occurs before public-web discovery: a substantially mismatched name is not permitted to proceed automatically to a normal name-based search.

#### Post-search finding review

Review-related records for uncertain findings may be stored in:

`admin_reviews`

This mechanism is intended particularly for findings, such as some reference-image candidates, where contextual evidence is insufficient to establish ownership automatically.

The codebase contains an administrative interface, supporting routes and backend role checks intended for this workflow.

However, full development, integration and evaluation of administrator review are outside the evaluated core prototype and are left for a future iteration.

The primary evaluated Footprint workflow therefore remains centred on authenticated user discovery, risk interpretation and user-controlled remediation.

### 11. Removal assistance

Eligible findings can be used to generate a user-facing removal-request draft.

Where applicable, the generated draft may refer to the right to erasure under Article 17 UK GDPR.

Footprint does not automatically submit removal requests and does not guarantee that a request will result in removal.

The generated text remains under user control and can be reviewed, edited, copied or downloaded before the user decides whether to contact the relevant organisation.

Removal requests can be tracked using the following user-recorded states:

- Draft
- Sent
- Acknowledged
- Removed
- Rejected

These statuses represent workflow states recorded by the user. They should not be interpreted as independently verified responses or actions by the organisation receiving a removal request.

## Core user workflow

The primary implemented and evaluated workflow can be summarised as:

```text
Register / Sign in
        │
        ▼
Verify identifier ownership
        │
        ▼
Provide explicit scan consent
        │
        ▼
Create bounded discovery queries
        │
        ▼
Brave Search public-web discovery
        │
        ▼
Retrieve accessible pages / indexed snippets
        │
        ▼
Detect verified identifiers
        │
        ▼
Classify source context
        │
        ▼
Calculate risk score
        │
        ▼
Present findings + rationale + recommended action
        │
        ├── View in scan history
        │
        └── Generate user-controlled removal-request draft
```

Where a reference photograph is supplied, the optional image-discovery stage supplements rather than replaces the verified-identifier workflow:

```text
Verified identifier(s)
        +
Reference photograph
        │
        ▼
Temporary private upload
        │
        ▼
Google Lens via SerpAPI
        │
        ▼
Image candidates
        │
        ▼
Associated-page identifier corroboration
        │
        ├── No corroboration → discard
        │
        └── Corroboration → finding / review-status handling
```

## Security and privacy boundaries

The prototype applies several safeguards intended to reduce misuse and unnecessary personal-data processing:

- protected API routes require authenticated Supabase sessions;
- email scanning is restricted to the authenticated account email;
- name-based searching requires documentary name verification;
- substantially different names are blocked before ordinary public-web discovery;
- phone scanning requires OTP verification;
- reference photographs cannot be searched independently;
- image candidates require corroboration using verified identifiers;
- selected social-media domains are not directly scraped;
- public-web discovery is bounded;
- identity documents and reference photographs are stored privately and deleted after their relevant processing stage;
- removal requests are generated as user-controlled drafts rather than automatically submitted;
- user-owned application records are protected using authentication and database-level access controls; and
- secrets and service credentials are supplied through environment variables rather than committed to source control.

These controls reduce risk but should not be interpreted as production-grade identity verification or a complete security assurance framework.

## Deployment architecture

The deployed prototype uses the following infrastructure:

```text
User's browser
      │
      ▼
Vercel
React / Vite frontend
      │
      ├──────────────► Supabase Auth
      │
      ▼
Railway
Express / Node.js API
      │
      ├──────────────► Supabase Postgres
      │
      ├──────────────► Supabase private Storage
      │
      ├──────────────► Brave Search API
      │
      ├──────────────► Vonage Verify
      │
      └──────────────► SerpAPI / Google Lens
```

Deployment components:

- **Frontend:** React / Vite
- **Frontend hosting:** Vercel
- **Backend:** Node.js / Express
- **Backend hosting:** Railway
- **Authentication:** Supabase Auth
- **Database:** Supabase PostgreSQL
- **Temporary private file storage:** Supabase Storage
- **Public-web discovery:** Brave Search API
- **Page retrieval:** Axios + Cheerio
- **Contextual NLP:** compromise.js
- **Document OCR:** Tesseract.js
- **Phone verification:** Vonage Verify
- **Reference-image discovery:** Google Lens through SerpAPI

## Architectural boundaries and limitations

The architecture reflects the scope of an MSc research prototype rather than a production privacy-management service.

In particular:

- public-web discovery is dependent on the coverage of the configured search provider;
- selected social-media platforms are not directly scraped;
- inaccessible pages may limit identifier detection;
- documentary name matching is not equivalent to formal identity or KYC verification;
- phone-verification state is temporarily held in backend memory;
- reference-image discovery does not perform biometric facial recognition;
- contextual identifier corroboration cannot by itself prove ownership of a person shown in an image;
- the risk model is a transparent prototype assessment rather than an externally validated measure of individual harm;
- removal-request generation does not establish that Article 17 applies in every individual case;
- Footprint does not automatically submit removal requests;
- administrator-review functionality is scaffolded but is outside the evaluated core prototype; and
- production deployment would require further security testing, monitoring, auditing and data-protection assessment.

## Design rationale

The system is deliberately modular.

Discovery, verification, page retrieval, identifier detection, contextual NLP, source classification, risk scoring, image discovery and removal assistance are separated into distinct stages and backend services.

This allows individual components to be modified or replaced without requiring the complete dashboard and user workflow to be rewritten.

The central architecture therefore supports the primary objective of Footprint: combining controlled digital-footprint discovery with interpretable privacy-risk assessment and user-directed remediation while maintaining explicit ownership and consent boundaries.
