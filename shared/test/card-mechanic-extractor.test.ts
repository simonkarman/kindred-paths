/* eslint-disable max-len */
import { describe, expect, test } from 'vitest';
import { extractMechanics, MechanicEntry, SerializedCard, splitFragments, normalizeFragment } from '../src';

/** Helper to create a SerializedCard with proper literal types from a plain object. */
function asCard(props: SerializedCard): SerializedCard {
  return props;
}

/** Helper to find entries matching a normalized fragment. */
function findByNormalized(entries: MechanicEntry[], pattern: string): MechanicEntry[] {
  return entries.filter(e => e.fragment.normalized.includes(pattern));
}

// ─── Shielding Shard ─────────────────────────────────────────────────────────
describe('Shielding Shard ({W} common artifact)', () => {
  const card = asCard({
    cid: 'n86uvwqx',
    rarity: 'common',
    collectorNumber: 32,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Shielding Shard',
      manaCost: { white: 1 },
      types: ['artifact'],
      subtypes: ['asteroid'],
      rules: [
        { variant: 'ability', content: 'When this artifact enters and when you sacrifice it, you gain 2 life.' },
        { variant: 'ability', content: '{1}, {T}, Sacrifice this artifact: Exile the top card of your library. You may play it this turn.' },
      ],
    }],
  });

  const entries = extractMechanics(card);

  test('should produce fragments from the ETB/sacrifice trigger (compound trigger split)', () => {
    // New splitting splits compound triggers: "When ~ enters and when you sacrifice it, you gain 2 life."
    // → ["When this artifact enters", "when you sacrifice it", "you gain 2 life"]
    const etbFragment = findByNormalized(entries, 'when ~ enters');
    expect(etbFragment.length).toBeGreaterThan(0);
    expect(etbFragment[0].colors).toBe('white');
    expect(etbFragment[0].rarity).toBe('common');

    const sacrificeFragment = findByNormalized(entries, 'when you sacrifice it');
    expect(sacrificeFragment.length).toBeGreaterThan(0);
    expect(sacrificeFragment[0].colors).toBe('white');
  });

  test('should produce "you gain N life" fragment', () => {
    const lifeGain = findByNormalized(entries, 'you gain N life');
    expect(lifeGain.length).toBeGreaterThan(0);
    expect(lifeGain[0].fragment.original).toBe('you gain 2 life');
  });

  test('should produce fragments from the activated crack ability', () => {
    const tapFragment = findByNormalized(entries, '{N}');
    expect(tapFragment.length).toBeGreaterThan(0);

    const sacrificeFragment = findByNormalized(entries, 'sacrifice ~');
    expect(sacrificeFragment.length).toBeGreaterThan(0);
  });

  test('ETB trigger should be at stage early (mv=1)', () => {
    const etbFragments = findByNormalized(entries, 'when ~ enters');
    expect(etbFragments[0].stage).toBe('early');
    expect(etbFragments[0].earliestTurn).toBe(1);
  });

  test('activated ability should be at stage early (non-creature, mv=1, act=1, earliest=1+1=2)', () => {
    const exileFragment = findByNormalized(entries, 'exile the top card of your library');
    expect(exileFragment.length).toBeGreaterThan(0);
    expect(exileFragment[0].stage).toBe('early');
    expect(exileFragment[0].earliestTurn).toBe(2);
  });

  test('all entries should be white', () => {
    expect(entries.every(e => e.colors === 'white')).toBe(true);
  });
});

// ─── Spore Tender ────────────────────────────────────────────────────────────
describe('Spore Tender ({G}{G} common creature)', () => {
  const card = asCard({
    cid: 'bcvevn87',
    rarity: 'common',
    collectorNumber: 25,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Spore Tender',
      manaCost: { green: 2 },
      types: ['creature'],
      subtypes: ['elf', 'druid'],
      rules: [
        { variant: 'ability', content: '{T}: Add {G}.' },
        { variant: 'ability', content: '{1}{G}, {T}: Create an Asteroid token.' },
        { variant: 'inline-reminder', content: 'It\'s an artifact with "{1}, {T}, Sacrifice this artifact: Exile the top card of your library. You may play it this turn."' },
      ],
      pt: { power: 1, toughness: 1 },
    }],
  });

  const entries = extractMechanics(card);

  test('should skip inline-reminder text', () => {
    const reminderFragments = entries.filter(e => e.fragment.original.includes('It\'s an artifact'));
    expect(reminderFragments).toHaveLength(0);
  });

  test('{T}: Add {G} — creature with summoning sickness, earliest = max(2+1, 0) = 3', () => {
    const addMana = findByNormalized(entries, 'add {g}');
    expect(addMana.length).toBeGreaterThan(0);
    expect(addMana[0].earliestTurn).toBe(3);
    expect(addMana[0].stage).toBe('mid');
  });

  test('{1}{G}, {T}: Create Asteroid — creature, earliest = max(2+1, 2) = 3', () => {
    const createAsteroid = findByNormalized(entries, 'create N asteroid tokens');
    expect(createAsteroid.length).toBeGreaterThan(0);
    expect(createAsteroid[0].earliestTurn).toBe(3);
    expect(createAsteroid[0].stage).toBe('mid');
  });

  test('all entries should be green', () => {
    expect(entries.every(e => e.colors === 'green')).toBe(true);
  });
});

// ─── Beacon Surveyor (hybrid) ────────────────────────────────────────────────
describe('Beacon Surveyor ({1}{W/U} hybrid common)', () => {
  const card = asCard({
    cid: '3apejhgs',
    rarity: 'common',
    collectorNumber: 42,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Beacon Surveyor',
      manaCost: { generic: 1, 'white/blue': 1 },
      types: ['creature'],
      subtypes: ['human', 'scout'],
      rules: [
        { variant: 'keyword', content: 'flying' },
        { variant: 'inline-reminder', content: 'This creature can\'t be blocked except by creatures with flying or reach.' },
      ],
      pt: { power: 1, toughness: 1 },
    }],
  });

  test('should produce no entries without includeKeywords', () => {
    const entries = extractMechanics(card);
    expect(entries).toHaveLength(0);
  });

  test('should produce keyword entries for both white and blue with includeKeywords', () => {
    const entries = extractMechanics(card, { includeKeywords: true });
    expect(entries.length).toBe(2);
    const colors = entries.map(e => e.colors).sort();
    expect(colors).toEqual(['blue', 'white']);
    expect(entries[0].fragment.normalized).toBe('flying');
  });

  test('should skip inline-reminder even with includeKeywords', () => {
    const entries = extractMechanics(card, { includeKeywords: true });
    const reminder = entries.filter(e => e.fragment.original.includes('can\'t be blocked'));
    expect(reminder).toHaveLength(0);
  });
});

// ─── Fleet Tactician (multi-color) ──────────────────────────────────────────
describe('Fleet Tactician ({W}{U}{1} uncommon)', () => {
  const card = asCard({
    cid: 'doepz12g',
    rarity: 'uncommon',
    collectorNumber: 62,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Fleet Tactician',
      manaCost: { white: 1, blue: 1, generic: 1 },
      types: ['creature'],
      subtypes: ['human', 'advisor'],
      rules: [
        { variant: 'keyword', content: 'flying' },
        { variant: 'ability', content: 'When this creature enters, create an Asteroid token.' },
        { variant: 'inline-reminder', content: 'It\'s an artifact with "{1},{lns}{T}, Sacrifice this artifact: Exile the top card of your library. You may play it this turn."' },
        { variant: 'ability', content: 'Sacrifice an Asteroid: Tap target permanent.' },
      ],
      pt: { power: 2, toughness: 3 },
    }],
  });

  const entries = extractMechanics(card);

  test('all entries should be white+blue (requires both colors)', () => {
    // Note: toOrderedColors puts white before blue
    expect(entries.every(e => e.colors === 'white+blue')).toBe(true);
  });

  test('should have ETB trigger fragment', () => {
    const etb = findByNormalized(entries, 'when ~ enters');
    expect(etb.length).toBeGreaterThan(0);
    expect(etb[0].rarity).toBe('uncommon');
  });

  test('activated ability "Sacrifice an Asteroid: Tap target permanent" — no {T}, act=0, earliest=3', () => {
    const tap = findByNormalized(entries, 'tap target permanent');
    expect(tap.length).toBeGreaterThan(0);
    expect(tap[0].earliestTurn).toBe(3);
    expect(tap[0].stage).toBe('mid');
  });
});

