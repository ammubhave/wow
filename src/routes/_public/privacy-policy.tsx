import {createFileRoute} from "@tanstack/react-router";

import {LegalPage} from "@/components/legal-page";

export const Route = createFileRoute("/_public/privacy-policy")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Privacy Policy | WOW"}]}),
});

function RouteComponent() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="September 5, 2024">
      <p>
        Welcome to Wafflehaüs Organized Workspaces ("WOW"). Your privacy is of utmost importance to
        us. This Privacy Policy outlines how we collect, use, and protect your information when you
        interact with our website and services.
      </p>

      <h2 id="information-we-collect">1. Information We Collect</h2>
      <div>
        We collect information in the following ways:
        <ul>
          <li>
            <strong>Personal Information:</strong> Information you provide directly, such as your
            name, email address, phone number, or payment information when creating an account or
            making purchases.
          </li>
          <li>
            <strong>Usage Information:</strong> Data on how you interact with our website, including
            IP address, browser type, and pages visited, using cookies and other tracking
            technologies.
          </li>
          <li>
            <strong>Third-Party Data:</strong> Information from third-party services, such as
            payment processors, to facilitate transactions.
          </li>
        </ul>
      </div>

      <h2 id="how-we-use-your-information">2. How We Use Your Information</h2>
      <div>
        We use the collected information to:
        <ul>
          <li>Provide, operate, and maintain our website and services.</li>
          <li>Process transactions and manage accounts.</li>
          <li>Improve and personalize your experience on WOW.</li>
          <li>Communicate with you regarding updates, offers, and other news related to WOW.</li>
          <li>Ensure legal compliance and protect against fraud.</li>
        </ul>
      </div>

      <h2 id="sharing-of-information">3. Sharing of Information</h2>
      <div>
        We do not share your personal information with third parties except in the following cases:
        <ul>
          <li>With your consent.</li>
          <li>
            To third-party service providers who help us run our business, such as payment
            processors and hosting services.
          </li>
          <li>
            As required by law, to comply with legal obligations, or in response to lawful requests
            by public authorities.
          </li>
          <li>In the event of a merger, acquisition, or sale of all or a portion of our assets.</li>
        </ul>
      </div>

      <h2 id="data-security">4. Data Security</h2>
      <p>
        We take appropriate measures to protect your personal data from unauthorized access,
        disclosure, alteration, and destruction. However, no method of transmission over the
        Internet is 100% secure, so we cannot guarantee absolute security.
      </p>

      <h2 id="your-rights">5. Your Rights</h2>
      <p>
        Depending on your location, you may have certain rights regarding your personal data,
        including the right to access, correct, or delete your information. You can contact us at{" "}
        <span>contact@wafflehaus.io</span> to exercise your rights.
      </p>

      <h2 id="cookies">6. Cookies</h2>
      <p>
        WOW uses cookies and similar technologies to enhance your experience. You can manage your
        cookie preferences through your browser settings. Disabling cookies may affect the
        functionality of our website.
      </p>

      <h2 id="changes-to-this-privacy-policy">7. Changes to this Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any changes by
        posting the updated policy on our website and updating the effective date.
      </p>

      <h2 id="contact-us">8. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy or our data practices, please contact us
        at:
        <br />
        <span>Email:</span> contact@wafflehaus.io
      </p>
    </LegalPage>
  );
}
