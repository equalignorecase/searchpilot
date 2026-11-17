export type Identity = { id: string; email: string; emailVerified: boolean };
export function isOwner(
  user: Identity | null | undefined,
  owner: { neonUserId?: string },
) {
  return !!(user && owner.neonUserId && user.id === owner.neonUserId);
}
