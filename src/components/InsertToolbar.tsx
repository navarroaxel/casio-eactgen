import { useState } from "react";
import type { Snippet } from "@/lib/insertAtCaret";
import { MATH_BUTTONS } from "@/lib/mathButtons";
import { PALETTES } from "@/lib/palettes";
import { SNIPPET_BTN } from "./styles";

interface InsertToolbarProps {
  onInsert: (snippet: Snippet, ownLine?: boolean) => void;
}

/** Math-markup buttons plus the tabbed character palettes. */
export function InsertToolbar({ onInsert }: InsertToolbarProps) {
  const [activeTab, setActiveTab] = useState<string | null>(PALETTES[0].id);
  const active = PALETTES.find((p) => p.id === activeTab);

  return (
    <>
      <section className="flex flex-wrap gap-2">
        {MATH_BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.title}
            onClick={() => onInsert({ pre: b.pre, post: b.post }, b.ownLine)}
            className={`rounded-lg px-3 py-1.5 font-mono text-sm transition ${SNIPPET_BTN}`}
          >
            {b.label}
          </button>
        ))}
      </section>

      <section className="rounded-xl border border-black/10 dark:border-white/10">
        <div className="flex flex-wrap gap-1 border-b border-black/10 p-2 dark:border-white/10">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setActiveTab((cur) => (cur === p.id ? null : p.id))
              }
              title={activeTab === p.id ? `Hide ${p.label}` : `Show ${p.label}`}
              aria-expanded={activeTab === p.id}
              className={`rounded-md px-3 py-1 text-sm transition ${
                activeTab === p.id
                  ? "bg-emerald-600 text-white"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {active && (
          <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto p-3">
            {active.items.map((item) => (
              <button
                key={item.insert}
                type="button"
                title={item.title}
                onClick={() => onInsert({ pre: item.insert })}
                className={`flex size-9 items-center justify-center rounded-md text-base ${SNIPPET_BTN}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
