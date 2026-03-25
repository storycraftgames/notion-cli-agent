/**
 * Smart markdown chunking for Notion's 500KB API limit.
 * Splits markdown at semantic boundaries to avoid breaking
 * code blocks, tables, lists, or headings.
 */

const DEFAULT_CHUNK_SIZE = 400 * 1024; // 400KB — safe margin under 500KB limit

/**
 * Split markdown into chunks that respect structural boundaries.
 * Each chunk is at most maxBytes in UTF-8 size.
 *
 * Split priority (highest to lowest):
 * 1. Top-level headings (## or #)
 * 2. Any heading level
 * 3. Paragraph boundaries (double newline)
 * 4. Single newline (last resort)
 */
export function chunkMarkdown(markdown: string, maxBytes: number = DEFAULT_CHUNK_SIZE): string[] {
  const totalBytes = Buffer.byteLength(markdown, 'utf-8');

  if (totalBytes <= maxBytes) {
    return [markdown];
  }

  const chunks: string[] = [];
  let remaining = markdown;

  while (remaining.length > 0) {
    const remainingBytes = Buffer.byteLength(remaining, 'utf-8');

    if (remainingBytes <= maxBytes) {
      chunks.push(remaining);
      break;
    }

    // Find a split point within the byte budget
    const splitIndex = findSplitPoint(remaining, maxBytes);

    if (splitIndex <= 0) {
      // Can't find a good split — force split at byte boundary
      // Walk characters until we hit the byte limit
      const forceSplit = findByteBoundary(remaining, maxBytes);
      chunks.push(remaining.slice(0, forceSplit));
      remaining = remaining.slice(forceSplit);
      continue;
    }

    chunks.push(remaining.slice(0, splitIndex).trimEnd());
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Find the best split point in content that fits within maxBytes.
 * Returns the character index to split at.
 */
function findSplitPoint(content: string, maxBytes: number): number {
  // Get a rough character estimate (overestimate for safety, then search backward)
  const searchEnd = findByteBoundary(content, maxBytes);

  // Strategy 1: Split at a top-level heading (# or ##) — strongest boundary
  const topHeadingSplit = findLastPattern(content, /\n(?=#{1,2} )/g, searchEnd);
  if (topHeadingSplit > 0) return topHeadingSplit;

  // Strategy 2: Split at any heading
  const headingSplit = findLastPattern(content, /\n(?=#{1,6} )/g, searchEnd);
  if (headingSplit > 0) return headingSplit;

  // Strategy 3: Split at paragraph boundary (blank line) — but not inside fenced blocks
  const paraSplit = findLastSafeParagraphBreak(content, searchEnd);
  if (paraSplit > 0) return paraSplit;

  // Strategy 4: Split at any newline
  const newlineSplit = content.lastIndexOf('\n', searchEnd);
  if (newlineSplit > 0) return newlineSplit;

  // No good split found
  return -1;
}

/**
 * Find the character index corresponding to approximately maxBytes of UTF-8 content.
 */
function findByteBoundary(content: string, maxBytes: number): number {
  // Binary search for the character index that fits within maxBytes
  let lo = 0;
  let hi = content.length;

  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (Buffer.byteLength(content.slice(0, mid), 'utf-8') <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

/**
 * Find the last occurrence of a regex pattern before the given position.
 * Returns the character index of the match, or -1 if not found.
 */
function findLastPattern(content: string, pattern: RegExp, before: number): number {
  const searchArea = content.slice(0, before);
  let lastMatch = -1;

  for (const match of searchArea.matchAll(pattern)) {
    if (match.index !== undefined && match.index > 0) {
      lastMatch = match.index;
    }
  }

  // Don't split too early — require at least 10% of the budget to be used
  const minBytes = Buffer.byteLength(content.slice(0, lastMatch), 'utf-8');
  if (minBytes < 40 * 1024) return -1; // At least 40KB in a chunk

  return lastMatch;
}

/**
 * Find the last paragraph break (double newline) that's not inside a fenced code block or table.
 */
function findLastSafeParagraphBreak(content: string, before: number): number {
  const searchArea = content.slice(0, before);

  // Track fenced code block state
  let inCodeBlock = false;
  let inTable = false;
  let lastSafeBreak = -1;

  const lines = searchArea.split('\n');
  let charIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Toggle code block state
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    // Detect table rows (lines starting with |)
    inTable = line.trimStart().startsWith('|');

    // Check for paragraph break (empty line)
    if (!inCodeBlock && !inTable && line.trim() === '' && i > 0) {
      // Make sure next line isn't a table or inside a code block
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      if (!nextLine.trimStart().startsWith('|') && !nextLine.trimStart().startsWith('```')) {
        lastSafeBreak = charIndex;
      }
    }

    charIndex += line.length + 1; // +1 for the \n
  }

  // Don't split too early
  if (lastSafeBreak > 0) {
    const minBytes = Buffer.byteLength(content.slice(0, lastSafeBreak), 'utf-8');
    if (minBytes < 40 * 1024) return -1;
  }

  return lastSafeBreak;
}
