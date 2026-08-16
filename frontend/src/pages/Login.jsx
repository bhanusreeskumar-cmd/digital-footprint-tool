import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setMessage("");

    if (mode === "signup") {
      const { error } =
        await supabase.auth.signUp({
          email: form.email,
          password: form.password,

          options: {
            data: {
              full_name: form.fullName,
            },

            emailRedirectTo:
              `${window.location.origin}/`,
          },
        });

      if (error) {
        return setMessage(
          error.message
        );
      }

      setMessage(
        "Check your email and confirm your account before signing in."
      );

      return;
    }

    const { error } =
      await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

    if (error) {
      return setMessage(
        error.message
      );
    }

    navigate("/");
  }

  async function resetPassword() {
    const email =
      form.email.trim();

    if (!email) {
      return setMessage(
        "Enter your email address first, then select Forgot password?"
      );
    }

    try {
      setSendingReset(true);
      setMessage("");

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              `${window.location.origin}/reset-password`,
          }
        );

      if (error) {
        throw error;
      }

      setMessage(
        "Password recovery email sent. Open the link in the email to choose a new password."
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-5">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"
      >
        <h1 className="text-2xl font-semibold">
          Footprint
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Find public exposure, understand its risk,
          and prepare removal requests.
        </p>

        {mode === "signup" && (
          <input
            className="mt-6 w-full rounded-xl border p-3"
            placeholder="Full legal name"
            value={form.fullName}
            onChange={(e) =>
              setForm({
                ...form,
                fullName:
                  e.target.value,
              })
            }
          />
        )}

        <input
          className="mt-3 w-full rounded-xl border p-3"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email:
                e.target.value,
            })
          }
        />

        <input
          className="mt-3 w-full rounded-xl border p-3"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) =>
            setForm({
              ...form,
              password:
                e.target.value,
            })
          }
        />

        <button className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white">
          {mode === "signup"
            ? "Create account"
            : "Sign in"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            onClick={resetPassword}
            disabled={sendingReset}
            className="mt-3 text-sm text-blue-700 disabled:opacity-50"
          >
            {sendingReset
              ? "Sending recovery email..."
              : "Forgot password?"}
          </button>
        )}

        {message && (
          <p className="mt-3 text-sm text-slate-600">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(
              mode === "signup"
                ? "login"
                : "signup"
            );

            setMessage("");
          }}
          className="mt-5 text-sm text-blue-700"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Need an account? Register"}
        </button>
      </form>
    </div>
  );
}