export function StorageWarning() {
  return (
    <p role="status" className="storage-notice">
      This match can continue, but resume may be unavailable because browser storage could not be
      accessed.
    </p>
  );
}
