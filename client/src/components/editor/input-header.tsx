import { capitalize } from '@/utils/typography';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencilSquare, faSquare } from '@fortawesome/free-solid-svg-icons';

export const InputHeader = (props: {
  propertyName: string,
  isChanged: boolean,
  revert: () => void,
  onTap?: () => void,
  children?: React.ReactNode,
}) => {
  const htmlId = `card${capitalize(props.propertyName).replace(/\s+\//g, '')}`;
  return <div className="flex items-baseline-last gap-3 border-t border-zinc-100 pt-2 mb-2">
    <label
      htmlFor={htmlId}
      className={`flex items-center gap-3 font-medium text-zinc-700 ${props.onTap ? 'cursor-pointer' : ''}`}
      onClick={props.onTap}
    >
      <FontAwesomeIcon className={`${props.isChanged ? 'text-orange-400' : 'text-zinc-200'} text-sm`} icon={
        props.isChanged ? faPencilSquare : faSquare
      }/>
      {props.propertyName.split(' ').map(s => capitalize(s)).join(' ')}
    </label>
    {props.isChanged && (
      <button
        type="button"
        className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        onClick={props.revert}
      >
        (Revert Changes)
      </button>
    )}
    {props.children}
  </div>;
}
