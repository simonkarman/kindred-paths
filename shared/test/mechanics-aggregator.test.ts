import { describe, expect, test } from 'vitest';
import { aggregateMechanics, isCostOnlyMechanic, SerializedCard } from '../src';

/** Helper to create a SerializedCard with proper literal types from a plain object. */
function asCard(props: SerializedCard): SerializedCard {
  return props;
}

describe('isCostOnlyMechanic', () => {
  describe('should filter out (return true)', () => {
    test('single tap symbol', () => {
      expect(isCostOnlyMechanic('{T}')).toBe(true);
      expect(isCostOnlyMechanic('{t}')).toBe(true);  // case insensitive
      expect(isCostOnlyMechanic('{Q}')).toBe(true);  // untap
    });

    test('single mana cost', () => {
      expect(isCostOnlyMechanic('{2}')).toBe(true);
      expect(isCostOnlyMechanic('{X}')).toBe(true);
      expect(isCostOnlyMechanic('{0}')).toBe(true);
    });

    test('color mana costs', () => {
      expect(isCostOnlyMechanic('{W}')).toBe(true);
      expect(isCostOnlyMechanic('{U}')).toBe(true);
      expect(isCostOnlyMechanic('{B}')).toBe(true);
      expect(isCostOnlyMechanic('{R}')).toBe(true);
      expect(isCostOnlyMechanic('{G}')).toBe(true);
      expect(isCostOnlyMechanic('{C}')).toBe(true);
    });

    test('multiple mana symbols', () => {
      expect(isCostOnlyMechanic('{G}{G}')).toBe(true);
      expect(isCostOnlyMechanic('{2}{W}{W}')).toBe(true);
      expect(isCostOnlyMechanic('{X}{X}{R}')).toBe(true);
      expect(isCostOnlyMechanic('{3}{U}{U}')).toBe(true);
    });

    test('with whitespace', () => {
      expect(isCostOnlyMechanic(' {T} ')).toBe(true);
      expect(isCostOnlyMechanic('{2} {G}')).toBe(true);
      expect(isCostOnlyMechanic('{T}, {2}')).toBe(true);
    });

    test('case insensitive', () => {
      expect(isCostOnlyMechanic('{w}{w}')).toBe(true);
      expect(isCostOnlyMechanic('{G}{g}')).toBe(true);
    });

    test('normalized costs with {N}', () => {
      expect(isCostOnlyMechanic('{N}')).toBe(true);  // Normalized from {2}, {3}, etc.
      expect(isCostOnlyMechanic('{n}')).toBe(true);  // Case insensitive
      expect(isCostOnlyMechanic('{N}{N}')).toBe(true);
      expect(isCostOnlyMechanic('{N}{G}{G}')).toBe(true);
      expect(isCostOnlyMechanic('{N}{N}{W}')).toBe(true);
    });
  });

  describe('should keep (return false)', () => {
    test('mechanics with effects', () => {
      expect(isCostOnlyMechanic('Add {G}{G}')).toBe(false);
      expect(isCostOnlyMechanic('Draw a card')).toBe(false);
      expect(isCostOnlyMechanic('Scry N')).toBe(false);
      expect(isCostOnlyMechanic('Flying')).toBe(false);
      expect(isCostOnlyMechanic('Destroy target creature')).toBe(false);
    });

    test('normalized numbers', () => {
      expect(isCostOnlyMechanic('N')).toBe(false);  // Not in braces
      expect(isCostOnlyMechanic('N/N')).toBe(false);
    });

    test('mechanics with cost prefix', () => {
      expect(isCostOnlyMechanic('{T}: Add {W}')).toBe(false);  // Has effect after colon
      expect(isCostOnlyMechanic('{2}, {T}: Draw')).toBe(false);
    });
  });
});

