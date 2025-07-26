export const CardCollectorNumberInput = (props: {
  collectorNumber: number,
  setCollectorNumber: (value: number) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardCollectorNumber" className="block font-medium text-zinc-800">
      Collector Number
    </label>
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
