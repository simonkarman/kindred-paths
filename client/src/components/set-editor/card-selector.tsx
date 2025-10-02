import { BlueprintValidator, SerializableBlueprintWithSource, SerializedCard } from 'kindred-paths';
import { useState } from 'react';
import { CardRender } from '@/components/card-render';
import SearchBar from '@/components/search-bar';
import { filterCardsBasedOnSearch, useSearch } from '@/utils/use-search';

type CardSelectorProps = {
  cards: SerializedCard[],
  validation?: {
    blueprints: SerializableBlueprintWithSource[],
    metadata: { [metadataKey: string]: string | undefined },
  }
  onSelect: (card: SerializedCard) => void,
  onCancel: () => void,
  search: {
    scope: string,
    initial: string,
  },
}

export function CardSelector(props: CardSelectorProps) {
  const [ignoreBlueprintValidation, setIgnoreBlueprintValidation] = useState(false);
  const [searchText] = useSearch(props.search.scope, props.search.initial);

  const hasValidation = props.validation && props.validation.blueprints.length > 0;
  const _cards: SerializedCard[] = (hasValidation && !ignoreBlueprintValidation)
    ? props.cards.filter(card => new BlueprintValidator().validate({
      metadata: props.validation!.metadata,
      blueprints: props.validation!.blueprints,
      card: card,
    }).success)
    : props.cards;
  const cards = filterCardsBasedOnSearch(_cards, searchText);

  return <>
    <h2 className="font-bold w-full text-center text-lg">Select a card</h2>
    <div
      className={`flex gap-2 justify-center items-baseline mb-4 p-1 border rounded-lg ${searchText ? 'border-transparent' : 'border-gray-200'}`}
    >
      <SearchBar scope={props.search.scope} initial={props.search.initial} />
      {hasValidation && <button
        onClick={() => setIgnoreBlueprintValidation(i => !i)}
        className="shrink-0 px-3 py-0.5 border-2 text-blue-500 border-blue-500 rounded-lg hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition"
      >
        {ignoreBlueprintValidation ? 'Exclude invalid cards' : 'Include invalid cards'}
      </button>}
    </div>
    {hasValidation && ignoreBlueprintValidation && <div>
      <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
        Warning: You are including cards that do not match the blueprint requirements.
        <button
          onClick={() => setIgnoreBlueprintValidation(false)}
          className="inline pl-1 underline text-blue-500 hover:text-blue-600"
        >
          Exclude invalid cards
        </button>
      </div>
    </div>}
    {cards.length === 0 && <div className="text-center text-gray-500">
      No cards found
    </div>}
    <div className="grid grid-cols-3 gap-2">
      {cards.map(card => <div
        key={card.id}
      >
        <button
          className="cursor-pointer rounded-2xl border-3 border-transparent hover:border-black transition-colors"
          onClick={() => props.onSelect(card)}
        >
          <CardRender serializedCard={card} hideBorder />
        </button>
      </div>)}
    </div>
  </>;
}
