export const CardPTInput = (props: {
  pt: { power: number, toughness: number },
  setPt: (value: { power: number, toughness: number }) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label className="block font-medium text-zinc-800">
      Power/Toughness
    </label>
    <div className="flex gap-2">
      <input
        type="number"
        min="0"
        placeholder="Power"
        value={props.pt?.power || ''}
        onChange={(e) => {
          const power = parseInt(e.target.value, 10);
          props.setPt({
            ...props.pt,
            power: isNaN(power) ? 0 : power,
          });
        }}
        className="w-full bg-white px-1 py-0.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="number"
        min="0"
        placeholder="Toughness"
        value={props.pt?.toughness || ''}
        onChange={(e) => {
          const toughness = parseInt(e.target.value, 10);
          props.setPt({
            ...props.pt,
            toughness: isNaN(toughness) ? 0 : toughness,
          });
        }}
        className="w-full bg-white px-1 py-0.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
