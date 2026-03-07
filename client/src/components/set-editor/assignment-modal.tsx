"use client";

import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUp,
  faCircleCheck,
  faCircleXmark,
  faLink,
  faPlus,
  faTimes,
  faTrash,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { CriteriaFailureReason } from 'kindred-paths';

export interface AssignmentInfo {
  cid: string;
  cardName: string;
  cardPreviewUrl?: string;
  isValid: boolean;
  statusReasons: CriteriaFailureReason[];
}

interface AssignmentModalProps {
  assignments: AssignmentInfo[];
  onClose: () => void;
  onPromote: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: (mode: 'create' | 'link') => void;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  assignments,
  onClose,
  onPromote,
  onRemove,
  onAdd,
}) => {

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [assignments]);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-start justify-center p-4 sm:p-10 overflow-auto"
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) { onClose(); }
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Manage Candidates
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {assignments.length} candidate{assignments.length !== 1 ? 's' : ''} —
              {' '}rank 1 is the selected card
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="text-lg" />
          </button>
        </div>

        {/* Candidate List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-base">No candidates assigned yet.</p>
              <p className="text-sm mt-1">
                Add a card by creating a new one or linking an existing card.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {assignments.map((candidate, index) => (
                <CandidateRow
                  key={candidate.cid}
                  assignmentInfo={candidate}
                  index={index}
                  isSelected={index === 0}
                  isOnly={assignments.length === 1}
                  onPromote={() => onPromote(index)}
                  onRemove={() => onRemove(index)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={() => onAdd('create')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
              text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} />
            Create New Card
          </button>
          <button
            onClick={() => onAdd('link')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
              text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faLink} />
            Link Existing Card
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800
              hover:bg-gray-100 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

interface AssignmentRowProps {
  assignmentInfo: AssignmentInfo;
  index: number;
  isSelected: boolean;
  isOnly: boolean;
  onPromote: () => void;
  onRemove: () => void;
}

const CandidateRow: React.FC<AssignmentRowProps> = ({
  assignmentInfo,
  index,
  isSelected,
  isOnly,
  onPromote,
  onRemove,
}) => {
  const borderColor = isSelected
    ? 'border-green-300 bg-green-50/50'
    : assignmentInfo.isValid
      ? 'border-gray-200 bg-white'
      : 'border-red-200 bg-red-50/30';

  return (
    <li
      className={`flex items-start gap-4 p-3 rounded-xl border-2 ${borderColor} transition-colors`}
    >
      {/* Rank Badge */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
            ${isSelected
            ? 'bg-green-600 text-white'
            : 'bg-gray-200 text-gray-600'
          }`}
        >
          {index + 1}
        </span>
        {isSelected && (
          <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">
            Selected
          </span>
        )}
      </div>

      {/* Card Preview Image */}
      {assignmentInfo.cardPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assignmentInfo.cardPreviewUrl}
          alt={assignmentInfo.cardName}
          className="w-[252px] rounded-lg object-contain flex-shrink-0"
        />
      ) : (
        <div className="w-[252px] h-[352px] bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-gray-400 text-xs">No preview</span>
        </div>
      )}

      {/* Card Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-base">
          <h3 className="font-semibold text-gray-900 truncate">
            {assignmentInfo.cardName}
          </h3>
          {assignmentInfo.isValid ? (
            <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 flex-shrink-0" />
          ) : (
            <FontAwesomeIcon icon={faCircleXmark} className="text-red-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{assignmentInfo.cid}</p>

        {/* Validation Errors */}
        {assignmentInfo.statusReasons.length > 0 && (
          <div className="mt-2 space-y-1">
            {assignmentInfo.statusReasons.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-xs"
              >
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  className="text-red-400 mt-0.5 flex-shrink-0"
                />
                <span className="text-red-700">
                  <span className="font-medium">{r.location}</span> is{' '}
                  <span className="text-red-600">{JSON.stringify(r.value)}</span>,
                  must{' '}
                  {r.criteria.key
                    .substring(r.criteria.key.indexOf('/') + 1)
                    .replaceAll('-', ' ')}{' '}
                  <span className="text-green-700">
                    {r.criteria.value
                      ? Array.isArray(r.criteria.value)
                        ? '[' + r.criteria.value.map((v) => JSON.stringify(v)).join(', ') + ']'
                        : JSON.stringify(r.criteria.value)
                      : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        {!isSelected && (
          <button
            onClick={onPromote}
            title="Promote to selected"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
              text-green-700 bg-green-50 hover:bg-green-100 border border-green-200
              rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faArrowUp} />
            Select
          </button>
        )}
        <button
          onClick={onRemove}
          title={isOnly ? 'Unlink card' : 'Remove candidate'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
            text-red-600 bg-red-50 hover:bg-red-100 border border-red-200
            rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faTrash} />
          Remove
        </button>
      </div>
    </li>
  );
};
