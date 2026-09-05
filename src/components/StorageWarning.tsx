export function StorageWarning() {
  return (
    <p role="status" className="storage-notice">
      <span className="storage-notice__icon" aria-hidden="true">!</span>
      <span>
        This match can continue, but resume may be unavailable because browser storage could not be
        accessed.
      </span>
    </p>
  );
}
