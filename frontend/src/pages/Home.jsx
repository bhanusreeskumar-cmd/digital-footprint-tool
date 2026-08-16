import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-medium text-blue-700">PRIVATE BY DESIGN</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">See what the public web reveals about you.</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        Footprint searches indexed public-web sources using the verified identifiers you provide, scores detected exposure transparently, and helps you prepare removal-request drafts.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["1", "Verify identifiers", "Verify your account email, phone number or full name before scanning."],
          ["2", "Run a bounded live scan", "Search indexed public results using your verified identifiers, with an optional reference photo."],
          ["3", "Review and act", "See risk rationale, recommended actions, scan history and removal-request drafts."],
        ].map(([n, title, text]) => (
          <div key={n} className="card p-5">
            <div className="text-xs font-bold text-blue-700">STEP {n}</div>
            <h2 className="mt-2 font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </div>
      <Link to="/scan" className="mt-7 inline-block rounded-xl bg-slate-950 px-5 py-3 text-white">Start a new scan</Link>
    </div>
  );
}
