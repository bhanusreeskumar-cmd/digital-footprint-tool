import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const navigate =
    useNavigate();

  async function submit(e) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      return setMessage(
        "Please choose a password with at least 8 characters."
      );
    }

    if (
      password !==
      confirmPassword
    ) {
      return setMessage(
        "The passwords do not match."
      );
    }

    try {
      setSaving(true);

      const {
        error,
      } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        throw error;
      }

      setMessage(
        "Password updated successfully."
      );

      setTimeout(
        () =>
          navigate(
            "/"
          ),
        1000
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-5">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"
      >
        <h1 className="text-2xl font-semibold">
          Set a new password
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Choose a new password for your Footprint
          account.
        </p>

        <input
          type="password"
          placeholder="New password"
          className="mt-6 w-full rounded-xl border p-3"
          value={password}
          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }
        />

        <input
          type="password"
          placeholder="Confirm new password"
          className="mt-3 w-full rounded-xl border p-3"
          value={
            confirmPassword
          }
          onChange={(e) =>
            setConfirmPassword(
              e.target.value
            )
          }
        />

        <button
          type="submit"
          disabled={saving}
          className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {saving
            ? "Updating password..."
            : "Update password"}
        </button>

        {message && (
          <p className="mt-3 text-sm text-slate-600">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}