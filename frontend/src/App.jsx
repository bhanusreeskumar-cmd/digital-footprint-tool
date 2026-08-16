import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { supabase } from "./lib/supabase";

import Layout from "./components/Layout";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Scan from "./pages/Scan";
import Results from "./pages/Results";
import History from "./pages/History";
import Removals from "./pages/Removals";
import Admin from "./pages/Admin";
import ReviewResults from "./pages/ReviewResults";
import ResetPassword from "./pages/ResetPassword";

function Protected({
  session,
}) {
  return session
    ? <Layout />
    : (
      <Navigate
        to="/login"
        replace
      />
    );
}

export default function App() {
  const [
    session,
    setSession,
  ] = useState(undefined);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(
        ({ data }) =>
          setSession(
            data.session
          )
      );

    const {
      data,
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            currentSession
          ) => {
            setSession(
              currentSession
            );
          }
        );

    return () =>
      data.subscription
        .unsubscribe();
  }, []);

  if (
    session === undefined
  ) {
    return null;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          session
            ? (
              <Navigate
                to="/"
                replace
              />
            )
            : <Login />
        }
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />
        
      <Route
        element={
          <Protected
            session={session}
          />
        }
      >
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/scan"
          element={<Scan />}
        />

        <Route
          path="/results/:id"
          element={<Results />}
        />

        <Route
          path="/history"
          element={<History />}
        />

        <Route
          path="/review-results"
          element={
            <ReviewResults />
          }
        />

        <Route
          path="/removals"
          element={<Removals />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />
      </Route>
    </Routes>
  );
}