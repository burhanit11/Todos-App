import { useEffect, useMemo, useRef, useState } from "react";
import { useTodos, type Priority, type Todo as TodoItem } from "../store/todos";
import DateTimePicker from "./DateTimePicker";

type TodoStage = "all" | "pending" | "finished";

const ITEMS_PER_PAGE = 6;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please select an image file.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Image is too large. Use a file smaller than 4MB.";
  }
  return null;
}

/** Resize an image File to 80×80 JPEG data URL via an offscreen canvas. */
function resizeImageToDataUrl(file: File, size = 80): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context unavailable"));
        return;
      }
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("load error"));
    };
    img.src = objectUrl;
  });
}
type SortMode =
  | "newest"
  | "oldest"
  | "alphabetical"
  | "status"
  | "priority"
  | "due";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "↑ High",
  medium: "→ Medium",
  low: "↓ Low",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type DueStatus = "future" | "soon" | "overdue";

function getDueStatus(dueAt: Date): DueStatus {
  const diff = dueAt.getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 60 * 60 * 1000) return "soon";
  return "future";
}

function getProgressTone(progress: number): "low" | "mid" | "high" | "done" {
  if (progress <= 25) return "low";
  if (progress <= 75) return "mid";
  if (progress <= 99) return "high";
  return "done";
}

