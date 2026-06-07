"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { parseDeadlineMs } from "@/lib/deadline";

interface CountdownTimerProps {
  deadline: string | null;
  onExpired?: () => void;
  className?: string;
}

export function CountdownTimer({
  deadline,
  onExpired,
  className,
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) return;

    const calc = () => {
      const deadlineMs = parseDeadlineMs(deadline);
      if (Number.isNaN(deadlineMs)) return;
      const diff = Math.max(
        0,
        Math.floor((deadlineMs - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
      if (diff === 0) onExpired?.();
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  if (secondsLeft === null || !deadline) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const urgent = secondsLeft < 10;

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[15px] font-medium leading-none tabular-nums",
        urgent ? "text-arena-danger animate-pulse" : "text-arena-accent",
        className,
      )}
    >
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      {secondsLeft === 0 ? "Deadline passed" : display}
    </div>
  );
}
