import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff, X } from 'lucide-react';

export const DEFAULT_SECTIONS = [
  { id: 'live_tv',           label: 'Live TV' },
  { id: 'continue_emby',     label: 'Continue Watching (Emby)' },
  { id: 'recently_added',    label: 'Recently Added (Emby)' },
  { id: 'emby_rows',         label: 'Emby Library' },
  { id: 'continue_watching', label: 'Continue Watching' },
  { id: 'local_recent',      label: 'Recently Added' },
  { id: 'anime',             label: 'Anime' },
  { id: 'kids',              label: 'Kids' },
  { id: 'genres',            label: 'Genres' },
];

const STORAGE_KEY = 'streamvault_home_order';

export function loadHomeOrder() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const saved = JSON.parse(raw);
    // Merge: keep saved order/visibility, add any new sections
    const savedIds = new Set(saved.map(s => s.id));
    const merged = [
      ...saved,
      ...DEFAULT_SECTIONS.filter(s => !savedIds.has(s.id)),
    ];
    return merged;
  } catch (_) { return DEFAULT_SECTIONS; }
}

export function saveHomeOrder(sections) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sections)); } catch (_) {}
}

export default function HomeOrderEditor({ sections, onChange, onClose }) {
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const updated = Array.from(sections);
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);
    onChange(updated);
  };

  const toggleVisible = (id) => {
    onChange(sections.map(s => s.id === id ? { ...s, hidden: !s.hidden } : s));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground font-semibold text-base">Rearrange Home Screen</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-muted-foreground text-xs mb-4">Drag to reorder • tap eye to hide/show sections</p>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="home-sections">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {sections.map((section, index) => (
                  <Draggable key={section.id} draggableId={section.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                          snapshot.isDragging
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-secondary border-border'
                        } ${section.hidden ? 'opacity-40' : ''}`}
                      >
                        <div {...provided.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="flex-1 text-sm text-foreground">{section.label}</span>
                        <button
                          onClick={() => toggleVisible(section.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                          {section.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}