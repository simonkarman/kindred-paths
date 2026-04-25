"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCancel,
  faCircleCheck,
  faCircleXmark, faEdit,
  faImage,
  faLink, faPause,
  faPlay,
  faPlus,
  faTimes,
  faTriangleExclamation,
  faUnlink,
} from '@fortawesome/free-solid-svg-icons';
import { IconButton } from '@/components/icon-button';
import { AssignmentInfo, AssignmentModal } from './assignment-modal';
import { CriteriaFailureReason, SlotStatus } from 'kindred-paths';
import { cardPath } from '@/utils/slugify';

export const getStatusConfig = (status: SlotStatus, cardName: string, cardCid: string | undefined) => {
  const getCardLabel = () => {
    const prefix = cardName.indexOf(')') !== -1 ? cardName.substring(0, cardName.indexOf(')') + 1) : '';
    return <span>
      <a
        className='group-hover:text-amber-700 hover:text-amber-500 rounded transition-colors'
        href={cardPath(cardCid ?? '', cardName)}
        target="_blank"
      >
        {prefix}
      </a>
      {cardName.slice(prefix.length)}
    </span>
  }
  switch (status) {
    case 'missing':
      return {
        label: 'Missing',
        icon: faTriangleExclamation,
        bgColor: 'bg-yellow-50 hover:bg-yellow-100',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-600',
      };
    case 'skip':
      return {
        label: 'Skip',
        icon: faCancel,
        bgColor: 'bg-gray-50 hover:bg-gray-100',
        textColor: 'text-gray-500',
        iconColor: 'text-gray-300',
      };
    case 'invalid':
      return {
        label: getCardLabel(),
        icon: faCircleXmark,
        bgColor: 'bg-red-50 hover:bg-red-100',
        textColor: 'text-red-800',
        iconColor: 'text-red-600',
      };
    case 'valid':
      return {
        label: getCardLabel(),
        icon: faCircleCheck,
        bgColor: 'bg-green-50 hover:bg-green-100',
        textColor: 'text-green-800',
        iconColor: 'text-green-600',
      };
    case 'valid-undecided':
      return {
        label: getCardLabel(),
        icon: faCircleCheck,
        bgColor: 'bg-green-50/60 hover:bg-green-100/60',
        textColor: 'text-green-700',
        iconColor: 'text-green-400',
      };
  }
};

interface SetEditorCellProps {
  cardCid?: string,
  cardName: string;
  status: SlotStatus;
  statusReasons: CriteriaFailureReason[];
  assignments: AssignmentInfo[];
  onMarkSkip: () => void;
  onMarkNotSkip: () => void;
  onCreateCard: () => void;
  onLinkCard: () => void;
  onEditCard: () => void;
  onClearSlot: () => void;
  onPromoteAssignment: (index: number) => void;
  onRemoveAssignment: (index: number) => void;
  onAddAssignment: (mode: 'create' | 'link') => void;
  hasBlueprint: boolean;
  onEditBlueprint: () => void;
  onRemoveBlueprint: () => void;
  cardPreviewUrl?: string;
}

