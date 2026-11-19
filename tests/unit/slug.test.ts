import { describe, it, expect } from "vitest";
import { generateSlug, generateId } from "@/lib/utils/slug";

describe("slug utilities", () => {
  it("generates lowercase URL-safe slugs", () => {
    expect(generateSlug("Hola Mundo! Next.js 16")).toBe("hola-mundo-nextjs-16");
    expect(generateSlug("  Café & Código  ")).toBe("cafe-and-codigo");
  });

  it("generates unique 21-character IDs", () => {
    const a = generateId();
    const b = generateId();
    expect(a).toHaveLength(21);
    expect(b).toHaveLength(21);
    expect(a).not.toBe(b);
  });
});
