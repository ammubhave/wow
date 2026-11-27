import {
  Autocomplete,
  Button,
  Checkbox,
  ComboBox,
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
import {CheckIcon, EyeIcon, EyeOffIcon} from "lucide-react";
import React, {useState} from "react";
import {cn} from "tailwind-variants";

import {IconButton} from "@/components/icon-button";

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
  isRequired,
  ...props
}: {
  label?: string;
  description?: React.ReactNode | string;
  variant?: React.ComponentProps<typeof TextField>["variant"];
  isRequired?: boolean;
} & Omit<React.ComponentProps<typeof InputGroup.Input>, "type">) {
  const field = useFieldContext<string>();
  const [isVisible, setIsVisible] = useState(false);
  return (
    <TextField
      variant={variant}
      isRequired={isRequired}
      isInvalid={field.state.meta.errors.length > 0}
      value={field.state.value}
      onChange={value => field.handleChange(value)}
      onBlur={() => field.handleBlur()}>
      {label && <Label>{label}</Label>}
      <InputGroup>
        <InputGroup.Input {...props} type={isVisible ? "text" : "password"} />
        <InputGroup.Suffix className="pe-0">
          <IconButton
            size="sm"
            variant="ghost"
            label={isVisible ? "Hide password" : "Show password"}
            onPress={() => setIsVisible(visible => !visible)}>
            {isVisible ? <EyeOffIcon /> : <EyeIcon />}
          </IconButton>
        </InputGroup.Suffix>
      </InputGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{field.state.meta.errors.map(error => error?.message).join(", ")}</FieldError>
    </TextField>
  );
}

/** "ecph.site/x" → "https://ecph.site/x"; anything with a scheme, or empty, is left alone. */
export function withHttps(value: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    /^[a-z][a-z\d+.-]*:/i.test(trimmed) ||
    !trimmed.includes(".") ||
    /\s/.test(trimmed)
  ) {
    return value;
  }
  return `https://${trimmed}`;
}

function FormTextField({
  label,
  description,
  variant,
  fullWidth,
  isDisabled,
  isRequired,
  ...props
}: {
  label?: string;
  description?: React.ReactNode | string;
  /** Can't be changed (shown dimmed); unlike readOnly, it doesn't look editable. */
  isDisabled?: boolean;
  /** Must be filled in: the label gets the required mark, and the form won't submit without it. */
  isRequired?: boolean;
} & React.ComponentProps<typeof Input>) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.errors.length > 0;
  // Web addresses: people paste "ecph.site/puzzles/x" without the https://. Add it (on leaving the
  // field, or Enter) rather than letting the browser's own URL check silently block the form.
  const isUrl = props.type === "url";
  const addScheme = () => {
    const fixed = withHttps(field.state.value);
    if (fixed !== field.state.value) field.handleChange(fixed);
  };
  return (
    <TextField
      variant={variant}
      fullWidth={fullWidth}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={isInvalid}
      value={field.state.value}
      onChange={value => field.handleChange(value)}
      onBlur={() => {
        if (isUrl) addScheme();
        field.handleBlur();
      }}>
      {label && <Label>{label}</Label>}
      <Input
        fullWidth={fullWidth}
        {...props}
        {...(isUrl && {
          type: "text",
          inputMode: "url",
          onKeyDown: event => {
            if (event.key === "Enter") addScheme();
            props.onKeyDown?.(event);
          },
        })}
      />
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

/** A suggestion for a SuggestField: its text, and an optional detail line under it. */
export type Suggestion = {id: string; text: string; detail?: string};

/**
 * A text field that suggests known values as you type (picking one fills it in), but takes
 * anything: the suggestions are a shortcut, not a list to choose from.
 */
function SuggestField({
  label,
  description,
  variant,
  placeholder,
  suggestions,
  isReadOnly,
  isDisabled,
  isRequired,
  onPick,
}: {
  label?: string;
  description?: React.ReactNode | string;
  variant?: FieldVariant;
  placeholder?: string;
  suggestions: Suggestion[];
  isReadOnly?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  /** A suggestion was picked (its id), or the text was typed instead (null). */
  onPick?: (id: string | null) => void;
}) {
  const field = useFieldContext<string>();
  const {contains} = useFilter({sensitivity: "base"});
  return (
    <ComboBox
      allowsCustomValue
      menuTrigger="input"
      variant={variant}
      isReadOnly={isReadOnly}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={field.state.meta.errors.length > 0}
      inputValue={field.state.value}
      onInputChange={value => field.handleChange(value)}
      onSelectionChange={key => onPick?.(key === null ? null : String(key))}
      onBlur={() => field.handleBlur()}
      items={suggestions.filter(suggestion => contains(suggestion.text, field.state.value))}>
      {label && <Label>{label}</Label>}
      {/* HeroUI's InputGroup expects the Trigger last: without it, its internal slot prop lands
          on the Input (a React warning, and no group styling). The chevron opens the suggestions. */}
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{field.state.meta.errors.map(error => error?.message).join(", ")}</FieldError>
      <ComboBox.Popover>
        <ListBox>
          {(suggestion: Suggestion) => (
            <ListBox.Item id={suggestion.id} textValue={suggestion.text}>
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{suggestion.text}</span>
                {suggestion.detail && (
                  <span className="text-muted truncate text-xs">{suggestion.detail}</span>
                )}
              </div>
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

function SubmitButton({
  children,
  savesChanges,
  ...props
}: React.ComponentProps<typeof Button> & {
  /**
   * For forms that edit something already saved (settings): disabled until there's a change, and
   * "Saved" once the change is saved, until the next edit. The form must reset to the saved values
   * after submitting (form.reset(value)), which is what marks it saved.
   */
  savesChanges?: boolean;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => [state.isSubmitting, state.isDirty] as const}>
      {([isSubmitting, isDirty]) =>
        savesChanges ? (
          <SaveChangesButton
            isSubmitting={isSubmitting}
            isDirty={isDirty}
            formId={form.formId}
            {...props}>
            {children}
          </SaveChangesButton>
        ) : (
          <Button
            type="submit"
            isPending={isSubmitting}
            isDisabled={isSubmitting}
            form={form.formId}
            {...props}>
            {children}
          </Button>
        )
      }
    </form.Subscribe>
  );
}

function SaveChangesButton({
  isSubmitting,
  isDirty,
  formId,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  isSubmitting: boolean;
  isDirty: boolean;
  formId: string;
}) {
  // Changed, then clean again: that's the reset after a save (editing back by hand stays dirty).
  const [justSaved, setJustSaved] = useState(false);
  const [wasDirty, setWasDirty] = useState(isDirty);
  if (wasDirty !== isDirty) {
    setWasDirty(isDirty);
    setJustSaved(wasDirty && !isDirty);
  }
  return (
    <Button
      type="submit"
      isPending={isSubmitting}
      isDisabled={isSubmitting || !isDirty}
      form={formId}
      {...props}
      // Nothing to save: a quiet button, so a page of forms has no bright Saves until one's needed.
      variant={isDirty || isSubmitting ? props.variant : "secondary"}>
      {justSaved && !isDirty ? (
        <>
          <CheckIcon />
          Saved
        </>
      ) : (
        children
      )}
    </Button>
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
    SuggestField,
  },
  formComponents: {SubmitButton, Form},
  fieldContext,
  formContext,
});

export {useAppForm};