// ─── Drift Igniter / Crack and Burn (adventure) ─────────────────────────────
describe('Drift Igniter / Crack and Burn (adventure)', () => {
  const card = asCard({
    cid: 'ehng5pvn',
    rarity: 'common',
    collectorNumber: 40,
    tags: { set: 'SHX' },
    layout: 'adventure',
    faces: [
      {
        name: 'Drift Igniter',
        manaCost: { generic: 2, red: 1 },
        types: ['creature'],
        subtypes: ['goblin', 'shaman'],
        rules: [
          { variant: 'keyword', content: 'haste' },
          { variant: 'ability', content: 'When this creature enters, create an Asteroid token.' },
        ],
        pt: { power: 3, toughness: 2 },
      },
      {
        name: 'Crack and Burn',
        manaCost: { red: 1 },
        types: ['instant'],
        subtypes: ['adventure'],
        rules: [
          { variant: 'ability', content: '~ deals 2 damage to any target.' },
        ],
      },
    ],
  });

  const entries = extractMechanics(card);

  test('creature face should have ETB trigger at red', () => {
    const etb = entries.filter(e => e.source.faceIndex === 0 && e.fragment.normalized.includes('when ~ enters'));
    expect(etb.length).toBe(1);
    expect(etb[0].colors).toBe('red');
    expect(etb[0].earliestTurn).toBe(3);
  });

  test('adventure face should have damage ability at red (from its own mana cost)', () => {
    const damage = entries.filter(e => e.source.faceIndex === 1);
    expect(damage.length).toBe(1);
    expect(damage[0].colors).toBe('red');
    expect(damage[0].fragment.normalized).toBe('~ deals N damage to any target');
    expect(damage[0].earliestTurn).toBe(1);
    expect(damage[0].stage).toBe('early');
  });

  test('adventure face should preserve original with exact number', () => {
    const damage = entries.filter(e => e.source.faceIndex === 1);
    expect(damage[0].fragment.original).toBe('~ deals 2 damage to any target');
  });
});

// ─── Token cards return empty ────────────────────────────────────────────────
describe('Token cards return empty array', () => {
  const asteroidToken = asCard({
    cid: '7uuewu9f',
    isToken: true,
    rarity: 'common',
    collectorNumber: 31,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Asteroid',
      givenColors: [],
      types: ['artifact'],
      subtypes: ['asteroid'],
      rules: [
        { variant: 'ability', content: '{1}, {T}, Sacrifice this artifact: Exile the top card of your library. You may play it this turn.' },
      ],
    }],
  });

  test('token card should return empty array', () => {
    const entries = extractMechanics(asteroidToken);
    expect(entries).toHaveLength(0);
  });

  test('token card should return empty array even with tokens option', () => {
    const entries = extractMechanics(asteroidToken, { tokens: [asteroidToken] });
    expect(entries).toHaveLength(0);
  });
});

// ─── Token mechanics flow through creating card ──────────────────────────────
describe('Token mechanics flow through creating card', () => {
  const asteroidToken = asCard({
    cid: '7uuewu9f',
    isToken: true,
    rarity: 'common',
    collectorNumber: 31,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Asteroid',
      givenColors: [],
      types: ['artifact'],
      subtypes: ['asteroid'],
      rules: [
        { variant: 'ability', content: '{1}, {T}, Sacrifice this artifact: Exile the top card of your library. You may play it this turn.' },
      ],
    }],
  });

  test('creating card without tokens option should not include token mechanics', () => {
    const sporeTender = asCard({
      cid: 'bcvevn87',
      rarity: 'common',
      collectorNumber: 25,
      tags: { set: 'SHX' },
      layout: 'normal',
      faces: [{
        name: 'Spore Tender',
        manaCost: { green: 2 },
        types: ['creature'],
        subtypes: ['elf', 'druid'],
        rules: [
          { variant: 'ability', content: '{T}: Add {G}.' },
          { variant: 'ability', content: '{1}{G}, {T}: Create an Asteroid token.' },
        ],
        pt: { power: 1, toughness: 1 },
      }],
    });
    const entries = extractMechanics(sporeTender);
    const tokenEntries = entries.filter(e => e.source.cardName === 'Asteroid');
    expect(tokenEntries).toHaveLength(0);
  });

  test('creating card with tokens option should include token activated ability mechanics', () => {
    // Spore Tender: {G}{G} creature, "{1}{G}, {T}: Create an Asteroid token."
    // Activated ability earliest turn: creature with {T}, no haste → max(2+1, 2) = 3
    // Token's activated ability: {1}, {T}, Sacrifice: artifact (non-creature), act=1
    // Token arrives at turn 3, act(1) <= mv(3) and act != 0 → earliest = 3+1 = 4
    const sporeTender = asCard({
      cid: 'bcvevn87',
      rarity: 'common',
      collectorNumber: 25,
      tags: { set: 'SHX' },
      layout: 'normal',
      faces: [{
        name: 'Spore Tender',
        manaCost: { green: 2 },
        types: ['creature'],
        subtypes: ['elf', 'druid'],
        rules: [
          { variant: 'ability', content: '{T}: Add {G}.' },
          { variant: 'ability', content: '{1}{G}, {T}: Create an Asteroid token.' },
        ],
        pt: { power: 1, toughness: 1 },
      }],
    });

    const entries = extractMechanics(sporeTender, { tokens: [asteroidToken] });
    const tokenEntries = entries.filter(e => e.source.cardName === 'Asteroid');

    expect(tokenEntries.length).toBeGreaterThan(0);
    expect(tokenEntries.every(e => e.colors === 'green')).toBe(true);
    expect(tokenEntries.every(e => e.rarity === 'common')).toBe(true);

    // Token's activated ability timing: non-creature artifact, act=1, mv=3 → earliest = 4
    const exileFragment = tokenEntries.filter(e => e.fragment.normalized.includes('exile the top card'));
    expect(exileFragment.length).toBeGreaterThan(0);
    expect(exileFragment[0].earliestTurn).toBe(4);
    expect(exileFragment[0].stage).toBe('mid');
  });

  test('ETB trigger that creates token should include token mechanics', () => {
    // Fleet Tactician: {W}{U}{1} → white+blue, mv=3
    // "When this creature enters, create an Asteroid token."
    // Triggered ability: earliest = 3
    // Token's activated ability: act=1, mv=3 → earliest = 4
    const fleetTactician = asCard({
      cid: 'doepz12g',
      rarity: 'uncommon',
      collectorNumber: 62,
      tags: { set: 'SHX' },
      layout: 'normal',
      faces: [{
        name: 'Fleet Tactician',
        manaCost: { white: 1, blue: 1, generic: 1 },
        types: ['creature'],
        subtypes: ['human', 'advisor'],
        rules: [
          { variant: 'keyword', content: 'flying' },
          { variant: 'ability', content: 'When this creature enters, create an Asteroid token.' },
          { variant: 'ability', content: 'Sacrifice an Asteroid: Tap target permanent.' },
        ],
        pt: { power: 2, toughness: 3 },
      }],
    });

    const entries = extractMechanics(fleetTactician, { tokens: [asteroidToken] });
    const tokenEntries = entries.filter(e => e.source.cardName === 'Asteroid');

    expect(tokenEntries.length).toBeGreaterThan(0);
    expect(tokenEntries.every(e => e.colors === 'white+blue')).toBe(true);
    expect(tokenEntries.every(e => e.rarity === 'uncommon')).toBe(true);

    const exileFragment = tokenEntries.filter(e => e.fragment.normalized.includes('exile the top card'));
    expect(exileFragment[0].earliestTurn).toBe(4);
  });

  test('token source should reference the token card, not the creating card', () => {
    const sporeTender = asCard({
      cid: 'bcvevn87',
      rarity: 'common',
      collectorNumber: 25,
      layout: 'normal',
      faces: [{
        name: 'Spore Tender',
        manaCost: { green: 2 },
        types: ['creature'],
        subtypes: ['elf', 'druid'],
        rules: [
          { variant: 'ability', content: '{1}{G}, {T}: Create an Asteroid token.' },
        ],
        pt: { power: 1, toughness: 1 },
      }],
    });

    const entries = extractMechanics(sporeTender, { tokens: [asteroidToken] });
    const tokenEntries = entries.filter(e => e.source.cardName === 'Asteroid');
    expect(tokenEntries[0].source.cid).toBe('7uuewu9f');
    expect(tokenEntries[0].source.faceIndex).toBe(0);
  });
});

