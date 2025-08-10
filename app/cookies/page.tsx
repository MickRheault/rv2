export default function CookiesPage() {
  return (
    <div className="container-custom py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Cookie Policy</h1>

        <div className="space-y-8">
          <section className="card p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Overview</h2>
            <p className="text-gray-700">
              We use cookies and similar technologies to ensure our website functions properly, to analyze
              traffic, and to improve your experience. You can manage your preferences at any time using the
              cookie banner that appears on first visit or the preferences dialog.
            </p>
          </section>

          <section className="card p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Types of cookies we use</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>
                <span className="font-medium">Functional (Required):</span> Necessary for core site functionality.
                These are always enabled.
              </li>
              <li>
                <span className="font-medium">Analytics (Optional):</span> Help us understand how visitors interact
                with our site so we can improve performance and content.
              </li>
              <li>
                <span className="font-medium">Marketing (Optional):</span> Used to personalize content and measure
                the effectiveness of campaigns.
              </li>
            </ul>
          </section>

          <section className="card p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Your choices</h2>
            <p className="text-gray-700 mb-3">
              On your first visit, you can accept all cookies, decline optional cookies, or set granular
              preferences. Functional cookies cannot be disabled as they are required for the site to work.
            </p>
            <p className="text-gray-700">
              You can change your preferences at any time by reopening the cookie preferences from the banner
              when it is shown again (e.g., after clearing your browser storage) or by contacting us.
            </p>
          </section>

          <section className="card p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data retention</h2>
            <p className="text-gray-700">
              Your consent preferences are stored locally in your browser along with a timestamp and version so we
              can honor your choices and prompt you again if our policy changes.
            </p>
          </section>

          <section className="card p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
            <p className="text-gray-700">
              If you have questions about our use of cookies, please reach out via the Contact page.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}