import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Banner } from "./Banner";
import type { BannerVariant } from "./Banner";

const cases: [BannerVariant, string, string][] = [
  ["warning", "status", "Warning"],
  ["info", "status", "Information"],
  ["success", "status", "Success"],
  ["danger", "alert", "Error"],
];

describe("Banner", () => {
  it("defaults to the warning variant", () => {
    render(<Banner>Careful</Banner>);
    const el = screen.getByRole("status");
    expect(el).toHaveClass("kc-banner--warning");
  });

  it.each(cases)("%s uses role %s and a hidden label", (variant, role, name) => {
    render(<Banner variant={variant}>Message</Banner>);
    const el = screen.getByRole(role);
    expect(el).toHaveClass(`kc-banner--${variant}`);
    const hidden = el.querySelector(".kc-visually-hidden");
    expect(hidden).toHaveTextContent(name);
    expect(el.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveTextContent("Message");
  });

  it("renders the action after the message", () => {
    render(
      <Banner action={<button className="kc-btn kc-btn--tertiary">Retry</button>}>Oops</Banner>,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