/** Generates a circular SVG avatar from owner name — works fully offline. */
function avatarDataUri(name: string): string {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const BG_COLORS = [
    "#fb923c",
    "#f43f5e",
    "#8b5cf6",
    "#06b6d4",
    "#22c55e",
    "#f59e0b",
    "#ec4899",
  ];
  const idx =
    [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % BG_COLORS.length;
  const bg = BG_COLORS[idx];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${bg}"/><text x="20" y="20" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DUE_LABELS: Record<DueStatus, string> = {
  future: "⏰ Due",
  soon: "⏳ Due soon",
  overdue: "⚠ Overdue",
};

function DueBadge({ dueAt, completed }: { dueAt: Date; completed: boolean }) {
  if (completed) {
    return (
      <span className="due-badge due-badge-done">
        ✓ Was due {dateFormatter.format(dueAt)}
      </span>
    );
  }

  const status = getDueStatus(dueAt);
  return (
    <span className={`due-badge due-badge-${status}`}>
      {DUE_LABELS[status]} · {dateFormatter.format(dueAt)}
    </span>
  );
}

const Todos = () => {
  const {
    todo,
    handleToggleTodo,
    handleUpdateTodo,
    handleDeleteTodo,
    handleRestoreTodo,
    handleClearCompleted,
    handleCompletePending,
  } = useTodos();

  const [activeStage, setActiveStage] = useState<TodoStage>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingTaskImage, setEditingTaskImage] = useState("");
  const [editingOwner, setEditingOwner] = useState("Me");
  const [editingOwnerAvatar, setEditingOwnerAvatar] = useState("");
  const [editingPriority, setEditingPriority] = useState<Priority>("medium");
  const [editingDueAt, setEditingDueAt] = useState<string>("");
  const [editingProgress, setEditingProgress] = useState(0);
  const [editingUploadError, setEditingUploadError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recentlyDeleted, setRecentlyDeleted] = useState<TodoItem | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<number | null>(null);
  const taskImageEditInputRef = useRef<HTMLInputElement>(null);
  const avatarEditInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isTypingTarget) return;

      if (event.key === "/") {
        event.preventDefault();
        setActiveStage("all");
        searchInputRef.current?.focus();
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        document.getElementById("todo-task-input")?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const showUndoForDelete = (item: TodoItem) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }

    setRecentlyDeleted(item);
    handleDeleteTodo(item.id);

    undoTimerRef.current = window.setTimeout(() => {
      setRecentlyDeleted(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!recentlyDeleted) {
      return;
    }

    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    handleRestoreTodo(recentlyDeleted);
    setRecentlyDeleted(null);
  };

  const stageCounts = {
    all: todo.length,
    pending: todo.filter((item) => !item.completed).length,
    finished: todo.filter((item) => item.completed).length,
  };

  const completionRate =
    stageCounts.all === 0
      ? 0
      : Math.round((stageCounts.finished / stageCounts.all) * 100);

  const filteredTodos = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const stageFiltered = todo.filter((item) => {
      if (activeStage === "pending") {
        return !item.completed;
      }

      if (activeStage === "finished") {
        return item.completed;
      }

      return true;
    });

    const queryFiltered = normalizedQuery
      ? stageFiltered.filter((item) =>
          item.task.toLowerCase().includes(normalizedQuery),
        )
      : stageFiltered;

    const sorted = [...queryFiltered];
    if (sortMode === "oldest") {
      sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } else if (sortMode === "alphabetical") {
      sorted.sort((a, b) => a.task.localeCompare(b.task));
    } else if (sortMode === "status") {
      sorted.sort((a, b) => Number(a.completed) - Number(b.completed));
    } else if (sortMode === "priority") {
      sorted.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      );
    } else if (sortMode === "due") {
      sorted.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return a.dueAt.getTime() - b.dueAt.getTime();
      });
    } else {
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return sorted;
  }, [activeStage, searchQuery, sortMode, todo]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTodos.length / ITEMS_PER_PAGE),
  );

  const paginatedTodos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTodos.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredTodos]);

  const rangeStart =
    filteredTodos.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredTodos.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeStage, searchQuery, sortMode]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const startEditing = (
    id: number,
    task: string,
    taskImage: string,
    owner: string,
    ownerAvatar: string,
    priority: Priority,
    dueAt: Date | null,
    progress: number,
  ) => {
    setEditingId(id);
    setEditingValue(task);
    setEditingTaskImage(taskImage);
    setEditingOwner(owner);
    setEditingOwnerAvatar(ownerAvatar);
    setEditingPriority(priority);
    setEditingDueAt(dueAt ? toLocalDateTimeString(dueAt) : "");
    setEditingProgress(progress);
    setEditingUploadError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue("");
    setEditingTaskImage("");
    setEditingOwner("Me");
    setEditingOwnerAvatar("");
    setEditingPriority("medium");
    setEditingDueAt("");
    setEditingProgress(0);
    setEditingUploadError("");
  };

  const saveEditing = (id: number) => {
    const trimmedValue = editingValue.trim();
    if (!trimmedValue) {
      return;
    }

    const parsedDueAtRaw = editingDueAt ? new Date(editingDueAt) : null;
    const parsedDueAt =
      parsedDueAtRaw && !Number.isNaN(parsedDueAtRaw.getTime())
        ? parsedDueAtRaw
        : null;

    handleUpdateTodo(
      id,
      trimmedValue,
      editingTaskImage,
      editingOwner,
      editingOwnerAvatar,
      editingPriority,
      parsedDueAt,
      editingProgress,
    );
    setEditingId(null);
    setEditingValue("");
    setEditingTaskImage("");
    setEditingOwner("Me");
    setEditingOwnerAvatar("");
    setEditingPriority("medium");
    setEditingDueAt("");
    setEditingProgress(0);
    setEditingUploadError("");
  };

  return (
    <section aria-label="Todo stages and list">
      <div className="todo-kpis" aria-label="Todo summary">
        <article className="kpi-card">
          <p className="kpi-label">All Tasks</p>
          <p className="kpi-value">{stageCounts.all}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Pending</p>
          <p className="kpi-value">{stageCounts.pending}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Finished</p>
          <p className="kpi-value">{stageCounts.finished}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Completion</p>
          <p className="kpi-value">{completionRate}%</p>
        </article>
      </div>

      <div className="completion-track" aria-hidden="true">
        <span style={{ width: `${completionRate}%` }} />
      </div>

      <header className="todo-stages">
        <h2>Todo Stages</h2>
        <div
          className="todo-stage-tabs"
          role="tablist"
          aria-label="Todo filters"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeStage === "all"}
            className={activeStage === "all" ? "stage-tab active" : "stage-tab"}
            onClick={() => setActiveStage("all")}
          >
            All ({stageCounts.all})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeStage === "pending"}
            className={
              activeStage === "pending" ? "stage-tab active" : "stage-tab"
            }
            onClick={() => setActiveStage("pending")}
          >
            Pending ({stageCounts.pending})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeStage === "finished"}
            className={
              activeStage === "finished" ? "stage-tab active" : "stage-tab"
            }
            onClick={() => setActiveStage("finished")}
          >
            Finished ({stageCounts.finished})
          </button>
        </div>
      </header>

      <section className="todo-controls" aria-label="Advanced controls">
        <input
          ref={searchInputRef}
          type="search"
          className="todo-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks"
        />
        <label className="todo-sort-label" htmlFor="todo-sort-select">
          Sort
        </label>
        <select
          id="todo-sort-select"
          className="todo-sort-select"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          aria-label="Sort tasks"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="alphabetical">A to Z</option>
          <option value="status">Pending first</option>
          <option value="priority">High priority first</option>
          <option value="due">Due soonest first</option>
        </select>
        <button
          type="button"
          className="todo-action-btn secondary"
          onClick={() => {
            setSearchQuery("");
            setSortMode("newest");
          }}
        >
          Reset
        </button>
        <button
          type="button"
          className="todo-action-btn save"
          onClick={handleCompletePending}
          disabled={stageCounts.pending === 0}
        >
          Complete pending
        </button>
        <button
          type="button"
          className="todo-action-btn danger"
          onClick={() => {
            const shouldClear = window.confirm(
              "Clear all finished tasks? This action cannot be undone.",
            );
            if (shouldClear) {
              handleClearCompleted();
            }
          }}
          disabled={stageCounts.finished === 0}
        >
          Clear finished
        </button>
      </section>

      <p className="todo-shortcuts-hint" aria-label="Keyboard shortcuts">
        Shortcuts: <strong>/</strong> search tasks • <strong>N</strong> new task
      </p>

      <ul className="todos-container">
        {filteredTodos.length === 0 ? (
          <li className="todo-empty">
            <strong>No tasks found.</strong>
            <span>
              Try another stage, clear the search filter, or add your next task
              above.
            </span>
          </li>
        ) : (
          paginatedTodos.map((item) => (
            <li
              key={item.id}
              className={`todo-row${item.completed ? " todo-row-done" : ""}${editingId === item.id ? " todo-row-editing" : ""}`}
            >
              {editingId === item.id ? (
                /* ── Edit mode ─────────────────────────────── */
                <div className="todo-edit-card">
                  <div className="todo-edit-header">
                    <span className="todo-edit-badge">Editing task</span>
                    <div className="todo-actions">
                      <button
                        type="button"
                        className="todo-action-btn save"
                        onClick={() => saveEditing(item.id)}
                        disabled={editingValue.trim().length === 0}
                        aria-label={`Save changes to task: ${item.task}`}
                      >
                        ✓ Save
                      </button>
                      <button
                        type="button"
                        className="todo-action-btn secondary"
                        onClick={cancelEditing}
                        aria-label="Cancel editing"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>

                  <input
                    className="todo-edit-input"
                    type="text"
                    autoFocus
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveEditing(item.id);
                      if (event.key === "Escape") cancelEditing();
                    }}
                    aria-label={`Edit task text for: ${item.task}`}
                    placeholder="Task description…"
                  />

                  <div className="todo-edit-fields">
                    <div className="todo-task-image-field todo-task-image-field-edit">
                      <button
                        type="button"
                        className="todo-task-image-upload-btn"
                        title="Change task image"
                        aria-label="Change task image"
                        onClick={() => taskImageEditInputRef.current?.click()}
                      >
                        {editingTaskImage ? (
                          <img
                            src={editingTaskImage}
                            alt="task"
                            className="todo-task-image-upload-preview"
                          />
                        ) : (
                          <span aria-hidden="true">🖼</span>
                        )}
                      </button>
                      <input
                        ref={taskImageEditInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const validationError = validateImageFile(file);
                          if (validationError) {
                            setEditingUploadError(validationError);
                            e.target.value = "";
                            return;
                          }
                          try {
                            const dataUrl = await resizeImageToDataUrl(
                              file,
                              420,
                            );
                            setEditingTaskImage(dataUrl);
                            setEditingUploadError("");
                          } catch {
                            setEditingUploadError(
                              "Could not process image. Try another one.",
                            );
                          }
                          e.target.value = "";
                        }}
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                      <span className="todo-task-image-label">Task image</span>
                    </div>

                    {editingUploadError && (
                      <p className="todo-upload-error" role="alert">
                        {editingUploadError}
                      </p>
                    )}

                    <div className="todo-owner-field">
                      <button
                        type="button"
                        className="todo-avatar-upload-btn"
                        title="Change owner photo"
                        aria-label="Change owner photo"
                        onClick={() => avatarEditInputRef.current?.click()}
                      >
                        {editingOwnerAvatar ? (
                          <img
                            src={editingOwnerAvatar}
                            alt="owner avatar"
                            className="todo-avatar-upload-preview"
                          />
                        ) : (
                          <span aria-hidden="true">📷</span>
                        )}
                      </button>
                      <input
                        ref={avatarEditInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await resizeImageToDataUrl(file);
                            setEditingOwnerAvatar(dataUrl);
                          } catch {
                            /* ignore */
                          }
                          e.target.value = "";
                        }}
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                      <span className="todo-owner-icon" aria-hidden="true">
                        👤
                      </span>
                      <input
                        className="todo-owner-input"
                        type="text"
                        value={editingOwner}
                        onChange={(e) => setEditingOwner(e.target.value)}
                        placeholder="Assigned to"
                        aria-label="Task owner"
                        maxLength={40}
                      />
                    </div>

                    <div className="todo-priority-edit">
                      <label htmlFor={`priority-edit-${item.id}`}>
                        Priority
                      </label>
                      <select
                        id={`priority-edit-${item.id}`}
                        value={editingPriority}
                        onChange={(event) =>
                          setEditingPriority(event.target.value as Priority)
                        }
                      >
                        <option value="low">↓ Low</option>
                        <option value="medium">→ Medium</option>
                        <option value="high">↑ High</option>
                      </select>
                    </div>
                    <div className="todo-progress-edit">
                      <label htmlFor={`progress-edit-${item.id}`}>
                        Progress
                      </label>
                      <div className="todo-progress-edit-track">
                        <input
                          id={`progress-edit-${item.id}`}
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={editingProgress}
                          onChange={(e) =>
                            setEditingProgress(Number(e.target.value))
                          }
                          aria-label="Task progress percentage"
                        />
                        <span className="todo-progress-edit-value">
                          {editingProgress}%
                        </span>
                      </div>
                    </div>
                    <div className="todo-due-edit">
                      <DateTimePicker
                        id={`due-edit-${item.id}`}
                        value={editingDueAt}
                        onChange={setEditingDueAt}
                        aria-label="Reminder date and time"
                        onClear={() => setEditingDueAt("")}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── View mode ─────────────────────────────── */
                <div className="todo-view-card">
                  {/* Zone 1: Card header */}
                  <div className="todo-card-header">
                    <div className="todo-card-header-left">
                      <div className="todo-owner-badge">
                        <span className="todo-owner-avatar" aria-hidden="true">
                          <img
                            src={item.ownerAvatar || avatarDataUri(item.owner)}
                            alt=""
                            width={28}
                            height={28}
                            draggable={false}
                          />
                        </span>
                        <span className="todo-owner-name">{item.owner}</span>
                      </div>
                      <span
                        className={`priority-pill priority-pill-${item.priority}`}
                      >
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                      <span
                        className={
                          item.completed
                            ? "status-pill done"
                            : "status-pill pending"
                        }
                      >
                        {item.completed ? "✓ Done" : "● Pending"}
                      </span>
                      {item.dueAt && (
                        <DueBadge
                          dueAt={item.dueAt}
                          completed={item.completed}
                        />
                      )}
                    </div>
                    <div className="todo-card-header-right">
                      <button
                        type="button"
                        className="todo-action-btn secondary"
                        aria-label={`Update task: ${item.task}`}
                        onClick={() =>
                          startEditing(
                            item.id,
                            item.task,
                            item.taskImage,
                            item.owner,
                            item.ownerAvatar,
                            item.priority,
                            item.dueAt,
                            item.progress,
                          )
                        }
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        className="todo-action-btn danger"
                        aria-label={`Delete task: ${item.task}`}
                        onClick={() => showUndoForDelete(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Zone 2: Task title */}
                  <p className="todo-task-text">{item.task}</p>
                  {item.taskImage && (
                    <div className="todo-task-image-wrap">
                      <img
                        src={item.taskImage}
                        alt={`Task image for ${item.task}`}
                        className="todo-task-image"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Zone 3: Footer — date · progress · done toggle */}
                  <div className="todo-card-footer">
                    <span className="todo-time-chip">
                      🕐 {dateFormatter.format(item.createdAt)}
                    </span>

                    {item.progress > 0 && (
                      <div
                        className={`todo-progress-inline progress-tone-${getProgressTone(item.progress)}`}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.progress}
                        aria-label={`Completion for ${item.task}`}
                      >
                        <div className="todo-progress-track" aria-hidden="true">
                          <span
                            className={`todo-progress-fill progress-fill-${getProgressTone(item.progress)}`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="todo-progress-chip">
                          {item.progress}%
                        </span>
                      </div>
                    )}

                    <label className="todo-check-inline">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleTodo(item.id)}
                        aria-label={`Mark "${item.task}" as ${item.completed ? "pending" : "complete"}`}
                      />
                      <span>
                        {item.completed ? "Mark pending" : "Mark done"}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>

      {filteredTodos.length > 0 && totalPages > 1 && (
        <nav className="todo-pagination" aria-label="Todo pagination">
          <button
            type="button"
            className="todo-page-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="todo-page-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="todo-page-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </nav>
      )}

      {recentlyDeleted && (
        <aside className="todo-undo-toast" role="status" aria-live="polite">
          <p>
            Deleted <strong>{recentlyDeleted.task}</strong>
          </p>
          <button
            type="button"
            className="todo-undo-btn"
            onClick={handleUndoDelete}
          >
            Undo
          </button>
        </aside>
      )}

      <p className="todo-results" aria-live="polite">
        Showing {rangeStart}-{rangeEnd} of {filteredTodos.length} filtered tasks
        ({stageCounts.all} total).
      </p>
    </section>
  );
};

export default Todos;
