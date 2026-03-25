import { describe, expect, test } from 'vitest';
import { aggregateMechanics, SerializedCard } from '../src';

/** Helper to create a SerializedCard with proper literal types from a plain object. */
function asCard(props: SerializedCard): SerializedCard {
  return props;
}

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
});
