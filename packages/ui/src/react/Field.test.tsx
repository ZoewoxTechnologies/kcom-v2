import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox, Fieldset, Radio, SelectField, TextField, TextareaField } from "./Field";

describe("control size", () => {
  it("defaults to md and adds a modifier class for other sizes", () => {
    expect(renderToStaticMarkup(<TextField label="A" />)).toContain('class="kc-input"');
    expect(renderToStaticMarkup(<TextField label="A" size="sm" />)).toContain("kc-input--sm");
    expect(
      renderToStaticMarkup(
        <SelectField label="A" size="lg">
          <option>x</option>
        </SelectField>,
      ),
    ).toContain("kc-select__control--lg");
  });
});

describe("TextField", () => {
  it("associates the label with the input", () => {
    const html = renderToStaticMarkup(<TextField label="Name" />);
    const id = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });

  it("renders an intro above the input and links it first in aria-describedby", () => {
    const html = renderToStaticMarkup(
      <TextField label="Verse" intro="Read this first" help="After" />,
    );
    const introId = /<p id="([^"]+)"[^>]*>Read this first/.exec(html)?.[1];
    expect(introId).toBeTruthy();
    expect(html.indexOf("Read this first")).toBeLessThan(html.indexOf("<input"));
    expect(html).toMatch(new RegExp(`aria-describedby="${introId} [^"]+"`));
  });

  it("links help and error through aria-describedby and flags invalid", () => {
    const html = renderToStaticMarkup(
      <TextField label="Email" help="We never share it" error="Enter a full email" />,
    );
    expect(html).toContain('aria-invalid="true"');
    const described = (/aria-describedby="([^"]+)"/.exec(html)?.[1] ?? "").split(" ");
    expect(described).toHaveLength(2);
    for (const id of described) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('role="alert"');
  });

  it("omits aria attributes when there is nothing to describe", () => {
    const html = renderToStaticMarkup(<TextField label="Name" />);
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("aria-invalid");
  });

  it("marks required and optional fields", () => {
    expect(renderToStaticMarkup(<TextField label="Name" required />)).toContain(
      'aria-required="true"',
    );
    expect(renderToStaticMarkup(<TextField label="Phone" optional />)).toContain("(optional)");
  });
});

describe("other controls", () => {
  it("renders textarea and select with their classes", () => {
    expect(renderToStaticMarkup(<TextareaField label="Message" />)).toContain("kc-textarea");
    const select = renderToStaticMarkup(
      <SelectField label="Topic">
        <option>One</option>
      </SelectField>,
    );
    expect(select).toContain("kc-select__control");
  });

  it("renders checkbox and radio inside their label", () => {
    expect(renderToStaticMarkup(<Checkbox label="Keep private" />)).toContain('type="checkbox"');
    expect(renderToStaticMarkup(<Radio label="Other" name="t" pill />)).toContain(
      "kc-choice--pill",
    );
  });

  it("describes a fieldset by its error", () => {
    const html = renderToStaticMarkup(
      <Fieldset legend="Topic" error="Pick one">
        <Radio label="A" name="t" />
      </Fieldset>,
    );
    expect(html).toMatch(/<fieldset[^>]*aria-describedby=/);
    expect(html).toContain("Pick one");
  });
});
