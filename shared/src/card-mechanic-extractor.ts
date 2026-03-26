import { Card, CardRarity } from './card';
import { CardFace, tryParseLoyaltyAbility } from './card-face';
import { CardColor, cardColors, hybridManaColors, isHybridMana, Mana, toOrderedColors, wubrg } from './colors';
import { SerializedCard } from './serialized-card';
import { TokenExtractor } from './token-extracter';

/**
 * A mechanic fragment extracted from a card's rules text.
 *
 * Contains both the original text (preserving casing and exact numbers) and
 * a normalized version (lowercase, numbers replaced with N, self-references
 * replaced with ~) for grouping mechanically similar effects.
 */
export interface MechanicFragment {
  /** Normalized text: lowercase, numbers → N, self-references → ~, no trailing period. */
  normalized: string;
  /** Original text: preserves casing and exact numbers. */
  original: string;
}

/**
 * A single mechanic entry representing one fragment of rules text,
 * annotated with its color context, rarity, game stage, and source card.
 */
export interface MechanicEntry {
  /** The mechanic fragment text (normalized + original). */
  fragment: MechanicFragment;
  /** Color(s) required to access this mechanic (e.g. "white", "white+blue", "generic"). */
  colors: string;
  /** Card rarity. */
  rarity: CardRarity;
  /** Game stage based on earliest turn this mechanic can be used. Early = 0-2, Mid = 3-4, Late = 5+. */
  stage: 'early' | 'mid' | 'late';
  /** The exact earliest turn number used to determine the stage. */
  earliestTurn: number;
  /** Source card information for traceability. */
  source: { cardName: string; faceIndex: number; cid: string };
}

/**
 * Options for the mechanic extractor.
 */
export interface MechanicExtractorOptions {
  /** Whether to include keywords (e.g. "flying", "trample") as mechanic entries. Default: false. */
  includeKeywords?: boolean;
  /**
   * Token cards available in the set. When a card creates a token, the extractor
   * will find matching token cards from this array and include their mechanics
   * with the creating card's color and timing context.
   */
  tokens?: SerializedCard[];
}

// ─── Color Helpers ───────────────────────────────────────────────────────────

/**
 * Extract card colors from mana symbol text like "{W}", "{1}{G}", "{W/U}", etc.
 * Returns an array of CardColor values found.
 */
function extractColorsFromManaSymbols(text: string): CardColor[] {
  const colorRegex = /\{([\w/]+)\}/g;
  const matches = text.matchAll(colorRegex);
  const result = new Set<CardColor>();
  for (const match of matches) {
    const inner = match[1].toLowerCase();
    for (let i = 0; i < wubrg.length; i++) {
      if (inner.includes(wubrg[i])) {
        result.add(cardColors[i]);
      }
    }
  }
  return toOrderedColors([...result]);
}

/**
 * Check if a mana cost text contains the colorless mana symbol {C} (not generic {1}, {2}, etc.).
 */
function hasColorlessMana(text: string): boolean {
  // Match {c} or {C} but not things like {w} or {1}
  return /\{[cC]\}/.test(text);
}

/**
 * Compute the total mana cost from mana symbols in text.
 * Counts generic numbers ({1}, {2}), colorless ({C}), and colored pips ({W}, {G}, etc.).
 * Excludes {T} and {X}.
 */
function computeManaCostFromText(text: string): number {
  const regex = /\{(\w+(?:\/\w+)?)\}/g;
  let total = 0;
  for (const match of text.matchAll(regex)) {
    const inner = match[1].toUpperCase();
    if (inner === 'T' || inner === 'X') continue;
    const asNumber = parseInt(inner, 10);
    if (!isNaN(asNumber)) {
      total += asNumber;
    } else {
      // Each colored/colorless/hybrid pip counts as 1
      total += 1;
    }
  }
  return total;
}

/**
 * Determine all possible castability color combinations for a face.
 *
 * Hybrid mana creates multiple variants (one per castable combination).
 * Returns an array of color strings like ["white", "blue"] for hybrid,
 * or ["white+blue"] for multi-color.
 */
