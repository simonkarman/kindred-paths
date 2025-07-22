"use client";

import Link from 'next/link';
import {
  Card, CardColor,
  cardColors,
  cardRarities,
  CardRarity,
  CardSuperType,
  CardType,
  cardTypes,
  Mana, RuleVariant, ruleVariants,
  SerializedCard,
  SerializedCardSchema,
} from 'kindred-paths';
import { useEffect, useState } from 'react';
import { createCard, serverUrl } from '@/utils/server';
import { capitalize, typographyRarityColors } from '@/utils/typography';
import CardExplanation from '@/components/card-explanation';

const CardNameInput = (props: {
  name: string,
  setName: (value: string) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardName" className="block font-medium text-gray-800">
      Card Name
    </label>
    <input
      id="cardName"
      type="text"
      value={props.name}
      onChange={(e) => props.setName(e.target.value)}
      placeholder="Enter card name..."
      className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}

const CardRarityInput = (props: {
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic',
  setRarity: (value: CardRarity) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardRarity" className="block font-medium text-gray-800">
      Card Rarity
    </label>
    <div className="px-1 flex gap-4 w-full justify-between">
      {cardRarities.map(rarityOption => (
        <div key={rarityOption} className="flex gap-1.5 items-center">
          <input
            type="radio"
            id={`rarity-${rarityOption}`}
            name="cardRarity"
            value={rarityOption}
            checked={props.rarity === rarityOption}
            onChange={(e) => props.setRarity(e.target.value as CardRarity)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            style={{
              accentColor: typographyRarityColors.get(rarityOption)?.[0],
            }}
          />
          <label
            htmlFor={`rarity-${rarityOption}`}
            className="text-sm font-medium cursor-pointer"
            style={{
              color: typographyRarityColors.get(rarityOption)?.[0],
            }}
          >
            {capitalize(rarityOption)}
          </label>
        </div>
      ))}
    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}

const CardSupertypeInput = (props: {
  supertype: 'basic' | 'legendary' | undefined,
  setSupertype: (value: CardSuperType) => void,
  types: [CardType, ...CardType[]],
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label className="block font-medium text-gray-800">
      Card Super Type
    </label>
    <div className="space-y-2 flex items-baseline gap-4">
      {/* Legendary checkbox */}
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={props.supertype === 'legendary'}
          onChange={(e) => {
            if (e.target.checked) {
              props.setSupertype('legendary');
            } else {
              props.setSupertype(undefined);
            }
          }}
          className="mr-2"
        />
        Legendary
      </label>

      {/* Basic checkbox - only show if types.length === 1 && types[0] === 'land' */}
      <label className="flex items-center">
        <input
          type="checkbox"
          disabled={props.types.length !== 1 || props.types[0] !== 'land'}
          checked={props.supertype === 'basic'}
          onChange={(e) => {
            if (e.target.checked) {
              props.setSupertype('basic');
            } else {
              props.setSupertype(undefined);
            }
          }}
          className="mr-2"
        />
        Basic
      </label>

    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}

const CardTypesInput = (props: {
  types: [CardType, ...CardType[]],
  setTypes: (value: [CardType, ...CardType[]]) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardTypes" className="block font-medium text-gray-800">
      Card Type <span className="text-xs text-gray-500 italic">(hold Ctrl or Cmd to select multiple)</span>
    </label>
    <select
      id="cardTypes"
      className="w-full bg-white h-31 px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      multiple
      value={props.types}
      onChange={(e) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value as CardType);
        if (selectedOptions.length === 0) {
          selectedOptions.push('creature'); // Ensure at least one type is always selected
        }
        props.setTypes([selectedOptions[0], ...selectedOptions.slice(1)] as [CardType, ...CardType[]]);
      }}
    >
      {cardTypes.map(type => (
        <option key={type} value={type}>
          {capitalize(type)}
        </option>
      ))}
    </select>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}

const CardSubtypesInput = (props: {
  subtypes: string[],
  setSubtypes: (value: string[]) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardSubtypes" className="block font-medium text-gray-800">
      Card Subtypes
    </label>
    <input
      id="cardSubtypes"
      type="text"
      value={props.subtypes.join(', ')}
      onChange={(e) => props.setSubtypes(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
      placeholder="Enter subtypes, separated by commas..."
      className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}

const CardManaCostInput = (props: {
  manaCost: { [type in Mana]?: number },
  setManaCost: (value: { [type in Mana]?: number }) => void,
  getErrorMessage: (color: CardColor | 'colorless') => string | undefined
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardManaCost" className="block font-medium text-gray-800">
      Card Mana Cost
    </label>
    <div className="grid grid-cols-2 gap-2">
      {(['colorless', ...cardColors] as const).map((manaType) => (<div key={manaType}>
        <div className="flex items-center space-x-2">
          <label htmlFor={`manaCost-${manaType}`} className="text-sm capitalize">
            {manaType}
          </label>
          <input
            id={`manaCost-${manaType}`}
            type="number"
            min="0"
            value={props.manaCost[manaType as Mana] || 0}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              props.setManaCost({
                ...props.manaCost,
                [manaType]: isNaN(value) ? undefined : value,
              });
            }}
            className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {props.getErrorMessage(manaType) && (
          <p className="text-red-700 text-xs mb-2">
            {props.getErrorMessage(manaType)}
          </p>
        )}
      </div>))}
    </div>
  </div>;
}

const CardCollectorNumberInput = (props: {
  collectorNumber: number,
  setCollectorNumber: (value: number) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardCollectorNumber" className="block font-medium text-gray-800">
      Collector Number
    </label>
    <input
      id="cardCollectorNumber"
      type="number"
      min="1"
      value={props.collectorNumber}
      onChange={(e) => props.setCollectorNumber(parseInt(e.target.value, 10))}
      className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}

const CardRulesInput = (props: {
  rules?: { variant: RuleVariant, content: string }[],
  setRules: (value: { variant: RuleVariant, content: string }[] | undefined) => void,
  getErrorMessage: () => string | undefined,
}) => {
  const rules = props.rules || [];

  const updateRule = (index: number, field: 'variant' | 'content', value: string | RuleVariant) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    props.setRules(newRules);
  };

  const removeRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    props.setRules(newRules.length === 0 ? undefined : newRules);
  };

  const moveRule = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === rules.length - 1)
    ) {
      return;
    }

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];
    props.setRules(newRules);
  };

  const addRule = () => {
    const newRule = { variant: 'ability' as RuleVariant, content: '' };
    props.setRules([...rules, newRule]);
  };

  return (
    <div className="space-y-1">
      <label className="block font-medium text-gray-800">
        Card Rules
      </label>

      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-gray-50">
            {/* Variant Selector */}
            <select
              value={rule.variant}
              onChange={(e) => updateRule(index, 'variant', e.target.value as RuleVariant)}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ruleVariants.map(variant => (
                <option key={variant} value={variant}>
                  {variant.split('-').map(capitalize).join(' ')}
                </option>
              ))}
            </select>

            {/* Rule Content Input */}
            <input
              type="text"
              value={rule.content}
              onChange={(e) => updateRule(index, 'content', e.target.value)}
              placeholder="Enter rule content..."
              className="flex-1 px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Move Up Button */}
            <button
              onClick={() => moveRule(index, 'up')}
              disabled={index === 0}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Move up"
            >
              ↑
            </button>

            {/* Move Down Button */}
            <button
              onClick={() => moveRule(index, 'down')}
              disabled={index === rules.length - 1}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Move down"
            >
              ↓
            </button>

            {/* Remove Button */}
            <button
              onClick={() => removeRule(index)}
              className="px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              title="Remove rule"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add Rule Button */}
        <button
          onClick={addRule}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Rule
        </button>
      </div>

      {/* Error Message */}
      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};

