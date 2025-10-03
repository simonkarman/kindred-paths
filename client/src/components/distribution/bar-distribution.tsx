export const BarDistribution = (props: {
  title: string,
  data: Record<string, number>,
  sortOnValue?: boolean,
  check?: string[],
  fullWidth?: boolean
}) => {
  const { title, fullWidth } = props;
  const check = props.check ?? [];
  const data = { ...(check ? Object.fromEntries(check.map(c => [c, 0])) : {}), ...props.data };
  const sortOnValue = props.sortOnValue ?? false;
  const maxValue = Math.max(...Object.values(data));
  return (
    <div>
      <h3 className="font-bold mb-2 text-center">{title}<span className="pl-1 font-normal">Distribution</span></h3>
      <div className={`mx-auto space-y-1 ${fullWidth ? 'w-full' : 'w-70'}`}>
        {Object.entries(data)
          .sort(([a, an], [b, bn]) => sortOnValue ? (bn - an) : a.localeCompare(b))
          .map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-sm bg-zinc-50 rounded-l-full border-zinc-200 border">
              <div className="block h-6 w-120 bg-zinc-200/80 rounded-full">
                <div
                  className={`${value === 0 ? 'bg-blue-200' : 'bg-blue-500'} h-6 rounded-full flex items-center justify-end pr-3`}
                  style={{ width: `${(value / maxValue) * 75 + 25}%` }}
                >
                  <span className="text-xs text-white font-bold">{value}x</span>
                </div>
              </div>
              <span className="inline-block h-6 font-mono text-right w-full pr-2 py-0.5">
                {key.substring(0, 70)}{key.length > 70 && '...'}
                {props.check && <>
                  {check.includes(key) && value !== 0 && <span className="text-green-500"> ✔</span>}
                  {check.includes(key) && value === 0 && <span className="text-yellow-500"> ⚠</span>}
                  {!check.includes(key) && <span className="text-red-500"> ✘</span>}
                </>}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};
