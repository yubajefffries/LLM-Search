import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GRADE_THRESHOLDS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getGrade(score: number): string {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) return t.grade;
  }
  return "F";
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-emerald-500";
    case "B": return "text-emerald-400";
    case "C": return "text-amber-500";
    case "D": return "text-amber-600";
    default: return "text-red-500";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}
