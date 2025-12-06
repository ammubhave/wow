import {createFormHook, createFormHookContexts} from "@tanstack/react-form";
import React, {useId} from "react";

import {Button} from "./ui/button";
import {Checkbox} from "./ui/checkbox";
import {Field, FieldContent, FieldDescription, FieldError, FieldLabel} from "./ui/field";
import {Input} from "./ui/input";
import {Select, SelectContent, SelectTrigger, SelectValue} from "./ui/select";
import {Textarea} from "./ui/textarea";

const {fieldContext, formContext, useFieldContext, useFormContext} = createFormHookContexts();

function TextField({
  label,
  description,
  ...props
}: {label?: string; description?: string} & React.ComponentProps<typeof Input>) {
  const field = useFieldContext<string>();
  return (
    <Field>
      {label && <FieldLabel>{label}</FieldLabel>}
      <Input
        value={field.state.value}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={() => field.handleBlur()}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={field.state.meta.errors} />
    </Field>
  );
}

function TextareaField({
  label,
  description,
  ...props
}: {label: string; description?: string} & React.ComponentProps<"textarea">) {
  const field = useFieldContext<string>();
  return (
    <Field>
      <FieldLabel htmlFor="name">{label}</FieldLabel>
      <Textarea
        value={field.state.value}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={() => field.handleBlur()}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={field.state.meta.errors} />
    </Field>
  );
}

function CheckboxField({
  label,
  description,
  ...props
}: {label: string; description?: string} & React.ComponentProps<typeof Checkbox>) {
  const field = useFieldContext<boolean>();
  const id = useId();
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={field.state.value}
        onCheckedChange={checked => field.handleChange(!!checked)}
        onBlur={() => field.handleBlur()}
        {...props}
      />
      <FieldContent>
        <FieldLabel htmlFor={props.id ?? id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        <FieldError errors={field.state.meta.errors} />
      </FieldContent>
    </Field>
  );
}

function SelectField({
  label,
  description,
  children,
  placeholder,
  onBlur,
  className,
  ...props
}: React.ComponentProps<typeof Select> & {label: string; description?: string} & Pick<
    React.ComponentProps<typeof SelectValue>,
    "onBlur" | "placeholder" | "className"
  >) {
  const field = useFieldContext<string>();
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select {...props} onValueChange={field.handleChange} defaultValue={field.state.value}>
        <SelectTrigger>
          <SelectValue
            placeholder={placeholder}
            onBlur={e => (onBlur ?? field.handleBlur)(e)}
            className={className}
          />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}

function SubmitButton({children}: React.ComponentProps<typeof Button>) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => (
        <Button type="submit" disabled={isSubmitting}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

const {useAppForm} = createFormHook({
  fieldComponents: {TextField, TextareaField, CheckboxField, SelectField},
  formComponents: {SubmitButton},
  fieldContext,
  formContext,
});

export {useAppForm};
