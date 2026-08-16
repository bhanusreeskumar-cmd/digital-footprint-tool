import nlp from "compromise";
import { compareNameVariant } from "./nameVerificationService.js";

function normalize(v = "") {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function exactContains(text, value) {
  return value
    ? normalize(text).includes(
        normalize(value)
      )
    : false;
}

function contextWindow(
  text,
  needle,
  radius = 300
) {
  if (!needle) {
    return text.slice(0, 600);
  }

  const normalizedText =
    normalize(text);

  const normalizedNeedle =
    normalize(needle);

  const i =
    normalizedText.indexOf(
      normalizedNeedle
    );

  if (i < 0) {
    return text.slice(0, 600);
  }

  return text.slice(
    Math.max(
      0,
      i - radius
    ),
    Math.min(
      text.length,
      i +
        needle.length +
        radius
    )
  );
}

/*
 * Build the same safe name variants
 * that may legitimately belong to the
 * documentary-verified account holder.
 *
 * Example:
 *
 * Bhanusree Sajith Kumar
 * Bhanusree S Kumar
 * Bhanusree Kumar
 */
function buildAcceptedNameVariants(
  verifiedName = "",
  submittedName = ""
) {
  const variants = [];

  const verifiedParts =
    verifiedName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (verifiedName) {
    variants.push(
      verifiedName.trim()
    );
  }

  if (
    verifiedParts.length >= 2
  ) {
    const first =
      verifiedParts[0];

    const last =
      verifiedParts[
        verifiedParts.length - 1
      ];

    /*
     * First + last.
     */
    variants.push(
      `${first} ${last}`
    );

    /*
     * First + middle initial(s) + last.
     */
    if (
      verifiedParts.length > 2
    ) {
      const initials =
        verifiedParts
          .slice(1, -1)
          .map(
            (part) =>
              part[0]
          )
          .filter(Boolean);

      if (
        initials.length
      ) {
        variants.push(
          `${first} ${initials.join(
            " "
          )} ${last}`
        );
      }
    }
  }

  /*
   * The submitted name has already passed
   * compareNameVariant() in scans.js, but
   * validate it again before including it.
   */
  if (
    submittedName &&
    compareNameVariant(
      verifiedName,
      submittedName
    ).allowed
  ) {
    variants.push(
      submittedName.trim()
    );
  }

  const seen =
    new Set();

  return variants.filter(
    (name) => {
      const key =
        normalize(name);

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

function findNameMatch(
  page,
  verifiedName,
  submittedName
) {
  if (
    !verifiedName ||
    !submittedName
  ) {
    return null;
  }

  const variants =
    buildAcceptedNameVariants(
      verifiedName,
      submittedName
    );

  const sources = [
    page.pageText || "",
    page.snippet || "",
    page.title || "",
  ];

  for (
    const variant of
      variants
  ) {
    const found =
      sources.some(
        (source) =>
          exactContains(
            source,
            variant
          )
      );

    if (found) {
      return variant;
    }
  }

  return null;
}

export function detectUserInformation(
  page,
  identifiers,
  verifiedName = ""
) {
  const text =
    page.pageText ||
    page.snippet ||
    "";

  const matched = [];

  /*
   * FULL NAME
   *
   * Detect any approved variation of the
   * documentary-verified name rather than
   * requiring only the exact submitted text.
   */
  if (
    identifiers.fullName &&
    verifiedName
  ) {
    const detectedName =
      findNameMatch(
        page,
        verifiedName,
        identifiers.fullName
      );

    if (detectedName) {
      matched.push({
        type:
          "fullName",

        /*
         * Keep the submitted name as the
         * identifier value for ownership/risk
         * consistency.
         */
        value:
          identifiers.fullName,

        /*
         * Record which variation actually
         * appeared on the result.
         */
        detectedValue:
          detectedName,
      });
    }
  }

  /*
   * VERIFIED ACCOUNT EMAIL
   */
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

  for (
    const email of
      emails
  ) {
    if (
      exactContains(
        text,
        email
      ) ||
      exactContains(
        page.snippet,
        email
      ) ||
      exactContains(
        page.title,
        email
      )
    ) {
      matched.push({
        type:
          "email",

        value:
          email,
      });
    }
  }

  /*
   * PHONE NUMBER
   */
  if (
    identifiers.phone &&
    (
      exactContains(
        text,
        identifiers.phone
      ) ||
      exactContains(
        page.snippet,
        identifiers.phone
      ) ||
      exactContains(
        page.title,
        identifiers.phone
      )
    )
  ) {
    matched.push({
      type:
        "phone",

      value:
        identifiers.phone,
    });
  }

  /*
   * Ignore result if none of the permitted
   * identifiers were actually detected.
   */
  if (!matched.length) {
    return null;
  }

  /*
   * Prefer the actual detected name
   * variation as the context anchor.
   */
  const nameMatch =
    matched.find(
      (item) =>
        item.type ===
        "fullName"
    );

  const anchor =
    nameMatch?.detectedValue ||
    nameMatch?.value ||
    matched[0].value;

  const local =
    contextWindow(
      text,
      anchor
    );

  const doc =
    nlp(local);

  return {
    matched,

    related: {
      people:
        doc
          .people()
          .out("array")
          .slice(0, 5),

      places:
        doc
          .places()
          .out("array")
          .slice(0, 5),

      organizations:
        doc
          .organizations()
          .out("array")
          .slice(0, 5),
    },

    evidenceText:
      local.slice(
        0,
        800
      ),
  };
}