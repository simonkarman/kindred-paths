import { InputHeader } from '@/components/editor/input-header';

export const CardCollectorNumberInput = (props: {
  collectorNumber: number,
  setCollectorNumber: (value: number) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  return <div className="space-y-1">
    <InputHeader propertyName="collector number" isChanged={props.isChanged} revert={props.revert} />
    <input
      id="cardCollectorNumber"
      type="number"
      min="1"
      value={props.collectorNumber}
      onChange={(e) => props.setCollectorNumber(parseInt(e.target.value, 10))}
      className="w-full bg-white px-1 py-0.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
