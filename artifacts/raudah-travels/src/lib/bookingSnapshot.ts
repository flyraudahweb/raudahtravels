// A slower GET must never replace a newer completion/webhook snapshot in the UI.
export function newestBooking(current: any, incoming: any) {
  if (!current || current.id !== incoming?.id) return incoming;
  if (Number.isInteger(current.revision) && Number.isInteger(incoming.revision))
    return incoming.revision < current.revision ? current : incoming;
  return Date.parse(current.updatedAt) > Date.parse(incoming.updatedAt)
    ? current
    : incoming;
}