function determineFaceCastColors(face: CardFace): string[] {
  if (!face.manaCost) {
    // Token or transform back — use givenColors or fall back to generic
    const given = face.givenColors ?? [];
    if (given.length === 0) return ['generic'];
    return [toOrderedColors(given).join('+')];
  }

  const manaKeys = Object.keys(face.manaCost) as Mana[];

  // Separate hybrid and non-hybrid mana
  const hybridKeys = manaKeys.filter(isHybridMana);
  const nonHybridColors = toOrderedColors(
    manaKeys.filter(k => cardColors.includes(k as CardColor)) as CardColor[],
  );
  const hasColorless = manaKeys.includes('colorless');

  // Build base colors from non-hybrid mana
  const baseColors: Set<string> = new Set(nonHybridColors);
  if (hasColorless) {
    baseColors.add('colorless');
  }

  if (hybridKeys.length === 0) {
    // No hybrid mana — single color combination
    if (baseColors.size === 0) return ['generic'];
    return [buildColorString([...baseColors])];
  }

  // Expand hybrid mana into all castable combinations
  // Each hybrid pip {A/B} means you can cast with A or B
  let colorSets: Set<string>[] = [new Set(baseColors)];
  for (const hybrid of hybridKeys) {
    const [colorA, colorB] = hybridManaColors(hybrid);
    const amount = face.manaCost[hybrid] ?? 0;
    for (let i = 0; i < amount; i++) {
      const expanded: Set<string>[] = [];
      for (const existing of colorSets) {
        const withA = new Set(existing);
        withA.add(colorA);
        expanded.push(withA);
        const withB = new Set(existing);
        withB.add(colorB);
        expanded.push(withB);
      }
      colorSets = expanded;
    }
  }

  // Deduplicate and build color strings
  const seen = new Set<string>();
  const results: string[] = [];
  for (const colorSet of colorSets) {
    const str = buildColorString([...colorSet]);
    if (!seen.has(str)) {
      seen.add(str);
      results.push(str);
    }
  }
  return results.length > 0 ? results : ['generic'];
}

/**
 * Build a color string from an array of color names.
 * Orders colors in WUBRG order and joins with '+'.
 * Handles 'colorless' by placing it after the WUBRG colors.
 */
function buildColorString(colors: string[]): string {
  if (colors.length === 0) return 'generic';

  const cardColorValues = colors.filter(c => cardColors.includes(c as CardColor)) as CardColor[];
  const hasColorless = colors.includes('colorless');

  const ordered = cardColorValues.length > 0 ? toOrderedColors(cardColorValues) : [];
  const parts: string[] = [...ordered];
  if (hasColorless) parts.push('colorless');

  return parts.length > 0 ? parts.join('+') : 'generic';
}

/**
 * Union two color strings together.
 * E.g. unionColors("white", "green") → "green+white" (WUBRG ordered).
 */
function unionColors(a: string, b: string): string {
  if (a === 'generic') return b;
  if (b === 'generic') return a;

  const allParts = new Set([...a.split('+'), ...b.split('+')]);
  return buildColorString([...allParts]);
}

// ─── Activated Ability Parsing ───────────────────────────────────────────────

/**
 * Parse an activated ability into its cost and effect parts.
 *
 * An activated ability has a cost portion followed by ": " and then the effect.
 * The cost portion contains mana symbols ({1}, {T}, {G}, etc.) and/or
 * keywords like "Sacrifice" or "Discard".
 *
 * Returns null if the text is not an activated ability.
 */
function parseActivatedAbility(text: string): { cost: string; effect: string } | null {
  // Find the ": " separator — but only if the part before it looks like a cost
  // Costs contain mana symbols, {T}, and/or sacrifice/discard keywords
  const colonIndex = text.indexOf(': ');
  if (colonIndex === -1) return null;

  const before = text.substring(0, colonIndex);

  // A cost should contain at least one of: mana symbols, {T}, Sacrifice, Discard, Exile, Tap, Remove
  const costIndicators = /\{[^}]+\}|[Ss]acrifice|[Dd]iscard|[Ee]xile|[Tt]ap|[Rr]emove|[Pp]ay/;
  if (!costIndicators.test(before)) return null;

  // Make sure the part before doesn't look like a trigger (starting with "When", "Whenever", "At", "If")
  const trimmedBefore = before.trimStart();
  if (/^(When|Whenever|At the|If )/i.test(trimmedBefore)) return null;

  return {
    cost: before.trim(),
    effect: text.substring(colonIndex + 2).trim(),
  };
}

// ─── Fragment Splitting ──────────────────────────────────────────────────────

/** Trigger/conditional prefixes that indicate the first comma separates condition from effect. */
const triggerPrefixes = /^(when |whenever |if |at the )/i;

/** Pattern to split compound triggers joined by "and when/whenever/if/at the". */
const triggerAndPattern = / and (when |whenever |if |at the )/i;

/**
 * Split text on a delimiter, respecting quoted strings.
 * Returns the parts (trimmed, empty filtered).
 */
function splitRespectingQuotes(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  const delimLen = delimiter.length;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && text.substring(i, i + delimLen) === delimiter) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        parts.push(trimmed);
      }
      current = '';
      i += delimLen - 1; // skip past delimiter
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    parts.push(trimmed);
  }

  return parts;
}

