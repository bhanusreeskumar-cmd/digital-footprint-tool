import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Link } from "react-router-dom";

export default function History() {
  const [scans, setScans] = useState([]);
  useEffect(() => { api.getScans().then((r) => setScans(r.scans)); }, []);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold">Scan history</h1>
      <p className="mt-2 text-slate-600">Compare your exposure over time.</p>
      <div className="mt-6 space-y-3">
        {scans.map((s) => (
          <Link key={s.id} to={`/results/${s.id}`} className="card block p-4 hover:border-slate-400">
            <div className="flex items-center justify-between">
              <div><div className="font-medium">{new Date(s.created_at).toLocaleString()}</div><div className="text-sm text-slate-500">{s.finding_count || 0} findings</div></div>
              <span className="text-sm text-slate-500">{s.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
