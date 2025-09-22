'use client';

import { StatusTableCell } from '@/app/set/status-table-cell';

// Example usage component
const ExampleTable: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold mb-4">Status Table Cell Examples</h2>

      <div className="overflow-x-auto">
        <table className="border-collapse border border-gray-300 w-full">
          <thead>
          <tr>
            <th className="border border-gray-300 p-3 bg-gray-100 text-left">ID</th>
            <th className="border border-gray-300 p-3 bg-gray-100 text-left">Status</th>
            <th className="border border-gray-300 p-3 bg-gray-100 text-left">Description</th>
          </tr>
          </thead>
          <tbody>
          <tr>
            <td className="border border-gray-300 p-3">1</td>
            <StatusTableCell
              status="missing"
              onSetSkip={() => console.log('Set skip')}
              onOpenBlueprintEditor={() => console.log('Open blueprint editor')}
            />
            <td className="border border-gray-300 p-3">Missing item needs attention</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-3">2</td>
            <StatusTableCell
              status="skip"
              onMarkNotSkip={() => console.log('Mark not skip')}
            />
            <td className="border border-gray-300 p-3">Skipped item</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-3">3</td>
            <StatusTableCell
              status="blueprint"
              onRemoveBlueprint={() => console.log('Remove blueprint')}
              onEditBlueprint={() => console.log('Edit blueprint')}
              onApplyBlueprintToRow={() => console.log('Apply to row')}
              onLinkCard={() => console.log('Link existing card')}
              onCreateCard={() => console.log('Create new card')}
            />
            <td className="border border-gray-300 p-3">Blueprint only</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-3">4</td>
            <StatusTableCell
              status="invalid"
              onRemoveBlueprint={() => console.log('Remove blueprint')}
              onEditBlueprint={() => console.log('Edit blueprint')}
              onApplyBlueprintToRow={() => console.log('Apply to row')}
              onEditCard={() => console.log('Edit card')}
              cardPreviewUrl="http://localhost:4101/render/mfy-401-miffy-the-kind"
              onUnlinkCard={() => console.log('Unlink card')}
            />
            <td className="border border-gray-300 p-3">Invalid configuration</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-3">5</td>
            <StatusTableCell
              status="valid"
              onRemoveBlueprint={() => console.log('Remove blueprint')}
              onEditBlueprint={() => console.log('Edit blueprint')}
              onApplyBlueprintToRow={() => console.log('Apply to row')}
              onEditCard={() => console.log('Edit card')}
              cardPreviewUrl="http://localhost:4101/render/mfy-401-miffy-the-kind"
              onUnlinkCard={() => console.log('Unlink card')}
            />
            <td className="border border-gray-300 p-3">Valid configuration</td>
          </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600 space-y-1">
        <p><strong>Instructions:</strong> Hover over the status cells to see available action buttons.</p>
        <p>Each status type shows different contextual actions with appropriate FontAwesome icons.</p>
      </div>
    </div>
  );
};

export default ExampleTable;
