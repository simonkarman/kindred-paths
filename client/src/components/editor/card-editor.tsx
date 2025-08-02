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
import { CardArtInput } from '@/components/editor/card-art-input';
import { CardTokenColorsInput } from '@/components/editor/card-token-colors-input';

export function CardEditor({ start }: { start: SerializedCard }) {
  const deckName = useDeckName();
  const isCreate = start.id === "<new>";
  const hasActiveDeck = deckName.length > 0 && deckName !== "*";

  // Properties State
  const [name, setName] = useState(start.name);
  const [rarity, setRarity] = useState<CardRarity>(start.rarity);
  const [supertype, setSupertype] = useState<CardSuperType>(start.supertype);
  const [tokenColors, setTokenColors] = useState<CardColor[] | undefined>(start.tokenColors);
  const [subtypes, setSubtypes] = useState<string[] | undefined>(start.subtypes);
  const [types, setTypes] = useState<[CardType, ...CardType[]]>(start.types);
  const [manaCost, setManaCost] = useState<{ [type in Mana]?: number }>(start.manaCost);
  const [rules, setRules] = useState<{ variant: RuleVariant, content: string }[] | undefined>(start.rules);
  const [pt, setPt] = useState<{ power: number, toughness: number } | undefined>(start.pt);
  const [collectorNumber, setCollectorNumber] = useState(start.collectorNumber);
  const [art, setArt] = useState<string | undefined>(start.art);
  const [tags, setTags] = useState<{ [key: string]: string | number | boolean } | undefined>(
    start.tags as { [key: string]: string | number | boolean } | undefined
  );

  // If supertype changes
  useEffect(() => {
    // Update tokenColors
    if (supertype === 'token') {
      setTokenColors([]);
    } else {
      setTokenColors(undefined);
    }

    // And update mana cost
    if (supertype === 'basic' || supertype === 'token') {
      setManaCost({});
    }
  }, [supertype]);

  // If types changes
  useEffect(() => {
    // reset supertype if it no longer applies
    if (supertype === 'basic' && (types.length !== 1 || types[0] !== 'land')) {
      setSupertype(undefined);
    }

    // reset pt if it no longer applies
    if (types.includes('creature') && !pt) {
      setPt(start.pt ?? { power: 2, toughness: 2 });
    } else if (!types.includes('creature') && pt) {
      setPt(undefined);
    }
  }, [types]);

  // If deckName changes, update tags
  useEffect(() => {
    if (isCreate && hasActiveDeck) {
      setTags({
        ...tags,
        deck: deckName,
        count: tags?.count ?? 2, // Default to 2 if not set
      });
    }
  }, [deckName]);

  const serializedCard: SerializedCard = {
    id: start.id,
    name,
    rarity,
    supertype,
    tokenColors,
    types,
    subtypes,
    manaCost,
    rules,
    pt,
    collectorNumber,
    art,
    tags,
  };
  const isChanged = isCreate || (JSON.stringify(serializedCard) !== JSON.stringify(start));
  const canSave = isChanged && (!isCreate || name !== start.name);

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

  // Handle cancel/discard
  const handleDiscard = () => {
    // If the URL has a 't' parameter, redirect to that location
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('t')) {
      window.location.href = urlParams.get('t')!;
    } else {
      // If no 't' parameter, redirect based on whether it's a create or edit
      if (isCreate) {
        // If creating a new card, just redirect to the home page
        window.location.href = '/';
      } else {
        // If editing an existing card, redirect to the card's page
        window.location.href = `/card/${start.id}`;
      }
    }
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

  const artSetting: string = typeof tags?.["setting"] === 'string' ? tags["setting"] : '';
  const setArtSetting = (setting: string | number | boolean | undefined) => {
    const _tags = { ...(tags ?? {}) };
    if (setting === undefined || (typeof setting === 'string' && setting.trim() === '')) {
      delete _tags["setting"];
      setTags(_tags);
      return;
    } else {
      setTags({
        ...tags,
        "setting": setting,
      });
    }
  };

  return (<>
    <div className="absolute left-2 right-2 flex items-start gap-6">
      <div className={`w-320 space-y-6 border ${isChanged ? 'border-orange-200' : 'border-zinc-200'} bg-white rounded-lg px-2 pb-2 shadow-lg`}>
        <h2 className="text-lg font-bold my-2 text-center">{isCreate ? 'Create Card' : `Update ${serializedCard.name}`}</h2>
        <div className="flex gap-6">
          <div className="space-y-4 grow border-r-2 border-zinc-200 pr-6">
            <CardTypesInput types={types} setTypes={setTypes} getErrorMessage={() => getErrorMessage('types')}
                            isChanged={!isCreate && JSON.stringify(start.types) !== JSON.stringify(types)} revert={() => setTypes(start.types)}
            />
            {pt
              && <CardPTInput pt={pt} setPt={setPt} getErrorMessage={() => getErrorMessage('pt')}
                              isChanged={!isCreate && start.pt !== undefined && JSON.stringify(start.pt) !== JSON.stringify(pt)} revert={() => setPt(start.pt)}
              />}
            {types.some(s => ['land', 'creature', 'artifact', 'enchantment'].includes(s))
              && <CardSubtypesInput subtypes={subtypes} setSubtypes={setSubtypes} getErrorMessage={() => getErrorMessage('subtypes')}
                                    isChanged={!isCreate && JSON.stringify(start.subtypes) !== JSON.stringify(subtypes)} revert={() => setSubtypes(start.subtypes)}
              />}
            {(supertype !== 'basic' && supertype !== 'token')
              && <CardManaCostInput manaCost={manaCost} setManaCost={setManaCost}
                               getErrorMessage={(color: CardColor | 'colorless') => getErrorMessage(`manaCost.${color}`)}
                               isChanged={!isCreate && JSON.stringify(start.manaCost) !== JSON.stringify(manaCost)} revert={() => setManaCost(start.manaCost)}
            />}
            <CardRulesInput rules={rules} setRules={setRules} getErrorMessage={() => getErrorMessage('rules')}
                            isChanged={!isCreate && JSON.stringify(start.rules) !== JSON.stringify(rules)} revert={() => setRules(start.rules)}
            />
            <CardSupertypeInput supertype={supertype} setSupertype={setSupertype} types={types} getErrorMessage={() => getErrorMessage('supertype')}
                                isChanged={!isCreate && JSON.stringify(start.supertype) !== JSON.stringify(supertype)} revert={() => setSupertype(start.supertype)}
            />
            {tokenColors !== undefined
              && <CardTokenColorsInput tokenColors={tokenColors} setTokenColors={setTokenColors} getErrorMessage={() => getErrorMessage('tokenColors')}
                                isChanged={!isCreate && start.tokenColors !== undefined && JSON.stringify(start.tokenColors) !== JSON.stringify(tokenColors)} revert={() => setTokenColors(start.tokenColors)}
            />}
          </div>
          <div className="space-y-4 w-150">
            <CardNameInput name={name} setName={setName} getErrorMessage={() => getErrorMessage('name')} card={card}
                           isChanged={!isCreate && JSON.stringify(start.name) !== JSON.stringify(name)} revert={() => setName(start.name)}
            />
            <CardRarityInput rarity={rarity} setRarity={setRarity} getErrorMessage={() => getErrorMessage('rarity')}
                             isChanged={!isCreate && JSON.stringify(start.rarity) !== JSON.stringify(rarity)} revert={() => setRarity(start.rarity)}
            />
            <CardArtInput artSetting={artSetting} setArtSetting={setArtSetting} art={art} setArt={setArt} getErrorMessage={() => getErrorMessage('art')} card={card}
                          isChanged={!isCreate && JSON.stringify(start.art) !== JSON.stringify(art)} revert={() => setArt(start.art)}
                          artSettingIsChanged={!isCreate && JSON.stringify(start.tags?.setting) !== JSON.stringify(tags?.["setting"])} revertArtSetting={() => setArtSetting(start.tags?.setting)}
            />
            <CardCollectorNumberInput collectorNumber={collectorNumber} setCollectorNumber={setCollectorNumber}
                                      getErrorMessage={() => getErrorMessage('collectorNumber')}
                                      isChanged={!isCreate && JSON.stringify(start.collectorNumber) !== JSON.stringify(collectorNumber)} revert={() => setCollectorNumber(start.collectorNumber)}
            />
            <CardTagsInput tags={tags} setTags={setTags} getErrorMessage={() => getErrorMessage('tags')}
                           isChanged={!isCreate && JSON.stringify(start.tags) !== JSON.stringify(tags)} revert={() => setTags(start.tags as { [key: string]: string | number | boolean } | undefined)}
            />
          </div>
        </div>

        {/* Create Button */}
        <div className="space-y-1">
          {!canSave && <p className="text-center text-zinc-600 text-sm">
            {isCreate ? "You must first provide a new name for the card." : "You must first make changes, before you can save them."}
          </p>}
          {((errors.length > 0) || (validationError !== undefined) || isLoading) && <p className="text-center text-red-600 text-sm">
            You must fix the above errors before you can {isCreate ? 'create' : 'update'} the card.
          </p>}
          <div className="flex gap-4 items-baseline">
            <button
              onClick={handleCreateCard}
              disabled={(errors.length > 0) || (validationError !== undefined) || isLoading || !canSave}
              className="w-full py-2 px-4 disabled:bg-gray-500 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? `${isCreate ? 'Creating' : 'Updating'}...`
                : (isCreate ? "Create card" : "Save changes")}
            </button>
            <button
              onClick={handleDiscard}
              className="w-60 mt-2 py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              {isCreate ? 'Cancel Card Creation' : 'Discard changes'}
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-6 w-md pt-4">
        <div className="flex w-full items-center justify-center">
          {(card !== undefined && errors.length === 0)
            ? <CardPreview card={card}/>
            : <div className="w-80 h-100 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-center"></div>}
        </div>
        <hr className="border-gray-200" />

        {/* Show Errors */}
        {((errors.length > 0) || (validationError !== undefined)) && (<>
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
        </>)}

        {/* Show Card Json */}
        {/*<div className="space-y-1">*/}
        {/*  <h3 className="font-bold">Card JSON:</h3>*/}
        {/*  <pre className="bg-gray-50 p-2 rounded-md overflow-x-auto text-sm">*/}
        {/*    {JSON.stringify(serializedCard, null, 2)}*/}
        {/*  </pre>*/}
        {/*</div>*/}

        {/* Show Card Explanation */}
        {card && <CardExplanation serializedCard={serializedCard}/>}
      </div>
    </div>
  </>);
}
