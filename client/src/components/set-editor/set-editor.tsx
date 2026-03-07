'use client';

import React, { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faArrowsRotate, faCancel, faCheck, faCircle, faClone, faCog,
  faExclamationTriangle, faPenToSquare, faPlus, faTimes, faTrash,
  faTrashCan, faWarning,
} from '@fortawesome/free-solid-svg-icons';
import {
  BlueprintValidator,
  Card,
  explainAllCriteria, MultiAssignmentPolicy, SerializableBlueprint,
  SerializableBlueprintWithSource,
  SerializableSet,
  SerializedCard,
  Set, SetLocation,
} from 'kindred-paths';
import { CollectorNumberInfo, getOrganizeCollectorNumbers, putSet } from '@/utils/api';
import { IconButton } from '@/components/icon-button';
import { DragHandle } from '@/components/set-editor/drag-handle';
import { SetEditorCell } from '@/components/set-editor/set-editor-cell';
import { BlueprintEditor } from '@/components/set-editor/blueprint-editor';
import { CardEditor } from '@/components/editor/card-editor';
import { CardSelector } from '@/components/set-editor/card-selector';
import { CollectorNumberOverview } from '@/components/collector-number-overview';
import { useLocalStorageState } from '@/utils/use-local-storage-state';

function Modal(props: PropsWithChildren<{ onClose?: () => void }>) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-10 overflow-auto"
      onClick={(e) => {
        if (props.onClose && e.target === e.currentTarget) { props.onClose(); }
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
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openSettings, setOpenSettings] = useState(false);
  const [setValidationMessages, setSetValidationMessages] = useState<string[]>([]);
  const [showValidationMessages, setShowValidationMessages] = useLocalStorageState(`set/${props.set.name}/show-validation-messages`, true);
  const [blueprintEditorLocation, setBlueprintEditorLocation] = useState<SetLocation>();
  const [cardEditorSettings, setCardEditorSettings] = useState<CardEditorSettings>();
  const [cardSelectorSettings, setCardSelectorSettings] = useState<CardSelectorSettings>();

  const [dragOverIndex, setDragOverIndex] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);
  const [draggedItem, setDraggedItem] = useState<{type: 'metadataKeys' | 'cycleKeys', index: number} | null>(null);

  const set = useMemo(() => new Set(serializableSet), [serializableSet]);
  const [_matrixIndex, setMatrixIndex] = useLocalStorageState(`set/${set}/matrix`, 0);
  const matrixIndex = Math.min(set.getMatrixCount() - 1, _matrixIndex);
  const matrix = set.getMatrix(matrixIndex);
  const statusCounts = matrix.computeStats(cards);

  const [showCollectorNumbers, setShowCollectorNumbers] = useState(false);
  const [collectorNumbers, setCollectorNumbers] = useState<CollectorNumberInfo[]>([]);
  const [fetchingCollectorNumbers, setFetchingCollectorNumbers] = useState(false);
  const fetchCollectorNumbers = useCallback(async () => {
    setFetchingCollectorNumbers(true);
    try {
      setCollectorNumbers(await getOrganizeCollectorNumbers(`set:${props.set.name}`));
      setShowCollectorNumbers(true);
    } finally {
      setFetchingCollectorNumbers(false);
    }
  }, [props.set.name]);

  const saveChanges = (props?: { newCards?: SerializedCard[] }) => {
    setSetValidationMessages(set.validateAndCorrect(props?.newCards ?? cards));
    const serializableSet = set.toJson();
    setSerializableSet(serializableSet);

    setHasPendingChanges(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      putSet(serializableSet)
        .then(() => {
          setHasPendingChanges(false);
          saveTimeoutRef.current = null;
        })
        .catch(e => console.error('Error saving set:', e));
    }, 1000);
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
    const name = prompt('Enter a new matrix name:');
    if (name) {
      set.addMatrix(name);
      saveChanges();
      setMatrixIndex(set.getMatrixCount() - 1);
    }
  }

  const updateMatrixName = (matrixIndexToUpdate: number, newName: string) => {
    set.getMatrix(matrixIndexToUpdate).setName(newName);
    saveChanges();
  }

  const removeMatrix = (matrixIndexToDelete: number) => {
    if (confirm(`Are you sure you want to delete matrix "#${matrixIndexToDelete} ${set.getMatrix(matrixIndexToDelete).getName()}"? This action cannot be undone.`)) {
      set.removeMatrix(matrixIndexToDelete);
      saveChanges();
      setMatrixIndex(Math.max(0, matrixIndexToDelete - 1));
    }
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

  const addCycle = (atIndex: number, blueprint?: SerializableBlueprint) => {
    const newKey = prompt(`Enter cycle key name:`);
    if (newKey) {
      matrix.addCycle(atIndex, newKey);
      if (blueprint) {
        matrix.setBlueprintAt({ type: 'cycle', index: atIndex }, blueprint);
      }
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

  const clearSlot = (archetypeIndex: number, cycleKey: string) => {
    matrix.clearSlot(archetypeIndex, cycleKey);
    saveChanges();
  };

  const unlinkCard = (archetypeIndex: number, cycleKey: string, unassignmentIndex: number) => {
    matrix.unassignCardFromSlot(archetypeIndex, cycleKey, unassignmentIndex);
    saveChanges();
  };

  const promoteCard = (archetypeIndex: number, cycleKey: string, assignmentIndex: number) => {
    const current = matrix.getArchetype(archetypeIndex).slots[cycleKey];
    if (current && current !== 'skip' && assignmentIndex < current.assignments.length) {
      matrix.selectCardForSlot(archetypeIndex, cycleKey, current?.assignments[assignmentIndex]);
      saveChanges();
    }
  }

  const onRemoveSetBlueprint = () => {
    set.removeBlueprintAt({ type: 'set' });
    saveChanges();
  };

  const onRemoveMatrixBlueprint = () => {
    matrix.removeBlueprintAt({ type: 'matrix' });
    saveChanges();
  };

  const onRemoveArchetypeBlueprint = (archetypeIndex: number) => {
    matrix.removeBlueprintAt({ type: 'archetype', index: archetypeIndex });
    saveChanges();
  }

  const onRemoveCycleBlueprint = (cycleIndex: number) => {
    matrix.removeBlueprintAt({ type: 'cycle', index: cycleIndex });
    saveChanges();
  };

  const onRemoveSlotBlueprint = (archetypeIndex: number, cycleKey: string) => {
    matrix.removeBlueprintAt({ type: 'slot', archetypeIndex, cycleKey });
    saveChanges();
  }

  const onEditSetBlueprint = () => {
    setBlueprintEditorLocation({ type: 'set' });
  };

  const onEditMatrixBlueprint = () => {
    setBlueprintEditorLocation({ type: 'matrix', index: matrixIndex });
  };

  const onEditArchetypeBlueprint = (archetypeIndex: number) => {
    setBlueprintEditorLocation({ matrixIndex, type: 'archetype', index: archetypeIndex });
  };

  const onEditCycleBlueprint = (cycleIndex: number) => {
    setBlueprintEditorLocation({ matrixIndex, type: 'cycle', index: cycleIndex });
  };

  const onEditSlotBlueprint = (archetypeIndex: number, cycleKey: string) => {
    setBlueprintEditorLocation({ matrixIndex, type: 'slot', archetypeIndex, cycleKey });
  };

  const editCard = (archetypeIndex: number, cycleKey: string) => {
    const slot = matrix.getArchetype(archetypeIndex).slots[cycleKey];
    if (slot && typeof slot !== 'string' && slot.assignments.length > 0) {
      const card = cards.find(c => c.cid === slot.assignments[0].cid);
      if (card) {
        setCardEditorSettings({
          archetypeIndex,
          cycleKey,
          card,
          blueprints: matrix.findSlotBlueprints(archetypeIndex, cycleKey),
        });
      }
    }
  }

  const createCard = (archetypeIndex: number , cycleKey: string) => {
    setCardEditorSettings({
      archetypeIndex,
      cycleKey,
      card: Card.new('normal').toJson(),
      blueprints: matrix.findSlotBlueprints(archetypeIndex, cycleKey),
    });
  }

  const linkCard = (archetypeIndex: number, cycleKey: string) => {
    setCardSelectorSettings({
      archetypeIndex,
      cycleKey,
      blueprints: matrix.findSlotBlueprints(archetypeIndex, cycleKey),
    });
  }

  const isAnyModalOpen = !!cardEditorSettings || !!blueprintEditorLocation || !!cardSelectorSettings;
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isAnyModalOpen]);

  const matrixBlueprint = matrix.getBlueprintAt({ type: 'matrix' });
  const setBlueprint = set.getBlueprintAt({ type: 'set' });

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {/* Modals */}
      {openSettings && (
        <Modal onClose={() => setOpenSettings(false)}>
          <div className="w-full max-w-[500px] rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-white p-6 space-y-8">
              <h2 className="text-xl font-bold mb-4">Set Settings</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exhaustive<br/>
                  <span className="text-gray-400">
                    Whether the set requires all card to be represented in the set&#39;s matrices and archetypes.
                  </span>
                </label>
                <select
                  value={serializableSet.exhaustive ? 'true' : 'false'}
                  onChange={(e) => {
                    set.setExhaustive(e.target.value === 'true');
                    saveChanges();
                  }}
                  className="p-1 mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Multi-Assignment Policy<br/>
                  <span className="text-gray-400">
                    Policy that defines how the set handles the same card being assigned to multiple slots.
                  </span>
                </label>
                <select
                  value={serializableSet.multiAssignmentPolicy}
                  onChange={(e) => {
                    set.setMultiAssignmentPolicy(e.target.value as MultiAssignmentPolicy);
                    saveChanges();
                  }}
                  className="p-1 mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="unrestricted">Unrestricted</option>
                  <option value="unique-selected">Unique Selected</option>
                  <option value="unique-all">Unique All</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setOpenSettings(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {cardEditorSettings && (
        <Modal>
          <div className="w-full max-w-[1200px] rounded-xl shadow-2xl overflow-hidden">
            <CardEditor
              initialCard={cardEditorSettings.card}
              isNewCard={false}
              validate={{
                blueprints: cardEditorSettings.blueprints,
                metadata: matrix.getArchetype(cardEditorSettings.archetypeIndex).metadata,
              }}
              onSave={(updatedCard) => {
                const cardIndex = cards.findIndex(c => c.cid === updatedCard.cid);
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
                matrix.selectCardForSlot(cardEditorSettings.archetypeIndex, cardEditorSettings.cycleKey, { cid: updatedCard.cid });
                saveChanges({ newCards });
                setCardEditorSettings(undefined);
              }}
              onCancel={() => setCardEditorSettings(undefined)}
            />
          </div>
        </Modal>
      )}

      {blueprintEditorLocation && (
        <Modal>
          <div className="w-full max-w-[900px] rounded-xl shadow-2xl overflow-hidden">
            <BlueprintEditor
              title={set.getLocationName(blueprintEditorLocation)}
              metadataKeys={matrix.getMetadataKeys()}
              blueprint={set.getBlueprintAt(blueprintEditorLocation) ?? {}}
              onSave={(blueprint) => {
                set.setBlueprintAt(blueprintEditorLocation, blueprint);
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
                matrix.selectCardForSlot(cardSelectorSettings.archetypeIndex, cardSelectorSettings.cycleKey, { cid: card.cid });
                saveChanges();
                setCardSelectorSettings(undefined);
              }}
              onCancel={() => setCardSelectorSettings(undefined)}
            />
          </div>
        </Modal>
      )}

      {/* Set Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 space-y-2">
          <div className='flex gap-6'>
            <input
              type="text"
              value={serializableSet.name}
              onChange={(e) => updateSetName(e.target.value)}
              className="field-sizing-content text-2xl font-bold border-none bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              placeholder="Enter set name..."
            />

            {/* Has Pending Changes Banner */}
            <div className="flex items-center gap-2 text-xs pt-1">
              {hasPendingChanges && (<>
                <FontAwesomeIcon icon={faArrowsRotate} className="text-yellow-600 mt-0.5 flex-shrink-0 animate-spin" />
                <span className="text-yellow-800">Saving...</span>
              </>)}
              {!hasPendingChanges && (<>
                <FontAwesomeIcon icon={faCheck} className="text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-green-800">All changes saved</span>
              </>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-2">
              {setBlueprint && (
                <IconButton
                  onClick={() => onRemoveSetBlueprint()}
                  icon={faCancel}
                  title="Clear Set Blueprint"
                  variant="default"
                />
              )}
              <IconButton
                onClick={() => onEditSetBlueprint()}
                icon={faPenToSquare}
                title="Add/Edit Set Blueprint"
                variant="primary"
              />
            </div>
            {!showCollectorNumbers && <button
              onClick={() => fetchCollectorNumbers()}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline px-2"
              disabled={fetchingCollectorNumbers}
            >
              {fetchingCollectorNumbers ? 'Fetching collector numbers...' : 'View Collector Numbers'}
            </button>}
            {set.getMatrices().map((m, index) => <button
              key={index}
              className={`cursor-pointer px-3 py-1 rounded-lg text-sm font-medium border ${index === matrixIndex ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'}`}
              onClick={() => setMatrixIndex(index)}
            >
              #{index} {m.getName()} {m.getArchetypeCount()}x{m.getCycleCount()}
            </button>)}
            <button
              onClick={() => addMatrix()}
              className="cursor-pointer px-3 py-1 rounded-lg text-sm font-medium border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Add Matrix
            </button>
            <button
              onClick={() => setOpenSettings(true)}
              className="cursor-pointer px-3 py-1 rounded-lg text-sm font-medium border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-400 active:bg-gray-200 transition-colors"
            >
              <FontAwesomeIcon icon={faCog} className="mr-2" />
              Settings
            </button>
          </div>
        </div>
        {setBlueprint && (
          <div className="mb-6 px-2 text-slate-400 text-xs">
            <div>
              Cards in this set {explainAllCriteria(setBlueprint).map(({ field, explanations }) =>  `must have ${field} that must ${explanations.join(' and ')}`).join(' and ')}.
            </div>
          </div>
        )}
      </div>

      {/* Set Collector Number Section */}
      {showCollectorNumbers && (<div
        className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6"
      >
        <div className="flex w-full justify-between mt-2 gap-2">
          <h2 className="text-lg font-bold">Collector Numbers</h2>
          <button
            onClick={() => setShowCollectorNumbers(false)}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Hide Collector Numbers
          </button>
        </div>
        <div className="pl-10">
        <CollectorNumberOverview collectorNumbers={collectorNumbers} />
        </div>
      </div>)}

      {/* Validation Messages */}
      {setValidationMessages.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <FontAwesomeIcon icon={faWarning} className="text-amber-600 text-lg mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="font-semibold text-amber-900 mb-2">
                  {setValidationMessages.length} Validation Warning{setValidationMessages.length === 1 ? '' : 's'}
                </h3>
                <button
                  onClick={() => setShowValidationMessages(!showValidationMessages)}
                  className="text-sm text-amber-600 hover:text-amber-800 hover:underline"
                >
                  {showValidationMessages
                    ? `Hide warning${setValidationMessages.length === 1 ? '' : 's'}`
                    : `Show warning${setValidationMessages.length === 1 ? '' : 's'}`
                  }
                </button>
              </div>
              {showValidationMessages && (<>
                <ul className="space-y-1">
                  {setValidationMessages.map(validationMessage => (
                    <li key={validationMessage} className="text-sm text-amber-800">
                      {validationMessage}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowValidationMessages(false)}
                  className="mt-6 text-sm text-amber-600 hover:text-amber-800 hover:underline"
                >
                  Close
                </button>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* Matrix Header Section */}
      <div className="from-white to-transparent bg-gradient-to-b rounded-t-2xl border-t border-slate-200 p-6 mb-6">
        <div className="text-2xl font-bold">
          #{matrixIndex}
          <input
            type="text"
            value={matrix.getName()}
            onChange={(e) => updateMatrixName(matrixIndex, e.target.value)}
            className="field-sizing-content text-2xl font-bold border-none bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
            placeholder="Enter matrix name..."
          />
          ({matrix.getArchetypeCount()}x{matrix.getCycleCount()})
        </div>
        <div className="flex flex-col items-end py-2">
          <div className="flex gap-2">
            {matrixBlueprint && (
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
            <p className="text-gray-500">|</p>
            <IconButton
              onClick={() => removeMatrix(matrixIndex)}
              icon={faTrash}
              title="Delete Matrix"
              variant="danger"
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
                      <textarea
                        value={archetype.metadata[metadataKey] || ''}
                        onChange={(e) => updateMetadataValue(archetypeIndex, metadataKey, e.target.value)}
                        className="w-full min-h-20 border-none text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 placeholder:text-yellow-800"
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
                        onClick={() => {
                          addCycle(rowIndex + 1, blueprint);
                        }}
                        icon={faClone}
                        title="Clone Cycle"
                        variant="default"
                      />
                    </div>
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
                    <div className="mt-1 text-xs text-zinc-400 max-w-[600px]">
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
                  const { status, reasons } = matrix.computeSlotStatus(cards, archetypeIndex, cycleKey);
                  const slot = matrix.getArchetype(archetypeIndex).slots[cycleKey];
                  const selectedAssignment = slot && typeof slot !== 'string' && slot.assignments.length > 0 ? slot.assignments[0] : undefined;
                  const card = selectedAssignment ? cards.filter(c => c.cid === selectedAssignment.cid).pop() : undefined;
                  const hasSlotBlueprint = (slot && typeof slot !== 'string' && "blueprint" in slot ? slot.blueprint : undefined) !== undefined;

                  const validator = new BlueprintValidator();
                  const slotBlueprints = matrix.findSlotBlueprints(archetypeIndex, cycleKey);
                  return (
                    <SetEditorCell
                      key={archetype.name}
                      cardCid={card?.cid}
                      cardName={card ? `(#${card.collectorNumber}) ${card.faces.map(f => f.name).join(' // ')}` : 'Unknown Card'}
                      status={status}
                      statusReasons={reasons ?? []}
                      onMarkSkip={() => markSkip(archetypeIndex, cycleKey)}
                      onMarkNotSkip={() => markNotSkip(archetypeIndex, cycleKey)}
                      onCreateCard={() => createCard(archetypeIndex, cycleKey)}
                      onLinkCard={() => linkCard(archetypeIndex, cycleKey)}
                      onEditCard={() => editCard(archetypeIndex, cycleKey)}
                      onClearSlot={() => clearSlot(archetypeIndex, cycleKey)}
                      hasBlueprint={hasSlotBlueprint}
                      onEditBlueprint={() => onEditSlotBlueprint(archetypeIndex, cycleKey)}
                      onRemoveBlueprint={() => onRemoveSlotBlueprint(archetypeIndex, cycleKey)}
                      cardPreviewUrl={selectedAssignment === undefined ? undefined : `/api/render/${selectedAssignment.cid}/0`}
                      assignments={slot && typeof slot !== 'string' && slot.assignments ? slot.assignments.map(assignment => {
                        const assignedCard = cards.filter(c => c.cid === assignment.cid).pop();
                        if (!assignedCard) {
                          return undefined;
                        }
                        const valid = validator.validate({ metadata: archetype.metadata, blueprints: slotBlueprints, card: assignedCard });
                        return ({
                          cid: assignment.cid,
                          cardName: `(#${assignedCard.collectorNumber}) ${assignedCard.faces.map(f => f.name).join(' // ')}`,
                          isValid: valid.success,
                          statusReasons: !valid.success ? valid.reasons : [],
                          cardPreviewUrl: `/api/render/${assignment.cid}/0`,
                        })
                      }).filter(c => c !== undefined) : []}
                      onRemoveAssignment={index => unlinkCard(archetypeIndex, cycleKey, index)}
                      onPromoteAssignment={index => promoteCard(archetypeIndex, cycleKey, index)}
                      onAddAssignment={mode => {
                        if (mode === 'create') {
                          createCard(archetypeIndex, cycleKey);
                        } else {
                          linkCard(archetypeIndex, cycleKey);
                        }
                      }}
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
  );
}
