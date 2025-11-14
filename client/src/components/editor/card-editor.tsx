"use client";

import {
  BlueprintValidator,
  Card,
  CardLayout,
  CardRarity,
  CriteriaFailureReason,
  Layout,
  explainCriteria,
  RuleVariant,
  SerializableBlueprintWithSource,
  SerializedCard,
  SerializedCardSchema,
  tryParseLoyaltyAbility,
  capitalize,
  SerializedCardFace, tokenCardTypes, TokenCardType, permanentTypes,
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
  isToken?: true;
  collectorNumber: number;
  tags: { [key: string]: string | number | boolean } | undefined;
  faces: SerializedCardFace[];
};

function initializeEditorState(initialCard?: SerializedCard, defaultTags?: { [key: string]: string | number | boolean }): EditorState {
  if (initialCard) {
    return {
      ...initialCard,
      tags: initialCard?.tags as { [key: string]: string | number | boolean } | undefined,
    };
  }
  return {
    ...Card.new('normal').toJson(),
    tags: defaultTags,
  };
}

// Auto-adjust face properties based on updates
const autoAdjustCardProperties = (props: {
  base: EditorState,
  cardUpdates?: Partial<Omit<SerializedCard, 'faces'>>,
  face0Updates?: Partial<SerializedCardFace>,
  face1Updates?: Partial<SerializedCardFace>,
}): EditorState => {
  // Validate face1Updates can only be applied to dual-face layouts
  const isTargetDualFace = new Layout(props.cardUpdates?.layout ?? props.base.layout).isDualFaceLayout();
  if (!isTargetDualFace && ('face1Updates' in props && props.face1Updates !== undefined)) {
    throw new Error('Cannot apply face1Updates to a single-face layout');
  }

  const canHavePT = (serializedCardFace: SerializedCardFace) => {
    return serializedCardFace.types.includes('creature') || (serializedCardFace.types.includes('artifact') && serializedCardFace.subtypes?.includes('vehicle'));
  }
  const facePostTypeChangeValidation = (face: SerializedCardFace) => {
    if (canHavePT(face)) {
      face.pt = face.pt ?? { power: 2, toughness: 2 };
    } else {
      face.pt = undefined;
    }
    if (face.types.includes('land')) {
      face.manaCost = undefined;
    }
    if (!face.types.includes('land') && face.supertype === 'basic') {
      face.supertype = undefined;
    }
    if (face.types.includes('planeswalker')) {
      face.supertype = 'legendary';
      face.subtypes = undefined;
      face.loyalty = face.loyalty ?? 3;
      if (!face.name.includes(',')) {
        face.name += ', Planeswalker';
      }
      if (!face.rules?.some(r => tryParseLoyaltyAbility(r).success)) {
        face.rules = [
          ...(face.rules ?? []),
          { variant: 'ability' as RuleVariant, content: '+1: Add one mana of any color.' },
        ];
      }
    } else {
      face.loyalty = undefined;
      face.name = face.name.replace(/, Planeswalker$/g, '');
      face.rules = face.rules?.filter(r => !tryParseLoyaltyAbility(r).success);
    }
  }

  const next: SerializedCard = ({ ...props.base, ...props.cardUpdates, faces: props.base.faces.map((face, i) => ({
      ...face,
      ...([props.face0Updates, props.face1Updates][i] ?? {}),
    })) });

  if ("cardUpdates" in props) {
    if (props.cardUpdates === undefined) {
      throw new Error('Cannot apply cardUpdates that is undefined');
    }

    if ("isToken" in props.cardUpdates) {
      if (props.cardUpdates.isToken !== props.base.isToken) {
        if (props.cardUpdates.isToken) {
          // Card changed to a token
          next.rarity = 'common';
          next.layout = 'normal';
          next.faces = next.faces.slice(0, 1);
          next.faces[0].manaCost = undefined;
          next.faces[0].givenColors = [];
          const types = next.faces[0].types.filter(t => tokenCardTypes.includes(t as TokenCardType));
          next.faces[0].types = types.length === 0 ? ['creature'] : [types[0], ...types.slice(1)];
          facePostTypeChangeValidation(next.faces[0]);
        } else {
          // Card changed to a non-token
          next.faces[0].manaCost = next.faces[0].types.includes('land') ? undefined : { generic: 1 };
          next.faces[0].givenColors = undefined;
        }
      }
    }
    if ("layout" in props.cardUpdates) {
      if (props.cardUpdates.layout === undefined) {
        throw new Error('Cannot apply layout update that is undefined');
      }
      if (props.cardUpdates.layout !== props.base.layout) {
        if ("isToken" in props.cardUpdates && props.cardUpdates.isToken) {
          throw new Error('Cannot change layout to a value other than "normal" when changing to a token card');
        }

        // Layout changed
        const layout = new Layout(props.cardUpdates.layout);
        next.layout = layout.id;
        if (layout.isDualFaceLayout() && next.faces.length === 1) {
          next.faces.push(layout.defaultFaces()[1]);
        }
        if (!layout.isDualFaceLayout() && next.faces.length === 2) {
          next.faces = [next.faces[0]];
        }

        // Modal Layout
        if (layout.id === 'modal') {
          next.faces.forEach(face => {
            if (face.types.includes('planeswalker')) {
              const types = face.types.filter(t => t !== 'planeswalker');
              face.types = types.length === 0 ? ['creature'] : [types[0], ...types.slice(1)];
              facePostTypeChangeValidation(face);
            }
            face.givenColors = undefined;
            face.manaCost = face.types.includes('land') ? undefined : (face.manaCost ?? { generic: 1 });
          });
        }

        // Adventure Layout
        if (layout.id === 'adventure') {
          if (!permanentTypes.includes(next.faces[0].types[0] as typeof permanentTypes[number])) {
            next.faces[0].types = ['creature'];
            facePostTypeChangeValidation(next.faces[0]);
          }
          if (next.faces[1].types.some(t => permanentTypes.includes(t as typeof permanentTypes[number]))) {
            next.faces[1].types = ['sorcery'];
            facePostTypeChangeValidation(next.faces[1]);
          }
          next.faces[1].supertype = undefined;
          next.faces[1].manaCost = next.faces[1].manaCost ?? { generic: 1 };
          next.faces[1].givenColors = undefined;
          next.faces[1].subtypes = ['adventure'];
        }

        // Transform Layout
        if (layout.id === 'transform') {
          next.faces.forEach(face => {
            if (!permanentTypes.includes(face.types[0] as typeof permanentTypes[number])) {
              face.types = ['creature'];
              facePostTypeChangeValidation(face);
            }
          });
          next.faces[1].manaCost = undefined;
          next.faces[1].givenColors = [];
        }
      }
    }
  }

  const applyFaceUpdates = (face: SerializedCardFace, updates: Partial<SerializedCardFace>) => {
    if ("types" in updates) {
      facePostTypeChangeValidation(face);
    }
  }

  if ("face0Updates" in props) {
    if (props.face0Updates === undefined) {
      throw new Error('Cannot apply face0Updates that is undefined');
    }
    applyFaceUpdates(next.faces[0], props.face0Updates);
  }
  if ("face1Updates" in props) {
    if (props.face1Updates === undefined) {
      throw new Error('Cannot apply face1Updates that is undefined');
    }
    applyFaceUpdates(next.faces[1], props.face1Updates);
  }

  return next as EditorState;
};

