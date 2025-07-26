"use client";

import { Card, CardColor, CardRarity, CardSuperType, CardType, Mana, RuleVariant, SerializedCard, SerializedCardSchema } from 'kindred-paths';
import { useEffect, useState } from 'react';
import { createCard, updateCard } from '@/utils/server';
import { capitalize } from '@/utils/typography';
import { CardExplanation } from '@/components/card-explanation';
import { CardNameInput } from '@/components/editor/card-name-input';
import { CardTypesInput } from '@/components/editor/card-types-input';
import { CardPTInput } from '@/components/editor/card-pt-input';
import { CardSubtypesInput } from '@/components/editor/card-subtypes-input';
import { CardManaCostInput } from '@/components/editor/card-mana-cost-input';
import { CardRulesInput } from '@/components/editor/card-rules-input';
import { CardSupertypeInput } from '@/components/editor/card-supertype-input';
import { CardRarityInput } from '@/components/editor/card-rarity-input';
import { CardCollectorNumberInput } from '@/components/editor/card-collector-number-input';
import { CardTagsInput } from '@/components/editor/card-tags-input';
import { CardPreview } from '@/components/editor/card-preview';
import { useDeckName } from '@/components/deck-name-setter';

export function CardEditor({ start }: { start: SerializedCard }) {
  const deckName = useDeckName();
  const hasActiveDeck = start.id === "<new>" && deckName.length > 0 && deckName !== "*";

  // Properties State
  const [name, setName] = useState(start.name);
  const [rarity, setRarity] = useState<CardRarity>(start.rarity);
  const [supertype, setSupertype] = useState<CardSuperType>(start.supertype);
  const [subtypes, setSubtypes] = useState<string[] | undefined>(start.subtypes);
  const [types, setTypes] = useState<[CardType, ...CardType[]]>(start.types);
  const [manaCost, setManaCost] = useState<{ [type in Mana]?: number }>(start.manaCost);
  const [rules, setRules] = useState<{ variant: RuleVariant, content: string }[] | undefined>(start.rules);
  const [pt, setPt] = useState<{ power: number, toughness: number } | undefined>(start.pt);
  const [collectorNumber, setCollectorNumber] = useState(start.collectorNumber);
  const [art, setArt] = useState<string | undefined>(start.art); // TODO!
  const [tags, setTags] = useState<{ [key: string]: string | number | boolean } | undefined>({
    ...start.tags,
    ...(hasActiveDeck ? {
      deck: deckName,
      count: 2,
    } : {})
  } as {
    [key: string]: string | number | boolean
  } | undefined);

  // If types changes
  useEffect(() => {
    // reset supertype if it no longer applies
    if (supertype === 'basic' && (types.length !== 1 || types[0] !== 'land')) {
      setSupertype(undefined);
    }

    // reset pt if it no longer applies
    if (types.includes('creature') && !pt) {
      setPt({ power: 2, toughness: 2 });
    } else if (!types.includes('creature') && pt) {
      setPt(undefined);
    }
  }, [types]);

  const serializedCard: SerializedCard = {
    id: start.id,
    name,
    rarity,
    supertype,
    types,
    subtypes,
    manaCost,
    rules,
    pt,
    collectorNumber,
    art,
    tags,
  };

  // Form State
  const [isLoading, setIsLoading] = useState(false);
  const parsedCard = SerializedCardSchema.safeParse(serializedCard);
  const errors: {
    path: string,
    message: string,
  }[] = parsedCard.success ? [] : parsedCard.error.errors.map(e => ({ path: e.path.join('.'), message: e.message }));
  const getErrorMessage = (path: string) => errors.find(e => e.path === path)?.message || undefined;
  let validationError: string | undefined;
  let card: Card | undefined;
  try {
    card = new Card(serializedCard);
  } catch (e: unknown) {
    validationError = (e as Error).message;
  }

  // Handle form submission
  const handleCreateCard = async () => {
    if (!parsedCard.success) {
      return;
    }
    const data = parsedCard.data;
    setIsLoading(true);

    try {
      const result = serializedCard.id === '<new>'
        ? await createCard(data)
        : await updateCard(data);
      if (result) {

        // if /edit/<id>?t=/a/location is used, we want to get the t from the URL, and navigate to that page
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('t')) {
          window.location.href = urlParams.get('t')!;
        } else {
          // Navigate to the new card's page
          window.location.href = `/card/${result.id}`;
        }
      }
    } catch (error) {
      const message = 'Error creating/updating card: ' + ((error instanceof Error) ? error.message : 'Unknown error');
      console.error(message);
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  ;
  return (<>
    <div className="flex gap-8">
      <div className="space-y-6 w-2xl border border-zinc-200 bg-zinc-50 rounded-lg p-2 shadow">
        <h2 className="text-lg font-bold my-2 text-center">Create Card</h2>

        {<CardNameInput name={name} setName={setName} getErrorMessage={() => getErrorMessage('name')}/>}
        {<CardTypesInput types={types} setTypes={setTypes} getErrorMessage={() => getErrorMessage('types')}/>}
        {pt
          && <CardPTInput pt={pt} setPt={setPt} getErrorMessage={() => getErrorMessage('pt')}/>}
        {types.some(s => ['land', 'creature', 'artifact', 'enchantment'].includes(s))
          && <CardSubtypesInput subtypes={subtypes} setSubtypes={setSubtypes} getErrorMessage={() => getErrorMessage('subtypes')}/>}
        {<CardManaCostInput manaCost={manaCost} setManaCost={setManaCost}
                            getErrorMessage={(color: CardColor | 'colorless') => getErrorMessage(`manaCost.${color}`)}/>}
        {<CardRulesInput rules={rules} setRules={setRules} getErrorMessage={() => getErrorMessage('rules')}/>}
        {<CardSupertypeInput supertype={supertype} setSupertype={setSupertype} types={types} getErrorMessage={() => getErrorMessage('supertype')}/>}
        {<CardRarityInput rarity={rarity} setRarity={setRarity} getErrorMessage={() => getErrorMessage('rarity')}/>}
        {<CardCollectorNumberInput collectorNumber={collectorNumber} setCollectorNumber={setCollectorNumber}
                                   getErrorMessage={() => getErrorMessage('collectorNumber')}/>}
        <CardTagsInput tags={tags} setTags={setTags} getErrorMessage={() => getErrorMessage('tags')}/>

        {/* Create Button */}
        <button
          onClick={handleCreateCard}
          disabled={(errors.length > 0) || (validationError !== undefined) || isLoading}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? `${serializedCard.id === "<new>" ? 'Creating' : 'Updating'}...` : `${serializedCard.id === "<new>" ? "Create" : "Update"} Card`}
        </button>
      </div>
      <div className="space-y-6 w-md pt-4">
        {/* Show Card Explanation */}
        {card && <CardExplanation serializedCard={serializedCard}/>}

        {/* Show Errors */}
        {((errors.length > 0) || (validationError !== undefined)) && (
          <div className="text-red-700">
            <h3 className="font-bold">Errors:</h3>
            <ul className="list-disc pl-5">
              {errors.map((err, index) => (
                <li key={index}>
                  <strong>{capitalize(err.path)}:</strong> {err.message}
                </li>
              ))}
              {validationError && (
                <li>
                  <strong>Validation Error:</strong> {validationError}
                </li>
              )}
            </ul>
          </div>
        )}
        <hr/>
        <div className="flex w-full items-center justify-center">
          {card !== undefined && errors.length === 0 && <CardPreview card={card}/>}
        </div>
      </div>
    </div>
  </>);
}
