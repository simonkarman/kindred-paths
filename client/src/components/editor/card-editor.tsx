"use client";

import {
  BlueprintValidator,
  Card,
  CardColor,
  CardRarity,
  CardSuperType,
  CardType,
  CriteriaFailureReason,
  explainCriteria,
  Mana,
  RuleVariant, SerializableBlueprintWithSource,
  SerializedCard,
  SerializedCardSchema,
  tryParseLoyaltyAbility,
} from 'kindred-paths';
import { useEffect, useState } from 'react';
import { createCard, updateCard } from '@/utils/server';
import { capitalize } from '@/utils/typography';
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
import { CardArtInput } from '@/components/editor/card-art-input';
import { CardTokenColorsInput } from '@/components/editor/card-token-colors-input';
import { CardLoyaltyInput } from '@/components/editor/card-loyalty-input';
import { useDeckNameFromSearch, useSetNameFromSearch } from '@/utils/use-search';

type CardEditorProps = {
  start: SerializedCard,
  validate?: {
    blueprints: SerializableBlueprintWithSource[],
    metadata: { [key: string]: string | undefined },
  }
  onSave?: (card: SerializedCard) => void,
  onCancel?: () => void,
};

export function CardEditor({ start, validate, onSave, onCancel }: CardEditorProps) {
  const isCreate = start.id === "<new>";
  const set = useSetNameFromSearch();
  const deck = useDeckNameFromSearch();

  // Properties State
  const [name, setName] = useState(start.name);
  const [rarity, setRarity] = useState<CardRarity>(start.rarity);
  const [isToken, setIsToken] = useState(start.isToken);
  const [supertype, setSupertype] = useState<CardSuperType>(start.supertype);
  const [tokenColors, setTokenColors] = useState<CardColor[] | undefined>(start.tokenColors);
  const [subtypes, setSubtypes] = useState<string[] | undefined>(start.subtypes);
  const [types, setTypes] = useState<[CardType, ...CardType[]]>(start.types);
  const [manaCost, setManaCost] = useState<{ [type in Mana]?: number }>(start.manaCost);
  const [rules, setRules] = useState<{ variant: RuleVariant, content: string }[] | undefined>(start.rules);
  const [pt, setPt] = useState<{ power: number, toughness: number } | undefined>(start.pt);
  const [loyalty, setLoyalty] = useState<number | undefined>(start.loyalty);
  const [collectorNumber, setCollectorNumber] = useState(start.collectorNumber);
  const [art, setArt] = useState<string | undefined>(start.art);
  const [tags, setTags] = useState<{ [key: string]: string | number | boolean } | undefined>(
    start.tags as { [key: string]: string | number | boolean } | undefined
  );

  // If isToken changes
  useEffect(() => {
    // Update tokenColors
    if (isToken) {
      setTokenColors(tokenColors => tokenColors ?? []);
    } else {
      setTokenColors(undefined);
    }
  }, [isToken]);

  // If card has basic supertype or is a token, reset mana cost
  useEffect(() => {
    if (supertype === 'basic' || isToken) {
      setManaCost({});
    }
  }, [supertype, isToken]);

  // If types changes
  const canHavePT = types.includes('creature') || (types.includes('artifact') && subtypes?.includes('vehicle'));
  useEffect(() => {
    // reset supertype if it no longer applies
    if (supertype === 'basic' && (types.length !== 1 || types[0] !== 'land')) {
      setSupertype(undefined);
    }

    // Update info on planeswalker
    if (types.includes('planeswalker')) {
      setSupertype('legendary');
      setLoyalty(start.loyalty ?? 3);
      if (!name.includes(',')) {
        setName(name + ', Planeswalker');
      }
      if (!rules?.some(r => tryParseLoyaltyAbility(r).success)) {
        setRules([...(rules ?? []), { variant: 'ability', content: '+1: Add one mana of any color.' }]);
      }
    } else if (loyalty !== undefined) {
      setLoyalty(undefined);
    }

    // Remove subtypes on instant/sorcery/planeswalkers
    if (types.some(t => ['instant', 'sorcery', 'planeswalker'].includes(t))) {
      setSubtypes(undefined);
    } else if (subtypes === undefined) {
      // for any other type, if subtypes is undefined, set it to the start value
      setSubtypes(start.subtypes);
    }

    // reset pt if it no longer applies
    if (canHavePT && !pt) {
      setPt(start.pt ?? { power: 2, toughness: 2 });
    } else if (!canHavePT && pt) {
      setPt(undefined);
    }
  }, [supertype, subtypes, types]);

  // If setName changes, update tags
  useEffect(() => {
    if (isCreate && (set || deck)) {
      setTags(tags => ({
        ...tags,
        ...(set ? { set } : {}),
        ...(deck ? { [`deck/${deck}`]: 1 } : {}),
      }));
    }
  }, [isCreate, deck, set]);

  const serializedCard: SerializedCard = {
    id: start.id,
    name,
    rarity,
    isToken,
    supertype,
    tokenColors,
    types,
    subtypes: subtypes ?? [],
    manaCost,
    rules,
    pt,
    loyalty,
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
  const getErrorMessage = (field: string) => {
    const additionalCriteriaFields: { [field: string]: string[] | undefined } = {
      types: ['isToken'],
      manaCost: ['manaValue', 'color', 'colorIdentity'],
      pt: ['power', 'toughness', 'powerToughnessDiff'],
      rules: ['creatableTokens', 'colorIdentity'],
    };
    const criteriaFields = [
      field,
      ...(additionalCriteriaFields[field] ?? [])].flatMap(f => criteriaFailureReasonsPerField[f] ?? [],
    );
    const messages = [
      ...errors.filter(e => e.path === field || e.path.startsWith(`${field}.`)).map(e => e.message),
      ...criteriaFields.map(fe => capitalize(fe.location) + ' must ' + explainCriteria(fe.criteria)),
    ].filter(m => m !== undefined);
    return messages.length > 0 ? messages.join(' AND ') : undefined;
  };
  let validationError: string | undefined;
  let card: Card | undefined;
  try {
    card = new Card(serializedCard);
  } catch (e: unknown) {
    validationError = (e as Error).message;
  }
  const criteriaFailureReasonsPerField: { [field: string]: CriteriaFailureReason[] | undefined } = {};
  if (card && validate) {
    const validation = new BlueprintValidator().validate({
      metadata: validate.metadata,
      blueprints: validate.blueprints,
      card: serializedCard,
    });
    if (!validation.success) {
      validation.reasons.forEach(r => {
        if (!criteriaFailureReasonsPerField[r.location]) {
          criteriaFailureReasonsPerField[r.location] = [];
        }
        criteriaFailureReasonsPerField[r.location]!.push(r);
      });
    }
  }

  // Handle cancel/discard
  const handleDiscard = () => {
    if (onCancel) {
      onCancel();
      return;
    }
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
        if (onSave) {
          onSave(result);
        } else {
          // if /edit/<id>?t=/a/location is used, we want to get the t from the URL, and navigate to that page
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.has('t')) {
            window.location.href = urlParams.get('t')!;
          } else {
            // Navigate to the new card's page
            window.location.href = `/card/${result.id}`;
          }
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

  const getStringTagOrEmptyString = (key: string) => typeof tags?.[key] === 'string' ? tags[key] : '';
  const createSetterFor = (key: string) => (value: string | number | boolean | undefined) => {
    const _tags = { ...(tags ?? {}) };
    if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
      delete _tags[key];
      setTags(_tags);
    } else {
      setTags({
        ...tags,
        [key]: value,
      });
    }
  };
  const setArtSetting = createSetterFor("setting");
  const setArtFocus = createSetterFor("art/focus");

  return (<>
    <div className={`mx-auto space-y-6 border ${isChanged ? 'border-orange-200' : 'border-zinc-200'} bg-white rounded-lg px-3 pb-2 shadow-lg`}>
      <h2 className="text-lg font-bold mt-2 mb-1 text-center">{isCreate ? 'Create Card' : `Update ${serializedCard.name}`}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-4 border-r border-zinc-100 pr-3">
          <CardTypesInput types={types} setTypes={setTypes} getErrorMessage={() => getErrorMessage('types')}
                          isToken={isToken} setIsToken={setIsToken}
                          isChanged={!isCreate && JSON.stringify({ isToken: start.isToken, types: start.types }) !== JSON.stringify({ isToken, types })}
                          revert={() => {
                            setTypes(start.types);
                            setIsToken(start.isToken);
                          }}
          />
          {types.some(s => ['land', 'creature', 'artifact', 'enchantment'].includes(s))
            && <CardSubtypesInput subtypes={subtypes} setSubtypes={setSubtypes} getErrorMessage={() => getErrorMessage('subtypes')}
                                  types={types}
                                  isChanged={!isCreate && JSON.stringify(start.subtypes) !== JSON.stringify(subtypes)} revert={() => setSubtypes(start.subtypes)}
            />}
          {pt
            && <CardPTInput pt={pt} setPt={setPt} getErrorMessage={() => getErrorMessage('pt')}
                            isChanged={!isCreate && start.pt !== undefined && JSON.stringify(start.pt) !== JSON.stringify(pt)} revert={() => setPt(start.pt)}
            />}
          {loyalty
            && <CardLoyaltyInput loyalty={loyalty} setLoyalty={setLoyalty} getErrorMessage={() => getErrorMessage('loyalty')}
                                 isChanged={!isCreate && start.loyalty !== undefined && JSON.stringify(start.loyalty) !== JSON.stringify(loyalty)} revert={() => setLoyalty(start.loyalty)}
            />}
          {(supertype !== 'basic' && !isToken)
            && <CardManaCostInput manaCost={manaCost} setManaCost={setManaCost}
                                  getErrorMessage={() => getErrorMessage('manaCost')}
                                  isChanged={!isCreate && JSON.stringify(start.manaCost) !== JSON.stringify(manaCost)} revert={() => setManaCost(start.manaCost)}
            />}
          {tokenColors !== undefined
            && <CardTokenColorsInput tokenColors={tokenColors} setTokenColors={setTokenColors} getErrorMessage={() => getErrorMessage('tokenColors')}
                                     isChanged={!isCreate && start.tokenColors !== undefined && JSON.stringify(start.tokenColors) !== JSON.stringify(tokenColors)} revert={() => setTokenColors(start.tokenColors)}
            />}
          <CardRulesInput rules={rules} setRules={setRules} getErrorMessage={() => getErrorMessage('rules')}
                          isChanged={!isCreate && JSON.stringify(start.rules) !== JSON.stringify(rules)} revert={() => setRules(start.rules)}
          />
          <CardSupertypeInput supertype={supertype} setSupertype={setSupertype} types={types} getErrorMessage={() => getErrorMessage('supertype')}
                              isChanged={!isCreate && JSON.stringify(start.supertype) !== JSON.stringify(supertype)} revert={() => setSupertype(start.supertype)}
          />
          <CardTagsInput tags={tags} setTags={setTags} getErrorMessage={() => getErrorMessage('tags')}
                         isChanged={!isCreate && JSON.stringify(start.tags) !== JSON.stringify(tags)} revert={() => setTags(start.tags as { [key: string]: string | number | boolean } | undefined)}
          />
        </div>
        <div className="space-y-4 border-r border-zinc-100 pr-3">
          <CardRarityInput rarity={rarity} setRarity={setRarity} getErrorMessage={() => getErrorMessage('rarity')}
                           isChanged={!isCreate && JSON.stringify(start.rarity) !== JSON.stringify(rarity)} revert={() => setRarity(start.rarity)}
          />
          <CardNameInput name={name} setName={setName} getErrorMessage={() => getErrorMessage('name')} card={card}
                         isChanged={!isCreate && JSON.stringify(start.name) !== JSON.stringify(name)} revert={() => setName(start.name)}
          />
          {card && <p>
            <span className="text-zinc-600 text-sm italic">
              {card.explain()}
            </span>
          </p>}
          <CardCollectorNumberInput collectorNumber={collectorNumber} setCollectorNumber={setCollectorNumber}
                                    getErrorMessage={() => getErrorMessage('collectorNumber')}
                                    isChanged={!isCreate && JSON.stringify(start.collectorNumber) !== JSON.stringify(collectorNumber)} revert={() => setCollectorNumber(start.collectorNumber)}
          />
          <CardArtInput art={art} setArt={setArt} getErrorMessage={() => getErrorMessage('art')} card={card}
                        isChanged={!isCreate && JSON.stringify(start.art) !== JSON.stringify(art)} revert={() => setArt(start.art)}

                        artSetting={getStringTagOrEmptyString("setting")} setArtSetting={setArtSetting}
                        artSettingIsChanged={!isCreate && JSON.stringify(start.tags?.setting) !== JSON.stringify(tags?.["setting"])} revertArtSetting={() => setArtSetting(start.tags?.setting)}

                        showArtFocus={isToken || types.includes('planeswalker')}
                        artFocus={getStringTagOrEmptyString("art/focus")} setArtFocus={setArtFocus}
                        artFocusIsChanged={!isCreate && JSON.stringify(start.tags?.['art/focus']) !== JSON.stringify(tags?.["art/focus"])} revertArtFocus={() => setArtFocus(start.tags?.['art/focus'])}

                        // TODO: add fs/rules too
          />
          <ul className="list-disc pl-5 text-red-600 text-sm">
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
          {card && errors.length === 0 && !validationError && <CardPreview card={card} />}
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
            className="w-full py-2 px-4 disabled:bg-zinc-500 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? `${isCreate ? 'Creating' : 'Updating'}...`
              : (isCreate ? "Create card" : "Save changes")}
          </button>
          <button
            onClick={handleDiscard}
            className="w-60 mt-2 py-2 px-4 bg-zinc-200 text-zinc-800 font-medium rounded-md hover:bg-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {isCreate ? 'Cancel Card Creation' : 'Discard changes'}
          </button>
        </div>
      </div>
    </div>
  </>);
}
