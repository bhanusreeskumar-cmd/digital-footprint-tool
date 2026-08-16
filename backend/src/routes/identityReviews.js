import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

export const identityReviewsRouter = Router();

/*
 * GET /api/identity-reviews
 *
 * Returns only the currently authenticated user's
 * name-identity review requests.
 *
 * These are created when a submitted name is blocked
 * before public-web search because it differs too much
 * from the documentary-verified account name.
 */
identityReviewsRouter.get(
  "/",
  requireUser,
  async (req, res) => {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("identity_reviews")
      .select(
        `
        id,
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
 * GET /api/identity-reviews/:id
 *
 * Returns one identity-review request, but only
 * if it belongs to the authenticated user.
 */
identityReviewsRouter.get(
  "/:id",
  requireUser,
  async (req, res) => {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("identity_reviews")
      .select(
        `
        id,
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
        "id",
        req.params.id
      )
      .eq(
        "user_id",
        req.user.id
      )
      .single();

    if (
      error ||
      !data
    ) {
      return res.status(404).json({
        error:
          "Review request not found.",
      });
    }

    return res.json({
      review:
        data,
    });
  }
);