"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faImage, faPlay, faCancel, faPlus, faUnlink } from '@fortawesome/free-solid-svg-icons';
import { CycleSlotStatus, getStatusConfig } from '@/app/set/types';
import { IconButton } from '@/app/set/icon-button';

interface StatusTableCellProps {
  status: CycleSlotStatus;
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

export const StatusTableCell: React.FC<StatusTableCellProps> = ({
  status,
  onSetSkip,
  onMarkNotSkip,
  onCreateCard,
  onLinkCard,
  onEditCard,
  cardPreviewUrl,
  onUnlinkCard,
}) => {
  const [showCardPreview, setShowCardPreview] = useState(false);

  const config = getStatusConfig(status);

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

      case 'invalid':
      case 'valid':
        return (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
    <td className={`py-0.5 px-2 border ${config.borderColor} ${config.bgColor} transition-all duration-200 group min-w-[150px]`}>
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
