import { createHash } from 'crypto';

/**
 * Generate a scry marker ID in {kind}.{name}~{hash} format.
 *
 * Per FR7:
 * - kind must be lowercase [a-z]+
 * - name is kebab-cased (lowercase, hyphens)
 * - hash: 8-char hex (SHA256 of content truncated, or random when content omitted)
 *
 * @param kind - Artifact kind (e.g., 'design', 'spec')
 * @param name - Kebab-case artifact name (e.g., 'auth-flow')
 * @param content - Optional content for deterministic SHA256 hash
 * @returns Full id string: {kind}.{name}~{hash}
 */
export function mintId(kind: string, name: string, content?: string): string {
  const safeKind = kind.toLowerCase().replace(/[^a-z]/g, '');
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  let hash: string;
  if (content !== undefined) {
    // Content-based: SHA256 truncated to 8 hex chars (deterministic across calls)
    hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
  } else {
    // Random: use crypto.randomBytes for 4 bytes → 8 hex chars
    const { randomBytes } = require('crypto');
    hash = (randomBytes(4) as Buffer).toString('hex');
  }

  return `${safeKind}.${safeName}~${hash}`;
}
