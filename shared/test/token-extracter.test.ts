/* eslint-disable max-len */
import { expect, test } from 'vitest';
import { Card } from '../src';

test('token extracter', () => {
  const scenarios = [
    {
      abilities: ['For each creature card you own in exile with a memory counter on it, create a tapped and attacking token that\'s a copy of it. Exile those tokens at end of combat.'],
      expectedTokens: ['Copy token'],
    },
    {
      abilities: ['At the beginning of your upkeep, create a 1/1 white Ally creature token with "{t}: Create a 2/2 red Minotaur creature token with menace" for each experience counter you have.'],
      expectedTokens: ['1/1 white Ally creature token with "{t}: Create a 2/2 red Minotaur creature token with menace"', '2/2 red Minotaur creature token with menace'],
    },
    {
      abilities: ['At the beginning of your upkeep, create a 1/1 white Ally creature token for each experience counter you have.'],
      expectedTokens: ['1/1 white Ally creature token'],
    },
    {
      abilities: ['When this creature enters, create a number of 1/1 black Harpy creature tokens with flying equal to your devotion to black.'],
      expectedTokens: ['1/1 black Harpy creature token with flying'],
    },
    {
      abilities: ['Whenever a nontoken creature you control dies, create a 1/1 white Spirit creature token with flying.'],
      expectedTokens: ['1/1 white Spirit creature token with flying'],
    },
    {
      abilities: ['Whenever you attack with this creature and/or your commander, for each opponent, create two 1/2 red Goblin creature tokens with first strike that\'s tapped and attacking that player.'],
      expectedTokens: ['1/2 red Goblin creature token with first strike'],
    },
    {
      abilities: ['You get an emblem with "At the beginning of your end step, create three 1/1 white Cat creature tokens with lifelink." and "Creatures you control get +1/+1."'],
      expectedTokens: ['1/1 white Cat creature token with lifelink'],
    },
    {
      abilities: ['Whenever this creature enters, create a 1/2 red Soldier creature token with haste. Then, if you control a spell that targets this creature, create a 1/1 red Soldier creature token with haste.'],
      expectedTokens: ['1/2 red Soldier creature token with haste', '1/1 red Soldier creature token with haste'],
    },
    {
      abilities: ['Whenever this creature enters, create a 1/1 red Soldier creature token with haste', 'Whenever you attack, create a 1/1 red Soldier creature token with haste.'],
      expectedTokens: ['1/1 red Soldier creature token with haste'],
    },
    {
      abilities: ['At the beginning of your upkeep, you may create Boo, a legendary 1/1 red Hamster creature token with trample and haste.'],
      expectedTokens: ['Boo, legendary 1/1 red Hamster creature token with trample and haste'],
    },
    {
      abilities: ['Whenever this creature deals combat damage to a player, roll a d20. You create a number of 1/1 blue Faerie Dragon creature tokens with flying equal to the result.'],
      expectedTokens: ['1/1 blue Faerie Dragon creature token with flying'],
    },
    {
      abilities: ['When this creature enters, sacrifice any number of creatures each with base power or toughness 1 or less. Create that many 4/4 colorless Eldrazi Angel creature tokens with flying and vigilance.'],
      expectedTokens: ['4/4 colorless Eldrazi Angel creature token with flying and vigilance'],
    },
    {
      abilities: ['Create X 1/1 colorless Gnome artifact creature tokens that are tapped and attacking, where X is the number of +1/+1 counters on this creature.'],
      expectedTokens: ['1/1 colorless Gnome artifact creature token'],
    },
    {
      abilities: ['Create a 1/1 red Mercenary creature token with "{t}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery."'],
      expectedTokens: ['1/1 red Mercenary creature token with "{t}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery."'],
    },
    {
      abilities: [
        'Create X 1/2 green Spider creature tokens with reach, where X is the number of creatures attacking you.',
        'Create a tapped 1/2 green Spider creature token with reach.'],
      expectedTokens: ['1/2 green Spider creature token with reach'],
    },
    {
      abilities: ['Create X 1/2 green Spider creature tokens with reach, where X is the number of creatures attacking you and create a 1/2 green Spider creature tokens with reach.'],
      expectedTokens: ['1/2 green Spider creature token with reach'],
    },
    {
      abilities: ['Create a 1/1 Cat creature token with lifelink. Create two 3/3 Beast creature tokens with trample.'],
      expectedTokens: ['1/1 Cat creature token with lifelink', '3/3 Beast creature token with trample'],
    },
    {
      abilities: ['Target player draws a card, then exiles a card from their hand. If a creature card is exiled this way, that player creates a token that\'s a copy of that card.'],
      expectedTokens: ['Copy token'],
    },
    {
      abilities: ['Whenever you commit a crime, create a 1/1 red Mercenary creature token with "{t}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery." This ability triggers only once each turn.'],
      expectedTokens: ['1/1 red Mercenary creature token with "{t}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery."'],
    },
    {
      abilities: ['If a creature card is exiled this way, that player creates a token that\'s a copy of that card.'],
      expectedTokens: ['Copy token'],
    },
    {
      abilities: [
        'When you cast this spell from your hand, copy it if you control an artifact, then copy it if you control an enchantment. You may choose new targets for the copies.',
        'Return target nonland permanent to its owner\'s hand. You create a 2/2 white Knight creature token with vigilance.',
      ],
      expectedTokens: ['2/2 white Knight creature token with vigilance'],
    },
    {
      abilities: ['At the beginning of your end step, if a creature died this turn, create a tapped token that\'s a copy of this creature.'],
      expectedTokens: ['Copy token'],
    },
  ];
  // For each ability, create a card and check the creatable tokens
  scenarios.forEach(({ abilities, expectedTokens }, index) => {
    const card = new Card({
      id: `test-card-${index}`,
      name: `Test Card ${index}`,
      rarity: 'common',
      types: ['creature'],
      subtypes: ['human'],
      manaCost: { colorless: 2 },
      rules: abilities.map(content => ({ variant: 'ability', content })),
      pt: { power: 2, toughness: 2 },
      collectorNumber: index + 1,
    });
    expect([abilities, card.getCreatableTokenNames()]).toStrictEqual([abilities, expectedTokens]);
  });
});