// ─── Number Normalization ────────────────────────────────────────────────────
describe('Number normalization', () => {
  test('life gain: "you gain 2 life" → "you gain N life"', () => {
    const card = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Life Gainer',
        manaCost: { white: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: 'When this creature enters, you gain 2 life.' }],
        pt: { power: 1, toughness: 1 },
      }],
    });
    const entries = extractMechanics(card);
    const lifeGain = findByNormalized(entries, 'you gain N life');
    expect(lifeGain.length).toBeGreaterThan(0);
    expect(lifeGain[0].fragment.original).toBe('you gain 2 life');
  });

  test('damage: "deals 3 damage to any target" normalizes number', () => {
    const card = asCard({
      cid: 'test0002',
      rarity: 'common',
      collectorNumber: 2,
      layout: 'normal',
      faces: [{
        name: 'Damage Dealer',
        manaCost: { red: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: '~ deals 3 damage to any target.' }],
      }],
    });
    const entries = extractMechanics(card);
    const damage = findByNormalized(entries, 'deals N damage');
    expect(damage.length).toBeGreaterThan(0);
  });

  test('P/T modifications: "+2/+0" → "+N/+N"', () => {
    const card = asCard({
      cid: 'test0003',
      rarity: 'common',
      collectorNumber: 3,
      layout: 'normal',
      faces: [{
        name: 'Pump Spell',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Target creature gets +2/+0 until end of turn.' }],
      }],
    });
    const entries = extractMechanics(card);
    const pump = findByNormalized(entries, '+N/+N');
    expect(pump.length).toBeGreaterThan(0);
    expect(pump[0].fragment.original).toBe('Target creature gets +2/+0 until end of turn');
  });

  test('scry: "scry 2" → "scry N"', () => {
    const card = asCard({
      cid: 'test0004',
      rarity: 'common',
      collectorNumber: 4,
      layout: 'normal',
      faces: [{
        name: 'Scrier',
        manaCost: { blue: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: 'When this creature enters, scry 2.' }],
        pt: { power: 1, toughness: 1 },
      }],
    });
    const entries = extractMechanics(card);
    const scry = findByNormalized(entries, 'scry N');
    expect(scry.length).toBeGreaterThan(0);
    expect(scry[0].fragment.original).toBe('scry 2');
  });

  test('generic mana in costs: "{2}" → "{N}"', () => {
    const card = asCard({
      cid: 'test0005',
      rarity: 'common',
      collectorNumber: 5,
      layout: 'normal',
      faces: [{
        name: 'Costly Artifact',
        manaCost: { generic: 2 },
        types: ['artifact'],
        rules: [{ variant: 'ability', content: '{2}, {T}: Draw a card.' }],
      }],
    });
    const entries = extractMechanics(card);
    const cost = findByNormalized(entries, '{N}');
    expect(cost.length).toBeGreaterThan(0);
  });
});

// ─── Self-reference Normalization ────────────────────────────────────────────
describe('Self-reference normalization', () => {
  test('"this creature" → "~"', () => {
    const card = asCard({
      cid: 'test0010',
      rarity: 'common',
      collectorNumber: 10,
      layout: 'normal',
      faces: [{
        name: 'Self Referrer',
        manaCost: { red: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: 'Whenever you cast a card from exile, this creature gets +2/+0 until end of turn.' }],
        pt: { power: 2, toughness: 1 },
      }],
    });
    const entries = extractMechanics(card);
    const selfRef = findByNormalized(entries, '~ gets +N/+N');
    expect(selfRef.length).toBeGreaterThan(0);
  });

  test('"this artifact" → "~"', () => {
    const card = asCard({
      cid: 'test0011',
      rarity: 'common',
      collectorNumber: 11,
      layout: 'normal',
      faces: [{
        name: 'Artifact Ref',
        manaCost: { generic: 1 },
        types: ['artifact'],
        rules: [{ variant: 'ability', content: 'Sacrifice this artifact: Draw a card.' }],
      }],
    });
    const entries = extractMechanics(card);
    const sacrifice = findByNormalized(entries, 'sacrifice ~');
    expect(sacrifice.length).toBeGreaterThan(0);
  });

  test('"~" (card name reference) stays as "~"', () => {
    const card = asCard({
      cid: 'test0012',
      rarity: 'common',
      collectorNumber: 12,
      layout: 'normal',
      faces: [{
        name: 'Name User',
        manaCost: { red: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: '~ deals 2 damage to any target.' }],
      }],
    });
    const entries = extractMechanics(card);
    expect(entries[0].fragment.normalized).toBe('~ deals N damage to any target');
  });
});

// ─── Game Stage Calculations ─────────────────────────────────────────────────
describe('Game stage calculations', () => {
  test('triggered ability on 1mv creature → early (turn 1)', () => {
    const card = asCard({
      cid: 'test0020',
      rarity: 'common',
      collectorNumber: 20,
      layout: 'normal',
      faces: [{
        name: 'Early Trigger',
        manaCost: { white: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: 'When this creature enters, you gain 1 life.' }],
        pt: { power: 1, toughness: 1 },
      }],
    });
    const entries = extractMechanics(card);
    expect(entries[0].stage).toBe('early');
    expect(entries[0].earliestTurn).toBe(1);
  });

  test('triggered ability on 5mv creature → late (turn 5)', () => {
    const card = asCard({
      cid: 'test0021',
      rarity: 'common',
      collectorNumber: 21,
      layout: 'normal',
      faces: [{
        name: 'Late Trigger',
        manaCost: { generic: 4, white: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: 'When this creature enters, you gain 5 life.' }],
        pt: { power: 3, toughness: 3 },
      }],
    });
    const entries = extractMechanics(card);
    expect(entries[0].stage).toBe('late');
    expect(entries[0].earliestTurn).toBe(5);
  });

  test('creature with {T} ability, no haste: summoning sickness applies → max(mv+1, act)', () => {
    // 2mv creature, {T}: Add {G}. → max(2+1, 0) = 3
    const card = asCard({
      cid: 'test0022',
      rarity: 'common',
      collectorNumber: 22,
      layout: 'normal',
      faces: [{
        name: 'Mana Dork',
        manaCost: { green: 2 },
        types: ['creature'],
        subtypes: ['elf'],
        rules: [{ variant: 'ability', content: '{T}: Add {G}.' }],
        pt: { power: 1, toughness: 1 },
      }],
    });
    const entries = extractMechanics(card);
    expect(entries[0].earliestTurn).toBe(3);
    expect(entries[0].stage).toBe('mid');
  });

  test('non-creature artifact with {T}: no summoning sickness → mv + act_cost', () => {
    // 1mv artifact, {1}, {T}: Scry 1. → act=1 <= mv=1, act != 0 → earliest = 1+1 = 2
    const card = asCard({
      cid: 'test0023',
      rarity: 'common',
      collectorNumber: 23,
      layout: 'normal',
      faces: [{
        name: 'Scrying Lens',
        manaCost: { generic: 1 },
        types: ['artifact'],
        rules: [{ variant: 'ability', content: '{1}, {T}: Scry 1.' }],
      }],
    });
    const entries = extractMechanics(card);
    expect(entries[0].earliestTurn).toBe(2);
    expect(entries[0].stage).toBe('early');
  });

  test('creature with haste and {T}: no summoning sickness penalty', () => {
    // 3mv haste creature, {T}: Scry 2. → haste, act=0 → earliest = 3
    const card = asCard({
      cid: 'test0024',
      rarity: 'common',
      collectorNumber: 24,
      layout: 'normal',
      faces: [{
        name: 'Hasty Scryer',
        manaCost: { generic: 2, red: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [
          { variant: 'keyword', content: 'haste' },
          { variant: 'ability', content: '{T}: Scry 2.' },
        ],
        pt: { power: 2, toughness: 2 },
      }],
    });
    const entries = extractMechanics(card);
    const scry = findByNormalized(entries, 'scry N');
    expect(scry[0].earliestTurn).toBe(3);
    expect(scry[0].stage).toBe('mid');
  });

  test('no {T}, activation_mana_cost = 0 → earliest = mv', () => {
    // 3mv creature, "Sacrifice an Asteroid: Scry 2" → act=0 → earliest = 3
    const card = asCard({
      cid: 'test0025',
      rarity: 'common',
      collectorNumber: 25,
      layout: 'normal',
      faces: [{
        name: 'Free Activator',
        manaCost: { generic: 2, blue: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: 'Sacrifice an Asteroid: Scry 2.' }],
        pt: { power: 2, toughness: 2 },
      }],
    });
    const entries = extractMechanics(card);
    const scry = findByNormalized(entries, 'scry N');
    expect(scry[0].earliestTurn).toBe(3);
  });

  test('no {T}, activation_mana_cost <= mv, act != 0 → earliest = mv + 1', () => {
    // 3mv creature, "{2}: Pump" → act=2 <= mv=3, act != 0 → earliest = 4
    const card = asCard({
      cid: 'test0026',
      rarity: 'common',
      collectorNumber: 26,
      layout: 'normal',
      faces: [{
        name: 'Self Pumper',
        manaCost: { generic: 2, red: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: '{2}: This creature gets +2/+0 until end of turn.' }],
        pt: { power: 2, toughness: 2 },
      }],
    });
    const entries = extractMechanics(card);
    const pump = findByNormalized(entries, '~ gets +N/+N');
    expect(pump[0].earliestTurn).toBe(4);
    expect(pump[0].stage).toBe('mid');
  });

  test('no {T}, activation_mana_cost > mv → earliest = activation_mana_cost', () => {
    // 1mv creature, "{3}: Draw" → act=3 > mv=1 → earliest = 3
    const card = asCard({
      cid: 'test0027',
      rarity: 'common',
      collectorNumber: 27,
      layout: 'normal',
      faces: [{
        name: 'Expensive Drawer',
        manaCost: { blue: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: '{3}: Draw a card.' }],
        pt: { power: 1, toughness: 1 },
      }],
    });
    const entries = extractMechanics(card);
    const draw = findByNormalized(entries, 'draw N cards');
    expect(draw[0].earliestTurn).toBe(3);
    expect(draw[0].stage).toBe('mid');
  });

  test('creature with {T}, no haste, high activation cost → earliest = activation_mana_cost', () => {
    // 3mv creature, {5}, {T}: Draw 3 → max(3+1, 5) = 5
    const card = asCard({
      cid: 'test0028',
      rarity: 'rare',
      collectorNumber: 28,
      layout: 'normal',
      faces: [{
        name: 'Heavy Tapper',
        manaCost: { generic: 2, blue: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: '{5}, {T}: Draw 3 cards.' }],
        pt: { power: 2, toughness: 3 },
      }],
    });
    const entries = extractMechanics(card);
    const draw = findByNormalized(entries, 'draw N cards');
    expect(draw[0].earliestTurn).toBe(5);
    expect(draw[0].stage).toBe('late');
  });
});

