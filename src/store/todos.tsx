import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type TodopoviderProps = {
  children: ReactNode;
};

export type Todo = {
  id: number;
  task: string;
  taskImage: string;
  owner: string;
  ownerAvatar: string;
  completed: boolean;
  progress: number;
  createdAt: Date;
  priority: Priority;
  dueAt: Date | null;
};

export type Priority = "low" | "medium" | "high";

export type TodoContext = {
  todo: Todo[];
  handleAddTodo: (
    task: string,
    taskImage: string,
    owner: string,
    ownerAvatar: string,
    priority: Priority,
    dueAt: Date | null,
  ) => void;
  handleToggleTodo: (id: number) => void;
  handleSetTodoProgress: (id: number, progress: number) => void;
  handleUpdateTodo: (
    id: number,
    task: string,
    taskImage: string,
    owner: string,
    ownerAvatar: string,
    priority: Priority,
    dueAt: Date | null,
    progress: number,
  ) => void;
  handleDeleteTodo: (id: number) => void;
  handleRestoreTodo: (item: Todo) => void;
  handleClearCompleted: () => void;
  handleCompletePending: () => void;
};

const TODO_STORAGE_KEY = "todo-typescript.items";

const clampProgress = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

const loadTodosFromStorage = (): Todo[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(TODO_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      id: number;
      task: string;
      taskImage?: string;
      owner?: string;
      ownerAvatar?: string;
      completed: boolean;
      progress?: number;
      createdAt: string;
      priority?: string;
      dueAt?: string | null;
    }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item) =>
          typeof item.id === "number" &&
          typeof item.task === "string" &&
          typeof item.completed === "boolean" &&
          typeof item.createdAt === "string",
      )
      .map((item) => {
        const dueAtDate = item.dueAt ? new Date(item.dueAt) : null;
        return {
          id: item.id,
          task: item.task,
          taskImage: typeof item.taskImage === "string" ? item.taskImage : "",
          owner:
            typeof item.owner === "string" && item.owner.trim()
              ? item.owner.trim()
              : "Me",
          ownerAvatar:
            typeof item.ownerAvatar === "string" ? item.ownerAvatar : "",
          completed: item.completed,
          progress: clampProgress(
            typeof item.progress === "number"
              ? item.progress
              : item.completed
                ? 100
                : 0,
          ),
          createdAt: new Date(item.createdAt),
          priority: (["low", "medium", "high"].includes(item.priority ?? "")
            ? item.priority
            : "medium") as Priority,
          dueAt:
            dueAtDate && !Number.isNaN(dueAtDate.getTime()) ? dueAtDate : null,
        };
      })
      .filter((item) => !Number.isNaN(item.createdAt.getTime()));
  } catch {
    return [];
  }
};

// create context
export const todoContext = createContext<TodoContext | null>(null);

// provider
export const TodoProvider = ({ children }: TodopoviderProps) => {
  const [todo, setTodo] = useState<Todo[]>(() => loadTodosFromStorage());

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todo));
    }
  }, [todo]);

  const handleAddTodo = (
    task: string,
    taskImage: string,
    owner: string,
    ownerAvatar: string,
    priority: Priority,
    dueAt: Date | null,
  ) => {
    const trimmedOwner = owner.trim() || "Me";
    setTodo((prev) => [
      {
        id: Date.now(),
        task,
        taskImage,
        owner: trimmedOwner,
        ownerAvatar,
        completed: false,
        progress: 0,
        createdAt: new Date(),
        priority,
        dueAt,
      },
      ...prev,
    ]);
  };

  const handleToggleTodo = (id: number) => {
    setTodo((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              progress: item.completed ? 0 : 100,
            }
          : item,
      ),
    );
  };

  const handleSetTodoProgress = (id: number, progress: number) => {
    const normalizedProgress = clampProgress(progress);

    setTodo((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              progress: normalizedProgress,
              completed: normalizedProgress === 100,
            }
          : item,
      ),
    );
  };

  const handleUpdateTodo = (
    id: number,
    task: string,
    taskImage: string,
    owner: string,
    ownerAvatar: string,
    priority: Priority,
    dueAt: Date | null,
    progress: number,
  ) => {
    const trimmedTask = task.trim();
    if (!trimmedTask) {
      return;
    }

    const trimmedOwner = owner.trim() || "Me";
    const normalizedProgress = clampProgress(progress);

    setTodo((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              task: trimmedTask,
              taskImage,
              owner: trimmedOwner,
              ownerAvatar,
              priority,
              dueAt,
              progress: normalizedProgress,
              completed: normalizedProgress === 100,
            }
          : item,
      ),
    );
  };

  const handleDeleteTodo = (id: number) => {
    setTodo((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRestoreTodo = (item: Todo) => {
    setTodo((prev) => {
      if (prev.some((todoItem) => todoItem.id === item.id)) {
        return prev;
      }
      return [item, ...prev];
    });
  };

  const handleClearCompleted = () => {
    setTodo((prev) => prev.filter((item) => !item.completed));
  };

  const handleCompletePending = () => {
    setTodo((prev) =>
      prev.map((item) =>
        item.completed ? item : { ...item, completed: true, progress: 100 },
      ),
    );
  };

  return (
    <todoContext.Provider
      value={{
        todo,
        handleAddTodo,
        handleToggleTodo,
        handleSetTodoProgress,
        handleUpdateTodo,
        handleDeleteTodo,
        handleRestoreTodo,
        handleClearCompleted,
        handleCompletePending,
      }}
    >
      {children}
    </todoContext.Provider>
  );
};

// consumer
export const useTodos = () => {
  const todoConsumer = useContext(todoContext);
  if (!todoConsumer) {
    throw new Error("useTodos must be used within a TodoProvider");
  }
  return todoConsumer;
};
