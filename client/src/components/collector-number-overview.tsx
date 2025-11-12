import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { CollectorNumberInfo } from '@/utils/server';

type CollectorNumberOverviewProps = {
  selectedCollectorNumber?: number;
  setSelectedCollectorNumber?: (num: number) => void;
  collectorNumbers: CollectorNumberInfo[];
}

export function CollectorNumberOverview(props: CollectorNumberOverviewProps) {
  const { selectedCollectorNumber, setSelectedCollectorNumber, collectorNumbers } = props;
  const minNumber = Math.min(...collectorNumbers.map(c => c.collectorNumber), selectedCollectorNumber ?? Infinity);
  const maxNumber = Math.max(...collectorNumbers.map(c => c.collectorNumber), selectedCollectorNumber ?? -Infinity);
  return <div className="mt-2 border border-zinc-300 rounded-md p-3">
    <div className="flex flex-wrap gap-1">
      {Array.from(
        { length: maxNumber - minNumber + 10 },
        (_, i) => i + minNumber
      ).map(num => {
        const occupiedInfo = collectorNumbers.filter(c => c.collectorNumber === num);
        const isOccupied = occupiedInfo.length > 0;
        const isSelected = num === selectedCollectorNumber;
        const clickable = !isOccupied && setSelectedCollectorNumber !== undefined;

        return (
          <div
            key={num}
            className={`
                relative group w-8 h-8 flex items-center justify-center rounded
                border font-medium transition-all
                ${isOccupied
                  ? isSelected
                    ? 'border-red-300 bg-red-100 text-red-700 hover:bg-red-100 hover:border-red-500'
                    : 'border-zinc-300 bg-zinc-100 text-zinc-400'
                  : isSelected
                    ? 'border-blue-500 bg-blue-100 text-blue-700'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-green-100 hover:border-green-500 hover:text-green-600'
                }
                ${clickable ? 'cursor-pointer' : 'cursor-default'}
              `}
            onClick={() => {
              if (!isOccupied && setSelectedCollectorNumber) {
                setSelectedCollectorNumber(num);
              }
            }}
          >
            {isOccupied ? (
              <>
                {occupiedInfo.length > 1 ? (
                  <div
                    className="bg-current/15 border border-current/40 text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    {'x' + occupiedInfo.length}
                  </div>
                ) : <FontAwesomeIcon icon={faCheckCircle} className="" />}
                {/* Tooltip on hover - positioned to avoid going off-screen */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 shadow-lg whitespace-nowrap">
                    <div className="font-semibold mb-1">#{num}</div>
                    {occupiedInfo.map((oi) => oi.faces.map(face => (
                      <div key={oi.cardId + '_' + face.name} className="mb-1 last:mb-0">
                        <div className="font-medium">{face.name}</div>
                        <div className="text-gray-300 text-xs">{face.renderedTypeLine}</div>
                      </div>
                    )))}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-xs">{num}</span>
            )}
          </div>
        );
      })}
    </div>
  </div>
}
