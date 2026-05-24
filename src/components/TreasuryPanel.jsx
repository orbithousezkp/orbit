import { Wallet } from 'lucide-react';

const rows = [
  ['Daily cap', '$5.00', 'AI-call spend limit'],
  ['Monthly cap', '$100.00', 'AI-call budget'],
  ['AI routes', 'Private', 'Configured route order'],
  ['AI buys', 'Gated', 'Owner-approved credits'],
  ['Revenue', 'Weekly', 'Performance-gated'],
  ['Live launch', 'Off', 'Signing stays gated'],
];

export default function TreasuryPanel() {
  return (
    <section
      id="treasury"
      className="rounded-xl border border-white/10 bg-[#f4f7fb] p-5 text-[#08111f]"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-[#496071]">
            Treasury
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold uppercase">Budget Policy</h2>
        </div>
        <Wallet size={23} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {rows.map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-[#08111f]/10 bg-[#08111f]/[0.04] p-4">
            <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#496071]">
              {label}
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold uppercase">{value}</div>
            <div className="mt-1 font-sans text-[11px] font-semibold text-[#496071]">{detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
