"use client";

import {
  BlueprintValidator,
  Card,
  CardColor,
  CardLayout,
  CardRarity,
  CardSuperType,
  CardType,
  CriteriaFailureReason,
  Layout,
  explainCriteria,
  Mana,
  RuleVariant,
  SerializableBlueprintWithSource,
  SerializedCard,
  SerializedCardSchema,
  tryParseLoyaltyAbility,
  capitalize,
  SerializedCardFace,
} from 'kindred-paths';
import { useState } from 'react';
import { createCard, updateCard } from '@/utils/server';
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
import { CardGivenColorsInput } from '@/components/editor/card-given-colors-input';
import { CardLoyaltyInput } from '@/components/editor/card-loyalty-input';
import { CardLayoutInput } from '@/components/editor/card-layout-input';

type CardEditorProps = {
  initialCard?: SerializedCard;
  validate?: {
    blueprints: SerializableBlueprintWithSource[];
    metadata: { [key: string]: string | undefined };
  };
  onSave?: (card: SerializedCard) => void;
  onCancel?: () => void;
  defaultTags?: { [key: string]: string | number | boolean };
  redirectTo?: string;
};

type EditorState = {
  id: string;
  layout: CardLayout;
  rarity: CardRarity;
  isToken: boolean;
  collectorNumber: number;
  tags: { [key: string]: string | number | boolean } | undefined;
  faces: SerializedCardFace[];
};

function createDefaultFace(): SerializedCardFace {
  return {
    name: 'New Card',
    types: ['creature'],
    subtypes: [],
    manaCost: { generic: 1 },
    pt: { power: 2, toughness: 2 },
  };
}

function initializeEditorState(initialCard?: SerializedCard, defaultTags?: { [key: string]: string | number | boolean }): EditorState {
  if (initialCard) {
    return {
      id: initialCard.id,
      layout: initialCard.layout,
      rarity: initialCard.rarity,
      isToken: initialCard.isToken,
      collectorNumber: initialCard.collectorNumber,
      tags: initialCard.tags as { [key: string]: string | number | boolean } | undefined,
      faces: initialCard.faces,
    };
  }

  // New card - no layout selected yet
  return {
    id: '<new>',
    layout: 'normal',
    rarity: 'common',
    isToken: false,
    collectorNumber: 0,
    tags: defaultTags,
    faces: [createDefaultFace()],
  };
}

