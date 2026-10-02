import {
  Autocomplete,
  Button,
  Checkbox,
  Description,
  EmptyState,
  FieldError,
  Input,
  InputGroup,
  type Key,
  Label,
  ListBox,
  SearchField,
  Select,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  useFilter,
} from "@heroui/react";
import {createFormHook, createFormHookContexts} from "@tanstack/react-form";
import {EyeIcon, EyeOffIcon} from "lucide-react";
import React, {useState} from "react";
import {cn} from "tailwind-variants";

const {fieldContext, formContext, useFieldContext, useFormContext} = createFormHookContexts();

function InputGroupInputField(props: React.ComponentProps<typeof InputGroup.Input>) {
  const field = useFieldContext<string>();
  return (
    <InputGroup.Input
      value={field.state.value}
      onChange={e => field.handleChange(e.target.value)}
      onBlur={() => field.handleBlur()}
      {...props}
    />
  );
}

function InputGroupTextareaField(props: React.ComponentProps<typeof InputGroup.TextArea>) {
  const field = useFieldContext<string>();
  return (
    <InputGroup.TextArea
      value={field.state.value}
      onChange={e => field.handleChange(e.target.value)}
      onBlur={() => field.handleBlur()}
      {...props}
    />
  );
}

// `variant="secondary"` is HeroUI's lower-emphasis field style for fields placed on a surface
// (Card, Surface, Modal, Popover, ...); the default "primary" is for the page background.
type FieldVariant = "primary" | "secondary";

/** A password input with an eye button to reveal or hide it (hidden by default). */
function PasswordField({
  label,
  description,
  variant,
  ...props
}: {
  label?: string;
  description?: React.ReactNode | string;
  variant?: React.ComponentProps<typeof TextField>["variant"];
} & Omit<React.ComponentProps<typeof InputGroup.Input>, "type">) {
  const field = useFieldContext<string>();
  const [isVisible, setIsVisible] = useState(false);
  return (
    <TextField
      variant={variant}
      isInvalid={field.state.meta.errors.length > 0}
      value={field.state.value}
      onChange={value => field.handleChange(value)}
      onBlur={() => field.handleBlur()}>
      {label && <Label>{label}</Label>}
      <InputGroup>
        <InputGroup.Input {...props} type={isVisible ? "text" : "password"} />
        <InputGroup.Suffix className="pe-0">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={isVisible ? "Hide password" : "Show password"}
            onPress={() => setIsVisible(visible => !visible)}>
            {isVisible ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{field.state.meta.errors.map(error => error?.message).join(", ")}</FieldError>
    </TextField>
  );
}

function FormTextField({
  label,
  description,
  variant,
  fullWidth,
  ...props
}: {label?: string; description?: React.ReactNode | string} & React.ComponentProps<typeof Input>) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.errors.length > 0;
  return (
    <TextField
      variant={variant}
      fullWidth={fullWidth}
      isInvalid={isInvalid}
      value={field.state.value}
      onChange={value => field.handleChange(value)}
      onBlur={() => field.handleBlur()}>
      {label && <Label>{label}</Label>}
      <Input fullWidth={fullWidth} {...props} />
      {description && <Description>{description}</Description>}
      <FieldError>{field.state.meta.errors.map(error => error?.message).join(", ")}</FieldError>
    </TextField>
  );
}

function TextareaField({
  label,
  description,
  variant,
  ...props
}: {label?: string; description?: React.ReactNode | string} & React.ComponentProps<
  typeof TextArea
>) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.errors.length > 0;
  return (
    <TextField
      variant={variant}
      isInvalid={isInvalid}
      value={field.state.value}
      onChange={value => field.handleChange(value)}
      onBlur={() => field.handleBlur()}>
      {label && <Label>{label}</Label>}
      <TextArea {...props} />
      {description && <Description>{description}</Description>}
      <FieldError>{field.state.meta.errors.map(error => error?.message).join(", ")}</FieldError>
    </TextField>
  );
}

function CheckboxField({
  label,
  description,
  ...props
}: {label: string; description?: string} & Omit<
  React.ComponentProps<typeof Checkbox>,
  "children"
>) {
  const field = useFieldContext<boolean>();
  const isInvalid = field.state.meta.errors.length > 0;
  return (
    <Checkbox
      isInvalid={isInvalid}
      isSelected={field.state.value}
      onChange={checked => field.handleChange(checked)}
      onBlur={() => field.handleBlur()}
      {...props}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {label}
      </Checkbox.Content>
      {description && <Description>{description}</Description>}
      <FieldError>{field.state.meta.errors.map(error => error?.message).join(", ")}</FieldError>
    </Checkbox>
  );
}

function SelectField({
  label,
  description,
  children,
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  items,
  ...props
}: Omit<React.ComponentProps<typeof Select>, "value" | "onChange" | "items" | "children"> & {
  label?: string;
  description?: string;
  className?: string;
  items?: unknown;
  children?: React.ReactNode;
}) {
  const field = useFieldContext<string>();
  return (
    <Select
      value={field.state.value}
      onChange={value => field.handleChange(String(value ?? ""))}
      onBlur={() => field.handleBlur()}
      {...props}>
      {label && <Label>{label}</Label>}
      <Select.Trigger className={className}>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {description && <Description>{description}</Description>}
      <Select.Popover>
        <ListBox>{children}</ListBox>
      </Select.Popover>
    </Select>
  );
}

function ComboboxMultipleField({
  label,
  items,
  className,
  variant,
  defaultOpen,
  onOpenChange,
}: {
  label?: string;
  items: string[];
  className?: string;
  variant?: FieldVariant;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const field = useFieldContext<string[]>();
  const {contains} = useFilter({sensitivity: "base"});
  const onRemoveTags = (keys: Set<Key>) =>
    field.handleChange(field.state.value.filter(value => !keys.has(value)));
  return (
    <Autocomplete
      variant={variant}
      selectionMode="multiple"
      placeholder="Select tags"
      aria-label={label ? undefined : "Tags"}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      value={field.state.value}
      onChange={value => field.handleChange(Array.isArray(value) ? value.map(String) : [])}
      onBlur={() => field.handleBlur()}>
      {label && <Label>{label}</Label>}
      <Autocomplete.Trigger className={className}>
        <Autocomplete.Value>
          {({defaultChildren, isPlaceholder, state}) => {
            if (isPlaceholder || state.selectedItems.length === 0) {
              return defaultChildren;
            }
            return (
              <TagGroup size="sm" aria-label="Selected tags" onRemove={onRemoveTags}>
                <TagGroup.List>
                  {state.selectedItems.map(item => (
                    <Tag key={item.key} id={item.key}>
                      {item.textValue}
                    </Tag>
                  ))}
                </TagGroup.List>
              </TagGroup>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="Search tags" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search tags..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No tags found</EmptyState>}>
            {items.map(item => (
              <ListBox.Item key={item} id={item} textValue={item}>
                {item}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

function SubmitButton({children, ...props}: React.ComponentProps<typeof Button>) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => (
        <Button
          type="submit"
          isPending={isSubmitting}
          isDisabled={isSubmitting}
          form={form.formId}
          {...props}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

// HeroUI's form layout (Form/Fieldset docs): a column of fields `gap-4` apart.
function Form({className, ...props}: React.ComponentPropsWithRef<"form">) {
  const form = useFormContext();
  return (
    <form
      id={form.formId}
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

const {useAppForm} = createFormHook({
  fieldComponents: {
    InputGroupInputField,
    InputGroupTextareaField,
    TextField: FormTextField,
    PasswordField,
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
