import { abzanDevotee, blindObedience, craterhoofBehemoth, emry, herdHeirloom, tundra } from './example-cards';

const cards = [emry, abzanDevotee, herdHeirloom, craterhoofBehemoth, tundra, blindObedience];
cards.forEach(card => console.info(card.toReadableString() + '\n'));
