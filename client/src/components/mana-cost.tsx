import { singleCharacterToTypographyColor, typographyColors } from '@/utils/typography';

export function ManaCost(props: { cost: string }) {
  return props.cost.replace(/[^a-z0-9]/g, '').split('').map((c, index) => {
    const backgroundColor = typographyColors.get(singleCharacterToTypographyColor(c))!;
    return (
      <span
        key={index}
        className="inline-block text-sm uppercase font-bold border w-5 h-5 mr-0.25 rounded-full text-center"
        style={{
          backgroundColor: backgroundColor.main,
        }}
      >
        {c}
      </span>
    );
  });
}
