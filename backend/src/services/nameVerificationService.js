import { createWorker } from "tesseract.js";
import { supabaseAdmin } from "../supabase.js";

/*
 * Normalize names for comparison.
 */
function normalizeName(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Split a name into tokens.
 *
 * Example:
 * "Bhanusree Sajith Kumar"
 * ->
 * ["bhanusree", "sajith", "kumar"]
 */
function nameTokens(value = "") {
  return normalizeName(value)
    .split(" ")
    .filter(Boolean);
}

/*
 * Determine whether a submitted name is a
 * reasonable variation of the verified name.
 *
 * Examples intended to pass:
 *
 * Bhanusree Sajith Kumar
 * Bhanusree S Kumar
 * Bhanusree Kumar
 *
 * Example intended to fail:
 *
 * Nikita Jose
 */
export function compareNameVariant(
  verifiedName,
  submittedName
) {
  const verified =
    nameTokens(verifiedName);

  const submitted =
    nameTokens(submittedName);

  if (
    verified.length < 2 ||
    submitted.length < 2
  ) {
    return {
      allowed: false,
      matchType: "insufficient_name_parts",
    };
  }

  /*
   * First and last names must match.
   */
  const verifiedFirst =
    verified[0];

  const verifiedLast =
    verified[
      verified.length - 1
    ];

  const submittedFirst =
    submitted[0];

  const submittedLast =
    submitted[
      submitted.length - 1
    ];

  if (
    verifiedFirst !== submittedFirst ||
    verifiedLast !== submittedLast
  ) {
    return {
      allowed: false,
      matchType: "major_mismatch",
    };
  }

  /*
   * Exact normalized match.
   */
  if (
    normalizeName(
      verifiedName
    ) ===
    normalizeName(
      submittedName
    )
  ) {
    return {
      allowed: true,
      matchType: "exact",
    };
  }

  /*
   * First + last name only.
   *
   * Example:
   * Bhanusree Kumar
   */
  if (
    submitted.length === 2
  ) {
    return {
      allowed: true,
      matchType:
        "middle_name_omitted",
    };
  }

  /*
   * If both have three or more parts,
   * compare the middle components.
   */
  const verifiedMiddle =
    verified.slice(
      1,
      -1
    );

  const submittedMiddle =
    submitted.slice(
      1,
      -1
    );

  /*
   * Exact middle-name sequence.
   */
  if (
    verifiedMiddle.join(" ") ===
    submittedMiddle.join(" ")
  ) {
    return {
      allowed: true,
      matchType:
        "middle_name_match",
    };
  }

  /*
   * Allow middle initials.
   *
   * Example:
   * verified:
   * Bhanusree Sajith Kumar
   *
   * submitted:
   * Bhanusree S Kumar
   */
  if (
    verifiedMiddle.length ===
    submittedMiddle.length
  ) {
    const middleMatches =
      verifiedMiddle.every(
        (
          verifiedPart,
          index
        ) => {
          const submittedPart =
            submittedMiddle[
              index
            ];

          if (
            verifiedPart ===
            submittedPart
          ) {
            return true;
          }

          if (
            submittedPart.length ===
              1 &&
            verifiedPart.startsWith(
              submittedPart
            )
          ) {
            return true;
          }

          return false;
        }
      );

    if (middleMatches) {
      return {
        allowed: true,
        matchType:
          "middle_initial",
      };
    }
  }

  return {
    allowed: false,
    matchType:
      "name_variation_not_allowed",
  };
}

/*
 * Find the registered account name inside
 * OCR text from the uploaded document.
 *
 * We are deliberately implementing
 * documentary name matching, not full KYC.
 */
function findRegisteredNameInText(
  text,
  registeredName
) {
  const normalizedText =
    normalizeName(text);

  const normalizedRegisteredName =
    normalizeName(
      registeredName
    );

  if (
    normalizedText.includes(
      normalizedRegisteredName
    )
  ) {
    return {
      matched: true,
      extractedName:
        registeredName,
      matchType:
        "exact_document_match",
    };
  }

  /*
   * Try looser token matching.
   *
   * Require at least first + last name
   * to appear in the OCR output.
   */
  const tokens =
    nameTokens(
      registeredName
    );

  if (
    tokens.length < 2
  ) {
    return {
      matched: false,
      extractedName: null,
      matchType:
        "registered_name_invalid",
    };
  }

  const first =
    tokens[0];

  const last =
    tokens[
      tokens.length - 1
    ];

  const firstFound =
    normalizedText.includes(
      first
    );

  const lastFound =
    normalizedText.includes(
      last
    );

  if (
    firstFound &&
    lastFound
  ) {
    return {
      matched: true,
      extractedName:
        registeredName,
      matchType:
        "first_last_document_match",
    };
  }

  return {
    matched: false,
    extractedName: null,
    matchType:
      "document_name_not_found",
  };
}

/*
 * Main documentary-name verification function.
 *
 * Flow:
 *
 * 1. Read profile.
 * 2. Download private ID image.
 * 3. OCR the image.
 * 4. Compare OCR text with registered full_name.
 * 5. Update profile if matched.
 * 6. Delete document regardless of outcome.
 */
export async function verifyNameDocument({
  userId,
  storagePath,
}) {
  if (
    !userId ||
    !storagePath
  ) {
    throw new Error(
      "User ID and document path are required."
    );
  }

  /*
   * Load registered profile name.
   */
  const {
    data: profile,
    error: profileError,
  } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, verified_name, name_verification_status"
    )
    .eq(
      "id",
      userId
    )
    .single();

  if (
    profileError ||
    !profile
  ) {
    throw new Error(
      "Profile could not be loaded."
    );
  }

  if (
    !profile.full_name
  ) {
    throw new Error(
      "No registered full name is available for this account."
    );
  }

  /*
   * Download the private document.
   */
  const {
    data: fileData,
    error: downloadError,
  } = await supabaseAdmin
    .storage
    .from(
      "name-verification-docs"
    )
    .download(
      storagePath
    );

  if (
    downloadError ||
    !fileData
  ) {
    throw new Error(
      downloadError?.message ||
      "Could not download verification document."
    );
  }

  /*
   * Convert Blob to Buffer for Tesseract.
   */
  const arrayBuffer =
    await fileData.arrayBuffer();

  const buffer =
    Buffer.from(
      arrayBuffer
    );

  let worker;

  try {
    /*
     * OCR
     */
    worker =
      await createWorker(
        "eng"
      );

    const {
      data: ocrData,
    } =
      await worker.recognize(
        buffer
      );

    const ocrText =
      ocrData?.text || "";

    /*
     * Documentary name match.
     */
    const documentMatch =
      findRegisteredNameInText(
        ocrText,
        profile.full_name
      );

    if (
      documentMatch.matched
    ) {
      const {
        error: updateError,
      } = await supabaseAdmin
        .from("profiles")
        .update({
          verified_name:
            profile.full_name,

          name_verification_status:
            "verified",

          name_verification_method:
            "documentary_name_match",

          name_verified_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          userId
        );

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      return {
        verified: true,
        verifiedName:
          profile.full_name,
        documentMatchType:
          documentMatch.matchType,
      };
    }

    /*
     * Record unsuccessful documentary match.
     */
    const {
      error: failedUpdateError,
    } = await supabaseAdmin
      .from("profiles")
      .update({
        verified_name:
          null,

        name_verification_status:
          "failed",

        name_verification_method:
          "documentary_name_match",

        name_verified_at:
          null,
      })
      .eq(
        "id",
        userId
      );

    if (
      failedUpdateError
    ) {
      throw new Error(
        failedUpdateError.message
      );
    }

    return {
      verified: false,
      verifiedName: null,
      documentMatchType:
        documentMatch.matchType,
    };
  } finally {
    /*
     * Always terminate OCR worker.
     */
    if (worker) {
      await worker.terminate();
    }

    /*
     * Always delete the uploaded ID.
     *
     * The document is temporary and should
     * not remain stored after processing.
     */
    const {
      error: removeError,
    } = await supabaseAdmin
      .storage
      .from(
        "name-verification-docs"
      )
      .remove([
        storagePath,
      ]);

    if (removeError) {
      console.error(
        "Could not delete temporary name-verification document:",
        removeError.message
      );
    }
  }
}