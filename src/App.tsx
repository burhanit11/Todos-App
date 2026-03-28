import { useEffect, useState } from "react";
import "./App.css";
import AddTodo from "./components/AddTodo";
import Todos from "./components/Todos";
import { useTodos } from "./store/todos";
import { useTaskReminders } from "./hooks/useTaskReminders";

/**
 * Shown when Notification permission is "default".
 * The request is triggered by a button click (user gesture) so browsers allow it.
 */
function NotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  const enable = () => {
    Notification.requestPermission().then((perm) => {
      setPermission(perm);
    });
  };

  if (
    dismissed ||
    !permission ||
    permission === "granted" ||
    permission === "denied"
  ) {
    return null;
  }

  return (
    <div className="notification-banner" role="status" aria-live="polite">
      <span className="notification-banner-icon" aria-hidden="true">
        🔔
      </span>
      <div className="notification-banner-body">
        <strong className="notification-banner-title">
          Enable task reminders
        </strong>
        <span className="notification-banner-desc">
          Get a browser notification the moment a task is due.
        </span>
      </div>
      <button
        type="button"
        className="notification-banner-btn"
        onClick={enable}
      >
        Enable
      </button>
      <button
        type="button"
        className="notification-banner-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notification prompt"
      >
        ✕
      </button>
    </div>
  );
}

function App() {
  const { todo } = useTodos();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("todo-theme") as "light" | "dark" | null;
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("todo-theme", theme);
  }, [theme]);

  useTaskReminders(todo);

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  const completedCount = todo.filter((item) => item.completed).length;
  const pendingCount = todo.length - completedCount;
  const completionRate =
    todo.length === 0 ? 0 : Math.round((completedCount / todo.length) * 100);
  const highPriorityPending = todo.filter(
    (item) => !item.completed && item.priority === "high",
  ).length;

  return (
    <div className="page-shell">
      <div className="ambient-glow glow-one" aria-hidden="true" />
      <div className="ambient-glow glow-two" aria-hidden="true" />

      <main className="todo-page">
        <header className="todo-header">
          <div className="header-top">
            <div className="header-title-section">
              <div className="header-logo-row">
                <span className="title-emoji">✨</span>
                <h1 className="header-title">Task Master</h1>
              </div>
              <p className="header-subtitle">Stay focused, get things done</p>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>

          <div className="header-content">
            <div className="header-stats">
              <div className="stat-card stat-card-main">
                <div className="stat-label">Today's Progress</div>
                <div className="stat-value-large">{completionRate}%</div>
                <div
                  className="stat-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completionRate}
                  aria-label="Overall completion progress"
                >
                  <span style={{ width: `${completionRate}%` }} />
                </div>
                <div className="stat-details">
                  {completedCount} of {todo.length} tasks done
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-info">
                  <div className="stat-value">{todo.length}</div>
                  <div className="stat-label">Total Tasks</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-info">
                  <div className="stat-value">{pendingCount}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-info">
                  <div className="stat-value">{highPriorityPending}</div>
                  <div className="stat-label">High Priority</div>
                </div>
              </div>
            </div>

            <div className="header-info">
              <div className="info-item">
                <span className="info-icon">📅</span>
                <span className="info-text">{todayLabel}</span>
              </div>
              <div className="info-divider" />
              <div className="info-item info-item-success">
                <span className="info-icon">✅</span>
                <span className="info-text">{completedCount} completed</span>
              </div>
              {highPriorityPending > 0 && (
                <>
                  <div className="info-divider" />
                  <div className="info-item info-item-alert">
                    <span className="info-icon">⚡</span>
                    <span className="info-text">
                      {highPriorityPending} urgent
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="header-features">
            <p className="features-title">Available features</p>
            <div className="features-list" aria-label="Available features">
              <span className="feature-pill">Tasks</span>
              <span className="feature-pill">Priority</span>
              <span className="feature-pill">Editing</span>
              <span className="feature-pill">Filters</span>
              <span className="feature-pill">Reminders</span>
              <span className="feature-pill">Auto Save</span>
              <span className="feature-pill">Themes</span>
              <span className="feature-pill">Responsive</span>
            </div>
          </div>
        </header>

        <section className="todo-panel" aria-label="Todo list section">
          <NotificationBanner />
          <AddTodo />
          <Todos />
        </section>

        <footer className="todo-footer" aria-label="Product quality highlights">
          <p>
            Built with React, TypeScript, responsive layout rules, and browser
            persistence for a smooth portfolio-ready experience.
          </p>
          <p className="todo-footer-signature">Crafted by Burhan Rabbani</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
