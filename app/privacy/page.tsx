export default function PrivacyPage() {
  return (
    <div className="container-custom py-12">
      <div className="max-w-4xl mx-auto prose prose-lg">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Privacy Policy
        </h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <p className="text-blue-800 mb-0">
            <strong>Last updated:</strong> {new Date().toLocaleDateString()}
            <br />
            This is a basic privacy policy template. Please consult with legal professionals 
            for a complete privacy policy that meets your jurisdiction's requirements.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Information We Collect
            </h2>
            <p className="text-gray-700">
              We collect information you provide directly to us, such as when you create an account, 
              contact us, or use our services. This may include your name, email address, phone number, 
              and preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Cookies and Tracking Technologies
            </h2>
            <p className="text-gray-700 mb-4">
              We use cookies and similar tracking technologies to provide and improve our services:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>Functional Cookies:</strong> Essential for the website to function properly, 
                including user authentication and basic site functionality.
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Help us understand how visitors interact with our 
                website by collecting information anonymously via Google Analytics.
              </li>
              <li>
                <strong>Marketing Cookies:</strong> Used to track visitors across websites to display 
                relevant advertisements and marketing campaigns.
              </li>
            </ul>
            <p className="text-gray-700 mt-4">
              You can control cookie preferences through our cookie consent banner or your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Google Analytics
            </h2>
            <p className="text-gray-700">
              We use Google Analytics to analyze website traffic and usage patterns. Google Analytics 
              uses cookies to collect information about your use of our website. The information 
              collected is typically anonymous and includes pages visited, time spent on pages, and 
              traffic sources. You can opt out of Google Analytics by using the cookie preferences 
              or by installing the Google Analytics opt-out browser add-on.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              How We Use Your Information
            </h2>
            <p className="text-gray-700">
              We use the information we collect to provide, maintain, and improve our services, 
              communicate with you, and analyze usage patterns to enhance user experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Data Security
            </h2>
            <p className="text-gray-700">
              We implement appropriate security measures to protect your personal information against 
              unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Your Rights
            </h2>
            <p className="text-gray-700">
              You have the right to access, update, or delete your personal information. 
              You can also opt out of certain communications and adjust your cookie preferences 
              at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Contact Us
            </h2>
            <p className="text-gray-700">
              If you have any questions about this Privacy Policy, please contact us at our 
              contact page or email us directly.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
} 