/**
 * Split text on the FIRST occurrence of a delimiter (outside quotes).
 * Returns [before, after] if found, or [text] if not found.
 */
function splitOnFirstRespectingQuotes(text: string, delimiter: string): string[] {
  let inQuotes = false;
  const delimLen = delimiter.length;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && text.substring(i, i + delimLen) === delimiter) {
      const before = text.substring(0, i).trim();
      const after = text.substring(i + delimLen).trim();
      const result: string[] = [];
      if (before.length > 0) result.push(before);
      if (after.length > 0) result.push(after);
      return result;
    }
  }

  return [text];
}

/**
 * Split text into fragments based on the context.
 *
 * In 'cost' mode: splits on every comma (outside quotes). Used for activated ability costs.
 *
 * In 'ability' mode: splits using sentence boundaries, trigger/conditional comma splitting,
 * compound trigger "and" splitting, and ", then" splitting. Used for ability effects and
 * triggered/static ability text.
 *
 * All splitting respects quoted strings — never splits inside "...".
 */
export function splitFragments(text: string, context: 'cost' | 'ability'): string[] {
  if (context === 'cost') {
    return splitRespectingQuotes(text, ',');
  }

  // === ABILITY MODE ===

  // Step 1: Split on sentence boundaries (". " — period followed by space)
  // Also strip trailing period from last fragment
  let input = text.trim();
  if (input.endsWith('.')) {
    // Check we're not inside quotes
    let quoteCount = 0;
    for (const ch of input) {
      if (ch === '"') quoteCount++;
    }
    // Only strip if quotes are balanced (even count)
    if (quoteCount % 2 === 0) {
      input = input.substring(0, input.length - 1).trim();
    }
  }
  const sentences = splitRespectingQuotes(input, '. ');

  const result: string[] = [];

  for (let sentence of sentences) {
    // Step 2: Strip "Then" prefix
    const thenMatch = sentence.match(/^then[, ]\s*/i);
    if (thenMatch) {
      sentence = sentence.substring(thenMatch[0].length);
    }

    // Step 3a: Conditional/trigger comma split
    if (triggerPrefixes.test(sentence)) {
      const parts = splitOnFirstRespectingQuotes(sentence, ',');
      if (parts.length === 2) {
        const triggerPart = parts[0];
        const effectPart = parts[1];

        // Step 3b: Split compound triggers on " and when/whenever/if/at the"
        const triggerFragments: string[] = [];
        let remaining = triggerPart;
        let andMatch = remaining.match(triggerAndPattern);
        while (andMatch && andMatch.index !== undefined) {
          const before = remaining.substring(0, andMatch.index).trim();
          if (before.length > 0) triggerFragments.push(before);
          // Keep the trigger word (when/whenever/if/at the) with the rest
          remaining = remaining.substring(andMatch.index + ' and '.length).trim();
          andMatch = remaining.match(triggerAndPattern);
        }
        if (remaining.trim().length > 0) triggerFragments.push(remaining.trim());

        // Add trigger fragments, then process effectPart through step 4
        result.push(...triggerFragments);

        // Step 4 on effect part: split on ", then " (with exception for ", then shuffle")
        const effectFragments = splitThenFragments(effectPart);
        result.push(...effectFragments);
      } else {
        // No comma found — process entire sentence through step 4
        const fragments = splitThenFragments(sentence);
        result.push(...fragments);
      }
    } else {
      // No trigger prefix — process through step 4
      const fragments = splitThenFragments(sentence);
      result.push(...fragments);
    }
  }

  // Step 5: Trim and filter
  return result.map(f => f.trim()).filter(f => f.length > 0);
}

/**
 * Step 4: Split on ", then " (case-insensitive), except when followed by "shuffle".
 * Then apply step 4b: split on " and " when followed by an action verb.
 */
function splitThenFragments(text: string): string[] {
  const thenResult: string[] = [];
  let inQuotes = false;

  let current = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && text.substring(i, i + 7).toLowerCase() === ', then ') {
      // Check exception: ", then shuffle" (followed by end of string or period)
      const afterThen = text.substring(i + 7);
      if (/^shuffle\b/i.test(afterThen)) {
        // Don't split — keep as part of current fragment
        current += char;
      } else {
        // Split here
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          thenResult.push(trimmed);
        }
        current = '';
        i += 6; // skip ", then" (the space after "then" starts the next fragment)
      }
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    thenResult.push(trimmed);
  }

  // Step 4b: Split each fragment on " and " when followed by an action verb
  const result: string[] = [];
  for (const fragment of thenResult) {
    result.push(...splitEffectAnd(fragment));
  }

  return result;
}

