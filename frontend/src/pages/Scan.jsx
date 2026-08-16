import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Scan() {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
  });

  // ACCOUNT EMAIL
  const [accountEmail, setAccountEmail] = useState("");
  const [includeEmail, setIncludeEmail] = useState(true);

  // NAME VERIFICATION
  const [registeredName, setRegisteredName] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [nameVerificationStatus, setNameVerificationStatus] =
    useState("unverified");
  const [nameVerifying, setNameVerifying] = useState(false);

  // PHONE VERIFICATION
  const [otp, setOtp] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneRequestId, setPhoneRequestId] = useState("");

  // OTHER SCAN STATE
  const [consent, setConsent] = useState(false);
  const [referencePath, setReferencePath] = useState("");
  const [status, setStatus] = useState("");
  const [scanning, setScanning] = useState(false);

  const navigate = useNavigate();

  /*
   * Load account email and documentary
   * name-verification status.
   */
  useEffect(() => {
    loadAccountEmail();
    loadNameVerificationStatus();
  }, []);

  async function loadAccountEmail() {
    const { data, error } =
      await supabase.auth.getUser();

    if (error) {
      return setStatus(error.message);
    }

    const email =
      data.user?.email || "";

    setAccountEmail(email);
  }

  async function loadNameVerificationStatus() {
    try {
      const result =
        await api.getNameVerificationStatus();

      const profile =
        result.profile || {};

      setRegisteredName(
        profile.full_name || ""
      );

      setVerifiedName(
        profile.verified_name || ""
      );

      setNameVerificationStatus(
        profile.name_verification_status ||
          "unverified"
      );
    } catch (error) {
      setStatus(error.message);
    }
  }

  /*
   * DOCUMENTARY NAME VERIFICATION
   *
   * The ID image is uploaded to a private
   * temporary Supabase Storage bucket.
   *
   * The backend then:
   * - downloads it,
   * - OCRs the document,
   * - compares its name with the account name,
   * - stores the verification result,
   * - deletes the uploaded document.
   */
  async function verifyNameWithDocument(file) {
    if (!file) {
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
      ].includes(file.type)
    ) {
      return setStatus(
        "Please upload a JPG or PNG image of the identity document."
      );
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      return setStatus(
        "The identity document must be smaller than 5 MB."
      );
    }

    setNameVerifying(true);

    setStatus(
      "Uploading identity document for name verification..."
    );

    let storagePath = "";

    try {
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
        throw new Error(
          "You must be signed in to verify your name."
        );
      }

      storagePath =
        `${user.id}/${Date.now()}-${file.name.replace(
          /\s+/g,
          "-"
        )}`;

      /*
       * Upload into the private temporary
       * name-verification bucket.
       */
      const {
        error: uploadError,
      } =
        await supabase.storage
          .from(
            "name-verification-docs"
          )
          .upload(
            storagePath,
            file,
            {
              upsert: false,
              contentType:
                file.type,
            }
          );

      if (uploadError) {
        throw uploadError;
      }

      setStatus(
        "Checking the name on your identity document..."
      );

      /*
       * Backend performs OCR, comparison,
       * profile update and file deletion.
       */
      const result =
        await api.verifyNameDocument(
          storagePath
        );

      if (!result.verified) {
        setNameVerificationStatus(
          "failed"
        );

        setVerifiedName("");

        return setStatus(
          "The name on the identity document could not be matched to your registered account name."
        );
      }

      setVerifiedName(
        result.verifiedName ||
          registeredName
      );

      setNameVerificationStatus(
        "verified"
      );

      setStatus(
        "Name verification completed successfully."
      );

      await loadNameVerificationStatus();
    } catch (error) {
      setStatus(
        error.message
      );

      /*
       * If upload succeeded but the backend
       * request failed before cleanup, try
       * deleting the temporary file here.
       */
      if (storagePath) {
        await supabase.storage
          .from(
            "name-verification-docs"
          )
          .remove([
            storagePath,
          ]);
      }
    } finally {
      setNameVerifying(false);
    }
  }

  /*
   * PHONE VERIFICATION
   */

  async function sendPhoneOtp() {
    const phone =
      form.phone.trim();

    if (!phone) {
      return setStatus(
        "Please enter a phone number first."
      );
    }

    setStatus(
      "Sending verification code..."
    );

    try {
      const result =
        await api.sendPhoneVerificationCode(
          phone
        );

      setPhoneRequestId(
        result.requestId
      );

      setPhoneSent(true);

      setStatus(
        "Verification code sent by SMS."
      );
    } catch (error) {
      setStatus(
        error.message
      );
    }
  }

  async function verifyPhone() {
    if (!otp.trim()) {
      return setStatus(
        "Please enter the verification code."
      );
    }

    if (!phoneRequestId) {
      return setStatus(
        "Please request a new verification code."
      );
    }

    setStatus(
      "Verifying phone number..."
    );

    try {
      const result =
        await api.verifyPhoneCode(
          phoneRequestId,
          otp.trim()
        );

      if (!result.verified) {
        return setStatus(
          "Phone verification was not completed."
        );
      }

      setPhoneVerified(true);

      setStatus(
        "Phone number verified."
      );
    } catch (error) {
      setStatus(
        error.message
      );
    }
  }

  /*
   * REFERENCE PHOTO
   */

  async function uploadReferencePhoto(file) {
    const { data: userData } =
      await supabase.auth.getUser();

    const user =
      userData.user;

    if (!user || !file) {
      return;
    }

    const path =
      `${user.id}/${Date.now()}-${file.name.replace(
        /\s+/g,
        "-"
      )}`;

    const { error } =
      await supabase.storage
        .from("scan-images")
        .upload(
          path,
          file,
          {
            upsert: false,
            contentType:
              file.type,
          }
        );

    if (error) {
      return setStatus(
        error.message
      );
    }

    setReferencePath(path);

    setStatus(
      "Reference photo uploaded privately for this scan."
    );
  }

  /*
   * RUN SCAN
   */

  async function runScan() {
    if (!consent) {
      return setStatus(
        "Please give explicit consent before scanning."
      );
    }

    /*
     * If a name is supplied, documentary
     * name verification must have succeeded
     * before the scan can run.
     */
    if (
      form.fullName.trim() &&
      nameVerificationStatus !==
        "verified"
    ) {
      return setStatus(
        "Please verify your name with an identity document before running a name-based scan."
      );
    }

    if (
      form.phone.trim() &&
      !phoneVerified
    ) {
      return setStatus(
        "Please verify your phone number before starting the scan."
      );
    }

    const emails =
      includeEmail &&
      accountEmail
        ? [
            accountEmail.toLowerCase(),
          ]
        : [];

    const hasIdentifier =
      form.fullName.trim() ||
      emails.length > 0 ||
      form.phone.trim();

    if (!hasIdentifier) {
      return setStatus(
        referencePath
          ? "Reference-photo searches require at least one verified name, email address, or phone number."
          : "Please provide at least one identifier to scan."
      );
    }

    setScanning(true);

    setStatus(
      "Running live scan. This can take a little while..."
    );

    try {
      const result =
        await api.startScan({
          identifiers: {
            fullName:
              form.fullName.trim(),

            emails,

            phone:
              form.phone.trim(),
          },

          phoneVerificationRequestId:
            phoneRequestId || null,

          referencePhotoPath:
            referencePath || null,

          consent: true,
        });

      navigate(
        `/results/${result.scan.id}`
      );
    } catch (error) {
      setStatus(
        error.message
      );

      setScanning(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">
        New scan
      </h1>

      <p className="mt-2 text-slate-600">
        Only scan identifiers that belong to you.
      </p>

      <div className="card mt-6 space-y-6 p-6">

        {/* FULL NAME */}

        <div>
          <label className="block">
            <span className="text-sm font-medium">
              Full name
            </span>

            <input
              className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              value={
                form.fullName
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  fullName:
                    e.target.value,
                })
              }
            />
          </label>

          {nameVerificationStatus ===
            "verified" ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">
                ✓ Name verified
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                {verifiedName}
              </p>

              <p className="mt-2 text-xs text-slate-600">
                Reasonable variations of this verified name may be used
                for name-based scans.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Name verification required
              </p>

              {registeredName && (
                <p className="mt-1 text-sm text-slate-700">
                  Registered account name:{" "}
                  <strong>
                    {registeredName}
                  </strong>
                </p>
              )}

              <p className="mt-2 text-xs text-slate-600">
                To prevent searches for other people, Footprint requires
                documentary name verification before name-based searches
                can be performed.
              </p>

              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">
                  Upload government ID for name verification
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={
                    nameVerifying
                  }
                  className="mt-2 block w-full text-sm"
                  onChange={(e) => {
                    const file =
                      e.target.files?.[0];

                    if (file) {
                      verifyNameWithDocument(
                        file
                      );
                    }

                    /*
                     * Reset input so the same file
                     * can be selected again if needed.
                     */
                    e.target.value = "";
                  }}
                />
              </label>

              <p className="mt-2 text-xs text-slate-500">
                JPG or PNG only, maximum 5 MB. The document is used only
                for documentary name matching and is deleted after
                processing.
              </p>

              {nameVerifying && (
                <p className="mt-2 text-sm text-slate-700">
                  Checking document...
                </p>
              )}

              {nameVerificationStatus ===
                "failed" && (
                <p className="mt-2 text-sm text-red-700">
                  The previous verification attempt did not match the
                  registered account name. You can try again with a
                  clearer image.
                </p>
              )}
            </div>
          )}
        </div>

        {/* VERIFIED ACCOUNT EMAIL */}

        <div>
          <span className="text-sm font-medium">
            Verified account email
          </span>

          {accountEmail ? (
            <label className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <input
                type="checkbox"
                checked={
                  includeEmail
                }
                onChange={(e) =>
                  setIncludeEmail(
                    e.target.checked
                  )
                }
              />

              <div>
                <div className="text-sm font-medium">
                  {accountEmail}
                </div>

                <div className="text-xs text-emerald-700">
                  ✓ Verified through your Footprint account
                </div>
              </div>
            </label>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              No account email could be loaded.
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            For privacy protection, this prototype only allows
            email-footprint searches using the verified email address
            associated with your account.
          </p>
        </div>

        {/* PHONE */}

        <label className="block">
          <span className="text-sm font-medium">
            Phone number
          </span>

          <input
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
            placeholder="+44..."
            value={
              form.phone
            }
            onChange={(e) => {
              setForm({
                ...form,
                phone:
                  e.target.value,
              });

              setPhoneVerified(
                false
              );

              setPhoneSent(
                false
              );

              setPhoneRequestId(
                ""
              );

              setOtp("");
            }}
          />
        </label>

        {form.phone &&
          !phoneVerified && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="mb-2 text-xs text-slate-500">
                We will send a one-time verification code to this
                phone number.
              </p>

              {!phoneSent ? (
                <button
                  type="button"
                  onClick={
                    sendPhoneOtp
                  }
                  className="rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  Send phone OTP
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="rounded-lg border p-2"
                    placeholder="SMS code"
                    value={otp}
                    onChange={(e) =>
                      setOtp(
                        e.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={
                      verifyPhone
                    }
                    className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    Verify
                  </button>
                </div>
              )}
            </div>
          )}

        {form.phone &&
          phoneVerified && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              ✓ Phone number verified.
            </p>
          )}

        {/* REFERENCE PHOTO */}

        <label className="block">
          <span className="text-sm font-medium">
            Reference photo (optional)
          </span>

          <input
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) =>
              uploadReferencePhoto(
                e.target.files?.[0]
              )
            }
          />

          <span className="mt-1 block text-xs text-slate-500">
            Used for image discovery and deleted after processing.
            For privacy protection, a reference photo can only be
            searched alongside a verified name, email address, or
            phone number. Image candidates are only retained when
            the associated page also contains a verified identifier.
          </span>
        </label>

        {/* CONSENT */}

        <label className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <input
            type="checkbox"
            checked={
              consent
            }
            onChange={(e) =>
              setConsent(
                e.target.checked
              )
            }
          />

          <span>
            I consent to Footprint searching public sources for the
            identifiers I supplied. I confirm they belong to me.
          </span>
        </label>

        {/* RUN SCAN */}

        <button
          type="button"
          onClick={
            runScan
          }
          disabled={
            !consent ||
            scanning ||
            nameVerifying
          }
          className="rounded-xl bg-blue-700 px-5 py-3 font-medium text-white disabled:opacity-40"
        >
          {scanning
            ? "Running scan..."
            : "Run live scan"}
        </button>

        {status && (
          <p className="text-sm text-slate-600">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}