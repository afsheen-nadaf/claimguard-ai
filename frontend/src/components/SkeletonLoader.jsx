export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton skeleton-circle" />
        <div className="skeleton skeleton-text skeleton-text-lg" />
      </div>
      <div className="skeleton-body">
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text skeleton-text-sm" />
      </div>
    </div>
  );
}

export function SkeletonMeter() {
  return (
    <div className="skeleton-meter">
      <div className="skeleton skeleton-circle-lg" />
      <div className="skeleton skeleton-text" />
    </div>
  );
}
