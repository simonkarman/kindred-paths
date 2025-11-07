'use client';

import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCancel,
  faCheck,
  faCircle,
  faExclamationTriangle,
  faPenToSquare,
  faPlus,
  faTimes,
  faTrashCan,
  faWarning,
} from '@fortawesome/free-solid-svg-icons';
import {
  Card,
  explainAllCriteria,
  SerializableBlueprintWithSource,
  SerializableSet,
  SerializedCard,
  Set,
  SetLocation,
} from 'kindred-paths';
import { putSet, serverUrl } from '@/utils/server';
import { IconButton } from '@/components/icon-button';
import { DragHandle } from '@/components/set-editor/drag-handle';
import { SetEditorCell } from '@/components/set-editor/set-editor-cell';
import { BlueprintEditor } from '@/components/set-editor/blueprint-editor';
import { CardEditor } from '@/components/editor/card-editor';
import { CardSelector } from '@/components/set-editor/card-selector';

function Modal(props: PropsWithChildren<{ onClose: () => void }>) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-10 overflow-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) { props.onClose(); }
      }}
    >
      {props.children}
    </div>
  );
}

export interface SetEditorProps {
  set: SerializableSet,
  cards: SerializedCard[],
}

type CardEditorSettings = {
  archetypeIndex: number,
  cycleKey: string,
  card: SerializedCard,
  blueprints: SerializableBlueprintWithSource[],
}

type CardSelectorSettings = {
  archetypeIndex: number,
  cycleKey: string,
  blueprints: SerializableBlueprintWithSource[],
}

