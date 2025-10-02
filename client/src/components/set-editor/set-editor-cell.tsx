"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLink,
  faImage,
  faPlay,
  faCancel,
  faPlus,
  faUnlink,
  faEdit,
  faTimes,
  faTriangleExclamation,
  faCircleXmark, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { CriteriaFailureReason, SlotStatus } from 'kindred-paths';
import { IconButton } from '@/components/icon-button';

export const getStatusConfig = (status: SlotStatus) => {
  switch (status) {
    case 'missing':
      return {
        label: 'Missing',
        icon: faTriangleExclamation,
        bgColor: 'bg-yellow-50 hover:bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-600'
      };
    case 'skip':
      return {
        label: 'Skip',
        icon: faCancel,
        bgColor: 'bg-gray-50 hover:bg-gray-100',
        textColor: 'text-gray-500',
        borderColor: 'border-gray-200',
        iconColor: 'text-gray-300'
      };
    case 'invalid':
      return {
        label: 'Invalid',
        icon: faCircleXmark,
        bgColor: 'bg-red-50 hover:bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        iconColor: 'text-red-600'
      };
    case 'valid':
      return {
        label: 'Valid',
        icon: faCircleCheck,
        bgColor: 'bg-green-50 hover:bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        iconColor: 'text-green-600'
      };
  }
};

interface SetEditorCellProps {
  status: SlotStatus;
  statusReasons: CriteriaFailureReason[];
  onMarkSkip: () => void;
  onMarkNotSkip: () => void;
  onCreateCard: () => void;
  onLinkCard: () => void;
  onEditCard: () => void;
  onUnlinkCard: () => void;
  hasBlueprint: boolean;
  onEditBlueprint: () => void;
  onRemoveBlueprint: () => void;
  cardPreviewUrl?: string;
}

export const SetEditorCell: React.FC<SetEditorCellProps> = ({
  status,
  statusReasons,
  onMarkSkip,
  onMarkNotSkip,
  onCreateCard,
  onLinkCard,
  onEditCard,
  onUnlinkCard,
  // hasBlueprint,
  // onEditBlueprint,
  // onRemoveBlueprint,
  cardPreviewUrl,
}) => {
  const [showCardPreview, setShowCardPreview] = useState(false);

  const config = getStatusConfig(status);

  const renderActionButtons = () => {
    const blueprintActions = null;
    // const blueprintActions = <>
    //   {hasBlueprint && <IconButton
    //     onClick={onRemoveBlueprint}
    //     icon={faCancel}
    //     title="Remove blueprint"
    //     variant="default"
    //   />}
    //   <IconButton
    //     onClick={onEditBlueprint}
    //     icon={faEdit}
    //     title="Edit blueprint"
    //     variant="primary"
    //   />
    // </>
    switch (status) {
      case 'missing':
        return (
          <>
            <IconButton
              onClick={onMarkSkip}
              icon={faCancel}
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
          <>
            <IconButton
              onClick={onMarkNotSkip}
              icon={faPlay}
              title="Mark as Not Skip"
              variant="default"
            />
          </>
        );

      case 'invalid':
      case 'valid':
        return (
          <>
            <div className="group">
              {blueprintActions}
              <IconButton
                onClick={onUnlinkCard}
                icon={faUnlink}
                title="Unlink Card"
                variant="danger"
              />
              <IconButton
                icon={faImage}
                title="Card Preview"
                variant="default"
                onClick={onEditCard}
              />

              {showCardPreview && <div className={`absolute ${status === 'valid' ? 'w-[250px] right-0' : 'w-[500px] -right-[80px]'} bg-white shadow-xl border border-gray-500 rounded-xl z-50 flex items-start gap-2`}>
                {cardPreviewUrl && (
                  <img
                    src={cardPreviewUrl}
                    alt="Card preview"
                    className="w-[250px] object-contain"
                  />
                )}
                {statusReasons.length > 0 && <div className="py-2 overflow-y-scroll text-sm max-h-[350px]">
                  <ul className='space-y-2'>
                    {statusReasons.map((r, index) => (
                      <li key={index}>
                        <p className="inline border-b border-gray-300">
                          <FontAwesomeIcon icon={faTimes} className="text-red-800" />{' '}
                          <span className="text-red-800 font-bold text-base">Error {index + 1}</span>{' '}
                          <span className="text-gray-500 text-xs">{' '}(from {r.source})</span>
                        </p>
                        <p className="py-0.5 px-2">
                          <span className="font-bold">{r.location + ' '}</span>
                          is <span className="text-red-700">{JSON.stringify(r.value)}</span>, while it must{' '}
                          {r.criteria.key.substring(r.criteria.key.indexOf('/') + 1).replaceAll('-', ' ')}{' '}
                          <span className="text-green-700">{r.criteria.value
                            ? (Array.isArray(r.criteria.value)
                              ? '[' + r.criteria.value.map(v => JSON.stringify(v)).join(', ') + ']'
                              : JSON.stringify(r.criteria.value))
                            : ''}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>}
              </div>}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <td
      className={`relative py-0.5 px-2 border ${config.borderColor} ${config.bgColor} transition-all duration-200 group min-w-[250px]`}
    >
      <div className="flex items-center justify-between">
        {/* Status display */}
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={config.icon} className={config.iconColor} />
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.label}
          </span>
        </div>

        {/* Action buttons */}
        <div
          onMouseEnter={() => setShowCardPreview(true)}
          onMouseLeave={() => setShowCardPreview(false)}
          className="flex opacity-0 group-hover:opacity-100"
        >
          {renderActionButtons()}
        </div>
      </div>
    </td>
  );
};
