export const CardNameInput = (props: {
  name: string,
  setName: (value: string) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardName" className="block font-medium text-zinc-800">
      Card Name
    </label>
    <input
      id="cardName"
      type="text"
      value={props.name}
      onChange={(e) => props.setName(e.target.value)}
      placeholder="Enter card name..."
      className="w-full bg-white px-1 py-0.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