// ─── Planeswalker Loyalty ────────────────────────────────────────────────────
describe('Planeswalker loyalty ability staging', () => {
  const card = asCard({
    cid: 'test0030',
    rarity: 'mythic',
    collectorNumber: 30,
    layout: 'normal',
    faces: [{
      name: 'Kira, Star Commander',
      manaCost: { generic: 2, white: 1, blue: 1 },
      types: ['planeswalker'],
      supertype: 'legendary',
      loyalty: 4,
      rules: [
        { variant: 'ability', content: '+1: Scry 2.' },
        { variant: 'ability', content: '-3: Draw 2 cards.' },
        { variant: 'ability', content: '-7: Draw 7 cards.' },
      ],
    }],
  });

  const entries = extractMechanics(card);

  test('+1 ability: usable immediately → earliest = mv = 4', () => {
    const scry = findByNormalized(entries, 'scry N');
    expect(scry[0].earliestTurn).toBe(4);
    expect(scry[0].stage).toBe('mid');
  });

  test('-3 ability: 4 loyalty >= 3 → usable immediately → earliest = mv = 4', () => {
    const draw2 = entries.filter(e => e.fragment.original === 'Draw 2 cards');
    expect(draw2[0].earliestTurn).toBe(4);
    expect(draw2[0].stage).toBe('mid');
  });

  test('-7 ability: need (7-4)/1 = 3 turns of +1 → earliest = 4+3 = 7', () => {
    const draw7 = entries.filter(e => e.fragment.original === 'Draw 7 cards');
    expect(draw7[0].earliestTurn).toBe(7);
    expect(draw7[0].stage).toBe('late');
  });
});

// ─── Activated ability with extra colors ─────────────────────────────────────
describe('Activated ability with colors beyond face cast color', () => {
  test('white card with {G} in activation cost → white+green for all fragments', () => {
    const card = asCard({
      cid: 'test0040',
      rarity: 'uncommon',
      collectorNumber: 40,
      layout: 'normal',
      faces: [{
        name: 'Cross-Color Activator',
        manaCost: { white: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [{ variant: 'ability', content: '{1}{G}: Create a 1/1 green Plant creature token.' }],
        pt: { power: 1, toughness: 1 },
      }],
    });
    const entries = extractMechanics(card);
    // All fragments from this ability should be green+white
    expect(entries.every(e => e.colors === 'green+white' || e.colors === 'white+green')).toBe(true);
  });
});

// ─── includeKeywords toggle ──────────────────────────────────────────────────
describe('includeKeywords option', () => {
  const card = asCard({
    cid: 'test0050',
    rarity: 'common',
    collectorNumber: 50,
    layout: 'normal',
    faces: [{
      name: 'Keyword Beast',
      manaCost: { generic: 3, green: 2 },
      types: ['creature'],
      subtypes: ['beast'],
      rules: [
        { variant: 'keyword', content: 'trample' },
        { variant: 'ability', content: 'When this creature enters, create an Asteroid token.' },
      ],
      pt: { power: 4, toughness: 4 },
    }],
  });

  test('without includeKeywords: only ability fragments', () => {
    const entries = extractMechanics(card);
    expect(entries.every(e => e.fragment.normalized !== 'trample')).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  test('with includeKeywords: keyword entries included', () => {
    const entries = extractMechanics(card, { includeKeywords: true });
    const trample = entries.filter(e => e.fragment.normalized === 'trample');
    expect(trample.length).toBe(1);
    expect(trample[0].colors).toBe('green');
    expect(trample[0].stage).toBe('late');
  });
});

// ─── Flavor and card-type-reminder skipping ──────────────────────────────────
describe('Skipping non-mechanic rule variants', () => {
  const card = asCard({
    cid: 'test0060',
    rarity: 'common',
    collectorNumber: 60,
    layout: 'normal',
    faces: [{
      name: 'Flavorful Card',
      manaCost: { white: 1 },
      types: ['creature'],
      subtypes: ['human'],
      rules: [
        { variant: 'card-type-reminder', content: 'Humans get +1/+1.' },
        { variant: 'ability', content: 'When this creature enters, you gain 1 life.' },
        { variant: 'flavor', content: 'The stars shine brightest in the darkest void.' },
      ],
      pt: { power: 1, toughness: 1 },
    }],
  });

  const entries = extractMechanics(card);

  test('should skip card-type-reminder', () => {
    const reminder = entries.filter(e => e.fragment.original.includes('Humans get'));
    expect(reminder).toHaveLength(0);
  });

  test('should skip flavor text', () => {
    const flavor = entries.filter(e => e.fragment.original.includes('stars shine'));
    expect(flavor).toHaveLength(0);
  });

  test('should include the ability', () => {
    const ability = findByNormalized(entries, 'you gain N life');
    expect(ability.length).toBeGreaterThan(0);
  });
});

// ─── Generic color (colorless artifacts) ─────────────────────────────────────
describe('Generic mana cost cards', () => {
  const card = asCard({
    cid: 'test0070',
    rarity: 'uncommon',
    collectorNumber: 70,
    layout: 'normal',
    faces: [{
      name: 'Colorless Gadget',
      manaCost: { generic: 3 },
      types: ['artifact'],
      rules: [
        { variant: 'ability', content: 'When this artifact enters, draw a card.' },
      ],
    }],
  });

  const entries = extractMechanics(card);

  test('should be tagged as generic', () => {
    expect(entries[0].colors).toBe('generic');
  });
});

// ─── Compound activation cost ────────────────────────────────────────────────
describe('Compound activation cost (Supply Runner)', () => {
  const card = asCard({
    cid: 'v8nbgbv5',
    rarity: 'common',
    collectorNumber: 3,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Supply Runner',
      manaCost: { generic: 1, white: 1 },
      types: ['creature'],
      subtypes: ['human', 'soldier'],
      rules: [
        { variant: 'ability', content: 'Sacrifice an Asteroid, Sacrifice this creature: Target creature you control gains indestructible until end of turn.' },
      ],
      pt: { power: 1, toughness: 1 },
    }],
  });

  const entries = extractMechanics(card);

  test('should parse as activated ability with sacrifice costs', () => {
    const sacrifice = findByNormalized(entries, 'sacrifice an asteroid');
    expect(sacrifice.length).toBeGreaterThan(0);
  });

  test('should have indestructible effect fragment', () => {
    const effect = findByNormalized(entries, 'target creature you control gains indestructible until end of turn');
    expect(effect.length).toBeGreaterThan(0);
  });

  test('activation mana cost is 0, so earliest = mv = 2', () => {
    const effect = findByNormalized(entries, 'target creature you control gains indestructible');
    expect(effect[0].earliestTurn).toBe(2);
    expect(effect[0].stage).toBe('early');
  });
});

// ─── Static abilities ────────────────────────────────────────────────────────
describe('Static abilities (spell cost reduction)', () => {
  const card = asCard({
    cid: 'test0080',
    rarity: 'common',
    collectorNumber: 80,
    layout: 'normal',
    faces: [{
      name: 'Nebula Sage',
      manaCost: { blue: 2, generic: 2 },
      types: ['creature'],
      subtypes: ['human', 'wizard'],
      rules: [
        { variant: 'ability', content: 'This spell costs {1} less to cast from exile.' },
        { variant: 'keyword', content: 'flying' },
        { variant: 'ability', content: 'When this creature enters, draw a card.' },
      ],
      pt: { power: 2, toughness: 2 },
    }],
  });

  const entries = extractMechanics(card);

  test('static ability should not be parsed as activated (no ": " cost pattern)', () => {
    const costReduction = findByNormalized(entries, '~ costs {N} less to cast from exile');
    expect(costReduction.length).toBe(1);
    expect(costReduction[0].earliestTurn).toBe(4);
    expect(costReduction[0].stage).toBe('mid');
  });
});

// ─── Multi-face: transform ───────────────────────────────────────────────────
describe('Transform layout (no explicit transform ability)', () => {
  // Front face: {1}{W} creature, back face: black creature (givenColors)
  // No explicit "transform" ability on front face → fallback:
  // back face inherits front face cast colors (white) and front MV (2)
  const card = asCard({
    cid: 'test0090',
    rarity: 'rare',
    collectorNumber: 90,
    layout: 'transform',
    faces: [
      {
        name: 'Day Explorer',
        manaCost: { generic: 1, white: 1 },
        types: ['creature'],
        subtypes: ['human'],
        rules: [
          { variant: 'ability', content: 'When this creature enters, you gain 2 life.' },
        ],
        pt: { power: 2, toughness: 2 },
      },
      {
        name: 'Night Terror',
        givenColors: ['black'],
        types: ['creature'],
        subtypes: ['vampire'],
        rules: [
          { variant: 'ability', content: 'Whenever this creature attacks, each opponent loses 2 life.' },
        ],
        pt: { power: 3, toughness: 3 },
      },
    ],
  });

  const entries = extractMechanics(card);

  test('front face should be white', () => {
    const front = entries.filter(e => e.source.faceIndex === 0);
    expect(front.every(e => e.colors === 'white')).toBe(true);
  });

  test('back face should inherit front face cast colors (white), not givenColors (black)', () => {
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back.every(e => e.colors === 'white')).toBe(true);
  });

  test('back face earliestTurn should be front face MV (2)', () => {
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back[0].earliestTurn).toBe(2);
    expect(back[0].stage).toBe('early');
  });
});

