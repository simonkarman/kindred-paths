"use client";

import Link from 'next/link';
import {
  Card,
  cardColors,
  cardRarities,
  CardRarity,
  CardSuperType,
  CardType,
  cardTypes,
  Mana, RuleVariant,
  SerializedCard,
  SerializedCardSchema,
} from 'kindred-paths';
import { useState } from 'react';
import { createCard } from '@/utils/server';
import { capitalize } from '@/utils/typography';

export default function CardCreate() {
  // Properties State
  const [name, setName] = useState('');
  const [rarity, setRarity] = useState<CardRarity>('common');
  const [supertype, setSupertype] = useState<CardSuperType>(undefined);
  const [subtypes, setSubtypes] = useState<string[]>([]); // TODO!
  const [types, setTypes] = useState<[CardType, ...CardType[]]>(['creature']);
  const [manaCost, setManaCost] = useState<{ [type in Mana]?: number }>({ colorless: 1 });
  const [rules, setRules] = useState<{ variant: RuleVariant, content: string }[]>([]); // TODO!
  const [pt, setPt] = useState<{ power: number, toughness: number } | undefined>(undefined); // TODO!
  const [collectorNumber, setCollectorNumber] = useState(1);
  const [art, setArt] = useState<string | undefined>(undefined); // TODO!
  const [tags, setTags] = useState<{ [key: string]: string | number | boolean | undefined }>({}); // TODO!

  const cardData: SerializedCard = {
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
  const parsedCard = SerializedCardSchema.safeParse(cardData);
  const errors: {
    path: string,
    message: string,
  }[] = parsedCard.success ? [] : parsedCard.error.errors.map(e => ({ path: e.path.join('.'), message: e.message }));
  const getErrorMessage = (path: string) => errors.find(e => e.path === path)?.message || undefined;
  let validationError: string | undefined;
  let card: Card | undefined;
  try {
    card = new Card(cardData);
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

  return (<>
    <p className="px-2">
      <Link href={'/'} className="underline text-blue-600">Go back</Link>
    </p>
    <div className="space-y-6 max-w-md">
      <h2 className="text-lg font-bold mb-0">Create Card</h2>

      {/* Card Name Input */}
      <div className="space-y-1">
        <label htmlFor="cardName" className="block font-medium text-gray-800">
          Card Name
        </label>
        <input
          id="cardName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter card name..."
          className="w-full px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {getErrorMessage('name') && (
          <p className="text-red-700 text-xs">
            {getErrorMessage('name')}
          </p>
        )}
      </div>

      {/* Card Rarity Input */}
      <div className="space-y-1">
        <label htmlFor="cardRarity" className="block font-medium text-gray-800">
          Rarity
        </label>
        <select
          id="cardRarity"
          className="w-full px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={rarity}
          onChange={(e) => setRarity(e.target.value as CardRarity)}
        >
          {cardRarities.map(rarityOption => (<option
            key={rarityOption}
            value={rarityOption}
          >
            {capitalize(rarityOption)}
          </option>))}
        </select>
        {getErrorMessage('rarity') && (
          <p className="text-red-700 text-xs">
            {getErrorMessage('rarity')}
          </p>
        )}
      </div>

      {/* Card Super Type Input */}
      <div className="space-y-1">
        <label htmlFor="cardSuperType" className="block font-medium text-gray-800">
          Super Type
        </label>
        <select
          id="cardSuperType"
          className="w-full px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={supertype || ''}
          onChange={(e) => setSupertype(e.target.value === '' ? undefined : e.target.value as CardSuperType)}
        >
          <option value="">None</option>
          <option value="basic">Basic</option>
          <option value="legendary">Legendary</option>
        </select>
        {getErrorMessage('supertype') && (
          <p className="text-red-700 text-xs">
            {getErrorMessage('supertype')}
          </p>
        )}
      </div>

      {/* Card Types Input */}
      <div className="space-y-1">
        <label htmlFor="cardTypes" className="block font-medium text-gray-800">
          Types <span className="text-xs text-gray-500 italic">(hold Ctrl or Cmd to select multiple)</span>
        </label>
        <select
          id="cardTypes"
          className="w-full h-31 px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          multiple
          value={types}
          onChange={(e) => {
            const selectedOptions = Array.from(e.target.selectedOptions, option => option.value as CardType);
            if (selectedOptions.length === 0) {
              selectedOptions.push('creature'); // Ensure at least one type is always selected
            }
            setTypes([selectedOptions[0], ...selectedOptions.slice(1)] as [CardType, ...CardType[]]);
          }}
        >
          {cardTypes.map(type => (
            <option key={type} value={type}>
              {capitalize(type)}
            </option>
          ))}
        </select>
        {getErrorMessage('types') && (
          <p className="text-red-700 text-xs">
            {getErrorMessage('types')}
          </p>
        )}
      </div>

      {/* Card Mana Cost Input */}
      <div className="space-y-1">
        <label htmlFor="cardManaCost" className="block font-medium text-gray-800">
          Mana Cost
        </label>
        <div className="grid grid-cols-2 gap-2">
          {['colorless', ...cardColors].map((manaType) => (
            <div key={manaType} className="flex items-center space-x-2">
              <label htmlFor={`manaCost-${manaType}`} className="text-sm capitalize">
                {manaType}
              </label>
              <input
                id={`manaCost-${manaType}`}
                type="number"
                min="0"
                value={manaCost[manaType as Mana] || 0}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setManaCost({
                    ...manaCost,
                    [manaType]: isNaN(value) ? undefined : value,
                  });
                }}
                className="w-full px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        {getErrorMessage('manaCost') && (
          <p className="text-red-700 text-xs">
            {getErrorMessage('manaCost')}
          </p>
        )}
      </div>

      {/* Card Collector Number Input */}
      <div className="space-y-1">
        <label htmlFor="cardCollectorNumber" className="block font-medium text-gray-800">
          Collector Number
        </label>
        <input
          id="cardCollectorNumber"
          type="number"
          min="1"
          value={collectorNumber}
          onChange={(e) => setCollectorNumber(parseInt(e.target.value, 10))}
          className="w-full px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {getErrorMessage('collectorNumber') && (
          <p className="text-red-700 text-xs">
            {getErrorMessage('collectorNumber')}
          </p>
        )}
      </div>

      {/* Explain Card */}
      {card && (
        <div className="text-gray-800">
          <h3 className="font-bold">Card Explanation:</h3>
          <p>{card.explain()}</p>
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreateCard}
        disabled={(errors.length > 0) || (validationError !== undefined) || isLoading}
        className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Creating...' : 'Create Card'}
      </button>

      {/* Error Display */}
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
        <pre className="bg-gray-100 p-2 rounded-md">
          {JSON.stringify(cardData, null, 2)}
        </pre>
      </div>
    </div>
  </>);
};
