import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom lacks scrollTo; some components may call it.
if (typeof window !== "undefined" && !window.scrollTo) {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
}