/**
 * Action verbs that indicate an independent effect clause after " and ".
 * When " and " is followed by one of these verbs, the two sides are separate effects.
 * E.g. "create an Asteroid token and scry 2" → two fragments.
 * But "trample and haste" or "gets +1/+1 and has flying" → do NOT split.
 */
const effectAndVerbs = /^(draw|create|destroy|exile|sacrifice|return|put|search|scry|mill|surveil|gain|lose|discard|deal|tap|untap|counter|add|reveal|look|shuffle|transform|play|cast|remove|choose|copy|fight|pay|each|you|target)\b/i;

/**
 * Step 4b: Split text on " and " when followed by an action verb (outside quotes).
 * This breaks compound effects like "create a token and scry 2" into separate fragments
 * while preserving compound nouns like "trample and haste" or "vigilance, trample, and haste".
 */
function splitEffectAnd(text: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && text.substring(i, i + 5).toLowerCase() === ' and ') {
      const afterAnd = text.substring(i + 5);
      if (effectAndVerbs.test(afterAnd)) {
        // Split here — the part after "and" starts an independent effect
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          result.push(trimmed);
        }
        current = '';
        i += 4; // skip " and" (the space after starts the next fragment)
      } else {
        current += char;
      }
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    result.push(trimmed);
  }

  return result;
}

// ─── Normalization ───────────────────────────────────────────────────────────

/** Patterns for self-reference replacement. */
const selfReferencePatterns = [
  'this creature',
  'this artifact',
  'this permanent',
  'this spell',
  'this enchantment',
  'this land',
];

/** Countable MTG nouns (singular and plural forms) for word-number lookahead. */
const countableNouns = 'cards?|creatures?|tokens?|counters?|lands?|permanents?|targets?|opponents?|artifacts?|enchantments?|times?';

/**
 * Verbs after which "a"/"an" means "one" rather than an article.
 * E.g. "draw a card" = draw one card, but "a creature dies" = any creature.
 */
const countingVerbs = 'draw|draws|create|creates|discard|discards|exile|exiles|destroy|destroys|sacrifice|sacrifices|return|returns|gain|gains|lose|loses|add|adds|mill|mills|put|puts|search|play|plays|cast|casts|get|gets|produce|produces|make|makes|choose|reveal|reveals|remove|removes';

