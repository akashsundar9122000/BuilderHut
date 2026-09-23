import { describe, expect, it } from "vitest";

import { describePropValue, describeThemeValue, propLabel, themeLabel } from "@/lib/render/labels";
import { INSPECTOR } from "@/lib/render/inspector";
import { ThemeSchema } from "@/lib/schema/theme";
import { REGISTRY } from "@/lib/render/registry";
import type { SectionType } from "@/lib/schema/page";

/*
 * These labels are what a merchant reads when the assistant tells them what it
 * is about to change. A missing one shows them a variable name.
 */
describe("human labels", () => {
  it("names every theme key in every group", () => {
    for (const group of ["colors", "typography", "shape"] as const) {
      for (const key of Object.keys(ThemeSchema.shape[group].shape)) {
        expect(themeLabel(group, key), `${group}.${key}`).not.toBe(key);
      }
    }
  });

  it("takes a section setting's name from its own inspector control", () => {
    for (const type of Object.keys(REGISTRY) as SectionType[]) {
      for (const group of INSPECTOR[type]) {
        for (const control of group.controls) {
          expect(propLabel(type, control.prop), `${type}.${control.prop}`).toBe(
            control.label.toLowerCase(),
          );
        }
      }
    }
  });

  it("never returns a camelCase identifier, even for a prop with no control", () => {
    expect(propLabel("hero", "someUnknownProp")).toBe("some unknown prop");
  });

  it("reads a slider at its maximum as what it means", () => {
    expect(describeThemeValue("shape", "buttonRadius", 999)).toBe("fully round");
    expect(describeThemeValue("shape", "radius", 12)).toBe("12px");
  });

  it("prints a font's proper name rather than its id", () => {
    expect(describeThemeValue("typography", "heading", "spacegrotesk")).toBe("Space Grotesk");
  });

  it("prints a select value the way its own control labels it", () => {
    const layout = INSPECTOR.hero.flatMap((g) => g.controls).find((c) => c.prop === "layout");
    if (layout?.kind === "select") {
      const [value, label] = layout.options[0]!;
      expect(describePropValue("hero", "layout", value)).toBe(label);
    }
  });
});
