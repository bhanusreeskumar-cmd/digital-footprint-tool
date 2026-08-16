import {
  useEffect,
  useState,
} from "react";

import { api } from "../lib/api";

export default function Removals() {
  const [
    items,
    setItems,
  ] = useState([]);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const result =
        await api.getRemovalRequests();

      setItems(
        result.requests || []
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(
    id,
    status
  ) {
    try {
      setMessage("");

      await api.updateRemovalStatus(
        id,
        status
      );

      await load();
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  async function copyDraft(
    body
  ) {
    try {
      await navigator.clipboard
        .writeText(body);

      setMessage(
        "Removal-request draft copied to clipboard."
      );
    } catch {
      setMessage(
        "The draft could not be copied automatically."
      );
    }
  }

  function readableStatus(
    status
  ) {
    const labels = {
      draft: "Draft",
      sent: "Sent",
      acknowledged:
        "Acknowledged",
      removed: "Removed",
      rejected: "Rejected",
    };

    return (
      labels[status] ||
      status
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">
        Removal requests
      </h1>

      <p className="mt-2 text-slate-600">
        Prepare and track removal requests for
        verified findings.
      </p>

      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
        Footprint prepares request drafts for you.
        It does not send them automatically or
        guarantee that a website will remove the
        information.
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">
          Loading removal requests...
        </p>
      ) : items.length === 0 ? (
        <div className="card mt-6 p-5">
          <p className="text-sm text-slate-500">
            No removal-request drafts have been
            created yet.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map(
            (request) => (
              <div
                key={
                  request.id
                }
                className="card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {
                        request.subject
                      }
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {
                        request.target_domain
                      }
                    </div>
                  </div>

                  <span className="rounded-full border px-3 py-1 text-xs font-medium">
                    {readableStatus(
                      request.status
                    )}
                  </span>
                </div>

                <textarea
                  readOnly
                  value={
                    request.draft_body
                  }
                  className="mt-4 h-48 w-full rounded-xl border bg-slate-50 p-3 text-sm"
                />

                <p className="mt-2 text-xs text-slate-500">
                  This draft was generated as
                  user-facing assistance by the
                  Footprint MSc prototype. It is not
                  legal advice and does not guarantee
                  that an erasure request must be
                  granted.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyDraft(
                        request.draft_body
                      )
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Copy draft
                  </button>

                  <a
                    className="rounded-lg border px-3 py-2 text-sm"
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                      request.draft_body
                    )}`}
                    download={`removal-request-${request.id}.txt`}
                  >
                    Download
                  </a>

                  {request.status ===
                    "draft" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus(
                          request.id,
                          "sent"
                        )
                      }
                      className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-white"
                    >
                      Mark as sent
                    </button>
                  )}

                  {request.status ===
                    "sent" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            request.id,
                            "acknowledged"
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Mark as acknowledged
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            request.id,
                            "removed"
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Mark as removed
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            request.id,
                            "rejected"
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Mark as rejected
                      </button>
                    </>
                  )}

                  {request.status ===
                    "acknowledged" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            request.id,
                            "removed"
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Mark as removed
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            request.id,
                            "rejected"
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Mark as rejected
                      </button>
                    </>
                  )}
                </div>

                {(request.status ===
                  "removed" ||
                  request.status ===
                    "rejected") && (
                  <p className="mt-4 text-xs text-slate-500">
                    This request is now in a final
                    tracking state.
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}