export function SetEditor(props: SetEditorProps) {
  const [cards, setAllCards] = useState<SerializedCard[]>(props.cards);
  const [serializableSet, setSerializableSet] = useState(props.set);
  const [setValidationMessages, setSetValidationMessages] = useState<string[]>([]);
  const [blueprintEditorLocation, setBlueprintEditorLocation] = useState<SetLocation>();
  const [cardEditorSettings, setCardEditorSettings] = useState<CardEditorSettings>();
  const [cardSelectorSettings, setCardSelectorSettings] = useState<CardSelectorSettings>();

  const [dragOverIndex, setDragOverIndex] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);

  const set = useMemo(() => new Set(serializableSet), [serializableSet]);
  const [matrixIndex, setMatrixIndex] = useState(0);
  const matrix = set.getMatrix(matrixIndex);
  const statusCounts = matrix.getSlotStats(cards);

  const saveChanges = (props?: { newCards?: SerializedCard[] }) => {
    setSetValidationMessages(set.validateAndCorrect(props?.newCards ?? cards));
    const serializableSet = set.toJson();
    setSerializableSet(serializableSet);
    putSet(serializableSet).catch(e => console.error('Error saving set:', e));
  };

  useEffect(() => {
    saveChanges();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set
  const updateSetName = (newName: string) => {
    set.updateName(newName);
    saveChanges();
  };

  const addMatrix = () => {
    set.addMatrix();
    saveChanges();
    setMatrixIndex(set.getMatrixCount() - 1);
  }

  // Archetype
  const updateArchetypeName = (archetypeIndex: number, newName: string) => {
    matrix.updateArchetypeName(archetypeIndex, newName);
    saveChanges();
  };

  const addArchetype = () => {
    const newName = prompt('Enter new archetype name:');
    if (newName) {
      matrix.addArchetype(newName);
      saveChanges();
    }
  };

  const deleteArchetype = (archetypeIndex: number) => {
    if (confirm(`Are you sure you want to delete archetype "${matrix.getArchetype(archetypeIndex).name}"? This action cannot be undone.`)) {
      matrix.deleteArchetype(archetypeIndex);
      saveChanges();
    }
  };

  // Metadata
  const updateMetadataValue = (archetypeIndex: number, metadataKey: string, value: string) => {
    matrix.updateMetadataValue(archetypeIndex, metadataKey, value);
    saveChanges();
  };

  const reorderMetadataKeys = (fromIndex: number, toIndex: number) => {
    matrix.reorderMetadataKeys(fromIndex, toIndex);
    saveChanges();
  };

  const addMetadataKey = (atIndex: number) => {
    const newKey = prompt(`Enter metadata key name:`);
    if (newKey) {
      matrix.addMetadataKey(atIndex, newKey);
      saveChanges();
    }
  };

  const updateMetadataKey = (metadataIndex: number, newKey: string) => {
    matrix.updateMetadataKey(metadataIndex, newKey);
    saveChanges();
  };

  const deleteMetadataKey = (metadataIndex: number) => {
    const keyToDelete = matrix.getMetadataKey(metadataIndex);
    if (confirm(`Are you sure you want to delete metadata key "${keyToDelete}"? This will also remove associated metadata from all archetypes. This action cannot be undone.`)) {
      matrix.deleteMetadataKey(metadataIndex);
      saveChanges();
    }
  };

  // Cycle
  const reorderCycles = (fromIndex: number, toIndex: number) => {
    matrix.reorderCycles(fromIndex, toIndex);
    saveChanges();
  };

  const addCycle = (atIndex: number) => {
    const newKey = prompt(`Enter cycle key name:`);
    if (newKey) {
      matrix.addCycle(atIndex, newKey);
      saveChanges();
    }
  };

  const updateCycleKey = (cycleIndex: number, _newKey: string) => {
    matrix.updateCycleKey(cycleIndex, _newKey);
    saveChanges();
  };

  const deleteCycle = (cycleIndex: number) => {
    const keyToDelete = matrix.getCycleKey(cycleIndex);
    if (confirm(`Are you sure you want to delete cycle key "${keyToDelete}"? This will also remove associated cycle slots from all archetypes. This action cannot be undone.`)) {
      matrix.deleteCycle(cycleIndex);
      saveChanges();
    }
  };

  const markSkip = (archetypeIndex: number, cycleKey: string) => {
    matrix.markSlotAsSkip(archetypeIndex, cycleKey);
    saveChanges();
  }

  const markNotSkip = (archetypeIndex: number, cycleKey: string) => {
    matrix.clearSlot(archetypeIndex, cycleKey);
    saveChanges();
  }

  const unlinkCard = (archetypeIndex: number, cycleKey: string) => {
    matrix.unlinkCardFromSlot(archetypeIndex, cycleKey);
    saveChanges();
  };

  const onRemoveMatrixBlueprint = () => {
    matrix.removeMatrixBlueprint();
    saveChanges();
  };

  const onRemoveArchetypeBlueprint = (archetypeIndex: number) => {
    matrix.removeArchetypeBlueprint(archetypeIndex);
    saveChanges();
  }

  const onRemoveCycleBlueprint = (cycleIndex: number) => {
    matrix.removeCycleBlueprint(cycleIndex);
    saveChanges();
  };

  const onRemoveSlotBlueprint = (archetypeIndex: number, cycleKey: string) => {
    matrix.removeSlotBlueprint(archetypeIndex, cycleKey);
    saveChanges();
  }

  const onEditMatrixBlueprint = () => {
    setBlueprintEditorLocation({ matrixIndex, matrixLocation: { type: 'matrix' } });
  };

  const onEditArchetypeBlueprint = (archetypeIndex: number) => {
    setBlueprintEditorLocation({ matrixIndex, matrixLocation: { type: 'archetype', index: archetypeIndex } });
  };

  const onEditCycleBlueprint = (cycleIndex: number) => {
    setBlueprintEditorLocation({ matrixIndex, matrixLocation: { type: 'cycle', index: cycleIndex } });
  };

  const onEditSlotBlueprint = (archetypeIndex: number, cycleKey: string) => {
    setBlueprintEditorLocation({ matrixIndex, matrixLocation: { type: 'slot', archetypeIndex, cycleKey } });
  };

  const editCard = (archetypeIndex: number, cycleKey: string) => {
    const slot = matrix.getArchetype(archetypeIndex).cycles[cycleKey];
    if (slot && typeof slot !== 'string' && "cardRef" in slot && slot.cardRef) {
      const card = cards.filter(c => c.id === slot.cardRef?.cardId).pop();
      if (card) {
        setCardEditorSettings({
          archetypeIndex,
          cycleKey,
          card,
          blueprints: matrix.getBlueprintsForSlot(archetypeIndex, cycleKey),
        });
      }
    }
  }

  const createCard = (archetypeIndex: number , cycleKey: string) => {
    setCardEditorSettings({
      archetypeIndex,
      cycleKey,
      card: Card.new(),
      blueprints: matrix.getBlueprintsForSlot(archetypeIndex, cycleKey),
    });
  }

  const linkCard = (archetypeIndex: number, cycleKey: string) => {
    setCardSelectorSettings({
      archetypeIndex,
      cycleKey,
      blueprints: matrix.getBlueprintsForSlot(archetypeIndex, cycleKey),
    });
  }

  const matrixBlueprint = matrix.getBlueprintAt({ type: 'matrix' });

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto">
        {/* Modals */}
        {cardEditorSettings && (
          <Modal onClose={() => setCardEditorSettings(undefined)}>
            <div className="w-full max-w-[1200px] rounded-xl shadow-2xl overflow-hidden">
              <CardEditor
                start={cardEditorSettings.card}
                validate={{
                  blueprints: cardEditorSettings.blueprints,
                  metadata: matrix.getArchetype(cardEditorSettings.archetypeIndex).metadata,
                }}
                onSave={(updatedCard) => {
                  const cardIndex = cards.findIndex(c => c.id === updatedCard.id);
                  let newCards;
                  if (cardIndex === -1) {
                    newCards = [...cards, updatedCard];
                  } else {
                    newCards = [
                      ...cards.slice(0, cardIndex),
                      updatedCard,
                      ...cards.slice(cardIndex + 1),
                    ];
                  }
                  setAllCards(newCards);
                  matrix.linkCardToSlot(cardEditorSettings.archetypeIndex, cardEditorSettings.cycleKey, { cardId: updatedCard.id });
                  saveChanges({ newCards });
                  setCardEditorSettings(undefined);
                }}
                onCancel={() => setCardEditorSettings(undefined)}
              />
            </div>
          </Modal>
        )}

        {blueprintEditorLocation && (
          <Modal onClose={() => setBlueprintEditorLocation(undefined)}>
            <div className="w-full max-w-[900px] rounded-xl shadow-2xl overflow-hidden">
              <BlueprintEditor
                title={matrix.getLocationName(blueprintEditorLocation.matrixLocation)}
                metadataKeys={matrix.getMetadataKeys()}
                blueprint={matrix.getBlueprintAt(blueprintEditorLocation.matrixLocation) ?? {}}
                onSave={(blueprint) => {
                  matrix.setBlueprintAt(blueprintEditorLocation?.matrixLocation, blueprint);
                  saveChanges();
                  setBlueprintEditorLocation(undefined);
                }}
                onCancel={() => setBlueprintEditorLocation(undefined)}
              />
            </div>
          </Modal>
        )}

        {cardSelectorSettings && (
          <Modal onClose={() => setCardSelectorSettings(undefined)}>
            <div className="bg-white w-full max-w-[900px] rounded-xl shadow-2xl overflow-hidden">
              <CardSelector
                search={{
                  scope: `set/${serializableSet.name}/archetype/${cardSelectorSettings.archetypeIndex}/cycle/${cardSelectorSettings.cycleKey}/selector`,
                  initial: `set:${serializableSet.name}`,
                }}
                cards={cards}
                validation={{
                  blueprints: cardSelectorSettings.blueprints,
                  metadata: matrix.getArchetype(cardSelectorSettings.archetypeIndex).metadata,
                }}
                onSelect={(card) => {
                  matrix.linkCardToSlot(cardSelectorSettings.archetypeIndex, cardSelectorSettings.cycleKey, { cardId: card.id });
                  saveChanges();
                  setCardSelectorSettings(undefined);
                }}
                onCancel={() => setCardSelectorSettings(undefined)}
              />
            </div>
          </Modal>
        )}

        {/* Set Header Section */}
        <div className="mx-auto max-w-[1600px] px-6 mb-6">
          <div className="flex items-center justify-between gap-4 space-y-2">
            <input
              type="text"
              value={serializableSet.name}
              onChange={(e) => updateSetName(e.target.value)}
              className="field-sizing-content text-2xl font-bold border-none bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              placeholder="Enter set name..."
            />
            <div className="flex flex-wrap gap-2 px-2">
              {set.getMatrices().map((m, index) => <button
                key={index}
                className={`cursor-pointer px-3 py-1 rounded-lg text-sm font-medium border ${index === matrixIndex ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'}`}
                onClick={() => setMatrixIndex(index)}
              >
                #{index} ({m.getArchetypeCount()}x{m.getCycleCount()})
              </button>)}
              <button
                onClick={() => addMatrix()}
                className="cursor-pointer px-3 py-1 rounded-lg text-sm font-medium border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                Add Matrix
              </button>
            </div>
          </div>
        </div>

        {/* Validation Messages */}
        {setValidationMessages.length > 0 && (
          <div className="mx-auto max-w-[1600px] bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <FontAwesomeIcon icon={faWarning} className="text-amber-600 text-lg mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">Validation Warnings</h3>
                <ul className="space-y-1">
                  {setValidationMessages.map(validationMessage => (
                    <li key={validationMessage} className="text-sm text-amber-800">
                      {validationMessage}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Matrix Header Section */}
        <div className="mx-auto max-w-[1600px] bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="text-2xl font-bold">
            #{matrixIndex} ({matrix.getArchetypeCount()}x{matrix.getCycleCount()})
          </div>
          <div className="flex flex-col items-end">
            <div className="flex gap-2">
              {matrix.getMatrixBlueprint() && (
                <IconButton
                  onClick={() => onRemoveMatrixBlueprint()}
                  icon={faCancel}
                  title="Clear Blueprint"
                  variant="default"
                />
              )}
              <IconButton
                onClick={() => onEditMatrixBlueprint()}
                icon={faPenToSquare}
                title="Add/Edit Blueprint"
                variant="primary"
              />
            </div>
          </div>

          {matrixBlueprint && (
            <div className="mb-6 px-2 text-slate-400 text-xs">
              <div>
                Cards in this matrix {explainAllCriteria(matrixBlueprint).map(({ field, explanations }) =>  `must have ${field} that must ${explanations.join(' and ')}`).join(' and ')}.
              </div>
            </div>
          )}

          {/* Status Legend */}
          <div className="flex flex-wrap justify-end gap-6 text-sm">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600" />
              <span className="text-slate-700">
                  Missing: <span className="font-semibold text-slate-900">{statusCounts.missing}</span>
                </span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCircle} className="text-slate-400" />
              <span className="text-slate-700">
                  Skip: <span className="font-semibold text-slate-900">{statusCounts.skip}</span>
                </span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faTimes} className="text-red-600" />
              <span className="text-slate-700">
                  Invalid: <span className="font-semibold text-slate-900">{statusCounts.invalid}</span>
                </span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheck} className="text-green-600" />
              <span className="text-slate-700">
                  Valid: <span className="font-semibold text-slate-900">{statusCounts.valid}</span>
                  <span className="text-slate-500 ml-1">
                    / {statusCounts.missing + statusCounts.invalid + statusCounts.valid}
                  </span>
                </span>
            </div>
          </div>
        </div>

        {/* Main Table Container */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-xs">
              <thead>
              <tr>
                <th className="sticky z-10 left-0 bg-slate-100 text-left p-3 font-semibold text-slate-900 border-b-2 border-slate-300">
                  Archetypes
                </th>
                {matrix.getArchetypes().map((archetype, archetypeIndex) => (
                  <th key={archetypeIndex} className="group border-b-2 border-slate-300 border-l p-2 bg-slate-50 min-w-[250px] text-center font-medium">
                    <div className="flex gap-1 px-1 items-center justify-center">
                      <div className="opacity-10 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        <IconButton
                          onClick={() => deleteArchetype(archetypeIndex)}
                          icon={faTrashCan}
                          title="Delete Archetype"
                          variant="danger"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={archetype.name}
                          onChange={(e) => updateArchetypeName(archetypeIndex, e.target.value)}
                          className="w-full border-none text-xs text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                          placeholder="Archetype name..."
                        />
                      </div>
                      {archetype.blueprint && (
                        <IconButton
                          onClick={() => onRemoveArchetypeBlueprint(archetypeIndex)}
                          icon={faCancel}
                          title="Clear Blueprint"
                          variant="default"
                        />
                      )}
                      <IconButton
                        onClick={() => onEditArchetypeBlueprint(archetypeIndex)}
                        icon={faPenToSquare}
                        title="Add/Edit Blueprint"
                        variant="primary"
                      />
                    </div>
                    {archetype.blueprint && (
                      <div className="mt-1 text-xs text-zinc-400">
                        Cards in this archetype {explainAllCriteria(archetype.blueprint).map(({ field, explanations }) =>  `must have ${field} that must ${explanations.join(' and ')}`).join(' and ')}.
                      </div>
                    )}
                  </th>
                ))}
                <th className="border-b-2 border-slate-300 border-l p-2 bg-slate-50 text-center font-medium">
                  <button
                    onClick={() => addArchetype()}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-sm" />
                  </button>
                </th>
              </tr>
              </thead>
              <tbody>
              {/* Metadata Section Header */}
              <tr>
                <th className="sticky z-10 left-0 bg-slate-100 p-3 pt-4 text-left font-semibold text-slate-900 border-b border-slate-200">
                  Metadata
                </th>
                <th colSpan={matrix.getArchetypeCount() + 1} className="bg-slate-100" />
              </tr>

              {/* Metadata Rows */}
              {matrix.getMetadataKeys().map((metadataKey, rowIndex) => (
                <tr key={rowIndex}>
                  <td
                    className={`group sticky z-10 left-0 px-3 py-2 border border-slate-200 bg-slate-50 text-slate-700 ${
                      dragOverIndex?.type === 'metadataKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                        ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-blue-500' : 'border-b-2 border-b-blue-500'}`
                        : ''
                    }`}
                    onDrop={(e: React.DragEvent) => {
                      e.preventDefault();
                      if (draggedItem && draggedItem.type === 'metadataKeys' && draggedItem.index !== rowIndex) {
                        reorderMetadataKeys(draggedItem.index, rowIndex);
                      }
                      setDraggedItem(null);
                      setDragOverIndex(null);
                    }}
                    onDragOver={(e: React.DragEvent) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDragEnter={() => setDragOverIndex({type: 'metadataKeys', index: rowIndex})}
                    onDragLeave={(e) => {
                      if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverIndex(null);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <DragHandle
                        type="metadataKeys"
                        index={rowIndex}
                        draggedItem={draggedItem}
                        setDraggedItem={setDraggedItem}
                      />
                      <div className="opacity-10 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        <IconButton
                          onClick={() => deleteMetadataKey(rowIndex)}
                          icon={faTrashCan}
                          title="Delete Metadata"
                          variant="danger"
                        />
                      </div>
                      <input
                        type="text"
                        value={metadataKey}
                        onChange={(e) => updateMetadataKey(rowIndex, e.target.value)}
                        className="flex-1 border-none text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                        placeholder="Metadata key..."
                      />
                    </div>
                  </td>
                  {matrix.getArchetypes().map((archetype, archetypeIndex) => {
                    const hasValue = metadataKey in archetype.metadata && archetype.metadata[metadataKey] !== undefined;
                    return (
                      <td key={archetypeIndex} className={`border border-slate-200 p-1 ${hasValue ? 'bg-white' : 'bg-yellow-50 hover:bg-yellow-100'}`}>
                        <input
                          type="text"
                          value={archetype.metadata[metadataKey] || ''}
                          onChange={(e) => updateMetadataValue(archetypeIndex, metadataKey, e.target.value)}
                          className="w-full border-none text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 placeholder:text-yellow-800"
                          placeholder="..."
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Add Metadata Key Button */}
              <tr>
                <td className="sticky z-10 left-0 p-3 bg-slate-100">
                  <button
                    onClick={() => addMetadataKey(matrix.getMetadataKeyCount())}
                    className="px-4 py-2 border border-green-300 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors text-xs flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Metadata Key
                  </button>
                </td>
                <td colSpan={matrix.getArchetypeCount() + 1} className="bg-slate-100" />
              </tr>

              {/* Cycles Section Header */}
              <tr>
                <th className="sticky z-10 left-0 bg-slate-100 p-3 pt-8 text-left font-semibold text-slate-900 border-b border-slate-200">
                  Cycles
                </th>
                <th colSpan={matrix.getArchetypeCount() + 1} className="bg-slate-100" />
              </tr>

              {/* Cycle Rows */}
              {matrix.getCycles().map(({ key: cycleKey, blueprint }, rowIndex) => (
                <tr key={rowIndex}>
                  <td
                    className={`group sticky z-10 left-0 px-3 py-2 border border-slate-200 bg-slate-50 text-slate-800 ${
                      dragOverIndex?.type === 'cycleKeys' && dragOverIndex.index === rowIndex && draggedItem?.index !== rowIndex
                        ? `${((draggedItem?.index ?? 0) > rowIndex) ? 'border-t-2 border-t-blue-500' : 'border-b-2 border-b-blue-500'}`
                        : ''
                    }`}
                    onDrop={(e: React.DragEvent) => {
                      e.preventDefault();
                      if (draggedItem && draggedItem.type === 'cycleKeys' && draggedItem.index !== rowIndex) {
                        reorderCycles(draggedItem.index, rowIndex);
                      }
                      setDraggedItem(null);
                      setDragOverIndex(null);
                    }}
                    onDragOver={(e: React.DragEvent) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDragEnter={() => setDragOverIndex({type: 'cycleKeys', index: rowIndex})}
                    onDragLeave={(e) => {
                      if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverIndex(null);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <DragHandle
                        type="cycleKeys"
                        index={rowIndex}
                        draggedItem={draggedItem}
                        setDraggedItem={setDraggedItem}
                      />
                      <div className="opacity-10 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        <IconButton
                          onClick={() => deleteCycle(rowIndex)}
                          icon={faTrashCan}
                          title="Delete Cycle"
                          variant="danger"
                        />
                      </div>
                      <input
                        type="text"
                        value={cycleKey}
                        onChange={(e) => updateCycleKey(rowIndex, e.target.value)}
                        className="flex-1 border-none text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                        placeholder="Cycle key..."
                      />
                      {blueprint && (
                        <IconButton
                          onClick={() => onRemoveCycleBlueprint(rowIndex)}
                          icon={faCancel}
                          title="Clear Blueprint"
                          variant="default"
                        />
                      )}
                      <IconButton
                        onClick={() => onEditCycleBlueprint(rowIndex)}
                        icon={faPenToSquare}
                        title="Add/Edit Blueprint"
                        variant="primary"
                      />
                    </div>

                    {blueprint && (
                      <div className="mt-1 text-xs text-zinc-400">
                        Cards in this cycle {explainAllCriteria(blueprint).map(({ field, explanations }) =>  `must have ${field} that must ${explanations.join(' and ')}`).join(' and ')}.
                      </div>
                    )}
                  </td>
                  {!blueprint && (
                    <td
                      colSpan={matrix.getArchetypeCount()}
                      className="border border-slate-200 p-3 bg-blue-50"
                    >
                      <div className="flex gap-3 items-center">
                        <FontAwesomeIcon icon={faArrowLeft} className="text-blue-600" />
                        <FontAwesomeIcon icon={faWarning} className="text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                            Cycle &ldquo;{cycleKey}&rdquo; is missing a blueprint
                          </span>
                      </div>
                    </td>
                  )}
                  {blueprint && matrix.getArchetypes().map((archetype, archetypeIndex) => {
                    const { status, reasons } = matrix.getSlotStatus(cards, archetypeIndex, cycleKey);
                    const slot = matrix.getArchetype(archetypeIndex).cycles[cycleKey];
                    const cardRef = slot && typeof slot !== 'string' && "cardRef" in slot ? slot.cardRef : undefined;
                    const card = cardRef ? cards.filter(c => c.id === cardRef.cardId).pop() : undefined;
                    const hasSlotBlueprint = (slot && typeof slot !== 'string' && "blueprint" in slot ? slot.blueprint : undefined) !== undefined;
                    return (
                      <SetEditorCell
                        key={archetype.name}
                        cardName={card ? `(#${card.collectorNumber}) ${card.faces.map(f => f.name).join(' // ')}` : 'Unknown Card'}
                        status={status}
                        statusReasons={reasons ?? []}
                        onMarkSkip={() => markSkip(archetypeIndex, cycleKey)}
                        onMarkNotSkip={() => markNotSkip(archetypeIndex, cycleKey)}
                        onCreateCard={() => createCard(archetypeIndex, cycleKey)}
                        onLinkCard={() => linkCard(archetypeIndex, cycleKey)}
                        onEditCard={() => editCard(archetypeIndex, cycleKey)}
                        onUnlinkCard={() => unlinkCard(archetypeIndex, cycleKey)}
                        hasBlueprint={hasSlotBlueprint}
                        onEditBlueprint={() => onEditSlotBlueprint(archetypeIndex, cycleKey)}
                        onRemoveBlueprint={() => onRemoveSlotBlueprint(archetypeIndex, cycleKey)}
                        cardPreviewUrl={cardRef === undefined ? undefined : `${serverUrl}/render/${cardRef.cardId}/0`}
                      />
                    );
                  })}
                </tr>
              ))}

              {/* Add Cycle Button */}
              <tr>
                <td className="sticky z-10 left-0 p-3 pb-80 bg-slate-100">
                  <button
                    onClick={() => addCycle(matrix.getCycleCount())}
                    className="px-4 py-2 border border-green-300 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors text-xs flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Cycle
                  </button>
                </td>
                <td colSpan={matrix.getArchetypeCount() + 1} className="bg-slate-100" />
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