// ─── Transform with colored activation cost ─────────────────────────────────
describe('Transform with colored activation cost ({1}{R}: Transform)', () => {
  // Front face: {1}{W} creature with "{1}{R}: Transform this creature."
  // Back face: black creature (givenColors)
  // The back face should be white+red (front cast + activation colors), NOT black
  // earliestTurn: activated, no {T}, act=2 <= mv=2 and act != 0 → earliest = 2+1 = 3
  const card = asCard({
    cid: 'test0091',
    rarity: 'rare',
    collectorNumber: 91,
    layout: 'transform',
    faces: [
      {
        name: 'Dawn Sentinel',
        manaCost: { generic: 1, white: 1 },
        types: ['creature'],
        subtypes: ['human', 'knight'],
        rules: [
          { variant: 'ability', content: 'When this creature enters, you gain 2 life.' },
          { variant: 'ability', content: '{1}{R}: Transform this creature.' },
        ],
        pt: { power: 2, toughness: 2 },
      },
      {
        name: 'Dusk Ravager',
        givenColors: ['black'],
        types: ['creature'],
        subtypes: ['vampire', 'knight'],
        rules: [
          { variant: 'ability', content: 'Whenever this creature attacks, each opponent loses 2 life.' },
          { variant: 'keyword', content: 'menace' },
        ],
        pt: { power: 3, toughness: 3 },
      },
    ],
  });

  const entries = extractMechanics(card);

  test('front face should be white (cast colors only for front face abilities)', () => {
    // Only the ETB ability — the transform ability itself is also on the front face
    const frontETB = entries.filter(e => e.source.faceIndex === 0);
    // The transform activated ability has white+red colors
    const etbEntries = frontETB.filter(e => e.fragment.normalized.includes('you gain N life'));
    expect(etbEntries.every(e => e.colors === 'white')).toBe(true);
  });

  test('front face transform ability fragments should be red+white (Boros pair order)', () => {
    const transformEntries = entries.filter(
      e => e.source.faceIndex === 0 && e.fragment.normalized.includes('transform'),
    );
    expect(transformEntries.length).toBeGreaterThan(0);
    expect(transformEntries.every(e => e.colors === 'red+white')).toBe(true);
  });

  test('back face should use front cast colors + transform activation colors → red+white', () => {
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back.every(e => e.colors === 'red+white')).toBe(true);
  });

  test('back face earliestTurn should match transform ability timing (3)', () => {
    // {1}{R}: Transform — activated, no {T}, act=2, mv=2 → act <= mv and act != 0 → earliest = 3
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back[0].earliestTurn).toBe(3);
    expect(back[0].stage).toBe('mid');
  });
});

// ─── Transform with tap activation cost ──────────────────────────────────────
describe('Transform with tap activation ({2}, {T}: Transform — creature)', () => {
  // Front face: {2}{G} creature with "{2}, {T}: Transform this creature."
  // Creature with {T} in cost → summoning sickness: earliest = max(mv+1, act) = max(4, 2) = 4
  // Back face inherits green colors and earliestTurn=4
  const card = asCard({
    cid: 'test0092',
    rarity: 'uncommon',
    collectorNumber: 92,
    layout: 'transform',
    faces: [
      {
        name: 'Grove Warden',
        manaCost: { generic: 2, green: 1 },
        types: ['creature'],
        subtypes: ['elf', 'druid'],
        rules: [
          { variant: 'ability', content: '{2}, {T}: Transform this creature.' },
        ],
        pt: { power: 2, toughness: 3 },
      },
      {
        name: 'Verdant Behemoth',
        givenColors: ['green'],
        types: ['creature'],
        subtypes: ['elemental'],
        rules: [
          { variant: 'keyword', content: 'trample' },
          { variant: 'ability', content: 'Whenever this creature deals combat damage to a player, draw a card.' },
        ],
        pt: { power: 5, toughness: 5 },
      },
    ],
  });

  const entries = extractMechanics(card);

  test('back face should be green (front cast colors, no new colored mana in activation)', () => {
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back.every(e => e.colors === 'green')).toBe(true);
  });

  test('back face earliestTurn should account for summoning sickness (4)', () => {
    // Creature with {T}: max(mv+1, act) = max(3+1, 2) = 4
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back[0].earliestTurn).toBe(4);
    expect(back[0].stage).toBe('mid');
  });
});

// ─── Transform with triggered transform ──────────────────────────────────────
describe('Transform with triggered ability (At beginning of upkeep, transform)', () => {
  // Front face: {1}{B} creature with triggered transform
  // Triggered ability → back face uses front MV (2) and front cast colors (black)
  const card = asCard({
    cid: 'test0093',
    rarity: 'uncommon',
    collectorNumber: 93,
    layout: 'transform',
    faces: [
      {
        name: 'Nightfall Stalker',
        manaCost: { generic: 1, black: 1 },
        types: ['creature'],
        subtypes: ['human', 'rogue'],
        rules: [
          { variant: 'ability', content: 'At the beginning of your upkeep, if a creature died last turn, transform this creature.' },
        ],
        pt: { power: 2, toughness: 1 },
      },
      {
        name: 'Shadow Predator',
        givenColors: ['black'],
        types: ['creature'],
        subtypes: ['nightmare'],
        rules: [
          { variant: 'ability', content: 'Whenever this creature attacks, target opponent discards a card.' },
        ],
        pt: { power: 4, toughness: 3 },
      },
    ],
  });

  const entries = extractMechanics(card);

  test('back face should be black (front cast colors)', () => {
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back.every(e => e.colors === 'black')).toBe(true);
  });

  test('back face earliestTurn should be front face MV (2) for triggered transform', () => {
    const back = entries.filter(e => e.source.faceIndex === 1);
    expect(back[0].earliestTurn).toBe(2);
    expect(back[0].stage).toBe('early');
  });
});
// ─── Hybrid + colored mana: {W/B}{B} ────────────────────────────────────────
describe('Hybrid + colored mana: {W/B}{B} uncommon', () => {
  const card = asCard({
    cid: 'test0100',
    rarity: 'uncommon',
    collectorNumber: 100,
    layout: 'normal',
    faces: [{
      name: 'Twilight Reaper',
      manaCost: { 'white/black': 1, black: 1 },
      types: ['creature'],
      subtypes: ['spirit'],
      rules: [
        { variant: 'ability', content: 'When this creature enters, each opponent loses 2 life.' },
      ],
      pt: { power: 2, toughness: 2 },
    }],
  });

  const entries = extractMechanics(card);

  test('should produce entries for black and white+black, but NOT white alone', () => {
    const colorSet = new Set(entries.map(e => e.colors));
    // {W/B}{B}: castable with W+B or B+B → "white+black" and "black"
    expect(colorSet.has('black')).toBe(true);
    expect(colorSet.has('white+black')).toBe(true);
    expect(colorSet.has('white')).toBe(false);
  });

  test('should produce 4 entries (2 fragments × 2 color variants)', () => {
    // "When this creature enters, each opponent loses 2 life." splits into 2 fragments
    // Each fragment gets entries for both "black" and "white+black"
    expect(entries.length).toBe(4);
  });

  test('each color variant should have the "loses N life" fragment', () => {
    const lifeLoss = findByNormalized(entries, 'each opponent loses N life');
    expect(lifeLoss.length).toBe(2);
    const colorSet = new Set(lifeLoss.map(e => e.colors));
    expect(colorSet.has('black')).toBe(true);
    expect(colorSet.has('white+black')).toBe(true);
  });
});

