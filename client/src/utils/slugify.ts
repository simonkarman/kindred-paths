/**
 * Convert a card name into a URL-safe slug.
 * e.g. "Verdant Shard" -> "verdant-shard"
 */
export function slugifyCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a /card/[cid]/[name] path for a given cid and primary face name.
 */
export function cardPath(cid: string, primaryName: string): string {
  return `/card/${cid}/${slugifyCardName(primaryName)}`;
}

/**
 * Build a /edit/[cid]/[name] path.
 */
export function editPath(cid: string, primaryName: string): string {
  return `/edit/${cid}/${slugifyCardName(primaryName)}`;
}

/**
 * Build a /clone/[cid]/[name] path.
 */
export function clonePath(cid: string, primaryName: string): string {
  return `/clone/${cid}/${slugifyCardName(primaryName)}`;
}
