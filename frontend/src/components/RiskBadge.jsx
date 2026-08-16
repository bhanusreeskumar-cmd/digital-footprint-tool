const style = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  "Very High": "bg-red-50 text-red-700 border-red-200",
};

export default function RiskBadge({ level }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style[level] || ""}`}>{level}</span>;
}