// ─── Token with hybrid creating face ─────────────────────────────────────────
describe('Token created by hybrid card', () => {
  const asteroidToken = asCard({
    cid: '7uuewu9f',
    isToken: true,
    rarity: 'common',
    collectorNumber: 31,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Asteroid',
      givenColors: [],
      types: ['artifact'],
      subtypes: ['asteroid'],
      rules: [
        { variant: 'ability', content: '{1}, {T}, Sacrifice this artifact: Exile the top card of your library. You may play it this turn.' },
      ],
    }],
  });

  test('token mechanics from hybrid {W/B}{B} card should produce entries for each color variant', () => {
    // Hybrid creating card: {W/B}{B} creature that creates an Asteroid token on ETB
    // This expands to two castability variants: "black" and "white+black"
    const hybridCreator = asCard({
      cid: 'test0110',
      rarity: 'uncommon',
      collectorNumber: 110,
      layout: 'normal',
      faces: [{
        name: 'Twilight Scavenger',
        manaCost: { 'white/black': 1, black: 1 },
        types: ['creature'],
        subtypes: ['human', 'rogue'],
        rules: [
          { variant: 'ability', content: 'When this creature enters, create an Asteroid token.' },
        ],
        pt: { power: 2, toughness: 1 },
      }],
    });

    const entries = extractMechanics(hybridCreator, { tokens: [asteroidToken] });
    const tokenEntries = entries.filter(e => e.source.cardName === 'Asteroid');

    expect(tokenEntries.length).toBeGreaterThan(0);

    const colorSet = new Set(tokenEntries.map(e => e.colors));
    // {W/B}{B}: castable with W+B or B+B → token entries should have "black" and "white+black"
    expect(colorSet.has('black')).toBe(true);
    expect(colorSet.has('white+black')).toBe(true);
    expect(colorSet.has('white')).toBe(false);
    expect(colorSet.size).toBe(2);

    // Token entries should inherit the creating card's rarity
    expect(tokenEntries.every(e => e.rarity === 'uncommon')).toBe(true);
  });

  test('token mechanics from single-color creating card should produce entries for that color only', () => {
    // Green creature that creates an Asteroid token on activated ability
    const greenCreator = asCard({
      cid: 'test0111',
      rarity: 'common',
      collectorNumber: 111,
      layout: 'normal',
      faces: [{
        name: 'Grove Tender',
        manaCost: { generic: 1, green: 2 },
        types: ['creature'],
        subtypes: ['elf', 'druid'],
        rules: [
          { variant: 'ability', content: 'When this creature enters, create an Asteroid token.' },
        ],
        pt: { power: 2, toughness: 2 },
      }],
    });

    const entries = extractMechanics(greenCreator, { tokens: [asteroidToken] });
    const tokenEntries = entries.filter(e => e.source.cardName === 'Asteroid');

    expect(tokenEntries.length).toBeGreaterThan(0);
    expect(tokenEntries.every(e => e.colors === 'green')).toBe(true);
  });
});

