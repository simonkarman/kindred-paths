import { CardColor, CardRarity } from 'kindred-paths';

type Prefix<K> = K extends string ? `mono ${K}` : K;
type TypographyColor = 'colorless' | Prefix<CardColor> | 'multicolor';

export const singleCharacterToTypographyColor = (char: string) => {
  switch (char.toLowerCase()) {
    case 'w':
      return 'mono white';
    case 'u':
      return 'mono blue';
    case 'b':
      return 'mono black';
    case 'r':
      return 'mono red';
    case 'g':
      return 'mono green';
    default:
      return 'colorless';
  }
}

export const typographyColors: Map<TypographyColor, { main: string }> = new Map([
  ['colorless', {
    main: 'rgb(238, 236, 235)',
  }],
  ['mono white', {
    main: 'rgb(236, 230, 179)',
  }],
  ['mono blue', {
    main: 'rgb(171, 225, 250)',
  }],
  ['mono black', {
    main: 'rgb(204, 195, 192)',
  }],
  ['mono red', {
    main: 'rgb(249, 172, 144)',
  }],
  ['mono green', {
    main: 'rgb(156, 212, 176)',
  }],
  ['multicolor', {
    main: 'rgb(186, 161, 239)',
  }],
]);

export const colorToTypographyColor = (colors: CardColor[]): TypographyColor => {
  if (colors.length === 0) {
    return 'colorless';
  } else if (colors.length === 1) {
    return `mono ${colors[0]}`;
  } else {
    return 'multicolor';
  }
}

export const typographyRarityColors: Map<CardRarity, string[]> = new Map([
  ['common', ['#000000', '#4f4f4f', '#000000']],
  ['uncommon', ['#4b6c79', '#bae2ef', '#4b6c79']],
  ['rare', ['#887441', '#e9d292', '#887441']],
  ['mythic', ['#b43326', '#f59326', '#b43326']],
]);
