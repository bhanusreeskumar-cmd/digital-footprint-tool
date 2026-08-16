import axios from "axios";

const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
];

/*
 * Normalize a person's name.
 */
function normalizeName(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Generate safe name variants from the
 * documentary-verified name.
 *
 * Example:
 *
 * Bhanusree Sajith Kumar
 *
 * becomes:
 *
 * Bhanusree Sajith Kumar
 * Bhanusree S Kumar
 * Bhanusree Kumar
 *
 * We also include the submitted name if it
 * already passed the pre-search name gate.
 */
function buildNameVariants(
  verifiedName = "",
  submittedName = ""
) {
  const variants = [];

  const verified =
    normalizeName(
      verifiedName
    );

  const submitted =
    normalizeName(
      submittedName
    );

  /*
   * Documentary-verified full name.
   */
  if (verified) {
    variants.push(
      verifiedName.trim()
    );
  }

  const parts =
    verifiedName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  /*
   * Generate variants only when the
   * verified name has at least a
   * first and last component.
   */
  if (parts.length >= 2) {
    const first =
      parts[0];

    const last =
      parts[
        parts.length - 1
      ];

    /*
     * First + last.
     *
     * Example:
     * Bhanusree Kumar
     */
    variants.push(
      `${first} ${last}`
    );

    /*
     * First + middle initial(s) + last.
     *
     * Example:
     * Bhanusree S Kumar
     */
    if (parts.length > 2) {
      const middleInitials =
        parts
          .slice(1, -1)
          .map(
            (part) =>
              part[0]
          )
          .filter(Boolean);

      if (
        middleInitials.length
      ) {
        variants.push(
          `${first} ${middleInitials.join(
            " "
          )} ${last}`
        );
      }
    }
  }

  /*
   * The submitted name has already passed
   * compareNameVariant() in scans.js, so it
   * is safe to include as a search variant.
   */
  if (
    submitted &&
    submitted !== verified
  ) {
    variants.push(
      submittedName.trim()
    );
  }

  /*
   * Deduplicate case-insensitively.
   */
  const seen =
    new Set();

  return variants.filter(
    (name) => {
      const key =
        normalizeName(name);

      if (
        !key ||
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

function queryList(
  identifiers,
  verifiedName = ""
) {
  const queries = [];

  const emails =
    Array.isArray(
      identifiers.emails
    )
      ? identifiers.emails
          .map((email) =>
            email
              ?.trim()
              .toLowerCase()
          )
          .filter(Boolean)
      : [];

  /*
   * NAME QUERIES
   *
   * Use the verified identity name and
   * its permitted variations.
   */
  const nameVariants =
    identifiers.fullName
      ? buildNameVariants(
          verifiedName ||
            identifiers.fullName,
          identifiers.fullName
        )
      : [];

  for (
    const name of
      nameVariants
  ) {
    /*
     * Exact-phrase query.
     */
    queries.push(
      `"${name}"`
    );
  }

  /*
   * Add one broader unquoted query using
   * the documentary-verified full name.
   *
   * This helps discovery where search-engine
   * indexing contains punctuation or slightly
   * different formatting.
   *
   * detectionService.js still determines
   * whether a result actually contains an
   * accepted name variant.
   */
  if (
    verifiedName
  ) {
    queries.push(
      verifiedName
    );
  }

  /*
   * EMAIL QUERIES
   */
  for (
    const email of
      emails
  ) {
    queries.push(
      `"${email}"`
    );
  }

  /*
   * PHONE QUERY
   */
  if (
    identifiers.phone
  ) {
    queries.push(
      `"${identifiers.phone}"`
    );
  }

  /*
   * NAME + EMAIL COMBINATIONS
   *
   * These can provide much stronger
   * identity-specific results.
   */
  for (
    const name of
      nameVariants
  ) {
    for (
      const email of
        emails
    ) {
      queries.push(
        `"${name}" "${email}"`
      );
    }
  }

  /*
   * Deduplicate all queries.
   */
  const uniqueQueries = [
    ...new Set(
      queries
    ),
  ];

  /*
   * Keep API use bounded for the prototype.
   */
  return uniqueQueries.slice(
    0,
    10
  );
}

export async function discoverPublicResults(
  identifiers,
  verifiedName = ""
) {
  const apiKey =
    process.env
      .BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Brave Search API key is not configured."
    );
  }

  const allResults = [];

  const queries =
    queryList(
      identifiers,
      verifiedName
    );

  for (
    const query of
      queries
  ) {
    const response =
      await axios.get(
        "https://api.search.brave.com/res/v1/web/search",
        {
          params: {
            q:
              query,

            count:
              Number(
                process.env
                  .MAX_SEARCH_RESULTS_PER_QUERY ||
                  10
              ),

            safesearch:
              "moderate",
          },

          headers: {
            Accept:
              "application/json",

            "Accept-Encoding":
              "gzip",

            "X-Subscription-Token":
              apiKey,
          },

          timeout:
            15000,
        }
      );

    const results =
      response.data.web
        ?.results || [];

    for (
      const item of
        results
    ) {
      if (
        !item.url
      ) {
        continue;
      }

      let hostname;

      try {
        hostname =
          new URL(
            item.url
          ).hostname.replace(
            /^www\./,
            ""
          );
      } catch {
        continue;
      }

      const isSocialMedia =
        SOCIAL_HOSTS.some(
          (host) =>
            hostname ===
              host ||
            hostname.endsWith(
              `.${host}`
            )
        );

      allResults.push({
        title:
          item.title ||
          hostname,

        url:
          item.url,

        domain:
          hostname,

        snippet:
          item.description ||
          "",

        directScrapeAllowed:
          !isSocialMedia,

        discoveredBy:
          query,
      });
    }
  }

  /*
   * Deduplicate URLs that may have appeared
   * under several name variants.
   */
  const uniqueResults = [
    ...new Map(
      allResults.map(
        (result) => [
          result.url,
          result,
        ]
      )
    ).values(),
  ];

  const maxPages =
    Number(
      process.env
        .MAX_PAGES_PER_SCAN ||
        20
    );

  return uniqueResults.slice(
    0,
    maxPages
  );
}