import { Color } from 'kindred-paths';

type TypographyColor = Color | 'colorless' | 'multicolor';

export const typographyColors: Map<TypographyColor, { main: string }> = new Map([
  ['colorless', {
    main: 'rgb(238, 236, 235)',
  }],
  ['multicolor', {
    main: 'rgb(186, 161, 239)',
  }],
  ['white', {
    main: 'rgb(236, 230, 179)',
  }],
  ['blue', {
    main: 'rgb(171, 225, 250)',
  }],
  ['black', {
    main: 'rgb(204, 195, 192)',
  }],
  ['red', {
    main: 'rgb(249, 172, 144)',
  }],
  ['green', {
    main: 'rgb(156, 212, 176)',
  }],
]);

export const colorToTypographyColor = (colors: Color[]) => {
  if (colors.length === 0) {
    return 'colorless';
  } else if (colors.length === 1) {
    return colors[0];
  } else {
    return 'multicolor';
  }
}
