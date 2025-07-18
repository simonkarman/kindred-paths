import { Group } from './group';
import { SerializedCardSummary } from './serialized-card-summary';

export const exampleGroup1 = new Group<SerializedCardSummary>("Example Group 1", [
  { name: 'artifact', predicate: c => c.card.types.includes('artifact') },
  { name: 'wurbg card', predicate: c => c.color.length === 5 },
  { name: 'mono green mythic', predicate: (cardSummary: SerializedCardSummary) => cardSummary.color.length === 1 && cardSummary.color[0] === 'green' && cardSummary.card.rarity === 'mythic' },
  { name: 'legendary creature 1/2', predicate: ({ card }) => card.types.includes('creature') && card.supertype === 'legendary' },
  { name: 'legendary creature 2/2', predicate: ({ card }) => card.types.includes('creature') && card.supertype === 'legendary' },
  { name: 'white legendary creature', predicate: c => c.color.length === 1 && c.color.includes('white') && c.card.types.includes('creature') && c.card.supertype === 'legendary' },
]);

export const exampleGroup2 = new Group<SerializedCardSummary>("Example Group 2", [
  { name: 'artifact 1/2', predicate: c => c.card.types.includes('artifact') },
  { name: 'artifact 2/2', predicate: c => c.card.types.includes('artifact') },
]);

export const exampleGroup3 = new Group<SerializedCardSummary>("Example Group 3", [
  { name: 'artifact', predicate: c => c.card.types.includes('artifact') },
]);
