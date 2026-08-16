import { compareNameVariant } from "./nameVerificationService.js";

export function assessOwnership({
  user,
  identifiers,
  phoneVerified,
  matchedIdentifiers,
  verifiedEmails = [],
  verifiedName = "",
}) {
  /*
   * Build a normalized set of email addresses
   * that the backend has already verified for
   * this account.
   */
  const verifiedEmailSet =
    new Set(
      verifiedEmails.map((email) =>
        email
          .trim()
          .toLowerCase()
      )
    );

  const checks = [];

  for (
    const matched of
      matchedIdentifiers
  ) {
    /*
     * EMAIL
     *
     * A matched email is considered owned only
     * when it is one of the verified emails
     * supplied by scans.js.
     */
    if (
      matched.type ===
      "email"
    ) {
      const matchedEmail =
        matched.value
          ?.trim()
          .toLowerCase();

      checks.push(
        verifiedEmailSet.has(
          matchedEmail
        )
      );
    }

    /*
     * PHONE
     *
     * phoneVerified is NOT supplied by the
     * browser as a trusted boolean.
     *
     * scans.js has already calculated it
     * server-side from the completed Vonage
     * verification request.
     */
    if (
      matched.type ===
      "phone"
    ) {
      checks.push(
        phoneVerified === true
      );
    }

    /*
     * FULL NAME
     *
     * Name ownership is now based on the
     * documentary-verified name stored in
     * the user's profile.
     *
     * The pre-search gate in scans.js has
     * already prevented major mismatches
     * from ever reaching public search.
     *
     * We repeat the comparison here so the
     * individual finding can also be marked
     * as verified.
     */
    if (
      matched.type ===
      "fullName"
    ) {
      if (
        !verifiedName ||
        !identifiers.fullName
      ) {
        checks.push(false);
      } else {
        const nameComparison =
          compareNameVariant(
            verifiedName,
            identifiers.fullName
          );

        checks.push(
          nameComparison.allowed ===
            true
        );
      }
    }

    /*
     * REFERENCE PHOTO
     *
     * A reverse-image match does not by itself
     * establish that the image belongs to the
     * account holder.
     *
     * Image findings therefore remain subject
     * to the separate manual-review workflow.
     */
    if (
      matched.type ===
      "referencePhoto"
    ) {
      checks.push(false);
    }
  }

  /*
   * A finding is verified only when every
   * identifier detected in that finding has
   * passed its corresponding ownership check.
   */
  const verified =
    checks.length > 0 &&
    checks.every(
      (result) =>
        result === true
    );

  return {
    verified,
  };
}