// ─── Complex: hybrid transform with multiple transform abilities + token creation ──
// This exercises: hybrid mana expansion × multiple transform paths × activated
// abilities on the back face × token mechanic flow — all at once.
//
// Card: {1}{W/U} creature (MV=2, hybrid → white or blue)
// Front face:
//   {G}, {T}: Transform this creature.  (creature + {T} → summoning sickness)
//   {2}{R}: Transform this creature.    (no {T}, act=3 > mv=2 → earliest=3)
// Back face:
//   {2}{W}: Create an Asteroid token.   (no {T}, act=3, base=3 → earliest=4)
//   {4}{B}: Create an Asteroid token.   (no {T}, act=5 > base=3 → earliest=5)
//
// Transform context: min(3,3)=3 earliest turn.
//   Colors from path 1 ({G},{T}): green+white, green+blue
//   Colors from path 2 ({2}{R}):  red+white,   blue+red
//   → 4 transform color variants
//
// Back face {2}{W} ability: each transform color ∪ white → 4 variants, earliest=4
// Back face {4}{B} ability: each transform color ∪ black → 4 variants, earliest=5
// Token via {2}{W} (base=4): artifact, {T} no sickness, act=1 ≤ 4 → earliest=5
// Token via {4}{B} (base=5): artifact, {T} no sickness, act=1 ≤ 5 → earliest=6
describe('Complex: hybrid transform + multiple transform abilities + token creation', () => {
  const asteroidToken = asCard({
    cid: '7uuewu9f',
    isToken: true,
    rarity: 'common',
    collectorNumber: 31,
    tags: { set: 'SHX' },
    layout: 'normal',
    faces: [{
      name: 'Asteroid',
      givenColors: [],
      types: ['artifact'],
      subtypes: ['asteroid'],
      rules: [
        { variant: 'ability', content: '{1}, {T}, Sacrifice this artifact: Exile the top card of your library. You may play it this turn.' },
      ],
    }],
  });

  const card = asCard({
    cid: 'test0200',
    rarity: 'rare',
    collectorNumber: 200,
    layout: 'transform',
    faces: [
      {
        name: 'Chromatic Shifter',
        manaCost: { generic: 1, 'white/blue': 1 },
        types: ['creature'],
        subtypes: ['shapeshifter'],
        rules: [
          { variant: 'ability', content: '{G}, {T}: Transform this creature.' },
          { variant: 'ability', content: '{2}{R}: Transform this creature.' },
        ],
        pt: { power: 2, toughness: 2 },
      },
      {
        name: 'Prismatic Horror',
        givenColors: ['black'],
        types: ['creature'],
        subtypes: ['horror'],
        rules: [
          { variant: 'ability', content: '{2}{W}: Create an Asteroid token.' },
          { variant: 'ability', content: '{4}{B}: Create an Asteroid token.' },
        ],
        pt: { power: 4, toughness: 4 },
      },
    ],
  });

  const entries = extractMechanics(card, { tokens: [asteroidToken] });

  // ── Front face: transform ability fragments ───────────────────────────
  describe('front face transform abilities', () => {
    const frontEntries = entries.filter(e => e.source.faceIndex === 0 && e.source.cardName === 'Chromatic Shifter');

    test('should produce transform fragments for both abilities', () => {
      const transformFrags = frontEntries.filter(e => e.fragment.normalized === 'transform ~');
      // 2 transform abilities × 2 hybrid variants = 4
      expect(transformFrags).toHaveLength(4);
    });

    test('{G},{T} path should have green+white and green+blue colors', () => {
      const greenPathTransform = frontEntries.filter(
        e => e.fragment.normalized === 'transform ~' && e.colors.includes('green'),
      );
      expect(greenPathTransform).toHaveLength(2);
      const colors = new Set(greenPathTransform.map(e => e.colors));
      expect(colors.has('green+white')).toBe(true);
      expect(colors.has('green+blue')).toBe(true);
    });

    test('{2}{R} path should have red+white and blue+red colors', () => {
      const redPathTransform = frontEntries.filter(
        e => e.fragment.normalized === 'transform ~' && e.colors.includes('red'),
      );
      expect(redPathTransform).toHaveLength(2);
      const colors = new Set(redPathTransform.map(e => e.colors));
      expect(colors.has('red+white')).toBe(true);
      expect(colors.has('blue+red')).toBe(true);
    });

    test('all front face entries should have earliestTurn=3', () => {
      expect(frontEntries.every(e => e.earliestTurn === 3)).toBe(true);
    });
  });

  // ── Back face: transform context applied ──────────────────────────────
  describe('back face transform context', () => {
    const backEntries = entries.filter(e => e.source.faceIndex === 1 && e.source.cardName === 'Prismatic Horror');

    test('givenColors (black) should NOT appear as a standalone back face color', () => {
      expect(backEntries.some(e => e.colors === 'black')).toBe(false);
    });

    test('{2}{W} ability: 4 transform colors each ∪ white → 4 color variants at turn 4', () => {
      const whiteAbility = backEntries.filter(e => e.earliestTurn === 4);
      // 2 fragments ({N}{w} + create an asteroid token) × 4 color variants = 8
      expect(whiteAbility).toHaveLength(8);
      const colors = new Set(whiteAbility.map(e => e.colors));
      // green+white ∪ white = green+white (already has white)
      expect(colors.has('green+white')).toBe(true);
      // green+blue ∪ white = green+white+blue
      expect(colors.has('green+white+blue')).toBe(true);
      // red+white ∪ white = red+white (already has white)
      expect(colors.has('red+white')).toBe(true);
      // blue+red ∪ white = blue+red+white
      expect(colors.has('blue+red+white')).toBe(true);
      expect(colors.size).toBe(4);
    });

    test('{4}{B} ability: 4 transform colors each ∪ black → 4 color variants at turn 5', () => {
      const blackAbility = backEntries.filter(e => e.earliestTurn === 5);
      // 2 fragments ({N}{b} + create an asteroid token) × 4 color variants = 8
      expect(blackAbility).toHaveLength(8);
      const colors = new Set(blackAbility.map(e => e.colors));
      expect(colors.has('white+black+green')).toBe(true);
      expect(colors.has('black+green+blue')).toBe(true);
      expect(colors.has('red+white+black')).toBe(true);
      expect(colors.has('blue+black+red')).toBe(true);
      expect(colors.size).toBe(4);
    });

    test('all back face entries should have stage mid or late', () => {
      expect(backEntries.every(e => e.stage === 'mid' || e.stage === 'late')).toBe(true);
    });
  });

  // ── Token mechanics flow ──────────────────────────────────────────────
  describe('token mechanics flow through back face abilities', () => {
    const tokenEntries = entries.filter(e => e.source.cardName === 'Asteroid');

    test('token entries should exist', () => {
      expect(tokenEntries.length).toBeGreaterThan(0);
    });

    test('tokens created via {2}{W} ability should have earliestTurn=5 (base=4, act=1)', () => {
      // Token artifact, non-creature, {T} in cost but no summoning sickness
      // act=1 ≤ base=4 and act ≠ 0 → earliest = 4+1 = 5
      const turn5Tokens = tokenEntries.filter(e => e.earliestTurn === 5);
      expect(turn5Tokens.length).toBeGreaterThan(0);
      // Should inherit the {2}{W} ability's 4 color variants
      const colors = new Set(turn5Tokens.map(e => e.colors));
      expect(colors.has('green+white')).toBe(true);
      expect(colors.has('green+white+blue')).toBe(true);
      expect(colors.has('red+white')).toBe(true);
      expect(colors.has('blue+red+white')).toBe(true);
    });

    test('tokens created via {4}{B} ability should have earliestTurn=6 (base=5, act=1)', () => {
      // act=1 ≤ base=5 and act ≠ 0 → earliest = 5+1 = 6
      const turn6Tokens = tokenEntries.filter(e => e.earliestTurn === 6);
      expect(turn6Tokens.length).toBeGreaterThan(0);
      // Should inherit the {4}{B} ability's 4 color variants
      const colors = new Set(turn6Tokens.map(e => e.colors));
      expect(colors.has('white+black+green')).toBe(true);
      expect(colors.has('black+green+blue')).toBe(true);
      expect(colors.has('red+white+black')).toBe(true);
      expect(colors.has('blue+black+red')).toBe(true);
    });

    test('all token entries should inherit the creating card rarity (rare)', () => {
      expect(tokenEntries.every(e => e.rarity === 'rare')).toBe(true);
    });

    test('token source should reference the Asteroid token card', () => {
      expect(tokenEntries.every(e => e.source.cid === '7uuewu9f')).toBe(true);
      expect(tokenEntries.every(e => e.source.faceIndex === 0)).toBe(true);
    });
  });

  // ── Overall entry count sanity check ──────────────────────────────────
  test('total entry count', () => {
    // Front face:
    //   {G},{T} ability: 3 fragments ({g}, {t}, transform ~) × 2 hybrid variants = 6
    //   {2}{R} ability:  2 fragments ({N}{r}, transform ~) × 2 hybrid variants = 4
    //   Subtotal front: 10
    //
    // Back face ({2}{W} ability, 4 transform color variants):
    //   2 fragments ({N}{w}, create an asteroid token) × 4 colors = 8
    // Back face ({4}{B} ability, 4 transform color variants):
    //   2 fragments ({N}{b}, create an asteroid token) × 4 colors = 8
    //   Subtotal back: 16
    //
    // Token via {2}{W} (4 colors):
    //   5 fragments ({N}, {t}, sacrifice ~, exile..., you may play...) × 4 colors = 20
    // Token via {4}{B} (4 colors):
    //   5 fragments ({N}, {t}, sacrifice ~, exile..., you may play...) × 4 colors = 20
    //   Subtotal token: 40
    //
    // Total: 10 + 16 + 40 = 66
    expect(entries).toHaveLength(66);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Unit Tests for splitFragments() ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

describe('splitFragments — cost mode', () => {
  test('splits on every comma', () => {
    expect(splitFragments('{1}, {T}, Sacrifice this artifact', 'cost'))
      .toEqual(['{1}', '{T}', 'Sacrifice this artifact']);
  });

  test('handles single element', () => {
    expect(splitFragments('{T}', 'cost')).toEqual(['{T}']);
  });

  test('handles empty string', () => {
    expect(splitFragments('', 'cost')).toEqual([]);
  });
});

describe('splitFragments — ability mode: sentence splitting', () => {
  test('splits on ". " and strips trailing period', () => {
    expect(splitFragments('Mill four cards. You may put a permanent card from among the cards milled this way into your hand.', 'ability'))
      .toEqual(['Mill four cards', 'You may put a permanent card from among the cards milled this way into your hand']);
  });

  test('single sentence with trailing period', () => {
    expect(splitFragments('Scry 2.', 'ability')).toEqual(['Scry 2']);
  });

  test('multiple sentences', () => {
    expect(splitFragments('Draw a card. Lose 1 life. Scry 2.', 'ability'))
      .toEqual(['Draw a card', 'Lose 1 life', 'Scry 2']);
  });
});

describe('splitFragments — ability mode: Then stripping', () => {
  test('"Then, draw a card." strips Then prefix', () => {
    expect(splitFragments('Scry 2. Then, draw a card.', 'ability'))
      .toEqual(['Scry 2', 'draw a card']);
  });

  test('"Then draw" (no comma) strips Then prefix', () => {
    expect(splitFragments('Scry 2. Then draw a card.', 'ability'))
      .toEqual(['Scry 2', 'draw a card']);
  });

  test('"then if" strips Then and splits as conditional', () => {
    const result = splitFragments('Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land.', 'ability');
    expect(result).toEqual([
      'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle',
      'if you control four or more lands',
      'untap that land',
    ]);
  });
});

describe('splitFragments — ability mode: trigger/conditional comma split', () => {
  test('ETB trigger: splits on first comma', () => {
    expect(splitFragments('When this creature enters, scry 2.', 'ability'))
      .toEqual(['When this creature enters', 'scry 2']);
  });

  test('ETB trigger with multi-sentence effect', () => {
    expect(splitFragments('When this creature enters, look at the top three cards of your library. Put one on top and the rest on the bottom in any order.', 'ability'))
      .toEqual([
        'When this creature enters',
        'look at the top three cards of your library',
        'Put one on top and the rest on the bottom in any order',
      ]);
  });

  test('"if" conditional splits on first comma', () => {
    const result = splitFragments('If you control a Squirrel or returned a Squirrel card to your hand this way, create a Food token.', 'ability');
    expect(result).toEqual([
      'If you control a Squirrel or returned a Squirrel card to your hand this way',
      'create a Food token',
    ]);
  });

  test('"at the" trigger splits on first comma', () => {
    expect(splitFragments('At the beginning of your upkeep, draw a card.', 'ability'))
      .toEqual(['At the beginning of your upkeep', 'draw a card']);
  });

  test('"whenever" trigger splits on first comma', () => {
    expect(splitFragments('Whenever you cast a spell, scry 1.', 'ability'))
      .toEqual(['Whenever you cast a spell', 'scry 1']);
  });
});

describe('splitFragments — ability mode: compound trigger "and" split', () => {
  test('"When X enters and when you sacrifice it" splits into separate triggers', () => {
    expect(splitFragments('When this artifact enters and when you sacrifice it, scry 2.', 'ability'))
      .toEqual(['When this artifact enters', 'when you sacrifice it', 'scry 2']);
  });

  test('"When X enters and whenever you expend 4" splits compound trigger', () => {
    expect(splitFragments('When this enchantment enters and whenever you expend 4, put a stash counter on it.', 'ability'))
      .toEqual(['When this enchantment enters', 'whenever you expend 4', 'put a stash counter on it']);
  });
});

describe('splitFragments — ability mode: ", then" splitting', () => {
  test('basic ", then" split', () => {
    expect(splitFragments('Draw a card, then discard a card.', 'ability'))
      .toEqual(['Draw a card', 'discard a card']);
  });

  test('trigger with ", then" in effect', () => {
    expect(splitFragments('When this artifact is put into a graveyard from the battlefield, each opponent loses 2 life and you gain 2 life, then draw a card.', 'ability'))
      .toEqual([
        'When this artifact is put into a graveyard from the battlefield',
        'each opponent loses 2 life',
        'you gain 2 life',
        'draw a card',
      ]);
  });

  test('", then shuffle" is NOT split', () => {
    expect(splitFragments('Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.', 'ability'))
      .toEqual(['Search your library for a basic land card, put it onto the battlefield tapped, then shuffle']);
  });
});

describe('splitFragments — ability mode: "and" effect splitting', () => {
  test('"create an Asteroid token and scry 2" splits on and + action verb', () => {
    expect(splitFragments('When this creature enters, create an Asteroid token and scry 2.', 'ability'))
      .toEqual(['When this creature enters', 'create an Asteroid token', 'scry 2']);
  });

  test('"draw a card and lose 1 life" splits on and + action verb', () => {
    expect(splitFragments('draw a card and lose 1 life.', 'ability'))
      .toEqual(['draw a card', 'lose 1 life']);
  });

  test('"trample and haste" does NOT split (not action verbs)', () => {
    // "haste" is not in the action verb list (it's a keyword, not an effect verb)
    expect(splitFragments('Target creature gains trample and haste until end of turn.', 'ability'))
      .toEqual(['Target creature gains trample and haste until end of turn']);
  });

  test('"gets +1/+1 and has flying" does NOT split (has is not an action verb)', () => {
    expect(splitFragments('Equipped creature gets +1/+1 and has flying.', 'ability'))
      .toEqual(['Equipped creature gets +1/+1 and has flying']);
  });

  test('"each opponent loses 2 life and you gain 2 life" splits (you is action)', () => {
    expect(splitFragments('each opponent loses 2 life and you gain 2 life.', 'ability'))
      .toEqual(['each opponent loses 2 life', 'you gain 2 life']);
  });
});

describe('splitFragments — ability mode: quoted string protection', () => {
  test('does not split on periods inside quoted strings', () => {
    expect(splitFragments('When Mabel enters, create Cragflame, a legendary colorless Equipment artifact token with "Equipped creature gets +1/+1 and has vigilance, trample, and haste" and equip {2}.', 'ability'))
      .toEqual([
        'When Mabel enters',
        'create Cragflame, a legendary colorless Equipment artifact token with "Equipped creature gets +1/+1 and has vigilance, trample, and haste" and equip {2}',
      ]);
  });

  test('does not split on commas inside quoted strings', () => {
    const input = 'Create a token with "When this enters, draw a card" and sacrifice it.';
    const result = splitFragments(input, 'ability');
    // The comma inside quotes should not trigger a split
    expect(result.some(f => f.includes('"When this enters, draw a card"'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Unit Tests for normalizeFragment() ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeFragment — word-number conversion', () => {
  test('"draw a card" → "draw N cards" (verb + a + noun)', () => {
    const result = normalizeFragment('draw a card');
    expect(result.normalized).toBe('draw N cards');
    expect(result.original).toBe('draw a card');
  });

  test('"create an Asteroid token" → "create N asteroid tokens" (verb + an + noun)', () => {
    const result = normalizeFragment('create an Asteroid token');
    expect(result.normalized).toBe('create N asteroid tokens');
  });

  test('"discard a card" → "discard N cards"', () => {
    const result = normalizeFragment('discard a card');
    expect(result.normalized).toBe('discard N cards');
  });

  test('"draw two cards" → "draw N cards"', () => {
    const result = normalizeFragment('draw two cards');
    expect(result.normalized).toBe('draw N cards');
  });

  test('"draw 2 cards" → "draw N cards"', () => {
    const result = normalizeFragment('draw 2 cards');
    expect(result.normalized).toBe('draw N cards');
  });

  test('"draw one card" → "draw N cards"', () => {
    const result = normalizeFragment('draw one card');
    expect(result.normalized).toBe('draw N cards');
  });

  test('"destroy three creatures" → "destroy N creatures"', () => {
    const result = normalizeFragment('destroy three creatures');
    expect(result.normalized).toBe('destroy N creatures');
  });

  test('"exile four cards" → "exile N cards"', () => {
    const result = normalizeFragment('exile four cards');
    expect(result.normalized).toBe('exile N cards');
  });
});

describe('normalizeFragment — "a/an" as article should NOT convert', () => {
  test('"a creature an opponent controls" stays unchanged (no verb before a/an)', () => {
    const result = normalizeFragment('a creature an opponent controls');
    expect(result.normalized).toBe('a creature an opponent controls');
  });

  test('"whenever a creature dies" stays unchanged', () => {
    const result = normalizeFragment('whenever a creature dies');
    expect(result.normalized).toBe('whenever a creature dies');
  });

  test('"if a creature died last turn" stays unchanged', () => {
    const result = normalizeFragment('if a creature died last turn');
    expect(result.normalized).toBe('if a creature died last turn');
  });

  test('"a creature you control" stays unchanged', () => {
    const result = normalizeFragment('a creature you control');
    expect(result.normalized).toBe('a creature you control');
  });

  test('"whenever you cast a card from exile" — "a card" stays (no counting verb before it)', () => {
    // "cast" IS a counting verb, so "cast a card" should convert
    const result = normalizeFragment('whenever you cast a card from exile');
    expect(result.normalized).toBe('whenever you cast N cards from exile');
  });
});

describe('normalizeFragment — singular → plural after N', () => {
  test('"scry N" stays as is (no noun)', () => {
    const result = normalizeFragment('scry 2');
    expect(result.normalized).toBe('scry N');
  });

  test('"N card" → "N cards"', () => {
    const result = normalizeFragment('draw 1 card');
    expect(result.normalized).toBe('draw N cards');
  });

  test('"N cards" stays "N cards" (already plural)', () => {
    const result = normalizeFragment('draw 3 cards');
    expect(result.normalized).toBe('draw N cards');
  });
});

describe('normalizeFragment — self-reference replacement', () => {
  test('"this creature" → "~"', () => {
    const result = normalizeFragment('when this creature enters');
    expect(result.normalized).toBe('when ~ enters');
  });

  test('"this artifact" → "~"', () => {
    const result = normalizeFragment('sacrifice this artifact');
    expect(result.normalized).toBe('sacrifice ~');
  });

  test('"this enchantment" → "~"', () => {
    const result = normalizeFragment('when this enchantment enters');
    expect(result.normalized).toBe('when ~ enters');
  });
});

describe('normalizeFragment — number normalization', () => {
  test('P/T modifications: "+2/+0" → "+N/+N"', () => {
    const result = normalizeFragment('target creature gets +2/+0 until end of turn');
    expect(result.normalized).toBe('target creature gets +N/+N until end of turn');
  });

  test('life: "gain 3 life" → "gain N life"', () => {
    const result = normalizeFragment('you gain 3 life');
    expect(result.normalized).toBe('you gain N life');
  });

  test('damage: "deals 4 damage" → "deals N damage"', () => {
    const result = normalizeFragment('~ deals 4 damage to any target');
    expect(result.normalized).toBe('~ deals N damage to any target');
  });

  test('generic mana: "{2}" → "{N}"', () => {
    const result = normalizeFragment('{2}{W}');
    expect(result.normalized).toBe('{N}{w}');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Integration: ETB + and splitting through extractMechanics ───────────────
// ═══════════════════════════════════════════════════════════════════════════════

describe('ETB "create token and scry" produces three fragments', () => {
  const card = asCard({
    cid: 'test0300',
    rarity: 'common',
    collectorNumber: 300,
    layout: 'normal',
    faces: [{
      name: 'Token Scryer',
      manaCost: { blue: 1, generic: 1 },
      types: ['creature'],
      subtypes: ['human', 'wizard'],
      rules: [
        { variant: 'ability', content: 'When this creature enters, create an Asteroid token and scry 2.' },
      ],
      pt: { power: 1, toughness: 2 },
    }],
  });

  const entries = extractMechanics(card);

  test('should produce exactly 3 fragments', () => {
    expect(entries).toHaveLength(3);
  });

  test('should have ETB trigger fragment', () => {
    const etb = findByNormalized(entries, 'when ~ enters');
    expect(etb).toHaveLength(1);
  });

  test('should have create token fragment', () => {
    const create = findByNormalized(entries, 'create N asteroid tokens');
    expect(create).toHaveLength(1);
  });

  test('should have scry fragment', () => {
    const scry = findByNormalized(entries, 'scry N');
    expect(scry).toHaveLength(1);
  });
});

describe('"a/an" article not falsely normalized in triggers', () => {
  const card = asCard({
    cid: 'test0310',
    rarity: 'uncommon',
    collectorNumber: 310,
    layout: 'normal',
    faces: [{
      name: 'Death Watcher',
      manaCost: { black: 1, generic: 1 },
      types: ['creature'],
      subtypes: ['human', 'cleric'],
      rules: [
        { variant: 'ability', content: 'Whenever a creature an opponent controls dies, you gain 2 life.' },
      ],
      pt: { power: 2, toughness: 1 },
    }],
  });

  const entries = extractMechanics(card);

  test('trigger should preserve "a creature an opponent controls"', () => {
    const trigger = entries.find(e => e.fragment.normalized.includes('whenever'));
    expect(trigger).toBeDefined();
    expect(trigger!.fragment.normalized).toBe('whenever a creature an opponent controls dies');
  });

  test('effect should normalize "gain 2 life" → "gain N life"', () => {
    const effect = findByNormalized(entries, 'you gain N life');
    expect(effect).toHaveLength(1);
  });
});