/** Word-number replacements: English word → digit string. */
const wordNumbers: [RegExp, string | ((match: string) => string)][] = [
  // "a"/"an" → 1 only after counting verbs (e.g. "draw a card" but NOT "a creature dies")
  // Allows 0-2 intervening words before countable noun (e.g. "create an Asteroid token", "draw a basic land card")
  [new RegExp(`(?:${countingVerbs}) \\b(?:a|an) (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), (match: string) => {
    // Replace the "a"/"an" part while keeping the verb
    return match.replace(/\b(?:a|an) /, '1 ');
  }],
  // "one" always means the number 1
  [new RegExp(`\\bone (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '1 '],
  [new RegExp(`\\btwo (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '2 '],
  [new RegExp(`\\bthree (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '3 '],
  [new RegExp(`\\bfour (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '4 '],
  [new RegExp(`\\bfive (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '5 '],
  [new RegExp(`\\bsix (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '6 '],
  [new RegExp(`\\bseven (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '7 '],
  [new RegExp(`\\beight (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '8 '],
  [new RegExp(`\\bnine (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '9 '],
  [new RegExp(`\\bten (?=(?:\\w+ ){0,2}(?:${countableNouns}))`, 'gi'), '10 '],
];

/** Singular nouns to normalize to plural after N, allowing 0-2 intervening words. */
const singularToPlural = /\bN ((?:\w+ ){0,2})(card|creature|token|counter|land|permanent|target|opponent|time|artifact|enchantment)\b/g;

/**
 * Create a MechanicFragment from raw text.
 *
 * The `original` preserves the text as-is (trimmed, trailing period stripped).
 * The `normalized` lowercases, replaces self-references with ~, replaces
 * word-numbers with digits, replaces specific numbers with N, and normalizes
 * singular nouns after N to plural.
 */
export function normalizeFragment(text: string): MechanicFragment {
  // Strip trailing period
  let original = text.trim();
  if (original.endsWith('.')) {
    original = original.substring(0, original.length - 1).trim();
  }

  let normalized = original.toLowerCase();

  // Replace self-references with ~
  for (const pattern of selfReferencePatterns) {
    normalized = normalized.replace(new RegExp(pattern.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~');
  }

  // Word numbers → digits (before number normalization): "draw a card" → "draw 1 card", "two cards" → "2 cards"
  for (const [regex, replacement] of wordNumbers) {
    if (typeof replacement === 'function') {
      normalized = normalized.replace(regex, replacement);
    } else {
      normalized = normalized.replace(regex, replacement);
    }
  }

  // Replace numbers in specific contexts with N
  // P/T modifications: +2/+0 → +N/+N, -2/-2 → -N/-N
  normalized = normalized.replace(/([+-])\d+\/([+-])\d+/g, '$1N/$2N');

  // Digit + countable noun: "3 creatures" → "N creatures", "2 cards" → "N cards", "1 asteroid token" → "N asteroid token"
  normalized = normalized.replace(new RegExp(`\\b(\\d+) ((?:\\w+ ){0,2}(?:${countableNouns})|life|damage)\\b`, 'g'), 'N $2');

  // "gain N life" pattern where number comes after verb
  normalized = normalized.replace(/\b(gain|lose|loses|gains|deals?|draw|draws?|mill|mills|surveil|surveils|scry) (\d+)\b/g, '$1 N');

  // Generic mana in cost symbols: {1}, {2}, etc. → {N}
  normalized = normalized.replace(/\{(\d+)\}/g, '{N}');

  // "costs {N} less" — already handled by above

  // Power/toughness references: "power 3 or less" → "power N or less"
  normalized = normalized.replace(/\b(power|toughness) (\d+)\b/g, '$1 N');

  // Singular → plural after N: "N card" → "N cards", "N asteroid token" → "N asteroid tokens"
  normalized = normalized.replace(singularToPlural, 'N $1$2s');

  return { normalized, original };
}

// ─── Game Stage ──────────────────────────────────────────────────────────────

/**
 * Convert an earliest-turn number to a game stage.
 * Early = 0-2, Mid = 3-4, Late = 5+.
 */
function turnToStage(turn: number): 'early' | 'mid' | 'late' {
  if (turn <= 2) return 'early';
  if (turn <= 4) return 'mid';
  return 'late';
}

/**
 * Compute the earliest turn an activated ability can be used.
 *
 * Rules:
 * - If {T} is NOT in the activation cost:
 *     - If activation mana cost is 0: earliest = card_mv
 *     - If activation mana cost <= card_mv: earliest = card_mv + 1
 *     - If activation mana cost > card_mv: earliest = activation_mana_cost
 *
 * - If {T} IS in the activation cost:
 *     - If face is a creature without haste (summoning sickness):
 *         earliest = max(card_mv + 1, activation_mana_cost)
 *     - Otherwise (non-creature or creature with haste):
 *         Same as the no-{T} rules above
 */
function computeActivatedAbilityEarliestTurn(
  cardMV: number,
  activationManaCost: number,
  hasTap: boolean,
  isCreature: boolean,
  hasHaste: boolean,
): number {
  if (hasTap && isCreature && !hasHaste) {
    // Creature with summoning sickness — must wait a turn before tapping
    return Math.max(cardMV + 1, activationManaCost);
  }

  // Non-creature, creature with haste, or no tap in cost
  if (activationManaCost === 0) {
    return cardMV;
  }
  if (activationManaCost <= cardMV) {
    return cardMV + 1;
  }
  return activationManaCost;
}

/**
 * Compute the earliest turn a planeswalker loyalty ability can be used.
 *
 * For +N or -X abilities: earliest = card_mv (usable immediately).
 * For -N abilities: calculate how many +ability activations are needed to
 * accumulate enough loyalty, then earliest = card_mv + turns_to_reach.
 */
function computePlaneswalkerAbilityEarliestTurn(
  cardMV: number,
  loyaltyCost: number | '-X',
  startingLoyalty: number,
  highestPlusAbility: number,
): number {
  if (loyaltyCost === '-X' || loyaltyCost >= 0) {
    return cardMV;
  }

  const absCost = Math.abs(loyaltyCost);
  const effectivePlus = highestPlusAbility > 0 ? highestPlusAbility : 1;
  const turnsToReach = Math.max(0, Math.ceil((absCost - startingLoyalty) / effectivePlus));
  return cardMV + turnsToReach;
}

// ─── Transform Context ──────────────────────────────────────────────────────

/**
 * A single path to reach the back face of a transform card.
 *
 * Each transform ability on the front face creates one or more paths, each with
 * its own color context and timing. This allows back face mechanics to be
 * correctly attributed to the specific transform route that was taken.
 */
interface TransformPath {
  /** Colors needed to reach the back face via this path (front cast colors ∪ transform activation colors). */
  colors: string[];
  /** Earliest turn the back face can appear via this path. */
  earliestTurn: number;
}

/**
 * Scan the front face of a transform card for abilities that contain
 * "transform" and derive the paths to reach the back face.
 *
 * Each transform ability produces a separate path with its own colors and timing:
 * - Activated abilities (e.g. "{1}{R}: Transform ~"): colors are the union of
 *   front cast colors + activation cost colors, timing from activation rules.
 * - Triggered/static abilities (e.g. "At the beginning of your upkeep,
 *   transform ~"): colors are the front cast colors, earliestTurn is the
 *   front face's MV.
 * - Fallback (no transform ability found): a single path with front cast
 *   colors and front face MV.
 */
function findTransformPaths(frontFace: CardFace): TransformPath[] {
  const frontMV = frontFace.manaValue();
  const frontCastColors = determineFaceCastColors(frontFace);
  const isCreature = frontFace.types.includes('creature');
  const hasHaste = frontFace.rules.some(r => r.variant === 'keyword' && r.content.toLowerCase() === 'haste');

  const paths: TransformPath[] = [];

  // Scan all ability rules for "transform" text
  for (const rule of frontFace.rules) {
    if (rule.variant !== 'ability') continue;
    if (!rule.content.toLowerCase().includes('transform')) continue;

    // Try to parse as activated ability
    const activated = parseActivatedAbility(rule.content);
    if (activated) {
      const hasTap = /\{[tT]\}/.test(activated.cost);
      const activationManaCost = computeManaCostFromText(activated.cost);
      const earliestTurn = computeActivatedAbilityEarliestTurn(
        frontMV, activationManaCost, hasTap, isCreature, hasHaste,
      );

      // Union front cast colors with activation cost colors
      const activationColors = extractColorsFromManaSymbols(activated.cost);
      const activationHasColorless = hasColorlessMana(activated.cost);
      const abilityColorParts: string[] = [...activationColors];
      if (activationHasColorless) abilityColorParts.push('colorless');
      const abilityColorString = abilityColorParts.length > 0
        ? buildColorString(abilityColorParts)
        : '';

      const colors = abilityColorString
        ? [...new Set(frontCastColors.map(c => unionColors(c, abilityColorString)))]
        : [...frontCastColors];

      paths.push({ colors, earliestTurn });
    } else {
      // Triggered/static ability with "transform" — use front MV
      paths.push({ colors: [...frontCastColors], earliestTurn: frontMV });
    }
  }

  // Fallback: no transform ability found
  if (paths.length === 0) {
    return [{ colors: [...frontCastColors], earliestTurn: frontMV }];
  }

  return paths;
}

// ─── Main Extraction ─────────────────────────────────────────────────────────

/**
 * Check if a face has the haste keyword in its rules.
 */
function faceHasHaste(face: CardFace): boolean {
  return face.rules.some(r => r.variant === 'keyword' && r.content.toLowerCase() === 'haste');
}

/**
 * Check if a face is a creature (has 'creature' in its types).
 */
function faceIsCreature(face: CardFace): boolean {
  return face.types.includes('creature');
}

/**
 * Extract all mechanic entries from a single card.
 *
 * Processes each face independently, determining color from the face's mana cost
 * (with hybrid mana expansion) and game stage from the card's mana value and
 * ability activation costs.
 *
 * Token cards always return an empty array — their mechanics are instead extracted
 * through the cards that create them, when `options.tokens` is provided.
 *
 * @param serializedCard The serialized card data to extract mechanics from.
 * @param options Optional configuration for the extraction.
 * @returns An array of MechanicEntry objects.
 */
export function extractMechanics(serializedCard: SerializedCard, options?: MechanicExtractorOptions): MechanicEntry[] {
  // Token cards cannot be used on their own — their mechanics flow through the creating card
  if (serializedCard.isToken) return [];

  const card = new Card(serializedCard);
  const includeKeywords = options?.includeKeywords ?? false;
  const entries: MechanicEntry[] = [];

  // Build a lookup of token reference names to token cards for efficient matching
  const tokenCards: Card[] = (options?.tokens ?? []).map(t => new Card(t));
  const tokensByReferenceName = new Map<string, Card>();
  for (const tokenCard of tokenCards) {
    const refName = tokenCard.faces[0].getTokenReferenceName();
    tokensByReferenceName.set(refName, tokenCard);
  }

  // For transform cards, compute the paths to reach the back face
  const isTransform = card.layout.id === 'transform';
  const transformPaths = isTransform && card.faces.length > 1
    ? findTransformPaths(card.faces[0])
    : undefined;

  for (const face of card.faces) {
    const isBackFace = isTransform && face.faceIndex === 1;

    if (isBackFace && transformPaths) {
      // Process the back face once per transform path, each with its own
      // colors and earliestTurn context
      for (const path of transformPaths) {
        extractFaceEntries(
          entries, face, card, path.colors, path.earliestTurn,
          includeKeywords, tokensByReferenceName,
        );
      }
    } else {
      // Normal face (or front face of transform): use the face's own colors/MV
      const baseFaceColors = determineFaceCastColors(face);
      const cardMV = face.manaValue();
      extractFaceEntries(
        entries, face, card, baseFaceColors, cardMV,
        includeKeywords, tokensByReferenceName,
      );
    }
  }

  return entries;
}

/**
 * Extract mechanic entries from a single face using the given base colors and
 * base mana value (which serves as the earliest turn baseline).
 */
function extractFaceEntries(
  entries: MechanicEntry[],
  face: CardFace,
  card: Card,
  baseFaceColors: string[],
  cardMV: number,
  includeKeywords: boolean,
  tokensByReferenceName: Map<string, Card>,
): void {
  const isCreature = faceIsCreature(face);
  const hasHaste = faceHasHaste(face);

  // Find highest plus loyalty ability for planeswalkers
  const isPlaneswalker = face.types.includes('planeswalker');
  let highestPlusAbility = 0;
  if (isPlaneswalker) {
    for (const rule of face.rules) {
      const parsed = tryParseLoyaltyAbility(rule);
      if (parsed.success && typeof parsed.cost === 'number' && parsed.cost > highestPlusAbility) {
        highestPlusAbility = parsed.cost;
      }
    }
  }

  const source = { cardName: face.name, faceIndex: face.faceIndex, cid: card.cid };

  for (const rule of face.rules) {
    // Handle keywords
    if (rule.variant === 'keyword') {
      if (!includeKeywords) continue;
      const fragment = normalizeFragment(rule.content);
      const stage = turnToStage(cardMV);
      for (const colors of baseFaceColors) {
        entries.push({
          fragment,
          colors,
          rarity: card.rarity,
          stage,
          earliestTurn: cardMV,
          source,
        });
      }
      continue;
    }

    // Skip non-ability rules
    if (rule.variant !== 'ability') continue;

    // Handle planeswalker loyalty abilities
    if (isPlaneswalker) {
      const loyaltyParsed = tryParseLoyaltyAbility(rule);
      if (loyaltyParsed.success) {
        const earliestTurn = computePlaneswalkerAbilityEarliestTurn(
          cardMV,
          loyaltyParsed.cost,
          face.loyalty ?? 0,
          highestPlusAbility,
        );
        const stage = turnToStage(earliestTurn);

        // Split the loyalty ability content into fragments
        const fragments = splitFragments(loyaltyParsed.content, 'ability');
        for (const fragmentText of fragments) {
          const fragment = normalizeFragment(fragmentText);
          for (const colors of baseFaceColors) {
            entries.push({
              fragment,
              colors,
              rarity: card.rarity,
              stage,
              earliestTurn,
              source,
            });
          }
        }

        // Extract token mechanics for tokens created by this loyalty ability
        extractTokenMechanics(
          entries, rule, face, card, earliestTurn, baseFaceColors,
          includeKeywords, tokensByReferenceName,
        );
        continue;
      }
    }

    // Try to parse as an activated ability
    const activated = parseActivatedAbility(rule.content);

    if (activated) {
      // Compute activation cost and check for tap
      const hasTap = /\{[tT]\}/.test(activated.cost);
      const activationManaCost = computeManaCostFromText(activated.cost);

      const earliestTurn = computeActivatedAbilityEarliestTurn(
        cardMV, activationManaCost, hasTap, isCreature, hasHaste,
      );
      const stage = turnToStage(earliestTurn);

      // Determine colors for the activated ability (union of face colors + activation cost colors)
      const activationColors = extractColorsFromManaSymbols(activated.cost);
      const activationHasColorless = hasColorlessMana(activated.cost);

      const abilityColorParts: string[] = [...activationColors];
      if (activationHasColorless) abilityColorParts.push('colorless');

      const abilityColorString = abilityColorParts.length > 0
        ? buildColorString(abilityColorParts)
        : '';

      // Compute final colors for this activated ability
      const activatedAbilityColors = baseFaceColors.map(baseColor =>
        abilityColorString ? unionColors(baseColor, abilityColorString) : baseColor,
      );
      // Deduplicate
      const uniqueActivatedColors = [...new Set(activatedAbilityColors)];

      // Split cost and effect into fragments
      const costFragments = splitFragments(activated.cost, 'cost');
      const effectFragments = splitFragments(activated.effect, 'ability');
      const allFragments = [...costFragments, ...effectFragments];

      for (const fragmentText of allFragments) {
        const fragment = normalizeFragment(fragmentText);
        for (const finalColors of uniqueActivatedColors) {
          entries.push({
            fragment,
            colors: finalColors,
            rarity: card.rarity,
            stage,
            earliestTurn,
            source,
          });
        }
      }

      // Extract token mechanics for tokens created by this activated ability
      extractTokenMechanics(
        entries, rule, face, card, earliestTurn, uniqueActivatedColors,
        includeKeywords, tokensByReferenceName,
      );
    } else {
      // Triggered or static ability — use card MV for stage
      const stage = turnToStage(cardMV);
      const fragments = splitFragments(rule.content, 'ability');

      for (const fragmentText of fragments) {
        const fragment = normalizeFragment(fragmentText);
        for (const colors of baseFaceColors) {
          entries.push({
            fragment,
            colors,
            rarity: card.rarity,
            stage,
            earliestTurn: cardMV,
            source,
          });
        }
      }

      // Extract token mechanics for tokens created by this triggered/static ability
      extractTokenMechanics(
        entries, rule, face, card, cardMV, baseFaceColors,
        includeKeywords, tokensByReferenceName,
      );
    }
  }
}

// ─── Token Mechanic Extraction ───────────────────────────────────────────────

/**
 * Extract mechanics from tokens created by an ability rule.
 *
 * Detects "create ... token" text in the rule, finds matching token cards,
 * and extracts their mechanics using the creating ability's context (colors,
 * earliest turn, rarity).
 */
function extractTokenMechanics(
  entries: MechanicEntry[],
  rule: { variant: string; content: string },
  _face: CardFace,
  card: Card,
  creatingAbilityEarliestTurn: number,
  creatingAbilityColors: string[],
  includeKeywords: boolean,
  tokensByReferenceName: Map<string, Card>,
): void {
  if (tokensByReferenceName.size === 0) return;
  if (!rule.content.toLowerCase().includes('create')) return;

  // Use the TokenExtractor to find what tokens this ability creates
  const tokenExtractor = new TokenExtractor();
  const createdTokenNames = tokenExtractor.extractTokensFromAbility(rule.content);
  if (createdTokenNames.length === 0) return;

  for (const tokenName of createdTokenNames) {
    const tokenCard = tokensByReferenceName.get(tokenName);
    if (!tokenCard) continue;

    const tokenFace = tokenCard.faces[0];
    const tokenSource = { cardName: tokenFace.name, faceIndex: 0, cid: tokenCard.cid };

    // Process token's rules with the creating ability's context
    for (const tokenRule of tokenFace.rules) {
      if (tokenRule.variant === 'keyword') {
        if (!includeKeywords) continue;
        const fragment = normalizeFragment(tokenRule.content);
        const stage = turnToStage(creatingAbilityEarliestTurn);
        for (const colors of creatingAbilityColors) {
          entries.push({
            fragment,
            colors,
            rarity: card.rarity,
            stage,
            earliestTurn: creatingAbilityEarliestTurn,
            source: tokenSource,
          });
        }
        continue;
      }

      if (tokenRule.variant !== 'ability') continue;

      // Try to parse the token's ability as activated
      const activated = parseActivatedAbility(tokenRule.content);

      if (activated) {
        const hasTap = /\{[tT]\}/.test(activated.cost);
        const activationManaCost = computeManaCostFromText(activated.cost);
        const tokenIsCreature = tokenFace.types.includes('creature');
        const tokenHasHaste = tokenFace.rules.some(
          r => r.variant === 'keyword' && r.content.toLowerCase() === 'haste',
        );

        const earliestTurn = computeActivatedAbilityEarliestTurn(
          creatingAbilityEarliestTurn, activationManaCost, hasTap, tokenIsCreature, tokenHasHaste,
        );
        const stage = turnToStage(earliestTurn);

        const costFragments = splitFragments(activated.cost, 'cost');
        const effectFragments = splitFragments(activated.effect, 'ability');
        const allFragments = [...costFragments, ...effectFragments];

        for (const fragmentText of allFragments) {
          const fragment = normalizeFragment(fragmentText);
          for (const colors of creatingAbilityColors) {
            entries.push({
              fragment,
              colors,
              rarity: card.rarity,
              stage,
              earliestTurn,
              source: tokenSource,
            });
          }
        }
      } else {
        // Triggered or static ability on token — use the creating ability's earliest turn
        const stage = turnToStage(creatingAbilityEarliestTurn);
        const fragments = splitFragments(tokenRule.content, 'ability');

        for (const fragmentText of fragments) {
          const fragment = normalizeFragment(fragmentText);
          for (const colors of creatingAbilityColors) {
            entries.push({
              fragment,
              colors,
              rarity: card.rarity,
              stage,
              earliestTurn: creatingAbilityEarliestTurn,
              source: tokenSource,
            });
          }
        }
      }
    }
  }
}
