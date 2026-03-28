import React, { useRef, useState } from "react";
import { useTodos, type Priority } from "../store/todos";
import DateTimePicker from "./DateTimePicker";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "↓ Low",
  medium: "→ Medium",
  high: "↑ High",
};

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

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
      // centre-crop square
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

const AddTodo = () => {
  const [inputValue, setInputValue] = useState("");
  const [taskImage, setTaskImage] = useState("");
  const [owner, setOwner] = useState("Me");
  const [ownerAvatar, setOwnerAvatar] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueAtValue, setDueAtValue] = useState("");
  const [uploadError, setUploadError] = useState("");
  const taskImageInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { handleAddTodo } = useTodos();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    const dueAt = dueAtValue ? new Date(dueAtValue) : null;
    handleAddTodo(trimmedValue, taskImage, owner, ownerAvatar, priority, dueAt);
    setInputValue("");
    setTaskImage("");
    setOwner("Me");
    setOwnerAvatar("");
    setPriority("medium");
    setDueAtValue("");
    setUploadError("");
  };

  const handleTaskImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 420);
      setTaskImage(dataUrl);
      setUploadError("");
    } catch {
      setUploadError("Could not process image. Try another one.");
    }
    e.target.value = "";
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setOwnerAvatar(dataUrl);
      setUploadError("");
    } catch {
      setUploadError("Could not process image. Try another one.");
    }
    // reset so same file can be re-selected
    e.target.value = "";
  };

  // Minimum selectable time is 1 minute from now.
  const minDateTime = toLocalDateTimeString(new Date(Date.now() + 60_000));
  const isSubmitDisabled = inputValue.trim().length === 0;

  return (
    <div className="todo-form-shell">
      <form className="todo-form" onSubmit={handleSubmit}>
        <div className="todo-form-row">
          <input
            id="todo-task-input"
            className="todo-input"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="What needs to be done?"
            aria-label="Todo task"
            aria-describedby="add-todo-hint"
          />
          <button
            className="todo-button"
            type="submit"
            disabled={isSubmitDisabled}
          >
            Add Todo
          </button>
        </div>

        <div className="todo-form-meta">
          <div className="todo-task-image-field">
            <button
              type="button"
              className="todo-task-image-upload-btn"
              title="Upload task image"
              aria-label="Upload task image"
              onClick={() => taskImageInputRef.current?.click()}
            >
              {taskImage ? (
                <img
                  src={taskImage}
                  alt="task"
                  className="todo-task-image-upload-preview"
                />
              ) : (
                <span aria-hidden="true">🖼</span>
              )}
            </button>
            <input
              ref={taskImageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleTaskImageFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
            <span className="todo-task-image-label">Task image</span>
          </div>

          <div className="todo-owner-field">
            <button
              type="button"
              className="todo-avatar-upload-btn"
              title="Upload owner photo"
              aria-label="Upload owner photo"
              onClick={() => avatarInputRef.current?.click()}
            >
              {ownerAvatar ? (
                <img
                  src={ownerAvatar}
                  alt="owner avatar"
                  className="todo-avatar-upload-preview"
                />
              ) : (
                <span aria-hidden="true">📷</span>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
            <span className="todo-owner-icon" aria-hidden="true">
              👤
            </span>
            <input
              id="todo-owner-input"
              className="todo-owner-input"
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Assigned to"
              aria-label="Task owner"
              maxLength={40}
            />
          </div>
          <div
            className="priority-selector"
            role="group"
            aria-label="Task priority"
          >
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`priority-option priority-option-${p}${priority === p ? " active" : ""}`}
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="todo-due-field">
            <DateTimePicker
              id="todo-due-input"
              value={dueAtValue}
              min={minDateTime}
              onChange={setDueAtValue}
              aria-label="Reminder date and time"
              onClear={() => setDueAtValue("")}
            />
          </div>
        </div>
      </form>

      {uploadError && (
        <p className="todo-upload-error" role="alert">
          {uploadError}
        </p>
      )}

      <p id="add-todo-hint" className="todo-form-helper">
        Priority: <strong>{PRIORITY_LABELS[priority]}</strong>
        {dueAtValue && (
          <>
            {" · Reminder: "}
            <strong>
              {new Date(dueAtValue).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </strong>
          </>
        )}
        {" · Saved locally in your browser."}
      </p>
    </div>
  );
};

export default AddTodo;
