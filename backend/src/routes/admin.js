import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

export const adminRouter = Router();

/*
 * ==================================================
 * FINDING REVIEWS
 * ==================================================
 *
 * These are reviews created AFTER a legitimate scan,
 * for example an image finding that could not be
 * automatically linked to the account holder.
 */

/*
 * GET /api/admin/reviews
 */
adminRouter.get(
  "/reviews",
  requireAdmin,
  async (_req, res) => {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("admin_reviews")
      .select(
        `
        *,
        finding:findings(*)
        `
      )
      .in(
        "status",
        [
          "pending",
          "more_confirmation",
        ]
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (error) {
      return res.status(500).json({
        error:
          error.message,
      });
    }

    return res.json({
      reviews:
        data || [],
    });
  }
);

/*
 * PATCH /api/admin/reviews/:id
 */
adminRouter.patch(
  "/reviews/:id",
  requireAdmin,
  async (req, res) => {
    const {
      decision,
      note = "",
    } = req.body;

    const allowedDecisions = [
      "approved",
      "rejected",
      "more_confirmation",
    ];

    if (
      !allowedDecisions.includes(
        decision
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid decision.",
      });
    }

    const {
      data: existingReview,
      error:
        existingReviewError,
    } = await supabaseAdmin
      .from("admin_reviews")
      .select("*")
      .eq(
        "id",
        req.params.id
      )
      .single();

    if (
      existingReviewError ||
      !existingReview
    ) {
      return res.status(404).json({
        error:
          "Review not found.",
      });
    }

    if (
      existingReview.status ===
        "approved" ||
      existingReview.status ===
        "rejected"
    ) {
      return res.status(400).json({
        error:
          "This review has already been completed.",
      });
    }

    const {
      data: review,
      error: reviewError,
    } = await supabaseAdmin
      .from("admin_reviews")
      .update({
        status:
          decision,

        admin_note:
          note,

        reviewed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        req.params.id
      )
      .select()
      .single();

    if (reviewError) {
      return res.status(500).json({
        error:
          reviewError.message,
      });
    }

    let findingOwnershipStatus =
      "needs_review";

    if (
      decision ===
      "approved"
    ) {
      findingOwnershipStatus =
        "verified";
    }

    if (
      decision ===
      "rejected"
    ) {
      findingOwnershipStatus =
        "rejected";
    }

    const {
      data: finding,
      error: findingError,
    } = await supabaseAdmin
      .from("findings")
      .update({
        ownership_status:
          findingOwnershipStatus,
      })
      .eq(
        "id",
        review.finding_id
      )
      .select()
      .single();

    if (findingError) {
      return res.status(500).json({
        error:
          findingError.message,
      });
    }

    return res.json({
      review,
      finding,
    });
  }
);

/*
 * ==================================================
 * IDENTITY REVIEWS
 * ==================================================
 *
 * These are created BEFORE public-web search.
 *
 * Example:
 *
 * verified name:
 * Bhanusree Sajith Kumar
 *
 * submitted name:
 * Nikita Jose
 *
 * The search is blocked and an identity-review
 * request is created instead.
 */

/*
 * GET /api/admin/identity-reviews
 *
 * Returns pending pre-search identity reviews.
 */
adminRouter.get(
  "/identity-reviews",
  requireAdmin,
  async (_req, res) => {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("identity_reviews")
      .select(
        `
        id,
        user_id,
        submitted_name,
        verified_name,
        match_type,
        reason,
        status,
        search_performed,
        admin_note,
        created_at,
        reviewed_at
        `
      )
      .eq(
        "status",
        "pending"
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (error) {
      return res.status(500).json({
        error:
          error.message,
      });
    }

    return res.json({
      reviews:
        data || [],
    });
  }
);

/*
 * PATCH /api/admin/identity-reviews/:id
 *
 * An authorised admin may approve or reject
 * a blocked name request.
 */
adminRouter.patch(
  "/identity-reviews/:id",
  requireAdmin,
  async (req, res) => {
    const {
      decision,
      note = "",
    } = req.body;

    if (
      ![
        "approved",
        "rejected",
      ].includes(
        decision
      )
    ) {
      return res.status(400).json({
        error:
          "Identity review decision must be approved or rejected.",
      });
    }

    /*
     * Load the review first.
     */
    const {
      data: existingReview,
      error:
        existingReviewError,
    } = await supabaseAdmin
      .from("identity_reviews")
      .select("*")
      .eq(
        "id",
        req.params.id
      )
      .single();

    if (
      existingReviewError ||
      !existingReview
    ) {
      return res.status(404).json({
        error:
          "Identity review not found.",
      });
    }

    /*
     * Don't allow a finalised review
     * to be decided again.
     */
    if (
      existingReview.status !==
      "pending"
    ) {
      return res.status(400).json({
        error:
          "This identity review has already been completed.",
      });
    }

    const {
      data: review,
      error: reviewError,
    } = await supabaseAdmin
      .from("identity_reviews")
      .update({
        status:
          decision,

        admin_note:
          note,

        reviewed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        req.params.id
      )
      .select()
      .single();

    if (reviewError) {
      return res.status(500).json({
        error:
          reviewError.message,
      });
    }

    return res.json({
      review,
    });
  }
);