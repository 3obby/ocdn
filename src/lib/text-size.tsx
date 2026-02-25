"use client";

import { createContext, useContext } from "react";

export type TextSize = "lg" | "sm";
export const TextSizeCtx = createContext<TextSize>("sm");
export function useTextSize() {
  return useContext(TextSizeCtx);
}
export function ts(size: TextSize) {
  return size === "lg" ? "text-[24px]" : "text-[14px]";
}
