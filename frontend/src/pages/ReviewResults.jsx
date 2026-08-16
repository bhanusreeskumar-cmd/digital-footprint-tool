import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function ReviewResults() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    try {
      setLoading(true);
      setMessage("");

      const result =
        await api.getIdentityReviews();

      setReviews(
        result.reviews || []
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(
    status
  ) {
    if (
      status === "approved"
    ) {
      return "Approved";
    }

    if (
      status === "rejected"
    ) {
      return "Not approved";
    }

    return "Pending review";
  }

  function getStatusClasses(
    status
  ) {
    if (
      status === "approved"
    ) {
      return "bg-emerald-100 text-emerald-800";
    }

    if (
      status === "rejected"
    ) {
      return "bg-red-100 text-red-800";
    }

    return "bg-amber-100 text-amber-800";
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold">
        Review Results
      </h1>

      <p className="mt-2 text-slate-600">
        View the status of name-search requests
        that required identity review.
      </p>

      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
        When a submitted name differs substantially
        from the documentary-verified name for your
        account, Footprint does not perform a public-web
        search until the request has been reviewed.
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">
          Loading review results...
        </p>
      ) : reviews.length ===
        0 ? (
        <div className="card mt-6 p-5">
          <p className="text-sm text-slate-500">
            You do not have any identity-review
            requests.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reviews.map(
            (review) => (
              <div
                key={review.id}
                className="card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Submitted name
                    </p>

                    <p className="mt-1 text-lg font-semibold">
                      {
                        review.submitted_name
                      }
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                      review.status
                    )}`}
                  >
                    {getStatusLabel(
                      review.status
                    )}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">
                      Documentary-verified name
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {
                        review.verified_name
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">
                      Search performed
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {review.search_performed
                        ? "Yes"
                        : "No"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Review reason
                  </p>

                  <p className="mt-2 text-sm text-slate-700">
                    {
                      review.reason
                    }
                  </p>
                </div>

                {review.status ===
                  "pending" && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">
                      Review pending
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      No public-web search has been
                      performed for this submitted name
                      while the ownership request is
                      unresolved.
                    </p>
                  </div>
                )}

                {review.status ===
                  "rejected" && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-800">
                      Search request not approved
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      This name does not sufficiently
                      match the documentary-verified
                      identity for this account.
                      Therefore, the search request was
                      not approved.
                    </p>
                  </div>
                )}

                {review.status ===
                  "approved" && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-800">
                      Identity review approved
                    </p>

                    <p className="mt-1 text-sm text-emerald-700">
                      The reviewer accepted this identity claim for the reviewed request. No search was automatically performed as part of the review.
                    </p>
                  </div>
                )}

                {review.admin_note && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reviewer note
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {
                        review.admin_note
                      }
                    </p>
                  </div>
                )}

                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-xs text-slate-400">
                    Requested{" "}
                    {review.created_at
                      ? new Date(
                          review.created_at
                        ).toLocaleString()
                      : ""}
                  </p>

                  {review.reviewed_at && (
                    <p className="mt-1 text-xs text-slate-400">
                      Reviewed{" "}
                      {new Date(
                        review.reviewed_at
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}