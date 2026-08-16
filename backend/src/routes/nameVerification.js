import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { verifyNameDocument } from "../services/nameVerificationService.js";
import { supabaseAdmin } from "../supabase.js";

export const nameVerificationRouter = Router();

/*
 * GET /api/name-verification/status
 *
 * Returns the current documentary name-verification
 * status for the authenticated user.
 */
nameVerificationRouter.get(
  "/status",
  requireUser,
  async (req, res) => {
    const {
      data: profile,
      error,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        full_name,
        verified_name,
        name_verification_status,
        name_verification_method,
        name_verified_at
        `
      )
      .eq(
        "id",
        req.user.id
      )
      .single();

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json({
      profile,
    });
  }
);

/*
 * POST /api/name-verification/verify
 *
 * Expected body:
 *
 * {
 *   storagePath: "USER_ID/file.jpg"
 * }
 *
 * The actual document has already been uploaded
 * to the private Supabase Storage bucket.
 *
 * This route:
 * 1. verifies that the path belongs to this user,
 * 2. passes it to the OCR/name-matching service,
 * 3. returns the verification result.
 */
nameVerificationRouter.post(
  "/verify",
  requireUser,
  async (req, res) => {
    const {
      storagePath,
    } = req.body;

    if (!storagePath) {
      return res.status(400).json({
        error:
          "A verification document path is required.",
      });
    }

    /*
     * Security check:
     * documents must live inside the logged-in
     * user's own storage folder.
     */
    const expectedPrefix =
      `${req.user.id}/`;

    if (
      !storagePath.startsWith(
        expectedPrefix
      )
    ) {
      return res.status(403).json({
        error:
          "This verification document does not belong to your account.",
      });
    }

    try {
      const result =
        await verifyNameDocument({
          userId:
            req.user.id,

          storagePath,
        });

      if (!result.verified) {
        return res.status(422).json({
          verified: false,

          error:
            "The name on the uploaded document could not be matched to the registered account name.",

          documentMatchType:
            result.documentMatchType,
        });
      }

      return res.json({
        verified: true,

        verifiedName:
          result.verifiedName,

        documentMatchType:
          result.documentMatchType,

        message:
          "Name verification completed successfully.",
      });
    } catch (error) {
      console.error(
        "Name verification error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Name verification failed.",
      });
    }
  }
);