type Props = {
  selfSubmitted: boolean;
  primarySubmitted: boolean;
  peerCompleted: number;
  peerTotal: number;
  finalized: boolean;
  released: boolean;
};

function pill(label: string, value: string, tone: "warm" | "neutral" | "success") {
  const className =
    tone === "success"
      ? "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
      : tone === "neutral"
        ? "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
        : "inline-flex items-center gap-2 rounded-full border border-orange-200 bg-[#fff7f0] px-3 py-1 text-xs font-semibold text-slate-700";

  return (
    <span className={className}>
      <span>{label}</span>
      {value ? <span>{value}</span> : null}
    </span>
  );
}

export function ProcessingSummaryBar({
  selfSubmitted,
  primarySubmitted,
  peerCompleted,
  peerTotal,
  finalized,
  released,
}: Props) {
  return (
    <section className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
        {pill("Self", selfSubmitted ? "Submitted" : "Missing", selfSubmitted ? "neutral" : "warm")}
        {pill(
            "Primary",
            primarySubmitted ? "Submitted" : "Missing",
            primarySubmitted ? "neutral" : "warm"
        )}
        {pill("Peer", peerTotal > 0 ? `${peerCompleted}/${peerTotal}` : "None", peerTotal > 0 ? "neutral" : "warm")}
        {pill(finalized ? "Finalized" : "Not finalized", "", finalized ? "neutral" : "warm")}
        {pill(released ? "Released" : "Not released", "", released ? "success" : "neutral")}
        </div>
    </section>
);
}