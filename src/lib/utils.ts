import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DEBUG_ENABLED = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

export function debugLog(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
}

export function debugError(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    console.error(...args);
  }
}