describe('aggregateMechanics', () => {
  test('should handle empty card array', () => {
    const result = aggregateMechanics([]);
    expect(result.totalMechanics).toBe(0);
    expect(result.uniqueMechanics).toBe(0);
    expect(result.colorCombinations).toEqual([]);
  });

  test('should exclude token cards from aggregation', () => {
    const tokenCard = asCard({
      cid: 'testtkn1',
      isToken: true,
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Test Token',
        types: ['creature'],
        subtypes: ['warrior'],
        pt: { power: 2, toughness: 2 },
        rules: [{ variant: 'keyword', content: 'flying' }],
      }],
    });

    const result = aggregateMechanics([tokenCard]);
    expect(result.totalMechanics).toBe(0);
    expect(result.uniqueMechanics).toBe(0);
  });

  test('should aggregate mechanics from a simple white creature', () => {
    const card = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Test Angel',
        manaCost: { white: 2, generic: 1 },
        types: ['creature'],
        subtypes: ['angel'],
        pt: { power: 2, toughness: 2 },
        rules: [
          { variant: 'keyword', content: 'flying' },
          { variant: 'ability', content: 'When this enters, you gain 2 life.' },
        ],
      }],
    });

    const result = aggregateMechanics([card], { includeKeywords: true });

    expect(result.totalMechanics).toBeGreaterThan(0);
    expect(result.colorCombinations).toContain('white');

    const whiteStages = result.grid.get('white');
    expect(whiteStages).toBeDefined();

    // Card costs 3 mana, so it should appear in mid stage (turn 3)
    const midCell = whiteStages?.get('mid');
    expect(midCell).toBeDefined();
    expect(midCell!.mechanics.length).toBeGreaterThan(0);

    // Check that mechanics have weightedScore and sources
    const firstMechanic = midCell!.mechanics[0];
    expect(firstMechanic.weightedScore).toBeGreaterThan(0);
    expect(firstMechanic.sources.length).toBeGreaterThan(0);
    expect(firstMechanic.sources[0].cid).toBe('test0001');
  });

  test('should calculate weighted scores correctly', () => {
    const commonCard = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Common Card',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const mythicCard = asCard({
      cid: 'test0002',
      rarity: 'mythic',
      collectorNumber: 2,
      layout: 'normal',
      faces: [{
        name: 'Mythic Card',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Scry 2.' }],
      }],
    });

    const result = aggregateMechanics([commonCard, mythicCard]);

    const whiteEarly = result.grid.get('white')?.get('early');
    expect(whiteEarly).toBeDefined();

    const drawMechanic = whiteEarly!.mechanics.find(m => m.mechanic.includes('draw'));
    const scryMechanic = whiteEarly!.mechanics.find(m => m.mechanic.includes('scry'));

    expect(drawMechanic).toBeDefined();
    expect(scryMechanic).toBeDefined();

    // Common has weight 6, mythic has weight 1
    expect(drawMechanic!.weightedScore).toBe(6);
    expect(scryMechanic!.weightedScore).toBe(1);

    // Draw should be sorted before Scry due to higher weight
    expect(whiteEarly!.mechanics[0].mechanic).toContain('draw');
  });

  test('should track source cards correctly', () => {
    const card1 = asCard({
      cid: 'card001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Flying Bird',
        manaCost: { white: 1 },
        types: ['creature'],
        subtypes: ['bird'],
        pt: { power: 1, toughness: 1 },
        rules: [{ variant: 'keyword', content: 'flying' }],
      }],
    });

    const card2 = asCard({
      cid: 'card002',
      rarity: 'uncommon',
      collectorNumber: 2,
      layout: 'normal',
      faces: [{
        name: 'Flying Angel',
        manaCost: { white: 2 },
        types: ['creature'],
        subtypes: ['angel'],
        pt: { power: 2, toughness: 2 },
        rules: [{ variant: 'keyword', content: 'flying' }],
      }],
    });

    const result = aggregateMechanics([card1, card2], { includeKeywords: true });

    const whiteEarly = result.grid.get('white')?.get('early');
    const flyingMechanic = whiteEarly?.mechanics.find(m => m.mechanic === 'flying');

    expect(flyingMechanic).toBeDefined();
    expect(flyingMechanic!.sources.length).toBe(2);
    expect(flyingMechanic!.sources[0].cardName).toBe('Flying Bird');
    expect(flyingMechanic!.sources[1].cardName).toBe('Flying Angel');
  });

  test('should filter out cost-only mechanics when excludeCostOnlyMechanics is true', () => {
    const card = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Mana Dork',
        manaCost: { green: 1 },
        types: ['creature'],
        subtypes: ['elf', 'druid'],
        pt: { power: 1, toughness: 1 },
        rules: [
          { variant: 'ability', content: '{T}: Add {G}.' },
        ],
      }],
    });

    const withoutFilter = aggregateMechanics([card], { excludeCostOnlyMechanics: false });
    const withFilter = aggregateMechanics([card], { excludeCostOnlyMechanics: true });

    // Without filter should have more mechanics (includes {T})
    expect(withoutFilter.totalMechanics).toBeGreaterThan(withFilter.totalMechanics);

    // With filter should not have {T} as a mechanic
    const greenEarly = withFilter.grid.get('green')?.get('early');
    const hasTapMechanic = greenEarly?.mechanics.some(m => m.mechanic === '{t}' || m.mechanic === '{T}');
    expect(hasTapMechanic).toBeFalsy();

    // Should still have the "add {g}" effect
    const hasAddMechanic = greenEarly?.mechanics.some(m => m.mechanic.includes('add'));
    expect(hasAddMechanic).toBeTruthy();
  });

  test('should aggregate mechanics from multiple colors', () => {
    const whiteCard = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'White Card',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const blueCard = asCard({
      cid: 'test0002',
      rarity: 'uncommon',
      collectorNumber: 2,
      layout: 'normal',
      faces: [{
        name: 'Blue Card',
        manaCost: { blue: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const result = aggregateMechanics([whiteCard, blueCard]);

    expect(result.colorCombinations).toContain('white');
    expect(result.colorCombinations).toContain('blue');
    expect(result.totalMechanics).toBeGreaterThan(0);
  });

  test('should count total mechanics including duplicates', () => {
    const card1 = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Card 1',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const card2 = asCard({
      cid: 'test0002',
      rarity: 'common',
      collectorNumber: 2,
      layout: 'normal',
      faces: [{
        name: 'Card 2',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const result = aggregateMechanics([card1, card2]);

    // Both cards have the same "draw a card" mechanic
    expect(result.uniqueMechanics).toBe(1);
    // But total should count both instances
    expect(result.totalMechanics).toBe(2);
  });

  test('should group mechanics by rarity within cells', () => {
    const commonCard = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Common Card',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const rareCard = asCard({
      cid: 'test0002',
      rarity: 'rare',
      collectorNumber: 2,
      layout: 'normal',
      faces: [{
        name: 'Rare Card',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const result = aggregateMechanics([commonCard, rareCard]);

    const whiteStages = result.grid.get('white');
    const earlyCell = whiteStages?.get('early');

    expect(earlyCell).toBeDefined();
    const drawMechanic = earlyCell!.mechanics.find(m => m.mechanic.includes('draw'));
    expect(drawMechanic).toBeDefined();

    // Should have both common and rare counts
    expect(drawMechanic!.rarities.length).toBe(2);
    const commonCount = drawMechanic!.rarities.find(r => r.rarity === 'common')?.count;
    const rareCount = drawMechanic!.rarities.find(r => r.rarity === 'rare')?.count;
    expect(commonCount).toBe(1);
    expect(rareCount).toBe(1);
  });

  test('should sort color combinations in WUBRG order', () => {
    const cards = [
      asCard({
        cid: 'green01',
        rarity: 'common',
        collectorNumber: 1,
        layout: 'normal',
        faces: [{
          name: 'Green Card',
          manaCost: { green: 1 },
          types: ['instant'],
          rules: [{ variant: 'ability', content: 'Draw a card.' }],
        }],
      }),
      asCard({
        cid: 'white01',
        rarity: 'common',
        collectorNumber: 2,
        layout: 'normal',
        faces: [{
          name: 'White Card',
          manaCost: { white: 1 },
          types: ['instant'],
          rules: [{ variant: 'ability', content: 'Draw a card.' }],
        }],
      }),
      asCard({
        cid: 'blue01',
        rarity: 'common',
        collectorNumber: 3,
        layout: 'normal',
        faces: [{
          name: 'Blue Card',
          manaCost: { blue: 1 },
          types: ['instant'],
          rules: [{ variant: 'ability', content: 'Draw a card.' }],
        }],
      }),
    ];

    const result = aggregateMechanics(cards);

    // Should be sorted: white, blue, green (WUBRG order)
    expect(result.colorCombinations[0]).toBe('white');
    expect(result.colorCombinations[1]).toBe('blue');
    expect(result.colorCombinations[2]).toBe('green');
  });

  test('should respect includeKeywords option', () => {
    const card = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Flying Creature',
        manaCost: { white: 1 },
        types: ['creature'],
        subtypes: ['bird'],
        pt: { power: 1, toughness: 1 },
        rules: [{ variant: 'keyword', content: 'flying' }],
      }],
    });

    const withoutKeywords = aggregateMechanics([card], { includeKeywords: false });
    const withKeywords = aggregateMechanics([card], { includeKeywords: true });

    expect(withKeywords.totalMechanics).toBeGreaterThan(withoutKeywords.totalMechanics);
  });

  test('should use custom rarity weights', () => {
    const commonCard = asCard({
      cid: 'test0001',
      rarity: 'common',
      collectorNumber: 1,
      layout: 'normal',
      faces: [{
        name: 'Common Card',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Draw a card.' }],
      }],
    });

    const mythicCard = asCard({
      cid: 'test0002',
      rarity: 'mythic',
      collectorNumber: 2,
      layout: 'normal',
      faces: [{
        name: 'Mythic Card',
        manaCost: { white: 1 },
        types: ['instant'],
        rules: [{ variant: 'ability', content: 'Scry 2.' }],
      }],
    });

    // Use custom weights: C:8, U:4, R:2, M:1
    const result = aggregateMechanics([commonCard, mythicCard], {
      rarityWeights: { common: 8, uncommon: 4, rare: 2, mythic: 1 },
    });

    const whiteEarly = result.grid.get('white')?.get('early');
    const drawMechanic = whiteEarly?.mechanics.find(m => m.mechanic.includes('draw'));
    const scryMechanic = whiteEarly?.mechanics.find(m => m.mechanic.includes('scry'));

    // Common should have weight 8 (not default 6)
    expect(drawMechanic!.weightedScore).toBe(8);
    // Mythic should have weight 1
    expect(scryMechanic!.weightedScore).toBe(1);
  });
});
