import {createFileRoute} from "@tanstack/react-router";

import {LegalPage} from "@/components/legal-page";

export const Route = createFileRoute("/_public/tos")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Terms of Service | WOW"}]}),
});

function RouteComponent() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="September 5, 2024">
      <p>
        Welcome to Wafflehaüs Organized Workspaces ("WOW"). By accessing or using our services, you
        agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms,
        you may not access or use our services.
      </p>

      <h2 id="use-of-our-services">1. Use of Our Services</h2>
      <div>
        You agree to use WOW's services only for lawful purposes and in accordance with these Terms.
        You must not use our services:
        <ul>
          <li>In any way that violates any applicable law or regulation.</li>
          <li>To send unsolicited or unauthorized advertising or promotional material.</li>
          <li>
            To impersonate or attempt to impersonate WOW, a WOW employee, or any other person or
            entity.
          </li>
          <li>
            To engage in any other conduct that restricts or inhibits anyone’s use or enjoyment of
            our services, or which, as determined by us, may harm WOW or users of our services.
          </li>
        </ul>
      </div>

      <h2 id="account-registration">2. Account Registration</h2>
      <p>
        To access certain features of WOW, you may be required to create an account. You agree to
        provide accurate, current, and complete information during the registration process and to
        update such information to keep it accurate, current, and complete. You are responsible for
        maintaining the confidentiality of your account and password and for restricting access to
        your computer. You agree to accept responsibility for all activities that occur under your
        account.
      </p>

      <h2 id="payment-and-subscription">3. Payment and Subscription</h2>
      <p>
        Some services provided by WOW may require payment. By subscribing to any of our paid
        services, you agree to pay all fees and applicable taxes associated with your use of such
        services. Failure to pay these fees may result in the termination of your access to the paid
        services.
      </p>

      <h2 id="intellectual-property">4. Intellectual Property</h2>
      <p>
        The content, features, and functionality on WOW are the exclusive property of Wafflehaüs
        Organized Workspace and its licensors. You agree not to reproduce, distribute, modify,
        create derivative works of, publicly display, publicly perform, republish, download, store,
        or transmit any of the material on our services, except as permitted by these Terms.
      </p>

      <h2 id="termination">5. Termination</h2>
      <p>
        We may terminate or suspend your account and access to our services at our sole discretion,
        without prior notice or liability, for any reason, including if you breach these Terms. Upon
        termination, your right to use the services will cease immediately.
      </p>

      <h2 id="limitation-of-liability">6. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, in no event will WOW, its affiliates, or their
        licensors, service providers, employees, agents, officers, or directors be liable for
        damages of any kind arising out of or in connection with your use, or inability to use, our
        services, including any direct, indirect, incidental, consequential, or punitive damages.
      </p>

      <h2 id="governing-law">7. Governing Law</h2>
      <p>
        These Terms are governed by and construed in accordance with the laws of the United States,
        without regard to its conflict of law principles. You agree to submit to the personal
        jurisdiction of the courts located within the United States for the purpose of litigating
        any disputes related to your use of WOW.
      </p>

      <h2 id="changes-to-the-terms">8. Changes to the Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of any changes by posting
        the new Terms on this page and updating the effective date. Your continued use of our
        services after the changes take effect will constitute your acceptance of the revised Terms.
      </p>

      <h2 id="contact-us">9. Contact Us</h2>
      <p>
        If you have any questions about these Terms, please contact us at:
        <br />
        <span>Email:</span> contact@wafflehaus.io
      </p>
    </LegalPage>
  );
}
