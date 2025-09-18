import { getStatistics, SerializedCard } from 'kindred-paths';
import { BarDistribution } from '@/components/distribution/bar-distribution';
import { GridDistribution } from '@/components/distribution/grid-distribution';
import { useDeckNameFromSearch } from '@/utils/use-search';

export function StatisticsTab(props: { cards: SerializedCard[] }) {
  const deckName = useDeckNameFromSearch();
  const {
    totalCount, nonlandCount, landCount, availableTokenNames,
    cardColorDistribution, rarityDistribution,
    manaValueRarityDistribution,
    manaValueDistribution, cardTypeDistribution,
    subtypeDistribution, tokenDistribution,
  } = getStatistics(props.cards, deckName);
  return <>
    <p className="text-zinc-500 text-sm italic">
      Overview of <span className="font-bold">{totalCount}</span> cards ({nonlandCount} nonlands and {landCount} lands).
    </p>
    <div className="flex gap-5 justify-between items-start py-2 break-inside-avoid">
      <BarDistribution title="Card Color" data={cardColorDistribution} />
      <BarDistribution title="Rarity" data={rarityDistribution} />
      <BarDistribution title="Mana Value" data={manaValueDistribution} />
    </div>
    <div className="flex gap-5 justify-between items-start py-2 break-inside-avoid">
      <BarDistribution title="Card Type" data={cardTypeDistribution} sortOnValue />
      <BarDistribution title="Subtype" data={subtypeDistribution} />
      <GridDistribution
        title="Mana Value by Rarity"
        yAxis={{ type: 'number', stepSize: 1 }}
        xAxis={{ type: 'enum', values: ['c', 'u', 'r', 'm'] }}
        data={Object.entries(manaValueRarityDistribution).map(([key, count]) => {
          const [manaValueStr, rarity] = key.split('/');
          const manaValue = Number(manaValueStr);
          return { y: manaValue, x: rarity, count };
        })}
      />
    </div>
    <BarDistribution title="Creatable Token Name" data={tokenDistribution} check={availableTokenNames} fullWidth />
  </>;
}
