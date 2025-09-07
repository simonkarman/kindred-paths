import { getStatistics, SerializedCard } from 'kindred-paths';
import { BarDistribution } from '@/components/bar-distribution';

export function CardsStatistics(props: { cards: SerializedCard[] }) {
  const {
    totalCount, nonlandCount, landCount, availableTokenNames,
    cardsWithZeroCount,
    cardColorDistribution, rarityDistribution,
    manaValueRarityDistribution,
    manaValueDistribution, cardTypeDistribution,
    subtypeDistribution, tokenDistribution,
  } = getStatistics(props.cards);
  return <>
    <p className="text-zinc-500 text-sm italic">
      Overview of <span className="font-bold">{totalCount}</span> cards ({nonlandCount} nonlands and {landCount} lands).
      {cardsWithZeroCount.length > 0 && <>The following cards have a count of zero: {cardsWithZeroCount.map(c => c.name).join(', ')}</>}
    </p>
    <div className="flex gap-5 justify-between items-start py-2 break-inside-avoid">
      <BarDistribution title="Card Color" data={cardColorDistribution} />
      <BarDistribution title="Rarity" data={rarityDistribution} />
      <BarDistribution title="Mana Value" data={manaValueDistribution} />
    </div>
    <div className="flex gap-5 justify-between items-start py-2 break-inside-avoid">
      <BarDistribution title="Card Type" data={cardTypeDistribution} sortOnValue />
      <BarDistribution title="Subtype" data={subtypeDistribution} />
      <BarDistribution title="Mana Value by Rarity" data={manaValueRarityDistribution} />
      {/* TODO: create a 2 axis distribution that shows the missing 'mana value / rarity' combinations */}
    </div>
    <BarDistribution title="Creatable Token Name" data={tokenDistribution} check={availableTokenNames} fullWidth />
  </>;
}
