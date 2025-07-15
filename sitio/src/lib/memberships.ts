// All known memberships from the scrapers
export const ALL_MEMBERSHIPS = [
  "Club La Nacion",
  "Comunidad Coto",
  "Clarin 365",
  "Club +Simple",
  "MasClub",
  "Mi Carrefour",
] as const;

export type Membership = typeof ALL_MEMBERSHIPS[number];