import {Modal} from "@heroui/react";
import {posthog} from "posthog-js";
import {toast} from "sonner";
import {z} from "zod";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

/** The PostHog survey (type "API", one open-text question) that collects bug reports, if any. */
const BUG_SURVEY_NAME = "Bug report";

/**
 * Files a bug report in PostHog: always as a `bug_reported` event (with the page and, through
 * PostHog, the session and its replay), and as a response to the "Bug report" survey when the
 * project has one, so reports also show up in its responses.
 */
function reportBug(description: string) {
  const properties = {description, path: window.location.pathname};
  posthog.capture("bug_reported", properties);
  posthog.getSurveys(surveys => {
    const survey = surveys.find(s => s.name === BUG_SURVEY_NAME);
    const question = survey?.questions[0];
    if (!survey || !question?.id) return;
    posthog.capture("survey sent", {
      $survey_id: survey.id,
      [`$survey_response_${question.id}`]: description,
      path: properties.path,
    });
  });
}

export function BugReportDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const form = useAppForm({
    defaultValues: {description: ""},
    onSubmit: ({value}) => {
      reportBug(value.description.trim());
      toast.success("Thanks! Bug report sent.");
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <ControlledModal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Report a bug</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form.AppForm>
              <form.Form>
                <form.AppField
                  name="description"
                  validators={{onSubmit: z.string().trim().min(1, "Tell us what went wrong.")}}
                  children={field => (
                    <field.TextareaField
                      variant="secondary"
                      label="What went wrong?"
                      description="What you did, what you expected, and what happened instead. We'll see which page you were on."
                      autoFocus
                      autoComplete="off"
                    />
                  )}
                />
              </form.Form>
            </form.AppForm>
          </Modal.Body>
          <Modal.Footer>
            <form.AppForm>
              <form.SubmitButton>Send</form.SubmitButton>
            </form.AppForm>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