export const SetEditorCell: React.FC<SetEditorCellProps> = ({
  cardCid,
  cardName,
  status,
  statusReasons,
  assignments,
  onMarkSkip,
  onMarkNotSkip,
  onCreateCard,
  onLinkCard,
  onEditCard,
  onClearSlot,
  onPromoteAssignment,
  onRemoveAssignment,
  onAddAssignment,
  hasBlueprint,
  onEditBlueprint,
  onRemoveBlueprint,
  cardPreviewUrl,
}) => {
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);

  const config = getStatusConfig(status, cardName, cardCid);
  const otherCandidateCount = assignments.length > 1 ? assignments.length - 1 : 0;
  const hasInvalidCandidates = assignments.some((c, i) => i > 0 && !c.isValid);

  const renderCandidateBadge = () => {
    if (assignments.length === 0) return null;

    // 1 assignment: show "+" to add more
    // 2+ assignments: show "+N" with optional warning
    const label = assignments.length === 1 ? '+' : `+${otherCandidateCount}`;

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowCandidateModal(true);
        }}
        title={assignments.length === 1
          ? 'Add more candidates'
          : `${otherCandidateCount} other candidate${otherCandidateCount > 1 ? 's' : ''}`
        }
        className="relative inline-flex items-center justify-center px-1.5 py-0.5
          text-xs font-semibold rounded-full border transition-colors
          bg-white border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400"
      >
        {label}
        {hasInvalidCandidates && (
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="text-amber-500 text-[10px] ml-0.5"
            title="Some candidates have validation issues"
          />
        )}
      </button>
    );
  };

  const renderActionButtons = () => {
    const blueprintActions = <>
      {hasBlueprint && <IconButton
        onClick={onRemoveBlueprint}
        icon={faCancel}
        title="Remove blueprint"
        variant="default"
      />}
      <IconButton
        onClick={onEditBlueprint}
        icon={faEdit}
        title="Edit blueprint"
        variant="primary"
      />
    </>
    switch (status) {
      case 'missing':
        return (
          <>
            <IconButton
              onClick={onMarkSkip}
              icon={faPause}
              title="Set as Skip"
              variant="default"
            />
            {blueprintActions}
            <IconButton
              onClick={onCreateCard}
              icon={faPlus}
              title="Create a new Card"
              variant="primary"
            />
            <IconButton
              onClick={onLinkCard}
              icon={faLink}
              title="Link an Existing Card"
              variant="primary"
            />
          </>
        );

      case 'skip':
        return (
          <IconButton
            onClick={onMarkNotSkip}
            icon={faPlay}
            title="Mark as Not Skip"
            variant="default"
          />
        );

      case 'invalid':
      case 'valid':
      case 'valid-undecided':
        return (
          <div
            className="flex items-center gap-0.5"
          >
            {blueprintActions}
            <IconButton
              onClick={onClearSlot}
              icon={faUnlink}
              title="Clear Slot"
              variant="danger"
            />
            <IconButton
              icon={faImage}
              title="Edit Selected Card"
              variant="default"
              onClick={onEditCard}
              onMouseEnter={() => setShowCardPreview(true)}
              onMouseLeave={() => setShowCardPreview(false)}
            />
            {renderCandidateBadge()}

            {showCardPreview && (
              <div
                className={`absolute top-[100%] -right-0 ${status === 'valid' || status === 'valid-undecided'
                  ? 'w-[250px]'
                  : 'w-[500px]'
                } bg-white shadow-xl border border-gray-500 rounded-xl z-50 flex items-start gap-2`}
              >
                {cardPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cardPreviewUrl}
                    alt="Card preview"
                    className="w-[250px] object-contain"
                  />
                )}
                {statusReasons.length > 0 && (
                  <div className="py-2 overflow-y-scroll text-sm max-h-[350px]">
                    <ul className="space-y-2">
                      {statusReasons.map((r, index) => (
                        <li key={index}>
                          <p className="inline border-b border-gray-300">
                            <FontAwesomeIcon icon={faTimes} className="text-red-800" />{' '}
                            <span className="text-red-800 font-bold text-base">
                              Error {index + 1}
                            </span>{' '}
                            <span className="text-gray-500 text-xs">
                              (from {r.source})
                            </span>
                          </p>
                          <p className="py-0.5 px-2">
                            <span className="font-bold">{r.location + ' '}</span>
                            is{' '}
                            <span className="text-red-700">
                              {JSON.stringify(r.value)}
                            </span>
                            , while it must{' '}
                            {r.criteria.key
                              .substring(r.criteria.key.indexOf('/') + 1)
                              .replaceAll('-', ' ')}{' '}
                            <span className="text-green-700">
                              {r.criteria.value
                                ? Array.isArray(r.criteria.value)
                                  ? '[' +
                                  r.criteria.value
                                    .map((v) => JSON.stringify(v))
                                    .join(', ') +
                                  ']'
                                  : JSON.stringify(r.criteria.value)
                                : ''}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <td
        className={`py-0.5 px-2 border border-gray-200 ${config.bgColor} transition-all duration-200 group min-w-[250px]`}
      >
        <div className="relative">
          <div className="flex items-center justify-between">
            {/* Status display */}
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={config.icon} className={config.iconColor} />
              <span className={`text-sm font-medium ${config.textColor}`}>
                {config.label}
              </span>
              {/* Inline candidate count badge (always visible when 2+) */}
              {otherCandidateCount > 0 && (
                <span className="text-xs text-gray-400">
                  +{otherCandidateCount}
                </span>
              )}
            </div>

            {/* Action buttons (visible on hover) */}
            <div className="flex items-center opacity-0 group-hover:opacity-100">
              {renderActionButtons()}
            </div>
          </div>
        </div>

        {/* Candidate Management Modal */}
        {showCandidateModal && (
          <AssignmentModal
            assignments={assignments}
            onClose={() => setShowCandidateModal(false)}
            onPromote={onPromoteAssignment}
            onRemove={onRemoveAssignment}
            onAdd={onAddAssignment}
          />
        )}
      </td>
    </>
  );
};
