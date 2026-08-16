import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { buildRemovalDraft } from "../services/removalService.js";

export const removalsRouter = Router();

/*
 * GET ALL REMOVAL REQUESTS
 */
removalsRouter.get(
  "/",
  requireUser,
  async (req, res) => {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("removal_requests")
      .select("*")
      .eq(
        "user_id",
        req.user.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json({
      requests: data || [],
    });
  }
);

/*
 * CREATE REMOVAL-REQUEST DRAFT
 */
removalsRouter.post(
  "/",
  requireUser,
  async (req, res) => {
    const {
      findingId,
    } = req.body;

    if (!findingId) {
      return res.status(400).json({
        error:
          "A finding ID is required.",
      });
    }

    /*
     * The finding must:
     *
     * - exist,
     * - belong to this user.
     */
    const {
      data: finding,
      error: findingError,
    } = await supabaseAdmin
      .from("findings")
      .select("*")
      .eq(
        "id",
        findingId
      )
      .eq(
        "user_id",
        req.user.id
      )
      .single();

    if (
      findingError ||
      !finding
    ) {
      return res.status(404).json({
        error:
          "Finding not found.",
      });
    }

    /*
     * Privacy safeguard:
     *
     * Footprint must not create a removal
     * request for information that has not
     * been verified as belonging to the user.
     */
    if (
      finding.ownership_status !==
      "verified"
    ) {
      return res.status(403).json({
        error:
          "Ownership must be verified before a removal-request draft can be created.",
      });
    }

    /*
     * Prevent several duplicate drafts from
     * being created for the same finding.
     */
    const {
      data: existingRequest,
      error:
        existingRequestError,
    } = await supabaseAdmin
      .from("removal_requests")
      .select("*")
      .eq(
        "finding_id",
        finding.id
      )
      .eq(
        "user_id",
        req.user.id
      )
      .maybeSingle();

    if (
      existingRequestError
    ) {
      return res.status(500).json({
        error:
          existingRequestError.message,
      });
    }

    if (
      existingRequest
    ) {
      return res.status(409).json({
        error:
          "A removal request already exists for this finding.",

        request:
          existingRequest,
      });
    }

    /*
     * Generate the user-facing draft.
     */
    const draft =
      buildRemovalDraft({
        user:
          req.user,

        finding,
      });

    const {
      data: request,
      error: insertError,
    } = await supabaseAdmin
      .from(
        "removal_requests"
      )
      .insert({
        user_id:
          req.user.id,

        finding_id:
          finding.id,

        target_domain:
          finding.domain,

        subject:
          draft.subject,

        draft_body:
          draft.body,

        status:
          "draft",
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({
        error:
          insertError.message,
      });
    }

    return res.json({
      request,
    });
  }
);

/*
 * UPDATE REMOVAL-REQUEST STATUS
 */
removalsRouter.patch(
  "/:id",
  requireUser,
  async (req, res) => {
    const {
      status,
    } = req.body;

    const allowedStatuses = [
      "draft",
      "sent",
      "acknowledged",
      "removed",
      "rejected",
    ];

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid status.",
      });
    }

    /*
     * Load the user's request first.
     */
    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from(
        "removal_requests"
      )
      .select("*")
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "user_id",
        req.user.id
      )
      .single();

    if (
      existingError ||
      !existing
    ) {
      return res.status(404).json({
        error:
          "Removal request not found.",
      });
    }

    /*
     * Only allow sensible status transitions.
     *
     * These statuses are user-recorded tracking
     * information. Footprint is not independently
     * confirming that a website acted on the request.
     */
    const transitions = {
      draft: [
        "sent",
      ],

      sent: [
        "acknowledged",
        "removed",
        "rejected",
      ],

      acknowledged: [
        "removed",
        "rejected",
      ],

      removed: [],

      rejected: [],
    };

    if (
      !transitions[
        existing.status
      ]?.includes(
        status
      )
    ) {
      return res.status(400).json({
        error:
          `Cannot change a removal request from ${existing.status} to ${status}.`,
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "removal_requests"
      )
      .update({
        status,
      })
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "user_id",
        req.user.id
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error:
          error.message,
      });
    }

    return res.json({
      request: data,
    });
  }
);