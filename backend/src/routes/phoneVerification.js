import { Router } from "express";
import { Vonage } from "@vonage/server-sdk";
import { Channels } from "@vonage/verify2";
import { requireUser } from "../middleware/auth.js";

export const phoneVerificationRouter = Router();

/*
 * Vonage Verify V2 uses an Application ID and private key.
 *
 * These are backend-only credentials.
 * Never put them in the React frontend.
 */
const vonage = new Vonage({
  applicationId: process.env.VONAGE_APPLICATION_ID,

  privateKey:
    process.env.VONAGE_PRIVATE_KEY ||
    process.env.VONAGE_PRIVATE_KEY_PATH,
});

/*
 * Prototype verification store.
 *
 * requestId -> {
 *   userId,
 *   phone,
 *   verified,
 *   createdAt
 * }
 *
 * This is deliberately kept server-side so the browser cannot
 * simply claim that a phone number has been verified.
 *
 * For a production system this would normally be stored in a
 * database rather than memory.
 */
const phoneVerifications = new Map();

/*
 * Basic phone-number validation.
 *
 * Require international format such as:
 * +447887190868
 */
function normalizePhone(phone = "") {
  return phone.replace(/\s+/g, "").trim();
}

function validPhone(phone) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/*
 * POST /api/phone-verification/send-code
 *
 * Starts a real Vonage Verify request.
 */
phoneVerificationRouter.post(
  "/send-code",
  requireUser,
  async (req, res) => {
    const phone = normalizePhone(req.body.phone);

    if (!phone) {
      return res.status(400).json({
        error: "Phone number is required.",
      });
    }

    if (!validPhone(phone)) {
      return res.status(400).json({
        error:
          "Enter the phone number in international format, for example +447887190868.",
      });
    }

    try {
      const result = await vonage.verify2.newRequest({
        brand: "Footprint",

        workflow: [
          {
            channel: Channels.SMS,
            to: phone,
          },
        ],
      });

      phoneVerifications.set(result.requestId, {
        userId: req.user.id,
        phone,
        verified: false,
        createdAt: Date.now(),
      });

      return res.json({
        message: "Verification code sent by SMS.",
        requestId: result.requestId,
      });
    } catch (error) {
      console.error(
        "Vonage send verification error:",
        error?.response?.data || error
      );

      return res.status(500).json({
        error:
          error?.response?.data?.detail ||
          error?.message ||
          "Could not send phone verification code.",
      });
    }
  }
);

/*
 * POST /api/phone-verification/verify-code
 *
 * Checks the OTP supplied by the user.
 */
phoneVerificationRouter.post(
  "/verify-code",
  requireUser,
  async (req, res) => {
    const requestId = req.body.requestId;
    const code = String(req.body.code || "").trim();

    if (!requestId || !code) {
      return res.status(400).json({
        error:
          "Verification request ID and code are required.",
      });
    }

    const verification =
      phoneVerifications.get(requestId);

    if (!verification) {
      return res.status(400).json({
        error:
          "Phone verification request was not found or has expired.",
      });
    }

    /*
     * Prevent one logged-in user from using another
     * user's verification request.
     */
    if (verification.userId !== req.user.id) {
      return res.status(403).json({
        error:
          "This phone verification does not belong to your account.",
      });
    }

    /*
     * Expire our local verification record after 10 minutes.
     */
    const TEN_MINUTES =
      10 * 60 * 1000;

    if (
      Date.now() - verification.createdAt >
      TEN_MINUTES
    ) {
      phoneVerifications.delete(requestId);

      return res.status(400).json({
        error:
          "The phone verification request has expired. Please request a new code.",
      });
    }

    try {
      const status =
        await vonage.verify2.checkCode(
          requestId,
          code
        );

      const verified =
        status === "completed";

      if (!verified) {
        return res.status(400).json({
          error:
            "The verification code was not accepted.",
          status,
        });
      }

      phoneVerifications.set(requestId, {
        ...verification,
        verified: true,
      });

      return res.json({
        message:
          "Phone number verified.",
        verified: true,
        phone:
          verification.phone,
        requestId,
      });
    } catch (error) {
      console.error(
        "Vonage check verification error:",
        error?.response?.data || error
      );

      return res.status(400).json({
        error:
          error?.response?.data?.detail ||
          error?.message ||
          "Incorrect or expired verification code.",
      });
    }
  }
);

/*
 * This helper will be used by scans.js.
 *
 * It lets the scan backend independently check that:
 *
 * 1. the verification belongs to this user,
 * 2. it succeeded,
 * 3. it was for this exact phone number,
 * 4. it has not expired.
 *
 * This means Scan.jsx cannot simply send
 * phoneVerified: true and bypass verification.
 */
export function isPhoneVerificationValid({
  requestId,
  userId,
  phone,
}) {
  if (!requestId) {
    return false;
  }

  const verification =
    phoneVerifications.get(requestId);

  if (!verification) {
    return false;
  }

  const TEN_MINUTES =
    10 * 60 * 1000;

  if (
    Date.now() - verification.createdAt >
    TEN_MINUTES
  ) {
    phoneVerifications.delete(requestId);
    return false;
  }

  return (
    verification.verified === true &&
    verification.userId === userId &&
    verification.phone ===
      normalizePhone(phone)
  );
}