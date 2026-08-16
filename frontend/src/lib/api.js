import { supabase } from "./supabase";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

async function headers() {
  const { data } =
    await supabase.auth.getSession();

  const token =
    data.session?.access_token;

  return {
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

async function request(
  path,
  options = {}
) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        ...options,

        headers: {
          ...(await headers()),
          ...(options.headers || {}),
        },
      }
    );

  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error ||
        "Request failed"
    );
  }

  return body;
}

export const api = {
  /*
   * SCANS
   */

  startScan: (payload) =>
    request(
      "/api/scans",
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    ),

  getScans: () =>
    request(
      "/api/scans"
    ),

  getScan: (id) =>
    request(
      `/api/scans/${id}`
    ),

  /*
   * NAME VERIFICATION
   */

  getNameVerificationStatus: () =>
    request(
      "/api/name-verification/status"
    ),

  verifyNameDocument: (
    storagePath
  ) =>
    request(
      "/api/name-verification/verify",
      {
        method: "POST",

        body: JSON.stringify({
          storagePath,
        }),
      }
    ),

  /*
   * IDENTITY REVIEW RESULTS
   */

  getIdentityReviews: () =>
    request(
      "/api/identity-reviews"
    ),

  getIdentityReview: (
    id
  ) =>
    request(
      `/api/identity-reviews/${id}`
    ),

  /*
   * PHONE VERIFICATION
   */

  sendPhoneVerificationCode: (
    phone
  ) =>
    request(
      "/api/phone-verification/send-code",
      {
        method: "POST",

        body: JSON.stringify({
          phone,
        }),
      }
    ),

  verifyPhoneCode: (
    requestId,
    code
  ) =>
    request(
      "/api/phone-verification/verify-code",
      {
        method: "POST",

        body: JSON.stringify({
          requestId,
          code,
        }),
      }
    ),

  /*
   * REMOVAL REQUESTS
   */

  getRemovalRequests: () =>
    request(
      "/api/removal-requests"
    ),

  createRemovalDraft: (
    findingId
  ) =>
    request(
      "/api/removal-requests",
      {
        method: "POST",

        body: JSON.stringify({
          findingId,
        }),
      }
    ),

  updateRemovalStatus: (
    id,
    status
  ) =>
    request(
      `/api/removal-requests/${id}`,
      {
        method: "PATCH",

        body: JSON.stringify({
          status,
        }),
      }
    ),

  /*
   * ADMIN FINDING REVIEWS
   */

  getAdminQueue: () =>
    request(
      "/api/admin/reviews"
    ),

  reviewFinding: (
    id,
    decision,
    note = ""
  ) =>
    request(
      `/api/admin/reviews/${id}`,
      {
        method: "PATCH",

        body: JSON.stringify({
          decision,
          note,
        }),
      }
    ),

  /*
   * ADMIN IDENTITY REVIEWS
   */

  getAdminIdentityReviews: () =>
    request(
      "/api/admin/identity-reviews"
    ),

  reviewIdentityRequest: (
    id,
    decision,
    note = ""
  ) =>
    request(
      `/api/admin/identity-reviews/${id}`,
      {
        method: "PATCH",

        body: JSON.stringify({
          decision,
          note,
        }),
      }
    ),
};