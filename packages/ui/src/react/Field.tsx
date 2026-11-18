import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

export interface ControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
}

export interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Show an "(optional)" marker. Ignored when required. */
  optional?: boolean;
  className?: string;
  /** Receives the props that tie the control to its label, help and error. */
  children: (control: ControlProps) => ReactNode;
}

/** Label, control, help and error text, wired with label/for, aria-describedby and aria-invalid. */
export function Field({ label, help, error, required, optional, className, children }: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("kc-field", className)}>
      <label className="kc-label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {!required && optional && <span className="kc-field__marker"> (optional)</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {help && (
        <p id={helpId} className="kc-field__help">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="kc-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type FieldChrome = Pick<FieldProps, "label" | "help" | "error" | "optional">;

export type ControlSize = "sm" | "md" | "lg";

export type TextFieldProps = FieldChrome &
  Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: ControlSize };

export function TextField({
  label,
  help,
  error,
  optional,
  className,
  required,
  size = "md",
  ...rest
}: TextFieldProps) {
  return (
    <Field
      label={label}
      help={help}
      error={error}
      optional={optional}
      required={required}
      className={className}
    >
      {(control) => (
        <input
          type="text"
          {...rest}
          {...control}
          required={required}
          className={cx("kc-input", size !== "md" && `kc-input--${size}`)}
        />
      )}
    </Field>
  );
}

export type TextareaFieldProps = FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField({
  label,
  help,
  error,
  optional,
  className,
  required,
  ...rest
}: TextareaFieldProps) {
  return (
    <Field
      label={label}
      help={help}
      error={error}
      optional={optional}
      required={required}
      className={className}
    >
      {(control) => <textarea {...rest} {...control} required={required} className="kc-textarea" />}
    </Field>
  );
}

export type SelectFieldProps = FieldChrome &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: ControlSize };

export function SelectField({
  label,
  help,
  error,
  optional,
  className,
  required,
  size = "md",
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <Field
      label={label}
      help={help}
      error={error}
      optional={optional}
      required={required}
      className={className}
    >
      {(control) => (
        <div className="kc-select">
          <select
            {...rest}
            {...control}
            required={required}
            className={cx("kc-select__control", size !== "md" && `kc-select__control--${size}`)}
          >
            {children}
          </select>
        </div>
      )}
    </Field>
  );
}

export interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  pill?: boolean;
}

export function Checkbox({ label, pill, className, ...rest }: ChoiceProps) {
  return (
    <label className={cx("kc-choice", pill && "kc-choice--pill", className)}>
      <input {...rest} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ label, pill, className, ...rest }: ChoiceProps) {
  return (
    <label className={cx("kc-choice", pill && "kc-choice--pill", className)}>
      <input {...rest} type="radio" />
      <span>{label}</span>
    </label>
  );
}

export interface FieldsetProps {
  legend: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Group of radios or checkboxes with a legend and an announced error. */
export function Fieldset({ legend, help, error, className, children }: FieldsetProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className={cx("kc-fieldset", className)} aria-describedby={describedBy}>
      <legend>{legend}</legend>
      {children}
      {help && (
        <p id={helpId} className="kc-field__help">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="kc-field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
