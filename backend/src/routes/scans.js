import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { discoverPublicResults } from "../services/searchService.js";
import { retrievePages } from "../services/scrapeService.js";
import { detectUserInformation } from "../services/detectionService.js";
import { classifySource } from "../services/sourceClassifier.js";
import { scoreFinding } from "../services/riskService.js";
import { assessOwnership } from "../services/ownershipService.js";
import { reverseImageSearch } from "../services/imageService.js";
import { isPhoneVerificationValid } from "./phoneVerification.js";
import { compareNameVariant } from "../services/nameVerificationService.js";

export const scansRouter = Router();

/*
 * CREATE A NEW SCAN
 */
scansRouter.post(
  "/",
  requireUser,
  async (req, res) => {
    const {
      identifiers = {},
      consent,
      phoneVerificationRequestId = null,
      referencePhotoPath = null,
    } = req.body;

    /*
     * Explicit consent is required.
     */
    if (consent !== true) {
      return res.status(400).json({
        error:
          "Explicit consent is required.",
      });
    }

    /*
     * NORMALIZE EMAILS
     */
    const submittedEmails =
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

    identifiers.emails = [
      ...new Set(
        submittedEmails
      ),
    ];

    /*
     * NORMALIZE OTHER IDENTIFIERS
     */
    identifiers.fullName =
      identifiers.fullName
        ?.trim() || "";

    identifiers.phone =
      identifiers.phone
        ?.trim() || "";

    /*
     * --------------------------------------------------
     * PRIMARY IDENTIFIER REQUIREMENT
     * --------------------------------------------------
     *
     * A reference photo cannot be searched alone.
     *
     * It must accompany:
     *
     * - documentary-verified name,
     * - authenticated account email,
     * - OTP-verified phone.
     */
    const hasPrimaryIdentifier =
      Boolean(
        identifiers.fullName
      ) ||
      identifiers.emails.length >
        0 ||
      Boolean(
        identifiers.phone
      );

    if (!hasPrimaryIdentifier) {
      if (referencePhotoPath) {
        return res.status(403).json({
          error:
            "Reference-photo searches require at least one verified name, email address, or phone number.",
        });
      }

      return res.status(400).json({
        error:
          "Provide at least one identifier.",
      });
    }

    /*
     * --------------------------------------------------
     * EMAIL OWNERSHIP
     * --------------------------------------------------
     */
    const accountEmail =
      req.user.email
        ?.trim()
        .toLowerCase() || "";

    if (
      identifiers.emails.length >
      1
    ) {
      return res.status(403).json({
        error:
          "For this prototype, email scans are limited to the verified email address associated with your account.",
      });
    }

    if (
      identifiers.emails.length ===
        1 &&
      identifiers.emails[0] !==
        accountEmail
    ) {
      return res.status(403).json({
        error:
          "For this prototype, email scans are limited to the verified email address associated with your account.",
      });
    }

    const verifiedEmails =
      accountEmail
        ? [accountEmail]
        : [];

    /*
     * --------------------------------------------------
     * FULL-NAME OWNERSHIP GATE
     * --------------------------------------------------
     *
     * Runs before Brave or Google Lens.
     */
    let verifiedName = "";

    if (identifiers.fullName) {
      const {
        data: profile,
        error: profileError,
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

      if (
        profileError ||
        !profile
      ) {
        return res.status(500).json({
          error:
            "The account profile could not be loaded for name verification.",
        });
      }

      if (
        profile.name_verification_status !==
          "verified" ||
        !profile.verified_name
      ) {
        return res.status(403).json({
          code:
            "NAME_VERIFICATION_REQUIRED",

          error:
            "Documentary name verification is required before a name-based scan can be performed.",

          searchPerformed:
            false,
        });
      }

      verifiedName =
        profile.verified_name;

      const nameComparison =
        compareNameVariant(
          verifiedName,
          identifiers.fullName
        );

      /*
       * Major name mismatch:
       *
       * - create review request,
       * - do not create scan,
       * - do not run Brave,
       * - do not run Lens.
       */
      if (!nameComparison.allowed) {
        const reviewReason =
          "The submitted name does not sufficiently match the documentary-verified name for this account. No public-web search has been performed.";

        const {
          data: identityReview,
          error:
            identityReviewError,
        } = await supabaseAdmin
          .from("identity_reviews")
          .insert({
            user_id:
              req.user.id,

            submitted_name:
              identifiers.fullName,

            verified_name:
              verifiedName,

            match_type:
              nameComparison.matchType,

            reason:
              reviewReason,

            status:
              "pending",

            search_performed:
              false,
          })
          .select()
          .single();

        if (
          identityReviewError
        ) {
          return res.status(500).json({
            error:
              identityReviewError.message,
          });
        }

        return res.status(403).json({
          code:
            "NAME_REVIEW_REQUIRED",

          error:
            reviewReason,

          searchPerformed:
            false,

          matchType:
            nameComparison.matchType,

          reviewId:
            identityReview.id,
        });
      }
    }

    /*
     * --------------------------------------------------
     * PHONE OWNERSHIP
     * --------------------------------------------------
     */
    let phoneVerified =
      false;

    if (identifiers.phone) {
      phoneVerified =
        isPhoneVerificationValid({
          requestId:
            phoneVerificationRequestId,

          userId:
            req.user.id,

          phone:
            identifiers.phone,
        });

      if (!phoneVerified) {
        return res.status(403).json({
          error:
            "This phone number has not been successfully verified for your account.",
        });
      }
    }

    /*
     * --------------------------------------------------
     * CREATE SCAN
     * --------------------------------------------------
     */
    const {
      data: scan,
      error: scanError,
    } = await supabaseAdmin
      .from("scans")
      .insert({
        user_id:
          req.user.id,

        status:
          "running",

        consent_given_at:
          new Date().toISOString(),

        identifiers: {
          ...(identifiers.fullName
            ? {
                fullName:
                  identifiers.fullName,
              }
            : {}),

          ...(identifiers
            .emails.length
            ? {
                emails:
                  identifiers.emails,
              }
            : {}),

          ...(identifiers.phone
            ? {
                phone:
                  identifiers.phone,
              }
            : {}),
        },
      })
      .select()
      .single();

    if (scanError) {
      return res.status(500).json({
        error:
          scanError.message,
      });
    }

    try {
      /*
       * ------------------------------------------------
       * STAGE 1
       * NORMAL WEB DISCOVERY
       * ------------------------------------------------
       */
      const searchResults =
        await discoverPublicResults(
          identifiers,
          verifiedName
        );

      /*
       * Retrieve ordinary web pages.
       */
      const pages =
        await retrievePages(
          searchResults
        );

      /*
       * ------------------------------------------------
       * STAGE 2
       * IMAGE DISCOVERY
       * ------------------------------------------------
       *
       * reverseImageSearch() now returns only
       * IMAGE CANDIDATES.
       *
       * They must not automatically become
       * Footprint findings.
       */
      const imageCandidates =
        referencePhotoPath
          ? await reverseImageSearch(
              req.user.id,
              referencePhotoPath
            )
          : [];

      /*
       * ------------------------------------------------
       * STAGE 3
       * VERIFY IMAGE CANDIDATE CONTEXT
       * ------------------------------------------------
       *
       * Fetch the pages associated with Lens
       * candidates.
       *
       * scrapeService.js will use actual page text
       * when possible, or the indexed snippet/title
       * when scraping is unavailable.
       */
      const retrievedImageCandidates =
        imageCandidates.length
          ? await retrievePages(
              imageCandidates
            )
          : [];

      const confirmedImageResults =
        [];

      for (
        const candidate of
          retrievedImageCandidates
      ) {
        /*
         * This checks whether the candidate page
         * contains at least one verified identifier
         * that was actually included in this scan.
         *
         * Examples:
         *
         * Bhanusree Sajith Kumar
         * verified account email
         * OTP-verified phone
         */
        const identifierDetection =
          detectUserInformation(
            candidate,
            identifiers,
            verifiedName
          );

        /*
         * No verified scan identifier appears on
         * the candidate page.
         *
         * Discard the image result completely.
         */
        if (
          !identifierDetection
        ) {
          continue;
        }

        /*
         * Keep the candidate only now.
         */
        confirmedImageResults.push({
          ...candidate,

          imageMatch:
            true,

          imageMatchCandidate:
            false,

          /*
           * Preserve the verified identifiers that
           * justified keeping this image candidate.
           */
          confirmedIdentifierDetection:
            identifierDetection,

          sourceMode:
            candidate.exactImageMatch
              ? "image-exact-plus-verified-identifier"
              : "image-visual-plus-verified-identifier",
        });
      }

      /*
       * Only confirmed image candidates enter the
       * finding pipeline.
       */
      const candidates = [
        ...pages,
        ...confirmedImageResults,
      ];

      const findings = [];

      /*
       * ------------------------------------------------
       * STAGE 4
       * DETECTION + SCORING + PERSISTENCE
       * ------------------------------------------------
       */
      for (
        const page of
          candidates
      ) {
        let detection;

        /*
         * CONFIRMED IMAGE RESULT
         *
         * The page contains both:
         *
         * - the reference-image association, AND
         * - at least one verified scan identifier.
         */
        if (page.imageMatch) {
          const identifierDetection =
            page
              .confirmedIdentifierDetection;

          detection = {
            matched: [
              ...(
                identifierDetection
                  ?.matched || []
              ),

              {
                type:
                  "referencePhoto",

                value:
                  "[image]",
              },
            ],

            related:
              identifierDetection
                ?.related || {},

            evidenceText:
              identifierDetection
                ?.evidenceText ||
              page.snippet ||
              "",
          };
        }

        /*
         * ORDINARY WEB RESULT
         */
        else {
          detection =
            detectUserInformation(
              page,
              identifiers,
              verifiedName
            );
        }

        if (!detection) {
          continue;
        }

        /*
         * ------------------------------------------------
         * FINDING OWNERSHIP
         * ------------------------------------------------
         */
        const ownership =
          assessOwnership({
            user:
              req.user,

            identifiers,

            phoneVerified,

            matchedIdentifiers:
              detection.matched,

            verifiedEmails,

            verifiedName,
          });

        /*
         * Source classification.
         */
        const sourceRule =
          classifySource(page);

        /*
         * Risk scoring.
         */
        const score =
          scoreFinding(
            detection,
            sourceRule
          );

        /*
         * Image findings intentionally remain
         * needs_review because a visual association
         * is not sufficient to establish that the
         * person shown is definitely the account holder.
         *
         * assessOwnership() already treats
         * referencePhoto as unverified, so this
         * naturally becomes needs_review.
         */
        const ownershipStatus =
          ownership.verified
            ? "verified"
            : "needs_review";

        const matchedTypes =
          detection.matched.map(
            (item) =>
              item.type
          );

        /*
         * IMAGE SUMMARY
         */
        let summary;

        if (page.imageMatch) {
          const supportingTypes =
            detection.matched
              .filter(
                (item) =>
                  item.type !==
                  "referencePhoto"
              )
              .map(
                (item) =>
                  item.type
              );

          const matchStrength =
            page.exactImageMatch
              ? "Exact reference-photo match"
              : "Potential reference-photo match";

          summary =
            `${matchStrength} found on ${page.domain}` +
            (
              supportingTypes.length
                ? ` alongside ${supportingTypes.join(
                    " + "
                  )}`
                : ""
            );
        } else {
          summary =
            `${matchedTypes.join(
              " + "
            )} found on ${page.domain}`;
        }

        /*
         * SAVE FINDING
         */
        const {
          data: finding,
          error: findingError,
        } = await supabaseAdmin
          .from("findings")
          .insert({
            scan_id:
              scan.id,

            user_id:
              req.user.id,

            url:
              page.url,

            domain:
              page.domain,

            title:
              page.title,

            summary,

            matched_identifiers:
              detection.matched,

            source_category:
              sourceRule.category,

            source_mode:
              page.sourceMode,

            dpc:
              score.dpc,

            ei:
              score.ei,

            cb:
              score.cb,

            severity_score:
              score.severity,

            risk_level:
              score.level,

            risk_reason:
              score.reason,

            score_explanation:
              score.explanation,

            recommended_action:
              score.recommendedAction,

            ownership_status:
              ownershipStatus,
          })
          .select()
          .single();

        if (findingError) {
          throw findingError;
        }

        findings.push(
          finding
        );

        /*
         * ------------------------------------------------
         * ADMIN REVIEW
         * ------------------------------------------------
         */
        if (
          ownershipStatus ===
          "needs_review"
        ) {
          let reviewReason;

          if (page.imageMatch) {
            const supportingIdentifiers =
              detection.matched
                .filter(
                  (item) =>
                    item.type !==
                    "referencePhoto"
                )
                .map(
                  (item) =>
                    item.type
                );

            reviewReason =
              `A reference-photo match was returned on a page that also contains verified scan identifier(s): ${supportingIdentifiers.join(
                ", "
              )}. ` +
              `The page passed the identifier filter, but the image association still requires manual confirmation before ownership is treated as verified.`;
          } else {
            reviewReason =
              "One or more identifiers in this finding could not be independently verified.";
          }

          const {
            error:
              reviewError,
          } = await supabaseAdmin
            .from(
              "admin_reviews"
            )
            .insert({
              user_id:
                req.user.id,

              finding_id:
                finding.id,

              reason:
                reviewReason,

              status:
                "pending",
            });

          if (reviewError) {
            throw reviewError;
          }
        }
      }

      /*
       * ------------------------------------------------
       * MARK SCAN COMPLETE
       * ------------------------------------------------
       */
      const {
        error:
          completionError,
      } = await supabaseAdmin
        .from("scans")
        .update({
          status:
            "completed",

          completed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          scan.id
        );

      if (
        completionError
      ) {
        throw completionError;
      }

      return res.json({
        scan: {
          ...scan,

          status:
            "completed",
        },

        findingCount:
          findings.length,

        /*
         * Useful for prototype testing.
         *
         * This lets us tell whether Lens returned
         * candidates that were later filtered out.
         */
        imageCandidateCount:
          imageCandidates.length,

        confirmedImageCount:
          confirmedImageResults.length,
      });
    } catch (error) {
      /*
       * Preserve failed scan for debugging/history.
       */
      await supabaseAdmin
        .from("scans")
        .update({
          status:
            "failed",

          error_message:
            error.message,
        })
        .eq(
          "id",
          scan.id
        );

      return res
        .status(500)
        .json({
          error:
            error.message,
        });
    }
  }
);

/*
 * --------------------------------------------------
 * GET SCAN HISTORY
 * --------------------------------------------------
 */
scansRouter.get(
  "/",
  requireUser,
  async (req, res) => {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("scans")
      .select(
        "id,created_at,status,completed_at"
      )
      .eq(
        "user_id",
        req.user.id
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (error) {
      return res
        .status(500)
        .json({
          error:
            error.message,
        });
    }

    const ids =
      data.map(
        (scan) =>
          scan.id
      );

    const {
      data: counts,
    } = ids.length
      ? await supabaseAdmin
          .from(
            "findings"
          )
          .select(
            "scan_id"
          )
          .in(
            "scan_id",
            ids
          )
      : {
          data: [],
        };

    const countMap = {};

    for (
      const row of
        counts || []
    ) {
      countMap[
        row.scan_id
      ] =
        (
          countMap[
            row.scan_id
          ] || 0
        ) + 1;
    }

    return res.json({
      scans:
        data.map(
          (scan) => ({
            ...scan,

            finding_count:
              countMap[
                scan.id
              ] || 0,
          })
        ),
    });
  }
);

/*
 * --------------------------------------------------
 * GET ONE SCAN + FINDINGS
 * --------------------------------------------------
 */
scansRouter.get(
  "/:id",
  requireUser,
  async (req, res) => {
    const {
      data: scan,
      error,
    } = await supabaseAdmin
      .from("scans")
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

    if (error) {
      return res
        .status(404)
        .json({
          error:
            "Scan not found.",
        });
    }

    const {
      data: findings,
      error:
        findingsError,
    } = await supabaseAdmin
      .from("findings")
      .select("*")
      .eq(
        "scan_id",
        scan.id
      )
      .eq(
        "user_id",
        req.user.id
      )
      .order(
        "severity_score",
        {
          ascending:
            false,
        }
      );

    if (
      findingsError
    ) {
      return res
        .status(500)
        .json({
          error:
            findingsError.message,
        });
    }

    return res.json({
      scan: {
        ...scan,

        findings:
          findings || [],
      },
    });
  }
);