export function CardEditor2({ initialCard, validate, onSave, onCancel, defaultTags, redirectTo }: CardEditorProps) {
  const isEditMode = initialCard !== undefined;
  const [state, setState] = useState<EditorState>(() => initializeEditorState(initialCard, defaultTags));
  const [selectedFaceIndex, setSelectedFaceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Helper functions for state updates
  const updateCardProperty = <K extends keyof Omit<EditorState, 'faces'>>(
    key: K,
    value: EditorState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  const updateFaceProperty = <K extends keyof SerializedCardFace>(
    faceIndex: number,
    key: K,
    value: SerializedCardFace[K]
  ) => {
    setState(prev => ({
      ...prev,
      faces: prev.faces.map((face, i) =>
        i === faceIndex ? { ...face, [key]: value } : face
      ),
    }));
  };

  const handleLayoutChange = (newLayout: CardLayout) => {
    const layoutObj = new Layout(newLayout);
    const defaultFaces = layoutObj.defaultFaces();
    setState(prev => ({
      ...prev,
      layout: newLayout,
      faces: defaultFaces,
    }));
    setSelectedFaceIndex(0);
  };

  // Build current serialized card
  const currentCard: SerializedCard = {
    id: state.id,
    layout: state.layout,
    rarity: state.rarity,
    isToken: state.isToken,
    collectorNumber: state.collectorNumber,
    tags: state.tags,
    faces: state.faces.map(face => ({
      ...face,
      subtypes: face.subtypes ?? [],
    })),
  };

  // Validation
  const parsedCard = SerializedCardSchema.safeParse(currentCard);
  const schemaErrors: { path: string; message: string }[] = parsedCard.success
    ? []
    : parsedCard.error.errors.map(e => ({ path: e.path.join('.'), message: e.message }));

  let card: Card | undefined;
  let validationError: string | undefined;
  try {
    card = new Card(currentCard);
  } catch (e: unknown) {
    validationError = (e as Error).message;
  }

  const criteriaFailureReasonsPerField: { [field: string]: CriteriaFailureReason[] | undefined } = {};
  if (card && validate) {
    const validation = new BlueprintValidator().validate({
      metadata: validate.metadata,
      blueprints: validate.blueprints,
      card: currentCard,
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

  const getErrorMessage = (field: string) => {
    const additionalCriteriaFields: { [field: string]: string[] | undefined } = {
      types: ['isToken'],
      manaCost: ['manaValue', 'color', 'colorIdentity'],
      pt: ['power', 'toughness', 'powerToughnessDiff'],
      rules: ['creatableTokens', 'colorIdentity'],
    };
    const criteriaFields = [field, ...(additionalCriteriaFields[field] ?? [])].flatMap(
      f => criteriaFailureReasonsPerField[f] ?? []
    );
    const messages = [
      ...schemaErrors.filter(e => e.path === field || e.path.startsWith(`${field}.`)).map(e => e.message),
      ...criteriaFields.map(fe => capitalize(fe.location) + ' must ' + explainCriteria(fe.criteria)),
    ].filter(m => m !== undefined);
    return messages.length > 0 ? messages.join(' AND ') : undefined;
  };

  // Determine if save is allowed
  const isChanged = isEditMode
    ? JSON.stringify(currentCard) !== JSON.stringify(initialCard)
    : state.faces.every((face, i) => {
        const defaultFaces = new Layout(state.layout).defaultFaces();
        return face.name !== defaultFaces[i]?.name;
      });

  const canSave = isChanged && schemaErrors.length === 0 && !validationError;

  // Handle save
  const handleSave = async () => {
    if (!parsedCard.success || !canSave) return;

    setIsLoading(true);
    try {
      const result = isEditMode
        ? await updateCard(parsedCard.data)
        : await createCard(parsedCard.data);

      if (result) {
        if (onSave) {
          onSave(result);
        } else if (redirectTo) {
          window.location.href = redirectTo;
        } else {
          window.location.href = `/card/${result.id}`;
        }
      }
    } catch (error) {
      const message = 'Error saving card: ' + ((error instanceof Error) ? error.message : 'Unknown error');
      console.error(message);
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (redirectTo) {
      window.location.href = redirectTo;
    } else if (isEditMode) {
      window.location.href = `/card/${state.id}`;
    } else {
      window.location.href = '/';
    }
  };

  // Current face being edited
  const currentFace = state.faces[selectedFaceIndex];
  const initialFace = initialCard?.faces[selectedFaceIndex];
  const layoutObj = new Layout(state.layout);
  const isDualFaceLayout = layoutObj.isDualFaceLayout();
  const isDualRenderLayout = layoutObj.isDualRenderLayout();

  // Helper for tag operations
  const getStringTag = (key: string) => typeof state.tags?.[key] === 'string' ? state.tags[key] as string : '';
  const setTag = (key: string, value: string | number | boolean | undefined) => {
    const newTags = { ...(state.tags ?? {}) };
    if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
      delete newTags[key];
    } else {
      newTags[key] = value;
    }
    updateCardProperty('tags', Object.keys(newTags).length > 0 ? newTags : undefined);
  };

  // Derived face properties with smart defaults
  const canHavePT = currentFace.types.includes('creature') ||
    (currentFace.types.includes('artifact') && currentFace.subtypes?.includes('vehicle'));

  const canHaveManaCost = currentFace.supertype !== 'basic' && !state.isToken;
  const isLand = currentFace.types.includes('land');
  const hasManaCost = currentFace.manaCost !== undefined;
  const needsGivenColors = !hasManaCost && !isLand;

  // Auto-adjust face properties based on types
  const handleTypesChange = (newTypes: [CardType, ...CardType[]]) => {
    const updates: Partial<SerializedCardFace> = { types: newTypes };

    // Handle planeswalker special cases
    if (newTypes.includes('planeswalker')) {
      updates.supertype = 'legendary';
      if (!currentFace.loyalty) {
        updates.loyalty = 3;
      }
      if (!currentFace.name.includes(',')) {
        updates.name = currentFace.name + ', Planeswalker';
      }
      if (!currentFace.rules?.some(r => tryParseLoyaltyAbility(r).success)) {
        updates.rules = [...(currentFace.rules ?? []), { variant: 'ability' as RuleVariant, content: '+1: Add one mana of any color.' }];
      }
    } else if (currentFace.loyalty !== undefined) {
      updates.loyalty = undefined;
    }

    // Remove subtypes for instant/sorcery/planeswalker
    if (newTypes.some(t => ['instant', 'sorcery', 'planeswalker'].includes(t))) {
      updates.subtypes = undefined;
    } else if (currentFace.subtypes === undefined) {
      updates.subtypes = initialFace?.subtypes ?? [];
    }

    // Handle PT
    const newCanHavePT = newTypes.includes('creature') ||
      (newTypes.includes('artifact') && currentFace.subtypes?.includes('vehicle'));
    if (newCanHavePT && !currentFace.pt) {
      updates.pt = initialFace?.pt ?? { power: 2, toughness: 2 };
    } else if (!newCanHavePT && currentFace.pt) {
      updates.pt = undefined;
    }

    setState(prev => ({
      ...prev,
      faces: prev.faces.map((face, i) =>
        i === selectedFaceIndex ? { ...face, ...updates } : face
      ),
    }));
  };

  return (
    <div className={`mx-auto max-w-[1400px] space-y-6 ${isChanged ? 'border-2 border-orange-200' : 'border border-zinc-200'} bg-white rounded-lg p-6 shadow-md`}>
      <h2 className="text-2xl font-bold mt-2 mb-4 text-center">
        {isEditMode ? `Edit ${currentCard.faces.map(f => f.name).join(' // ')}` : 'Create Card'}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Face properties */}
        <div className="space-y-4 border-r border-zinc-100 pr-6">
          <h3 className="font-semibold text-lg">Face Properties</h3>

          {isDualFaceLayout && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Editing Face</label>
              <div className="flex gap-2">
                {state.faces.map((face, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedFaceIndex(index)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      selectedFaceIndex === index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {index === 0 ? 'Primary' : 'Secondary'} Face
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">Editing: {currentFace.name || 'Unnamed'}</p>
            </div>
          )}

          <CardNameInput
            name={currentFace.name}
            setName={(value) => updateFaceProperty(selectedFaceIndex, 'name', value)}
            getErrorMessage={() => getErrorMessage('name')}
            card={card}
            isChanged={isEditMode && initialFace?.name !== currentFace.name}
            revert={() => initialFace && updateFaceProperty(selectedFaceIndex, 'name', initialFace.name)}
          />

          <CardTypesInput
            types={currentFace.types}
            setTypes={handleTypesChange}
            getErrorMessage={() => getErrorMessage('types')}
            isToken={state.isToken}
            setIsToken={(value) => updateCardProperty('isToken', value)}
            isChanged={isEditMode && (initialFace?.types !== currentFace.types || initialCard?.isToken !== state.isToken)}
            revert={() => {
              if (initialFace) updateFaceProperty(selectedFaceIndex, 'types', initialFace.types);
              if (initialCard) updateCardProperty('isToken', initialCard.isToken);
            }}
          />

          {currentFace.types.some(s => ['land', 'creature', 'artifact', 'enchantment'].includes(s)) && (
            <CardSubtypesInput
              subtypes={currentFace.subtypes}
              setSubtypes={(value) => updateFaceProperty(selectedFaceIndex, 'subtypes', value)}
              getErrorMessage={() => getErrorMessage('subtypes')}
              types={currentFace.types}
              isChanged={isEditMode && JSON.stringify(initialFace?.subtypes) !== JSON.stringify(currentFace.subtypes)}
              revert={() => initialFace && updateFaceProperty(selectedFaceIndex, 'subtypes', initialFace.subtypes)}
            />
          )}

          {canHavePT && currentFace.pt && (
            <CardPTInput
              pt={currentFace.pt}
              setPt={(value) => updateFaceProperty(selectedFaceIndex, 'pt', value)}
              getErrorMessage={() => getErrorMessage('pt')}
              isChanged={isEditMode && JSON.stringify(initialFace?.pt) !== JSON.stringify(currentFace.pt)}
              revert={() => initialFace?.pt && updateFaceProperty(selectedFaceIndex, 'pt', initialFace.pt)}
            />
          )}

          {currentFace.loyalty !== undefined && (
            <CardLoyaltyInput
              loyalty={currentFace.loyalty}
              setLoyalty={(value) => updateFaceProperty(selectedFaceIndex, 'loyalty', value)}
              getErrorMessage={() => getErrorMessage('loyalty')}
              isChanged={isEditMode && initialFace?.loyalty !== currentFace.loyalty}
              revert={() => initialFace?.loyalty !== undefined && updateFaceProperty(selectedFaceIndex, 'loyalty', initialFace.loyalty)}
            />
          )}

          {canHaveManaCost && (
            <CardManaCostInput
              manaCost={currentFace.manaCost}
              setManaCost={(value) => updateFaceProperty(selectedFaceIndex, 'manaCost', value)}
              getErrorMessage={() => getErrorMessage('manaCost')}
              isChanged={isEditMode && JSON.stringify(initialFace?.manaCost) !== JSON.stringify(currentFace.manaCost)}
              revert={() => updateFaceProperty(selectedFaceIndex, 'manaCost', initialFace?.manaCost)}
            />
          )}

          {needsGivenColors && (
            <CardGivenColorsInput
              givenColors={currentFace.givenColors ?? []}
              setGivenColors={(value) => updateFaceProperty(selectedFaceIndex, 'givenColors', value)}
              getErrorMessage={() => getErrorMessage('givenColors')}
              isChanged={isEditMode && JSON.stringify(initialFace?.givenColors) !== JSON.stringify(currentFace.givenColors)}
              revert={() => updateFaceProperty(selectedFaceIndex, 'givenColors', initialFace?.givenColors)}
            />
          )}

          <CardRulesInput
            rules={currentFace.rules}
            setRules={(value) => updateFaceProperty(selectedFaceIndex, 'rules', value)}
            getErrorMessage={() => getErrorMessage('rules')}
            isChanged={isEditMode && JSON.stringify(initialFace?.rules) !== JSON.stringify(currentFace.rules)}
            revert={() => updateFaceProperty(selectedFaceIndex, 'rules', initialFace?.rules)}
          />

          <CardSupertypeInput
            supertype={currentFace.supertype}
            setSupertype={(value) => updateFaceProperty(selectedFaceIndex, 'supertype', value)}
            types={currentFace.types}
            getErrorMessage={() => getErrorMessage('supertype')}
            isChanged={isEditMode && initialFace?.supertype !== currentFace.supertype}
            revert={() => updateFaceProperty(selectedFaceIndex, 'supertype', initialFace?.supertype)}
          />

          <CardArtInput
            art={currentFace.art}
            setArt={(value) => updateFaceProperty(selectedFaceIndex, 'art', value)}
            getErrorMessage={() => getErrorMessage('art')}
            card={card}
            isChanged={isEditMode && initialFace?.art !== currentFace.art}
            revert={() => updateFaceProperty(selectedFaceIndex, 'art', initialFace?.art)}
            artSetting={getStringTag('setting')}
            setArtSetting={(value) => setTag('setting', value)}
            artSettingIsChanged={isEditMode && initialCard?.tags?.setting !== state.tags?.setting}
            revertArtSetting={() => setTag('setting', initialCard?.tags?.setting as string | undefined)}
            showArtFocus={state.isToken || currentFace.types.includes('planeswalker')}
            artFocus={getStringTag('art/focus')}
            setArtFocus={(value) => setTag('art/focus', value)}
            artFocusIsChanged={isEditMode && initialCard?.tags?.['art/focus'] !== state.tags?.['art/focus']}
            revertArtFocus={() => setTag('art/focus', initialCard?.tags?.['art/focus'] as string | undefined)}
          />
        </div>

        {/* Right column: Card properties and preview */}
        <div className="space-y-4 border-r border-zinc-100 pr-3">
          <h3 className="font-semibold text-lg">Card Properties</h3>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <CardLayoutInput
              layout={state.layout}
              setLayout={handleLayoutChange}
              getErrorMessage={() => getErrorMessage('layout')}
              isChanged={isEditMode && initialCard.layout !== state.layout}
              revert={() => initialCard && updateCardProperty('layout', initialCard.layout)}
            />
            <p className="text-xs text-blue-700 mt-2">
              💡 Changing the layout will reset faces to defaults for that layout
            </p>
          </div>

          <CardRarityInput
            rarity={state.rarity}
            setRarity={(value) => updateCardProperty('rarity', value)}
            getErrorMessage={() => getErrorMessage('rarity')}
            isChanged={isEditMode && initialCard.rarity !== state.rarity}
            revert={() => initialCard && updateCardProperty('rarity', initialCard.rarity)}
          />

          <CardCollectorNumberInput
            collectorNumber={state.collectorNumber}
            setCollectorNumber={(value) => updateCardProperty('collectorNumber', value)}
            getErrorMessage={() => getErrorMessage('collectorNumber')}
            isChanged={isEditMode && initialCard.collectorNumber !== state.collectorNumber}
            revert={() => initialCard && updateCardProperty('collectorNumber', initialCard.collectorNumber)}
            renderedTypeLine={card?.faces[0].renderTypeLine() ?? ''}
            cardId={state.id}
          />

          <CardTagsInput
            tags={state.tags}
            setTags={(value) => updateCardProperty('tags', value)}
            getErrorMessage={() => getErrorMessage('tags')}
            isChanged={isEditMode && JSON.stringify(initialCard.tags) !== JSON.stringify(state.tags)}
            revert={() => initialCard && updateCardProperty('tags', initialCard.tags as any)}
          />

          {card && <p>
            <span className="text-zinc-600 text-sm italic">
              {card.faces[selectedFaceIndex].explain()}
            </span>
          </p>}

          <ul className="list-disc pl-5 text-red-600 text-sm">
            {schemaErrors.map((err, index) => (
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

          {card && schemaErrors.length === 0 && !validationError && (
            <CardPreview card={card} faceIndex={selectedFaceIndex} showDualRender={isDualRenderLayout} />
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-1">
        {!canSave && (
          <p className="text-center text-zinc-600 text-sm">
            {isEditMode
              ? "You must make changes before you can save."
              : "You must change all face names before you can create the card."}
          </p>
        )}
        {(schemaErrors.length > 0 || validationError) && (
          <p className="text-center text-red-600 text-sm">
            You must fix the above errors before you can save the card.
          </p>
        )}
        <div className="flex gap-4 items-baseline">
          <button
            onClick={handleSave}
            disabled={!canSave || isLoading}
            className="w-full py-2 px-4 disabled:bg-zinc-500 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Card'}
          </button>
          <button
            onClick={handleCancel}
            className="w-60 mt-2 py-2 px-4 bg-zinc-200 text-zinc-800 font-medium rounded-md hover:bg-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {isEditMode ? 'Discard Changes' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
