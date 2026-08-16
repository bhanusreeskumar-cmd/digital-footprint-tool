import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

export default function Admin() {
  /*
   * POST-SEARCH FINDING REVIEWS
   */
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [loadingId, setLoadingId] =
    useState(null);

  /*
   * PRE-SEARCH IDENTITY REVIEWS
   */
  const [
    identityReviews,
    setIdentityReviews,
  ] = useState([]);

  const [
    identityNotes,
    setIdentityNotes,
  ] = useState({});

  const [
    identityLoadingId,
    setIdentityLoadingId,
  ] = useState(null);

  /*
   * GENERAL PAGE STATE
   */
  const [message, setMessage] =
    useState("");

  const [
    checkingAccess,
    setCheckingAccess,
  ] = useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  /*
   * Check administrator access.
   */
  useEffect(() => {
    checkAdminAccess();
  }, []);

  async function checkAdminAccess() {
    try {
      setCheckingAccess(true);
      setMessage("");

      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const user =
        userData.user;

      if (!user) {
        setIsAdmin(false);
        return;
      }

      const {
        data: profile,
        error: profileError,
      } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

      if (profileError) {
        throw profileError;
      }

      const admin =
        profile?.role === "admin";

      setIsAdmin(admin);

      /*
       * Only administrators load review data.
       */
      if (admin) {
        await loadAllReviews();
      }
    } catch (error) {
      setMessage(
        error.message
      );

      setIsAdmin(false);
    } finally {
      setCheckingAccess(false);
    }
  }

  /*
   * Load both review queues.
   */
  async function loadAllReviews() {
    try {
      setMessage("");

      const [
        findingResult,
        identityResult,
      ] =
        await Promise.all([
          api.getAdminQueue(),
          api.getAdminIdentityReviews(),
        ]);

      setItems(
        findingResult.reviews ||
          []
      );

      setIdentityReviews(
        identityResult.reviews ||
          []
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  /*
   * -----------------------------------------------
   * POST-SEARCH FINDING REVIEW DECISION
   * -----------------------------------------------
   */
  async function decideFinding(
    id,
    decision
  ) {
    try {
      setLoadingId(id);
      setMessage("");

      await api.reviewFinding(
        id,
        decision,
        notes[id] || ""
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.id !== id
          )
      );

      setNotes(
        (current) => {
          const updated = {
            ...current,
          };

          delete updated[id];

          return updated;
        }
      );

      if (
        decision === "approved"
      ) {
        setMessage(
          "Finding review approved. The finding is now marked as verified."
        );
      }

      if (
        decision === "rejected"
      ) {
        setMessage(
          "Finding review rejected. The finding is now marked as rejected."
        );
      }

      if (
        decision ===
        "more_confirmation"
      ) {
        setMessage(
          "More confirmation has been requested for the finding."
        );
      }
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoadingId(null);
    }
  }

  /*
   * -----------------------------------------------
   * PRE-SEARCH IDENTITY REVIEW DECISION
   * -----------------------------------------------
   */
  async function decideIdentity(
    id,
    decision
  ) {
    try {
      setIdentityLoadingId(
        id
      );

      setMessage("");

      await api.reviewIdentityRequest(
        id,
        decision,
        identityNotes[id] || ""
      );

      /*
       * Remove completed identity review
       * from the pending admin queue.
       */
      setIdentityReviews(
        (current) =>
          current.filter(
            (review) =>
              review.id !== id
          )
      );

      setIdentityNotes(
        (current) => {
          const updated = {
            ...current,
          };

          delete updated[id];

          return updated;
        }
      );

      if (
        decision === "approved"
      ) {
        setMessage(
          "Identity review approved. The user can now be informed that the submitted name was accepted by the reviewer."
        );
      }

      if (
        decision === "rejected"
      ) {
        setMessage(
          "Identity review rejected. No public-web search was performed for the submitted name."
        );
      }
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setIdentityLoadingId(
        null
      );
    }
  }

  /*
   * Existing finding-review helper.
   */
  function getSuggestedDecision(
    reason = ""
  ) {
    const lower =
      reason.toLowerCase();

    if (
      lower.includes(
        "suggested decision: approve"
      )
    ) {
      return "approve";
    }

    if (
      lower.includes(
        "suggested decision: reject"
      )
    ) {
      return "reject";
    }

    return null;
  }

  /*
   * Do not expose the administrator
   * interface while access is checked.
   */
  if (checkingAccess) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-slate-500">
          Checking administrator access...
        </p>
      </div>
    );
  }

  /*
   * STANDARD USER
   */
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">
          Administrator review
        </h1>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <p className="font-medium text-slate-900">
            Administrator access required
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Administrative identity reviews are
            restricted to authorised reviewers.
            Standard users cannot approve or reject
            their own ownership claims.
          </p>

          <p className="mt-3 text-sm text-slate-500">
            You can view the status of your own
            identity-review requests from the Review
            Results page.
          </p>
        </div>
      </div>
    );
  }

  /*
   * ADMINISTRATOR INTERFACE
   */
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">
        Admin review
      </h1>

      <p className="mt-2 text-slate-600">
        Review pre-search identity requests and
        findings that require manual ownership
        confirmation.
      </p>

      {message && (
        <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      {/* ============================================
          IDENTITY REVIEWS
          ============================================ */}

      <section className="mt-8">
        <div>
          <h2 className="text-xl font-semibold">
            Identity reviews
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Name requests blocked before public-web
            search because the submitted name did not
            sufficiently match the documentary-verified
            identity.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {identityReviews.length ===
            0 && (
            <div className="card p-5">
              <p className="text-sm text-slate-500">
                No pending identity reviews.
              </p>
            </div>
          )}

          {identityReviews.map(
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

                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                    Pending identity review
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
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

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">
                      Match classification
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {review.match_type ||
                        "Major mismatch"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">
                      Requested
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {review.created_at
                        ? new Date(
                            review.created_at
                          ).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Review reason
                  </p>

                  <p className="mt-2 text-sm text-slate-700">
                    {review.reason}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">
                    Privacy safeguard
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    No public-web search was performed
                    for this name. Approval or rejection
                    records the review decision only.
                  </p>
                </div>

                <label className="mt-4 block">
                  <span className="text-sm font-medium">
                    Reviewer note
                  </span>

                  <textarea
                    className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm"
                    placeholder="Optional explanation for the identity-review decision"
                    value={
                      identityNotes[
                        review.id
                      ] || ""
                    }
                    onChange={(e) =>
                      setIdentityNotes({
                        ...identityNotes,

                        [review.id]:
                          e.target
                            .value,
                      })
                    }
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      identityLoadingId ===
                      review.id
                    }
                    onClick={() =>
                      decideIdentity(
                        review.id,
                        "approved"
                      )
                    }
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40"
                  >
                    {identityLoadingId ===
                    review.id
                      ? "Saving..."
                      : "Approve"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      identityLoadingId ===
                      review.id
                    }
                    onClick={() =>
                      decideIdentity(
                        review.id,
                        "rejected"
                      )
                    }
                    className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* ============================================
          FINDING REVIEWS
          ============================================ */}

      <section className="mt-10 border-t border-slate-200 pt-8">
        <div>
          <h2 className="text-xl font-semibold">
            Finding reviews
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Findings created after an authorised scan
            that could not be automatically linked to
            the authenticated account.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {items.length === 0 && (
            <div className="card p-5">
              <p className="text-sm text-slate-500">
                No pending finding reviews.
              </p>
            </div>
          )}

          {items.map(
            (review) => {
              const suggestedDecision =
                getSuggestedDecision(
                  review.reason
                );

              return (
                <div
                  key={review.id}
                  className="card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {review.finding
                          ?.summary ||
                          "Ownership review"}
                      </div>

                      <p className="mt-1 break-all text-sm text-slate-500">
                        {
                          review.finding
                            ?.url
                        }
                      </p>
                    </div>

                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      Needs review
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Review reason
                    </p>

                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                      {review.reason}
                    </p>
                  </div>

                  {suggestedDecision && (
                    <div
                      className={
                        suggestedDecision ===
                        "approve"
                          ? "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                          : "mt-4 rounded-xl border border-red-200 bg-red-50 p-4"
                      }
                    >
                      <p className="text-sm font-medium">
                        System suggestion:{" "}
                        {suggestedDecision ===
                        "approve"
                          ? "Approve"
                          : "Reject"}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        This is decision support only.
                        The final ownership decision
                        must still be made by the
                        reviewer.
                      </p>
                    </div>
                  )}

                  {review.finding && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">
                          Source category
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {review.finding
                            .source_category ||
                            "Unknown"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">
                          Risk level
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {review.finding
                            .risk_level ||
                            "Unknown"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">
                          Severity score
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {review.finding
                            .severity_score ??
                            "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">
                          Current ownership status
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {review.finding
                            .ownership_status ||
                            "needs_review"}
                        </p>
                      </div>
                    </div>
                  )}

                  <label className="mt-4 block">
                    <span className="text-sm font-medium">
                      Admin note
                    </span>

                    <textarea
                      className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm"
                      placeholder="Optional explanation for the review decision"
                      value={
                        notes[
                          review.id
                        ] || ""
                      }
                      onChange={(e) =>
                        setNotes({
                          ...notes,

                          [review.id]:
                            e.target
                              .value,
                        })
                      }
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        loadingId ===
                        review.id
                      }
                      onClick={() =>
                        decideFinding(
                          review.id,
                          "approved"
                        )
                      }
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40"
                    >
                      {loadingId ===
                      review.id
                        ? "Saving..."
                        : "Approve"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        loadingId ===
                        review.id
                      }
                      onClick={() =>
                        decideFinding(
                          review.id,
                          "rejected"
                        )
                      }
                      className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-40"
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={
                        loadingId ===
                        review.id
                      }
                      onClick={() =>
                        decideFinding(
                          review.id,
                          "more_confirmation"
                        )
                      }
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Request more confirmation
                    </button>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}