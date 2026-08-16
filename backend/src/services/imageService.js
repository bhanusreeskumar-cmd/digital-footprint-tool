import axios from "axios";
import { supabaseAdmin } from "../supabase.js";

export async function reverseImageSearch(
  userId,
  storagePath
) {
  if (!storagePath) {
    return [];
  }

  /*
   * Prevent a user from supplying a
   * reference-photo path belonging to
   * another account.
   */
  if (
    !storagePath.startsWith(
      `${userId}/`
    )
  ) {
    throw new Error(
      "Invalid reference photo path."
    );
  }

  const apiKey =
    process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error(
      "SERPAPI_KEY is not configured."
    );
  }

  /*
   * The scan-images bucket remains private.
   *
   * Google Lens needs a retrievable URL,
   * so create a short-lived signed URL.
   */
  const {
    data: signed,
    error: signedUrlError,
  } =
    await supabaseAdmin
      .storage
      .from("scan-images")
      .createSignedUrl(
        storagePath,
        300
      );

  if (
    signedUrlError ||
    !signed?.signedUrl
  ) {
    throw new Error(
      signedUrlError?.message ||
        "Could not create a temporary image URL."
    );
  }

  try {
    /*
     * GOOGLE LENS VISUAL MATCHES
     *
     * We deliberately retrieve visual candidates here.
     *
     * IMPORTANT:
     * These are NOT automatically treated as
     * Footprint findings.
     *
     * scans.js will later keep a candidate only
     * when the page also contains one of the
     * verified identifiers supplied for the scan.
     */
    const {
      data,
    } =
      await axios.get(
        "https://serpapi.com/search.json",
        {
          params: {
            engine:
              "google_lens",

            type:
              "visual_matches",

            url:
              signed.signedUrl,

            api_key:
              apiKey,

            safe:
              "active",
          },

          timeout:
            30000,
        }
      );

    /*
     * No Lens results is a valid outcome,
     * not a scan failure.
     */
    if (data?.error) {
      const message =
        String(
          data.error
        ).toLowerCase();

      if (
        message.includes(
          "hasn't returned any results"
        ) ||
        message.includes(
          "has not returned any results"
        ) ||
        message.includes(
          "no results"
        )
      ) {
        return [];
      }

      throw new Error(
        data.error
      );
    }

    const matches =
      data?.visual_matches ||
      [];

    /*
     * Convert Lens results into candidate
     * page objects.
     *
     * Note that imageMatchCandidate is used
     * instead of imageMatch.
     *
     * A result becomes imageMatch=true only
     * after scans.js confirms that the page
     * contains a verified scan identifier.
     */
    return matches
      .filter(
        (match) =>
          match?.link
      )
      .slice(
        0,
        20
      )
      .map(
        (match) => {
          let domain =
            "unknown";

          try {
            domain =
              new URL(
                match.link
              ).hostname.replace(
                /^www\./,
                ""
              );
          } catch {
            domain =
              match.source ||
              "unknown";
          }

          return {
            title:
              match.title ||
              match.source ||
              "Potential image match",

            url:
              match.link,

            domain,

            /*
             * Preserve text SerpAPI gives us.
             * scans.js can use this as part of
             * identifier confirmation.
             */
            snippet:
              [
                match.title,
                match.source,
              ]
                .filter(Boolean)
                .join(" "),

            /*
             * Candidate only.
             */
            imageMatchCandidate:
              true,

            /*
             * Some visual-match results are
             * marked by Google Lens as also
             * having exact matches.
             */
            exactImageMatch:
              match.exact_matches ===
              true,

            imageUrl:
              match.image ||
              match.thumbnail ||
              null,

            directScrapeAllowed:
              true,

            pageText:
              "",

            sourceMode:
              match.exact_matches
                ? "image-visual-and-exact-candidate"
                : "image-visual-candidate",
          };
        }
      );
  } finally {
    /*
     * The uploaded reference photo is temporary.
     */
    const {
      error: removeError,
    } =
      await supabaseAdmin
        .storage
        .from("scan-images")
        .remove([
          storagePath,
        ]);

    if (removeError) {
      console.error(
        "Could not delete temporary reference photo:",
        removeError.message
      );
    }
  }
}