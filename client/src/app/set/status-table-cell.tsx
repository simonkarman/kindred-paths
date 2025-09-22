"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon, FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation,
  faFileLines,
  faCircleXmark,
  faCircleCheck,
  faTrashCan,
  faPenToSquare,
  faLink,
  faImage,
  faPlay, faArrowsLeftRight, faCancel, faPlus, faUnlink,
} from '@fortawesome/free-solid-svg-icons';

export type StatusType = 'missing' | 'skip' | 'blueprint' | 'invalid' | 'valid';

interface StatusTableCellProps {
  status: StatusType;
  onSetSkip?: () => void;
  onOpenBlueprintEditor?: () => void;
  onMarkNotSkip?: () => void;
  onRemoveBlueprint?: () => void;
  onEditBlueprint?: () => void;
  onApplyBlueprintToRow?: () => void;
  onCreateCard?: () => void;
  onLinkCard?: () => void;
  onEditCard?: () => void;
  cardPreviewUrl?: string;
  onUnlinkCard?: () => void;
}

const getStatusConfig = (status: StatusType) => {
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
    case 'blueprint':
      return {
        label: 'Blueprint',
        icon: faFileLines,
        bgColor: 'bg-blue-50 hover:bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-200',
        iconColor: 'text-blue-600'
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

export const StatusTableCell: React.FC<StatusTableCellProps> = ({
  status,
  onSetSkip,
  onOpenBlueprintEditor,
  onMarkNotSkip,
  onRemoveBlueprint,
  onEditBlueprint,
  onApplyBlueprintToRow,
  onCreateCard,
  onLinkCard,
  onEditCard,
  cardPreviewUrl,
  onUnlinkCard,
}) => {
  const [showCardPreview, setShowCardPreview] = useState(false);

  const config = getStatusConfig(status);

  const IconButton: React.FC<{
    onClick?: () => void;
    icon: FontAwesomeIconProps["icon"];
    title: string;
    variant?: 'default' | 'danger' | 'primary' | 'success';
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }> = ({ onClick, icon, title, variant = 'default', onMouseEnter, onMouseLeave }) => {
    const variantClasses = {
      default: 'text-gray-600 hover:text-gray-800 hover:bg-gray-200',
      danger: 'text-red-600 hover:text-red-800 hover:bg-red-200',
      primary: 'text-blue-600 hover:text-blue-800 hover:bg-blue-200',
      success: 'text-green-600 hover:text-green-800 hover:bg-green-200'
    };

    return (
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`p-1.5 rounded transition-colors ${variantClasses[variant]}`}
        title={title}
      >
        <FontAwesomeIcon icon={icon} size="sm" />
      </button>
    );
  };

  const renderActionButtons = () => {
    switch (status) {
      case 'missing':
        return (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              onClick={onSetSkip}
              icon={faCancel}
              title="Set as Skip"
              variant="default"
            />
            <IconButton
              onClick={onOpenBlueprintEditor}
              icon={faPenToSquare}
              title="Open Blueprint Editor"
              variant="primary"
            />
          </div>
        );

      case 'skip':
        return (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              onClick={onMarkNotSkip}
              icon={faPlay}
              title="Mark as Not Skip"
              variant="default"
            />
          </div>
        );

      case 'blueprint':
        return (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              onClick={onEditBlueprint}
              icon={faPenToSquare}
              title="Edit Blueprint"
              variant="primary"
            />
            <IconButton
              onClick={onApplyBlueprintToRow}
              icon={faArrowsLeftRight}
              title="Apply Blueprint to Full Row"
              variant="success"
            />
            <IconButton
              onClick={onRemoveBlueprint}
              icon={faTrashCan}
              title="Remove Blueprint"
              variant="danger"
            />
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
          </div>
        );

      case 'invalid':
      case 'valid':
        return (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              onClick={onEditBlueprint}
              icon={faPenToSquare}
              title="Edit Blueprint"
              variant="primary"
            />
            <IconButton
              onClick={onApplyBlueprintToRow}
              icon={faArrowsLeftRight}
              title="Apply Blueprint to Full Row"
              variant="success"
            />
            <IconButton
              onClick={onRemoveBlueprint}
              icon={faTrashCan}
              title="Remove Blueprint"
              variant="danger"
            />
            {cardPreviewUrl && (
              <div className="relative group">
                <IconButton
                  icon={faImage}
                  title="Card Preview"
                  variant="default"
                  onMouseEnter={() => setShowCardPreview(true)}
                  onMouseLeave={() => setShowCardPreview(false)}
                  onClick={onEditCard}
                />
                {showCardPreview && (
                  <div className="absolute rounded-xl bottom-full left-0 mb-2 z-50 bg-white border border-gray-300 shadow-lg">
                    <img
                      src={cardPreviewUrl}
                      alt="Card preview"
                      className="max-w-[250px] object-contain"
                    />
                  </div>
                )}
              </div>
            )}
            <IconButton
              onClick={onUnlinkCard}
              icon={faUnlink}
              title="Unlink Card"
              variant="danger"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <td className={`p-3 border ${config.borderColor} ${config.bgColor} transition-all duration-200 group min-w-[200px]`}>
      <div className="flex items-center justify-between">
        {/* Status display */}
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={config.icon} className={config.iconColor} />
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.label}
          </span>
        </div>

        {/* Action buttons */}
        {renderActionButtons()}
      </div>
    </td>
  );
};