const CardPTInput = (props: {
  pt: { power: number, toughness: number },
  setPt: (value: { power: number, toughness: number }) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label className="block font-medium text-gray-800">
      Power/Toughness
    </label>
    <div className="flex gap-2">
      <input
        type="number"
        min="0"
        placeholder="Power"
        value={props.pt?.power || ''}
        onChange={(e) => {
          const power = parseInt(e.target.value, 10);
          props.setPt({
            ...props.pt,
            power: isNaN(power) ? 0 : power,
          });
        }}
        className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="number"
        min="0"
        placeholder="Toughness"
        value={props.pt?.toughness || ''}
        onChange={(e) => {
          const toughness = parseInt(e.target.value, 10);
          props.setPt({
            ...props.pt,
            toughness: isNaN(toughness) ? 0 : toughness,
          });
        }}
        className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}

function CardPreview({ card }: { card: Card }) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [isWaiting, setIsWaiting] = useState(true);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    setIsWaiting(true);
    const fetchImage = async () => {
      setIsRendering(true);
      try {
        const response = await fetch(`${serverUrl}/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(card.toJson()),
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        }
      } catch (error) {
        console.error('Failed to fetch image:', error);
      } finally {
        setIsWaiting(false);
        setIsRendering(false);
      }
    };

    const timeout = setTimeout(() => {
      fetchImage();
    }, 3000);

    // Cleanup function to revoke the object URL
    return () => {
      clearTimeout(timeout);
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [card]); // Re-fetch when card changes

  if (isRendering) {
    return <div className="block aspect-[63/88] w-100 bg-purple-50 rounded-3xl border text-center align-middle">Rendering...</div>;
  }

  if (isWaiting) {
    return <div className="block aspect-[63/88] w-100 bg-gray-100 rounded-3xl border text-center align-middle">Waiting for changes...</div>;
  }

  if (!imageUrl) {
    return <div className="block aspect-[63/88] w-100 bg-gray-100 rounded-3xl border text-center align-middle">No image available</div>;
  }

  return <img
    alt={`${card.name} image`}
    className="block aspect-[63/88] w-100 bg-gray-50 rounded-3xl border"
    src={imageUrl}
  />;
}

const CardTagsInput = (props: {
  tags: undefined | { [key: string]: string | number | boolean },
  setTags: (value: undefined | { [key: string]: string | number | boolean }) => void,
  getErrorMessage: () => string | undefined,
}) => {
  // Convert tags object to array for easier manipulation
  const tagsArray = props.tags !== undefined
    ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
    : [];

  const convertArrayToTags = (array: { key: string, value: string | number | boolean }[]) => {
    if (array.length === 0) return undefined;

    const result: { [key: string]: string | number | boolean } = {};
    array.forEach(({ key, value }) => {
      result[key] = value;
    });

    return Object.keys(result).length === 0 ? undefined : result;
  };

  const updateTag = (index: number, field: 'key' | 'value', newValue: string | number | boolean) => {
    const newArray = [...tagsArray];
    newArray[index] = { ...newArray[index], [field]: newValue };
    props.setTags(convertArrayToTags(newArray));
  };

  const updateValueType = (index: number, type: 'string' | 'number' | 'boolean') => {
    const currentValue = tagsArray[index].value;
    let newValue: string | number | boolean;

    switch (type) {
      case 'string':
        newValue = String(currentValue || '');
        break;
      case 'number':
        newValue = typeof currentValue === 'number' ? currentValue : 0;
        break;
      case 'boolean':
        newValue = typeof currentValue === 'boolean' ? currentValue : false;
        break;
    }

    updateTag(index, 'value', newValue);
  };

  const removeTag = (index: number) => {
    const newArray = tagsArray.filter((_, i) => i !== index);
    props.setTags(convertArrayToTags(newArray));
  };

  const moveTag = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === tagsArray.length - 1)
    ) {
      return;
    }

    const newArray = [...tagsArray];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newArray[index], newArray[targetIndex]] = [newArray[targetIndex], newArray[index]];
    props.setTags(convertArrayToTags(newArray));
  };

  const addTag = () => {
    const newTag = { key: 'key', value: '' as string };
    const newArray = [...tagsArray, newTag];
    props.setTags(convertArrayToTags(newArray));
  };

  const getValueType = (value: string | number | boolean | undefined): string => {
    if (value === undefined) return 'undefined';
    return typeof value;
  };

  const renderValueInput = (tag: { key: string, value: string | number | boolean | undefined }, index: number) => {
    const valueType = getValueType(tag.value);

    switch (valueType) {
      case 'boolean':
        return (
          <select
            value={tag.value ? 'true' : 'false'}
            onChange={(e) => updateTag(index, 'value', e.target.value === 'true')}
            className="px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={tag.value as number}
            onChange={(e) => updateTag(index, 'value', parseFloat(e.target.value) || 0)}
            className="px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      default: // string
        return (
          <input
            type="text"
            value={tag.value as string}
            onChange={(e) => updateTag(index, 'value', e.target.value)}
            placeholder="Enter value..."
            className="px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      <label className="block font-medium text-gray-800">
        Card Tags
      </label>

      <div className="space-y-2">
        {tagsArray.map((tag, index) => (
          <div key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-gray-50">
            {/* Key Input */}
            <input
              type="text"
              value={tag.key}
              onChange={(e) => updateTag(index, 'key', e.target.value)}
              placeholder="Key..."
              className="w-32 px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Type Selector */}
            <select
              value={getValueType(tag.value)}
              onChange={(e) => updateValueType(index, e.target.value as 'string' | 'number' | 'boolean')}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>

            {/* Value Input */}
            <div className="flex-1">
              {renderValueInput(tag, index)}
            </div>

            {/* Move Up Button */}
            <button
              onClick={() => moveTag(index, 'up')}
              disabled={index === 0}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Move up"
            >
              ↑
            </button>

            {/* Move Down Button */}
            <button
              onClick={() => moveTag(index, 'down')}
              disabled={index === tagsArray.length - 1}
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Move down"
            >
              ↓
            </button>

            {/* Remove Button */}
            <button
              onClick={() => removeTag(index)}
              className="px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              title="Remove tag"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add Tag Button */}
        <button
          onClick={addTag}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Tag
        </button>
      </div>

      {/* Error Message */}
      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};

export default function CardCreate() {
  // Properties State
  const [name, setName] = useState('New Card');
  const [rarity, setRarity] = useState<CardRarity>('common');
  const [supertype, setSupertype] = useState<CardSuperType>(undefined);
  const [subtypes, setSubtypes] = useState<string[]>([]);
  const [types, setTypes] = useState<[CardType, ...CardType[]]>(['creature']);
  const [manaCost, setManaCost] = useState<{ [type in Mana]?: number }>({ colorless: 1 });
  const [rules, setRules] = useState<{ variant: RuleVariant, content: string }[]>();
  const [pt, setPt] = useState<{ power: number, toughness: number } | undefined>(undefined);
  const [collectorNumber, setCollectorNumber] = useState(1);
  const [art, setArt] = useState<string | undefined>(undefined); // TODO!
  const [tags, setTags] = useState<{ [key: string]: string | number | boolean | undefined }>();

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
    id: 'new',
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
      const result = await createCard(data);
      if (result) {
        // Navigate to the new card's page
        window.location.href = `/card/${result.id}`;
      }
    } finally {
      setIsLoading(false);
    }
  };

  ;
  return (<>
    <p className="px-2">
      <Link href={'/'} className="underline text-blue-600">Go back</Link>
    </p>
    <div className="flex gap-8">
      <div className="space-y-6 w-2xl border border-gray-200 bg-gray-50 rounded-lg p-2 shadow">
        <h2 className="text-lg font-bold my-2 text-center">Create Card</h2>

        {<CardNameInput name={name} setName={setName} getErrorMessage={() => getErrorMessage('name')}/>}
        {<CardTypesInput types={types} setTypes={setTypes} getErrorMessage={() => getErrorMessage('types')}/>}
        {pt
          && <CardPTInput pt={pt} setPt={setPt} getErrorMessage={() => getErrorMessage('pt')}/>}
        {types.some(s => ['land', 'creature', 'artifact', 'enchantment'].includes(s))
          && <CardSubtypesInput subtypes={subtypes} setSubtypes={setSubtypes} getErrorMessage={() => getErrorMessage('subtypes')}/>}
        {<CardManaCostInput manaCost={manaCost} setManaCost={setManaCost} getErrorMessage={(color: CardColor | 'colorless') => getErrorMessage(`manaCost.${color}`)}/>}
        {<CardRulesInput rules={rules} setRules={setRules} getErrorMessage={() => getErrorMessage('rules')}/>}
        {<CardSupertypeInput supertype={supertype} setSupertype={setSupertype} types={types} getErrorMessage={() => getErrorMessage('supertype')}/>}
        {<CardRarityInput rarity={rarity} setRarity={setRarity} getErrorMessage={() => getErrorMessage('rarity')}/>}
        {<CardCollectorNumberInput collectorNumber={collectorNumber} setCollectorNumber={setCollectorNumber} getErrorMessage={() => getErrorMessage('collectorNumber')} />}
        <CardTagsInput tags={tags} setTags={setTags} getErrorMessage={() => getErrorMessage('tags')} />

        {/* Create Button */}
        <button
          onClick={handleCreateCard}
          disabled={(errors.length > 0) || (validationError !== undefined) || isLoading}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating...' : 'Create Card'}
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

        {/* Show Raw Card Data */}
        <div className="text-gray-600 text-xs">
          <h3 className="font-bold">Raw Card Data:</h3>
          <pre className="bg-gray-100 p-2 rounded-md overflow-x-scroll border border-gray-200">
            {JSON.stringify(serializedCard, null, 2)}
          </pre>
        </div>
      </div>
      <div className="space-y-6 w-md pt-4">
        {/* Show Card Render */}
        {card !== undefined && errors.length === 0 && <CardPreview card={card} />}
      </div>
    </div>
  </>);
};
