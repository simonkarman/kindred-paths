import { singleCharacterToTypographyColor, typographyColors } from '@/utils/typography';

export function ManaCost(props: { cost: string }) {
  const colors = props.cost.replace(/[^a-z0-9]/g, '').split('');

  if (colors.length === 0) {
    return <span className="text-gray-400">No mana cost</span>;
  }

  return colors.map((c, index) => {
    const backgroundColor = typographyColors.get(singleCharacterToTypographyColor(c))!;
    return (
      <span
        key={index}
        className="inline-block text-xs uppercase font-bold border border-zinc-500 py-0.5 px-1 mr-0.25 rounded-full text-center"
        style={{
          backgroundColor: backgroundColor.main,
        }}
      >
        {c === 'c' ? '◇' : c}
      </span>
    );
  });
}
