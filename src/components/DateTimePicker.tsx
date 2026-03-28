import { useEffect, useRef, useState } from "react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Parts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
};

function parseDT(val: string): Parts | null {
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return {
    year: +m[1],
    month: +m[2],
    day: +m[3],
    hour: +m[4],
    minute: +m[5],
  };
}

function fmtDT(p: Parts): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstDOW(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function toMinutes(p: Parts): number {
  return Math.floor(
    new Date(p.year, p.month - 1, p.day, p.hour, p.minute).getTime() / 60_000,
  );
}

function partsFromDate(date: Date): Parts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

type Props = {
  id?: string;
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  min?: string; // "YYYY-MM-DDTHH:mm" or undefined
  onChange: (v: string) => void;
  "aria-label"?: string;
  onClear?: () => void;
};

export default function DateTimePicker({
  id,
  value,
  min,
  onChange,
  "aria-label": ariaLabel,
  onClear,
}: Props) {
  const now = new Date();
  const parsed = parseDT(value);
  const minParsed = parseDT(min ?? "");

  const getFallback = () => {
    const current = new Date();
    if (minParsed) {
      return {
        day: { y: minParsed.year, mo: minParsed.month, d: minParsed.day },
        time: { hour: minParsed.hour, minute: minParsed.minute },
      };
    }
    return {
      day: {
        y: current.getFullYear(),
        mo: current.getMonth() + 1,
        d: current.getDate(),
      },
      time: { hour: current.getHours(), minute: current.getMinutes() },
    };
  };

  const initialFallback = getFallback();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(
    parsed?.month ?? now.getMonth() + 1,
  );
  const [selDay, setSelDay] = useState<{
    y: number;
    mo: number;
    d: number;
  } | null>(
    parsed
      ? { y: parsed.year, mo: parsed.month, d: parsed.day }
      : initialFallback.day,
  );
  const [selHour, setSelHour] = useState(
    parsed?.hour ?? initialFallback.time.hour,
  );
  const [selMin, setSelMin] = useState(
    parsed?.minute ?? initialFallback.time.minute,
  );
  const [openUp, setOpenUp] = useState(false);
  const [openLeft, setOpenLeft] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  // Sync internal state when value prop changes externally
  useEffect(() => {
    const p = parseDT(value);
    if (p) {
      setSelDay({ y: p.year, mo: p.month, d: p.day });
      setSelHour(p.hour);
      setSelMin(p.minute);
      setViewYear(p.year);
      setViewMonth(p.month);
    } else {
      const fallback = getFallback();
      setSelDay(fallback.day);
      setSelHour(fallback.time.hour);
      setSelMin(fallback.time.minute);
      setViewYear(fallback.day.y);
      setViewMonth(fallback.day.mo);
    }
  }, [value]);

  // Keep default time fresh whenever the picker opens without a selected value.
  useEffect(() => {
    if (!open || value) return;
    const fallback = getFallback();
    setSelDay(fallback.day);
    setSelHour(fallback.time.hour);
    setSelMin(fallback.time.minute);
  }, [open, value, min]);

  // Detect whether popover should open upward or left-align right
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setOpenUp(window.innerHeight - rect.bottom < 400);
    setOpenLeft(rect.left + 296 > window.innerWidth - 12);
  }, [open]);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isDayOff = (y: number, mo: number, d: number): boolean => {
    if (!minParsed) return false;
    return (
      y * 10000 + mo * 100 + d <
      minParsed.year * 10000 + minParsed.month * 100 + minParsed.day
    );
  };

  const goToPrev = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNext = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDaySelect = (d: number) => {
    if (isDayOff(viewYear, viewMonth, d)) return;
    setSelDay({ y: viewYear, mo: viewMonth, d });
  };

  const selectedParts: Parts | null = selDay
    ? {
        year: selDay.y,
        month: selDay.mo,
        day: selDay.d,
        hour: selHour,
        minute: selMin,
      }
    : null;

  const floorToMin = (parts: Parts): Parts => {
    if (!minParsed) return parts;
    return toMinutes(parts) < toMinutes(minParsed) ? minParsed : parts;
  };

  const handleConfirm = () => {
    if (!selectedParts) return;
    onChange(fmtDT(floorToMin(selectedParts)));
    setOpen(false);
  };

  const applyPreset = (makeDate: () => Date) => {
    const safe = floorToMin(partsFromDate(makeDate()));
    onChange(fmtDT(safe));
    setSelDay({ y: safe.year, mo: safe.month, d: safe.day });
    setSelHour(safe.hour);
    setSelMin(safe.minute);
    setViewYear(safe.year);
    setViewMonth(safe.month);
    setOpen(false);
  };

  // Build calendar grid
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startOff = firstDOW(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array<null>(startOff).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSel = (d: number) =>
    selDay?.y === viewYear && selDay?.mo === viewMonth && selDay?.d === d;

  const isTodayCell = (d: number) =>
    now.getFullYear() === viewYear &&
    now.getMonth() + 1 === viewMonth &&
    now.getDate() === d;

  const display = parsed
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(
        new Date(
          parsed.year,
          parsed.month - 1,
          parsed.day,
          parsed.hour,
          parsed.minute,
        ),
      )
    : null;

  const popCls = [
    "dtp-popover",
    openUp ? "dtp-pop-up" : "",
    openLeft ? "dtp-pop-left" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="dtp-root" ref={rootRef}>
      {/* Trigger button */}
      <button
        type="button"
        id={id}
        aria-label={ariaLabel ?? "Pick date and time"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={["dtp-trigger", open ? "open" : "", value ? "has-value" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dtp-icon" aria-hidden="true">
          📅
        </span>
        <span className="dtp-trigger-text">{display ?? "Set reminder…"}</span>
        {value && onClear && (
          <span
            role="button"
            tabIndex={0}
            className="dtp-clear-btn"
            aria-label="Clear reminder"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onClear();
              }
            }}
          >
            ✕
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          className={popCls}
          role="dialog"
          aria-label="Date and time picker"
          aria-modal="true"
        >
          {/* Month navigation header */}
          <div className="dtp-header">
            <button
              type="button"
              className="dtp-nav"
              onClick={goToPrev}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="dtp-month-title">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button
              type="button"
              className="dtp-nav"
              onClick={goToNext}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="dtp-presets" role="group" aria-label="Quick presets">
            <button
              type="button"
              className="dtp-preset-btn"
              onClick={() =>
                applyPreset(() => new Date(Date.now() + 15 * 60 * 1000))
              }
            >
              +15m
            </button>
            <button
              type="button"
              className="dtp-preset-btn"
              onClick={() =>
                applyPreset(() => new Date(Date.now() + 60 * 60 * 1000))
              }
            >
              +1h
            </button>
            <button
              type="button"
              className="dtp-preset-btn"
              onClick={() =>
                applyPreset(() => {
                  const next = new Date();
                  next.setHours(20, 0, 0, 0);
                  if (next.getTime() <= Date.now()) {
                    next.setDate(next.getDate() + 1);
                  }
                  return next;
                })
              }
            >
              Tonight 8:00
            </button>
            <button
              type="button"
              className="dtp-preset-btn"
              onClick={() =>
                applyPreset(() => {
                  const next = new Date();
                  next.setDate(next.getDate() + 1);
                  next.setHours(9, 0, 0, 0);
                  return next;
                })
              }
            >
              Tomorrow 9:00
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="dtp-dow-row" aria-hidden="true">
            {DOW.map((d) => (
              <span key={d} className="dtp-dow">
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="dtp-grid" role="grid">
            {cells.map((day, i) =>
              day == null ? (
                <span
                  key={`e-${i}`}
                  className="dtp-day dtp-day-empty"
                  aria-hidden="true"
                />
              ) : (
                <button
                  key={day}
                  type="button"
                  disabled={isDayOff(viewYear, viewMonth, day)}
                  aria-label={`${MONTH_NAMES[viewMonth - 1]} ${day}, ${viewYear}`}
                  aria-pressed={isSel(day)}
                  className={[
                    "dtp-day",
                    isSel(day) ? "dtp-day-sel" : "",
                    isTodayCell(day) && !isSel(day) ? "dtp-day-today" : "",
                    isDayOff(viewYear, viewMonth, day) ? "dtp-day-off" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleDaySelect(day)}
                >
                  {day}
                </button>
              ),
            )}
          </div>

          {/* Time spinner */}
          <div className="dtp-time-bar">
            <span className="dtp-time-lbl" aria-hidden="true">
              🕐 Time
            </span>
            <div className="dtp-spinners" role="group" aria-label="Select time">
              <div className="dtp-spin" aria-label="Hour">
                <button
                  type="button"
                  className="dtp-spn-btn"
                  aria-label="Increase hour"
                  onClick={() => setSelHour((h) => (h + 1) % 24)}
                >
                  ▲
                </button>
                <output className="dtp-spn-val" aria-live="polite">
                  {String(selHour).padStart(2, "0")}
                </output>
                <button
                  type="button"
                  className="dtp-spn-btn"
                  aria-label="Decrease hour"
                  onClick={() => setSelHour((h) => (h + 23) % 24)}
                >
                  ▼
                </button>
              </div>
              <span className="dtp-colon" aria-hidden="true">
                :
              </span>
              <div className="dtp-spin" aria-label="Minute (1-min steps)">
                <button
                  type="button"
                  className="dtp-spn-btn"
                  aria-label="Increase minute"
                  onClick={() => setSelMin((m) => (m + 1) % 60)}
                >
                  ▲
                </button>
                <output className="dtp-spn-val" aria-live="polite">
                  {String(selMin).padStart(2, "0")}
                </output>
                <button
                  type="button"
                  className="dtp-spn-btn"
                  aria-label="Decrease minute"
                  onClick={() => setSelMin((m) => (m + 59) % 60)}
                >
                  ▼
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="dtp-footer">
            <button
              type="button"
              className="dtp-cancel"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="dtp-confirm"
              onClick={handleConfirm}
              disabled={!selDay}
            >
              {selDay ? "Confirm" : "Pick a day first"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
