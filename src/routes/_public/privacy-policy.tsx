import {createFileRoute} from "@tanstack/react-router";

export const Route = createFileRoute("/_public/privacy-policy")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-lg">
      <h1 className="mb-6 text-4xl font-bold text-gray-800">Privacy Policy</h1>
      <p className="mb-6 text-gray-600">
        Effective Date: <span className="font-semibold">September 5, 2024</span>
      </p>

      <p className="mb-6 text-gray-700">
        Welcome to Wafflehaüs Organized Workspaces ("WOW"). Your privacy is of utmost importance to
        us. This Privacy Policy outlines how we collect, use, and protect your information when you
        interact with our website and services.
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">1. Information We Collect</h2>
      <p className="mb-6 text-gray-700">
        We collect information in the following ways:
        <ul className="ml-6 mt-2 list-disc">
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
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">2. How We Use Your Information</h2>
      <p className="mb-6 text-gray-700">
        We use the collected information to:
        <ul className="ml-6 mt-2 list-disc">
          <li>Provide, operate, and maintain our website and services.</li>
          <li>Process transactions and manage accounts.</li>
          <li>Improve and personalize your experience on WOW.</li>
          <li>Communicate with you regarding updates, offers, and other news related to WOW.</li>
          <li>Ensure legal compliance and protect against fraud.</li>
        </ul>
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">3. Sharing of Information</h2>
      <p className="mb-6 text-gray-700">
        We do not share your personal information with third parties except in the following cases:
        <ul className="ml-6 mt-2 list-disc">
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
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">4. Data Security</h2>
      <p className="mb-6 text-gray-700">
        We take appropriate measures to protect your personal data from unauthorized access,
        disclosure, alteration, and destruction. However, no method of transmission over the
        Internet is 100% secure, so we cannot guarantee absolute security.
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">5. Your Rights</h2>
      <p className="mb-6 text-gray-700">
        Depending on your location, you may have certain rights regarding your personal data,
        including the right to access, correct, or delete your information. You can contact us at{" "}
        <span className="font-semibold">contact@wafflehaus.io</span> to exercise your rights.
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">6. Cookies</h2>
      <p className="mb-6 text-gray-700">
        WOW uses cookies and similar technologies to enhance your experience. You can manage your
        cookie preferences through your browser settings. Disabling cookies may affect the
        functionality of our website.
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">
        7. Changes to this Privacy Policy
      </h2>
      <p className="mb-6 text-gray-700">
        We may update this Privacy Policy from time to time. We will notify you of any changes by
        posting the updated policy on our website and updating the effective date.
      </p>

      <h2 className="mb-4 text-2xl font-semibold text-gray-800">8. Contact Us</h2>
      <p className="mb-6 text-gray-700">
        If you have any questions about this Privacy Policy or our data practices, please contact us
        at:
        <br />
        <span className="font-semibold">Email:</span> contact@wafflehaus.io
      </p>
    </div>
  );
}
