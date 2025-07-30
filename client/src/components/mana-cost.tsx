import { singleCharacterToTypographyColor, typographyColors } from '@/utils/typography';

export function ManaCost(props: { cost: string }) {
  return props.cost.replace(/[^a-z0-9]/g, '').split('').map((c, index) => {
    const backgroundColor = typographyColors.get(singleCharacterToTypographyColor(c))!;
    return (
      <span
        key={index}
        className="inline-block text-xs uppercase font-bold border border-zinc-500 py-0.5 px-1 mr-0.25 rounded-full text-center"
        style={{
          backgroundColor: backgroundColor.main,
        }}
      >
        {c}
      </span>
    );
  });
}