export function CardEditor({ initialCard, validate, onSave, onCancel, defaultTags, redirectTo }: CardEditorProps) {
  const isEditMode = initialCard !== undefined && initialCard.id !== '<new>';
  const [state, setState] = useState<EditorState>(() => initializeEditorState(initialCard, defaultTags));
  const [selectedFaceIndex, setSelectedFaceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Helper functions for state updates
  const updateCardProperty = <K extends keyof Omit<EditorState, 'faces'>>(
    key: K,
    value: EditorState[K],
  ) => {
    setState(base => autoAdjustCardProperties(({ base, cardUpdates: { [key]: value } })));
  };
  const updateFaceProperty = <K extends keyof SerializedCardFace>(
    faceIndex: number,
    key: K,
    value: SerializedCardFace[K],
  ) => {
    setState(base => autoAdjustCardProperties({ base, [`face${faceIndex}Updates`]: { [key]: value } }));
  };
  const handleLayoutChange = (layout: CardLayout) => {
    setState(base => autoAdjustCardProperties({ base, cardUpdates: { layout } }));
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
  const layout = new Layout(state.layout);

  // Current face being edited
  const currentFace = state.faces[selectedFaceIndex];
  const initialFace = initialCard?.faces[selectedFaceIndex];
  const canHaveManaCost = !state.isToken && !currentFace.types.includes('land');

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

  return (
    <div className={`mx-auto max-w-[1400px] space-y-6 ${isChanged ? 'border-2 border-orange-200' : 'border border-zinc-200'} bg-white rounded-lg p-6 shadow-md`}>
      <h2 className="text-2xl font-bold mt-2 mb-4 text-center">
        {isEditMode ? `Edit ${currentCard.faces.map(f => f.name).join(' // ')}` : 'Create Card'}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Card properties and preview */}
        <div className="space-y-4 border-r border-zinc-100 pr-6">
          <h3 className="font-semibold text-lg">Card Properties</h3>

          <CardLayoutInput
            layout={state.layout}
            setLayout={handleLayoutChange}
            getErrorMessage={() => getErrorMessage('layout')}
            isChanged={isEditMode && initialCard.layout !== state.layout}
            revert={() => initialCard && updateCardProperty('layout', initialCard.layout)}
          />

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
            revert={() => initialCard && updateCardProperty('tags', initialCard.tags as { [key: string]: string | number | boolean } | undefined)}
          />

          {card && schemaErrors.length === 0 && !validationError && (
            <CardPreview card={card} />
          )}

          {card && card.faces.map((face, i) => <p key={i}>
            <span className="text-zinc-600 text-sm italic">
              {face.explain()}
            </span>
          </p>)}

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
        </div>

        {/* Right column: Face properties */}
        <div className="space-y-4 border-r border-zinc-100 pr-3">
          <h3 className="font-semibold text-lg">Face Properties</h3>

          {layout.isDualFaceLayout() && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {state.faces.map((_, index) => (
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
            setTypes={(value) => updateFaceProperty(selectedFaceIndex, 'types', value)}
            getErrorMessage={() => getErrorMessage('types')}
            isToken={state.isToken}
            setIsToken={(value) => updateCardProperty('isToken', value)}
            isChanged={isEditMode && (initialFace?.types !== currentFace.types || initialCard?.isToken !== state.isToken)}
            revert={() => {
              if (initialFace) updateFaceProperty(selectedFaceIndex, 'types', initialFace.types);
              if (initialCard) updateCardProperty('isToken', initialCard.isToken);
            }}
          />

          {currentFace.subtypes !== undefined && (
            <CardSubtypesInput
              subtypes={currentFace.subtypes}
              setSubtypes={(value) => updateFaceProperty(selectedFaceIndex, 'subtypes', value)}
              getErrorMessage={() => getErrorMessage('subtypes')}
              types={currentFace.types}
              isChanged={isEditMode && JSON.stringify(initialFace?.subtypes) !== JSON.stringify(currentFace.subtypes)}
              revert={() => initialFace && updateFaceProperty(selectedFaceIndex, 'subtypes', initialFace.subtypes)}
            />
          )}

          {currentFace.pt !== undefined && (
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

          {currentFace.givenColors && (
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
      </div>

      {/* Action buttons */}
      <div className="space-y-1">
        {!isChanged && (
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
