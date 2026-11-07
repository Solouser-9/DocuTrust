export function folderFromApi(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    parentId: raw.parentId || null,
    // H-3: the server emits docCount (Folder.toMap); documentCount kept as a legacy fallback
    documentCount: raw.docCount !== undefined ? raw.docCount : raw.documentCount || 0,
    createdAt: raw.createdAt,
  };
}

export function countOf(folder) {
  return folder && folder.documentCount !== undefined ? folder.documentCount : 0;
}
