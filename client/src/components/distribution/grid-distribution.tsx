export type DataPoint = { x: string | number, y: string | number, count: number };
export type EnumAxis = { type: 'enum', values: string[] };
export type NumberAxis = { type: 'number', min?: number, max?: number, stepSize: number };
export type Axis = EnumAxis | NumberAxis;

const precisionForStepSize = (stepSize: number): number => {
  if (stepSize >= 1) return 0;
  const stepStr = stepSize.toString();
  if (stepStr.includes('e-')) {
    const parts = stepStr.split('e-');
    return parseInt(parts[1], 10);
  } else if (stepStr.includes('.')) {
    return stepStr.split('.')[1].length;
  }
  return 0;
};

export const GridDistribution = (props: {
  title: string,
  xAxis: Axis,
  yAxis: Axis,
  data: DataPoint[],
}) => {
  const { title, xAxis, yAxis, data } = props;

  const computeAxisValues = (axis: Axis): string[] => {
    if (axis.type === "enum") {
      return axis.values;
    } else {
      const values: string[] = [];
      let min = axis.min;
      let max = axis.max;

      // Auto-generate min/max if not provided
      if (min === undefined || max === undefined) {
        const axisData = data.map(d => typeof d.x === 'number' ? d.x : typeof d.y === 'number' ? d.y : 0)
          .filter(val => typeof val === 'number');
        if (axisData.length > 0) {
          min = min ?? Math.min(...axisData);
          max = max ?? Math.max(...axisData);
        } else {
          min = min ?? 0;
          max = max ?? 10;
        }
      }

      // Round min to stepSize below
      if (min !== undefined) {
        min = Math.floor(min / axis.stepSize) * axis.stepSize;
      }
      // Round max to stepSize above
      if (max !== undefined) {
        max = Math.ceil(max / axis.stepSize) * axis.stepSize;
      }

      const stepSizePrecision = precisionForStepSize(axis.stepSize);
      for (let i = min; i <= max; i += axis.stepSize) {
        values.push(i.toFixed(stepSizePrecision));
      }
      return values;
    }
  };

  const xValues = computeAxisValues(xAxis);
  const yValues = computeAxisValues(yAxis);

  // Create lookup map for data
  const dataMap = new Map<string, number>();
  data.forEach((d) => {
    const x = typeof d.x === 'number' && xAxis.type === 'number'
      ? (Math.round(d.x / xAxis.stepSize) * xAxis.stepSize).toFixed(precisionForStepSize(xAxis.stepSize))
      : d.x.toString();
    const y = typeof d.y === 'number' && yAxis.type === 'number'
      ? (Math.round(d.y / yAxis.stepSize) * yAxis.stepSize).toFixed(precisionForStepSize(yAxis.stepSize))
      : d.y.toString();
    const key = `${x}-${y}`;
    dataMap.set(key, (dataMap.get(key) ?? 0) + d.count);
  });

  const maxCount = Math.max(...data.map(d => d.count), 1); // Ensure at least 1 to avoid division by zero

  // Color intensity based on count
  const getColorIntensity = (count: number) => {
    if (count === 0) return 0;
    return Math.max(0.1, (count / maxCount) * 0.9); // Min 10% opacity, max 90%
  };

  return (
    <div className="flex flex-col items-center">
      <h3 className="font-bold mb-4 text-center">
        {title}
        <span className="pl-1 font-normal">Distribution</span>
      </h3>
      <div>
        <div className="inline-block">
          {/* Table */}
          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
            {/* Header row */}
            <div className="flex bg-zinc-50 border-b border-zinc-200">
              <div className="w-20 h-6 flex items-center justify-center font-mono text-xs text-zinc-600 border-r border-zinc-200">

              </div>
              {xValues.map(xVal => (
                <div key={xVal} className="w-10 h-6 flex items-center justify-center font-mono text-xs text-zinc-700 border-r border-zinc-200 last:border-r-0">
                  {xVal}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {yValues.map(yVal => (
              <div key={yVal} className="flex border-b border-zinc-200 last:border-b-0">
                {/* Y-axis label */}
                <div className="w-20 h-10 flex items-center justify-center font-mono text-xs text-zinc-700 bg-zinc-50 border-r border-zinc-200">
                  {yVal} mana
                </div>

                {/* Data cells */}
                {xValues.map(xVal => {
                  const count = dataMap.get(`${xVal}-${yVal}`) ?? 0;
                  const intensity = getColorIntensity(count);

                  return (
                    <div
                      key={`${xVal}-${yVal}`}
                      className="w-10 h-10 flex items-center justify-center font-mono text-xs border-r border-zinc-200 last:border-r-0 relative"
                      style={{
                        backgroundColor: count > 0
                          ? `rgba(43, 127, 255, ${intensity})` // blue-500 with opacity
                          : 'transparent',
                        color: intensity > 0.5 ? 'white' : '#374151' // text-gray-700
                      }}
                    >
                      <span className="font-bold">
                        {count === 0 ? '-' : count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
