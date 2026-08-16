export function buildRemovalDraft({
  user,
  finding,
}) {
  const fullName =
    user.user_metadata?.full_name ||
    "Data subject";

  const date =
    new Date().toLocaleDateString(
      "en-GB"
    );

  /*
   * Convert internal identifier names into
   * natural wording for the removal request.
   */
  const personalDataDescription =
    finding.matched_identifiers?.length > 0
      ? finding.matched_identifiers
          .map((item) => {
            if (
              item.type === "email"
            ) {
              return "my email address";
            }

            if (
              item.type === "phone"
            ) {
              return "my phone number";
            }

            if (
              item.type === "fullName"
            ) {
              return "my name";
            }

            if (
              item.type ===
              "referencePhoto"
            ) {
              return "my photograph";
            }

            return "personal information relating to me";
          })
          .join(", ")
      : "personal information relating to me";

  return {
    subject:
      `Request for erasure of personal data - ${fullName}`,

    body:
`Date: ${date}

Dear Data Protection / Privacy Team,

I am writing to request the erasure of personal data relating to me that is accessible at the following URL:

${finding.url}

The personal data identified at this URL includes ${personalDataDescription}.

I am requesting erasure of this personal data under Article 17 of the UK GDPR, where the right to erasure applies.

Please assess this request in light of the relevant grounds for erasure and any applicable exemptions, and let me know the outcome of your assessment.

If you have reasonable grounds to verify my identity before processing this request, please request only the information that is reasonably necessary and proportionate for that purpose.

Please confirm receipt of this request and let me know if you require any further information reasonably necessary to assess it.

Kind regards,

${fullName}`
  };
}