"use client";

import { useState } from "react";
import { createSet } from '@/utils/server';

export default function CreateNewSetForm() {
  const [setName, setSetName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSet = async () => {
    const name = setName.trim();
    if (!name) {
      console.error("Set name cannot be empty");
      return;
    }

    setIsCreating(true);

    try {
      const res = await createSet(name);
      console.info(`Set ${res.name} created successfully`);
      window.location.reload();
    } catch (error) {
      console.error("Error creating set:", error);
      console.error("Failed to create set. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreateSet();
        }}
      >
        <label
          htmlFor="set-name"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          Set Name
        </label>
        <input
          id="set-name"
          type="text"
          value={setName}
          onChange={(e) => setSetName(e.target.value.toUpperCase())}
          placeholder="Enter set name"
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
          disabled={isCreating}
        />
      </form>

      <button
        onClick={handleCreateSet}
        disabled={isCreating || !setName.trim()}
        className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed disabled:hover:bg-slate-300"
      >
        {isCreating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Creating...
          </span>
        ) : (
          'Create Set'
        )}
      </button>
    </div>
  );
}
