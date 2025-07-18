import { Group } from './group';
import { Card } from './card';

export const exampleGroup1 = new Group<Card>("Example Group 1", [
  { name: 'artifact', predicate: c => c.types.includes('artifact') },
  { name: 'wurbg card', predicate: c => c.color.length === 5 },
  { name: 'mono green mythic', predicate: c => c.color.length === 1 && c.color()[0] === 'green' && c.rarity === 'mythic' },
  { name: 'legendary creature 1/2', predicate: c => c.types.includes('creature') && c.supertype === 'legendary' },
  { name: 'legendary creature 2/2', predicate: c => c.types.includes('creature') && c.supertype === 'legendary' },
  { name: 'white legendary creature', predicate: c => c.color.length === 1 && c.color().includes('white') && c.types.includes('creature') && c.supertype === 'legendary' },
]);

export const exampleGroup2 = new Group<Card>("Example Group 2", [
  { name: 'artifact 1/2', predicate: c => c.types.includes('artifact') },
  { name: 'artifact 2/2', predicate: c => c.types.includes('artifact') },
]);

export const exampleGroup3 = new Group<Card>("Example Group 3", [
  { name: 'artifact', predicate: c => c.types.includes('artifact') },
]);
