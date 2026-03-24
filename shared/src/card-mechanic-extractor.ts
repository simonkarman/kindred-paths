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

/**
 * Split a text into fragments on ", " boundaries.
 * Does not split inside quoted strings.
 * Trims each fragment and filters out empty ones.
 */
function splitFragments(text: string): string[] {
  const fragments: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        fragments.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    fragments.push(trimmed);
  }

  return fragments;
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

/**
 * Create a MechanicFragment from raw text.
 *
 * The `original` preserves the text as-is (trimmed, trailing period stripped).
 * The `normalized` lowercases, replaces self-references with ~, and replaces
 * specific numbers with N.
 */
function normalizeFragment(text: string): MechanicFragment {
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

  // Replace numbers in specific contexts with N
  // P/T modifications: +2/+0 → +N/+N, -2/-2 → -N/-N
  normalized = normalized.replace(/([+-])\d+\/([+-])\d+/g, '$1N/$2N');

  // Life, damage, cards, etc.: "N life", "N damage", "N cards"
  normalized = normalized.replace(/\b(\d+) (life|damage|cards?|times?)\b/g, 'N $2');

  // "gain N life" pattern where number comes after verb
  normalized = normalized.replace(/\b(gain|lose|loses|gains|deals?|draw|draws?|mill|mills|surveil|surveils|scry) (\d+)\b/g, '$1 N');

  // Generic mana in cost symbols: {1}, {2}, etc. → {N}
  normalized = normalized.replace(/\{(\d+)\}/g, '{N}');

  // "costs {N} less" — already handled by above

  // Power/toughness references: "power 3 or less" → "power N or less"
  normalized = normalized.replace(/\b(power|toughness) (\d+)\b/g, '$1 N');

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
        const fragments = splitFragments(loyaltyParsed.content);
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
      const costFragments = splitFragments(activated.cost);
      const effectFragments = splitFragments(activated.effect);
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
      const fragments = splitFragments(rule.content);

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

        const costFragments = splitFragments(activated.cost);
        const effectFragments = splitFragments(activated.effect);
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
        const fragments = splitFragments(tokenRule.content);

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
