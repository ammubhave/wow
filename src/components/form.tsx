import {createFormHook, createFormHookContexts} from "@tanstack/react-form";
import React, {useId} from "react";

import {Button} from "./ui/button";
import {Checkbox} from "./ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "./ui/combobox";
import {Field, FieldContent, FieldDescription, FieldError, FieldLabel} from "./ui/field";
import {Input} from "./ui/input";
import {InputGroupInput} from "./ui/input-group";
import {Select, SelectContent, SelectTrigger, SelectValue} from "./ui/select";
import {Textarea} from "./ui/textarea";

const {fieldContext, formContext, useFieldContext, useFormContext} = createFormHookContexts();

function InputGroupInputField(props: React.ComponentProps<typeof InputGroupInput>) {
  const field = useFieldContext<string>();
  return (
    <InputGroupInput
      value={field.state.value}
      onChange={e => field.handleChange(e.target.value)}
      onBlur={() => field.handleBlur()}
      {...props}
    />
  );
}

function TextField({
  label,
  description,
  ...props
}: {label?: string; description?: React.ReactNode | string} & React.ComponentProps<typeof Input>) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.errors.length > 0;
  return (
    <Field data-invalid={isInvalid}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <Input
        value={field.state.value}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={() => field.handleBlur()}
        aria-invalid={isInvalid}
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
  const isInvalid = field.state.meta.errors.length > 0;
  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor="name">{label}</FieldLabel>
      <Textarea
        value={field.state.value}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={() => field.handleBlur()}
        aria-invalid={isInvalid}
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
  className,
  ...props
}: React.ComponentProps<typeof Select> & {label?: string; description?: string} & Pick<
    React.ComponentProps<typeof SelectValue>,
    "className"
  >) {
  const field = useFieldContext<unknown>();
  return (
    <Field>
      {label && <FieldLabel>{label}</FieldLabel>}
      <Select onValueChange={field.handleChange} value={field.state.value} {...props}>
        <SelectTrigger className={className}>
          <SelectValue onBlur={field.handleBlur} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}

function ComboboxMultipleField({
  label,
  items,
  className,
}: {label?: string; items: any[]} & Pick<React.ComponentProps<typeof ComboboxChips>, "className">) {
  const anchor = useComboboxAnchor();
  const field = useFieldContext<any[]>();
  return (
    <Field>
      {label && <FieldLabel>{label}</FieldLabel>}
      <Combobox
        multiple
        autoHighlight
        items={items}
        defaultValue={[]}
        value={field.state.value}
        onValueChange={value => field.handleChange(value)}>
        <ComboboxChips ref={anchor} className={className}>
          <ComboboxValue>
            {values => (
              <React.Fragment>
                {values.map((value: string) => (
                  <ComboboxChip key={value}>{value}</ComboboxChip>
                ))}
                <ComboboxChipsInput onBlur={field.handleBlur} />
              </React.Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No items found.</ComboboxEmpty>
          <ComboboxList>
            {item => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function SubmitButton({children}: React.ComponentProps<typeof Button>) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => (
        <Button type="submit" isPending={isSubmitting} disabled={isSubmitting} form={form.formId}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

function Form(props: React.ComponentPropsWithRef<"form">) {
  const form = useFormContext();
  return (
    <form
      id={form.formId}
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      {...props}
    />
  );
}

const {useAppForm} = createFormHook({
  fieldComponents: {
    InputGroupInputField,
    TextField,
    TextareaField,
    CheckboxField,
    SelectField,
    ComboboxMultipleField,
  },
  formComponents: {SubmitButton, Form},
  fieldContext,
  formContext,
});

export {useAppForm};
