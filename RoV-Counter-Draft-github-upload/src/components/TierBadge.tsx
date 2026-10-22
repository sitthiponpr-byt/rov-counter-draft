export function TierBadge({ tier, size = 'sm' }: { tier: string | null | undefined; size?: 'sm' | 'md' }) {
  if (!tier) return null;
  const key = tier === 'S+' ? 'splus' : tier.toLowerCase();
  return (
    <span className={`tier tier-${key} tier-${size}`} title={`เทียร์ ${tier} (ROV META แพตช์ 1.64)`}>
      {tier}
    </span>
  );
}
