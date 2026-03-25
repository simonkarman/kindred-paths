"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MechanicWithRarity, SerializedCard } from 'kindred-paths';
import { CardRender } from '../card-render';
import { getCard } from '@/utils/api';

interface MechanicRowProps {
  mechanic: MechanicWithRarity;
  isProminent: boolean;
  showNormalized: boolean;
  isHighlighted: boolean;
  onHover: (normalized: string | null, instanceId?: string) => void;
  totalWeightedScore: number;
}

/**
 * Get the rarity abbreviation.
 */
function getRarityAbbr(rarity: string): string {
  return rarity.charAt(0).toUpperCase();
}

export function MechanicRow({
  mechanic,
  isProminent,
  showNormalized,
  isHighlighted,
  onHover,
  totalWeightedScore,
}: MechanicRowProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [hoveredCard, setHoveredCard] = useState<{ cid: string; position: { top: number; left: number } } | null>(null);
  const [cardData, setCardData] = useState<SerializedCard | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate a unique ID for this component instance
  const instanceId = useMemo(() => Math.random().toString(36).substring(2, 11), []);

  // Display text based on showNormalized preference
  const displayText = showNormalized ? mechanic.mechanic : mechanic.original;

  // Calculate percentage of total weighted score
  const percentage = totalWeightedScore > 0
    ? ((mechanic.weightedScore / totalWeightedScore) * 100).toFixed(1)
    : '0.0';

  // Visual styling based on prominence
  const textSizeClass = isProminent ? 'text-sm' : 'text-xs';
  const fontWeightClass = isProminent ? 'font-semibold' : 'font-normal';
  const textColorClass = isProminent ? 'text-slate-800' : 'text-slate-600';

  // Highlight styling - use transparent border to prevent layout shift
  const highlightClasses = isHighlighted
    ? 'bg-yellow-100 border-yellow-400 shadow-sm'
    : 'bg-transparent border-transparent';

  // Update tooltip position when hovering
  useEffect(() => {
    if (isHovering && elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top - 8, // 8px above (mb-2)
        left: rect.left,
      });
    }
  }, [isHovering]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (cardHoverTimeoutRef.current) {
        clearTimeout(cardHoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovering(true);
    onHover(mechanic.mechanic, instanceId);
  };

  const handleMouseLeave = () => {
    // Delay closing to allow moving to tooltip
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(false);
      onHover(null, instanceId);
    }, 160);
  };

  const handleCardHoverEnter = async (cid: string, event: React.MouseEvent) => {
    // Clear any pending card hover timeout
    if (cardHoverTimeoutRef.current) {
      clearTimeout(cardHoverTimeoutRef.current);
      cardHoverTimeoutRef.current = null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredCard({
      cid,
      position: {
        top: rect.top,
        left: rect.right + 8, // 8px to the right
      },
    });

    // Fetch card data if not already loaded
    if (!cardData || cardData.cid !== cid) {
      setIsLoadingCard(true);
      try {
        const card = await getCard(cid);
        if (card) {
          setCardData(card);
        }
      } catch (error) {
        console.error('Failed to load card:', error);
      } finally {
        setIsLoadingCard(false);
      }
    }
  };

  const handleCardHoverLeave = () => {
    // Delay closing to allow moving to the card preview
    cardHoverTimeoutRef.current = setTimeout(() => {
      setHoveredCard(null);
      setCardData(null);
    }, 150);
  };

  return (
    <>
      <div
        ref={elementRef}
        className={`group relative border rounded px-1 -mx-1 transition-all duration-150 ${highlightClasses}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-baseline justify-between">
          <div className={`${textSizeClass} ${fontWeightClass} ${textColorClass} font-mono break-words`}>
            {displayText}
          </div>
          <span className={`${isProminent ? 'text-xs' : 'text-[10px]'} text-slate-400 font-normal ml-2 flex-shrink-0`}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* Tooltip rendered via portal */}
      {isHovering && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateY(-100%)',
            zIndex: 9999,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Invisible bridge to prevent hover gaps */}
          <div
            style={{
              position: 'absolute',
              bottom: '-8px',
              left: 0,
              right: 0,
              height: '8px',
              pointerEvents: 'auto',
            }}
          />

          <div className="bg-gray-900 text-white rounded-lg shadow-xl p-3 min-w-[12rem] max-w-[20rem] text-xs pointer-events-auto">
            {/* Rarity counts at the top */}
            <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-700">
              {mechanic.rarities.map((rc, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-700 text-white"
                >
                  <span className="font-semibold">{getRarityAbbr(rc.rarity)}</span>
                  <span className="mx-0.5">:</span>
                  <span>{rc.count}</span>
                </span>
              ))}
            </div>

            {/* Card list */}
            <div className="font-semibold mb-2 text-gray-300">
              Cards with this mechanic
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {mechanic.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={`/card/${source.cid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:bg-gray-800 px-2 py-1 rounded transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => handleCardHoverEnter(source.cid, e)}
                  onMouseLeave={handleCardHoverLeave}
                >
                  • {source.cardName}
                  {mechanic.sources.filter(s => s.cardName === source.cardName).length > 1 &&
                    source.faceIndex > 0 && ` (Face ${source.faceIndex + 1})`}
                </a>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Card preview tooltip */}
      {hoveredCard && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${hoveredCard.position.top}px`,
            left: `${hoveredCard.position.left}px`,
            zIndex: 10000,
          }}
          onMouseEnter={() => {
            if (cardHoverTimeoutRef.current) {
              clearTimeout(cardHoverTimeoutRef.current);
              cardHoverTimeoutRef.current = null;
            }
          }}
          onMouseLeave={handleCardHoverLeave}
        >
          {(!isLoadingCard && cardData) ? (
            <div className="shadow-2xl w-64">
              <CardRender
                serializedCard={cardData}
                faceIndex={0}
              />
            </div>
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
}
