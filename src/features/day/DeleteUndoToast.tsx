// Undo-after-delete was removed in Slice 2b: delete is now a server soft-delete
// (status → cancelled) with no local undo buffer. This component is kept as a
// stub so import sites compile; it renders nothing.
export function DeleteUndoToast() {
  return null;
}
