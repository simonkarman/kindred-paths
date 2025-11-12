import { capitalize, CardLayout, cardLayouts, Layout } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';

export const CardLayoutInput = (props: {
  layout: CardLayout,
  setLayout: (value: CardLayout) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  return <div className="space-y-1">
    <InputHeader propertyName="layout" isChanged={props.isChanged} revert={props.revert} />
    <div className="px-1 grid gap-4 w-full justify-between grid-cols-1 sm:grid-cols-2">
      {cardLayouts.map(layoutOption => (<div key={layoutOption}>
        <div className="flex gap-2 items-center">
          <input
            type="radio"
            id={`layout-${layoutOption}`}
            name="cardLayout"
            value={layoutOption}
            checked={props.layout === layoutOption}
            onChange={(e) => props.setLayout(e.target.value as CardLayout)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 accent-blue-600"
          />
          <label
            htmlFor={`layout-${layoutOption}`}
            className="text-sm font-medium cursor-pointer"
          >
            {capitalize(layoutOption)}
          </label>
        </div>
        <p className="text-sm p-1 text-zinc-600">
          {new Layout(layoutOption).description()}
        </p>
      </div>))}
    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
