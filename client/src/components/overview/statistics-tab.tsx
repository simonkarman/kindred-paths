import { getStatistics, SerializedCard } from 'kindred-paths';
import { BarDistribution } from '@/components/distribution/bar-distribution';
import { GridDistribution } from '@/components/distribution/grid-distribution';
import { useDeckNameFromSearch } from '@/utils/use-search';

export function StatisticsTab(props: { cards: SerializedCard[] }) {
  const deckName = useDeckNameFromSearch();
  const {
    totalCount, nonlandCount, landCount,
    tokens,
    cardColorDistribution, rarityDistribution,
    manaValueRarityDistribution,
    manaValueDistribution, cardTypeDistribution,
    subtypeDistribution, tokenDistribution,
  } = getStatistics(props.cards, deckName);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Collection Summary</h3>
        <div className="flex flex-wrap gap-6 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600">{totalCount}</span>
            <span className="text-sm text-slate-600">total cards</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-700">{nonlandCount}</span>
            <span className="text-sm text-slate-600">nonlands</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-700">{landCount}</span>
            <span className="text-sm text-slate-600">lands</span>
          </div>
        </div>

        {(tokens.length > 0 || deckName) && (
          <div className="space-y-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
            {tokens.length > 0 && (
              <p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700 mr-2">
                  Note
                </span>
                Statistics exclude <strong className="text-slate-900">{tokens.length}</strong> unique {tokens.length === 1 ? 'token' : 'tokens'} from this query.
              </p>
            )}
            {deckName && (
              <p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 mr-2">
                  Deck
                </span>
                Statistics based on counts in deck <strong className="text-slate-900">{deckName}</strong>.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Primary Distributions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Primary Distributions</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <BarDistribution title="Card Color" data={cardColorDistribution} />
          <BarDistribution title="Rarity" data={rarityDistribution} />
          <BarDistribution title="Mana Value" data={manaValueDistribution} />
        </div>
      </div>

      {/* Detailed Distributions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Detailed Breakdown</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
      </div>

      {/* Token Distribution */}
      {Object.keys(tokenDistribution).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Token Generation</h3>
          <BarDistribution
            title="Creatable Token Name"
            data={tokenDistribution}
            check={tokens.map(t => t.getTokenReferenceName())}
            sortOnValue
            fullWidth
          />
        </div>
      )}
    </div>
  );
}
