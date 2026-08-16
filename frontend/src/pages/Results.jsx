import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { api } from "../lib/api";
import RiskBadge from "../components/RiskBadge";

const order = [
  "Very High",
  "High",
  "Medium",
  "Low",
];

/*
 * Convert internal identifier names into
 * human-readable UI labels.
 */
const identifierLabels = {
  fullName: "Full name",
  email: "Email address",
  phone: "Phone number",
  referencePhoto: "Reference photo",
};

/*
 * Convert stored finding summaries such as:
 *
 * fullName found on example.com
 *
 * into:
 *
 * Full name found on example.com
 */
function readableSummary(
  summary = ""
) {
  let result =
    summary;

  for (
    const [
      internalName,
      readableName,
    ] of Object.entries(
      identifierLabels
    )
  ) {
    result =
      result.replaceAll(
        internalName,
        readableName
      );
  }

  return result;
}

function readableOwnershipStatus(
  status
) {
  if (
    status === "verified"
  ) {
    return "Verified";
  }

  if (
    status === "needs_review"
  ) {
    return "Needs review";
  }

  if (
    status === "rejected"
  ) {
    return "Rejected";
  }

  return status || "Unknown";
}

export default function Results() {
  const { id } =
    useParams();

  const navigate =
    useNavigate();

  const [
    scan,
    setScan,
  ] =
    useState(null);

  const [
    selected,
    setSelected,
  ] =
    useState(null);

  const [
    message,
    setMessage,
  ] =
    useState("");

  useEffect(() => {
    api
      .getScan(id)
      .then(
        (result) =>
          setScan(
            result.scan
          )
      )
      .catch(
        (error) =>
          setMessage(
            error.message
          )
      );
  }, [id]);

  async function createDraft(
    findingId
  ) {
    try {
      await api.createRemovalDraft(
        findingId
      );

      navigate(
        "/removals"
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  if (!scan) {
    return (
      <p>
        {message ||
          "Loading results..."}
      </p>
    );
  }

  const findings = [
    ...(scan.findings || []),
  ];

  const counts =
    Object.fromEntries(
      order.map(
        (risk) => [
          risk,

          findings.filter(
            (finding) =>
              finding.risk_level ===
              risk
          ).length,
        ]
      )
    );

  /*
   * Do not classify a scan with zero findings
   * as Low risk.
   *
   * No detected findings does not prove that
   * no public exposure exists.
   */
  const highest =
    findings.length > 0
      ? order.find(
          (risk) =>
            counts[risk] > 0
        )
      : null;

  const urgent =
    [...findings].sort(
      (a, b) =>
        Number(
          b.severity_score ||
            0
        ) -
        Number(
          a.severity_score ||
            0
        )
    )[0];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">
        Scan results
      </h1>

      <div className="card mt-6 p-6">
        <p className="text-xs font-bold text-slate-500">
          YOUR EXPOSURE
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {findings.length > 0 ? (
            <>
              <span className="text-2xl font-semibold">
                Overall risk:{" "}
                {highest}
              </span>

              <RiskBadge
                level={
                  highest
                }
              />
            </>
          ) : (
            <span className="text-2xl font-semibold">
              No exposure findings identified
            </span>
          )}
        </div>

        {findings.length > 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            {findings.length} findings
            {" · "}
            {counts[
              "Very High"
            ]}{" "}
            very high
            {" · "}
            {counts.High} high
            {" · "}
            {counts.Medium} medium
            {" · "}
            {counts.Low} low
          </p>
        ) : (
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            No findings were detected in this scan.
            This does not guarantee that no public
            exposure exists; it only means that this
            scan did not identify matching exposure
            within the sources and search methods used.
          </p>
        )}

        {urgent && (
          <p className="mt-3 text-sm">
            <b>
              Most urgent:
            </b>{" "}
            {readableSummary(
              urgent.summary
            )}
          </p>
        )}
      </div>

      <div className="card mt-4 p-5">
        <h2 className="font-semibold">
          How risk is calculated
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          DPC (data sensitivity/context) × EI
          (ease of identification) + CB
          (exposure circumstances) maps each
          finding to Low, Medium, High or Very
          High.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {order.map(
          (risk) => {
            const rows =
              findings.filter(
                (finding) =>
                  finding.risk_level ===
                  risk
              );

            if (
              !rows.length
            ) {
              return null;
            }

            return (
              <section
                key={
                  risk
                }
              >
                <div className="mb-2 flex items-center gap-2">
                  <RiskBadge
                    level={
                      risk
                    }
                  />

                  <span className="text-sm text-slate-500">
                    {
                      rows.length
                    }{" "}
                    finding(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {rows.map(
                    (finding) => (
                      <button
                        key={
                          finding.id
                        }
                        onClick={() =>
                          setSelected(
                            finding
                          )
                        }
                        className="card w-full p-4 text-left hover:border-slate-400"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {readableSummary(
                                finding.summary
                              )}
                            </div>

                            <div className="mt-1 text-sm text-slate-500">
                              {
                                finding.domain
                              }
                            </div>
                          </div>

                          <div className="text-right text-xs text-slate-500">
                            <div>
                              {finding.ownership_status ===
                              "verified"
                                ? "✓ Verified"
                                : finding.ownership_status ===
                                  "rejected"
                                ? "✕ Rejected"
                                : "⚠ Needs review"}
                            </div>

                            <div>
                              SE{" "}
                              {Number(
                                finding.severity_score
                              ).toFixed(
                                2
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>
              </section>
            );
          }
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <RiskBadge
                  level={
                    selected.risk_level
                  }
                />

                <h2 className="mt-3 text-xl font-semibold">
                  {readableSummary(
                    selected.summary
                  )}
                </h2>

                <p className="mt-1 break-all text-sm text-slate-500">
                  {
                    selected.url
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <b>
                  Why it matters
                </b>

                <p className="mt-1 text-slate-600">
                  {
                    selected.risk_reason
                  }
                </p>
              </div>

              <div>
                <b>
                  What should I do?
                </b>

                <p className="mt-1 text-slate-600">
                  {
                    selected.recommended_action
                  }
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <b>
                  Transparent score
                </b>

                <p className="mt-2 text-slate-600">
                  DPC{" "}
                  {
                    selected.dpc
                  }{" "}
                  × EI{" "}
                  {
                    selected.ei
                  }{" "}
                  + CB{" "}
                  {
                    selected.cb
                  }{" "}
                  = SE{" "}
                  {Number(
                    selected.severity_score
                  ).toFixed(
                    2
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {
                    selected.score_explanation
                  }
                </p>
              </div>

              <div>
                <b>
                  Verification
                </b>

                <p className="mt-1 text-slate-600">
                  {readableOwnershipStatus(
                    selected.ownership_status
                  )}
                </p>
              </div>
            </div>

            {selected.ownership_status ===
            "verified" ? (
              <button
                type="button"
                onClick={() =>
                  createDraft(
                    selected.id
                  )
                }
                className="mt-6 rounded-xl bg-slate-950 px-4 py-3 text-white"
              >
                Create removal-request draft
              </button>
            ) : (
              <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                A removal draft is blocked until
                ownership is verified or approved by
                an administrator.
              </p>
            )}

            {message && (
              <p className="mt-3 text-sm text-slate-600">
                {
                  message
                }
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}