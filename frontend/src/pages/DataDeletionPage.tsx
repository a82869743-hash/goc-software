import React from 'react';
import PublicLegalLayout from '../components/layout/PublicLegalLayout';
import { Trash2, ShieldCheck, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export default function DataDeletionPage() {
  return (
    <PublicLegalLayout
      title="Facebook Data Deletion Instructions"
      subtitle="How Meta (Facebook & Instagram) users can request the deletion of their personal data collected via GOC Studio Lead Ads."
    >
      {/* 1. Overview */}
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
          1. Data Deletion Policy Overview
        </h2>
        <p>
          <strong className="text-white">GOC Studio Management System</strong> respects user privacy and complies with Meta's Platform Data Deletion Guidelines. If you interacted with a God of Ceramic Lead Form on Facebook or Instagram, your submitted contact information (such as name, phone number, and email) was processed for service inquiry handling.
        </p>
        <p>
          In accordance with Meta Platform Rules, users have the right to request the complete removal of their personal data from our CRM databases at any time.
        </p>
      </section>

      {/* 2. Step-by-Step Instructions */}
      <section className="space-y-4 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Trash2 className="w-6 h-6 text-indigo-400" />
          2. How to Request Data Deletion
        </h2>
        <p>You can request data deletion using either of the two standard methods below:</p>

        {/* Method 1 */}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/60 space-y-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            Method 1: Direct Email Request (Recommended)
          </h3>
          <p className="text-sm text-slate-300">
            Send an email to our Data Protection Officer with your request details:
          </p>
          <ul className="list-disc pl-6 text-xs sm:text-sm text-slate-300 space-y-1">
            <li><strong>Email Recipient:</strong> <a href="mailto:support@godofceramic.cloud" className="text-indigo-400 font-medium">support@godofceramic.cloud</a></li>
            <li><strong>Subject Line:</strong> <code className="text-indigo-300 bg-slate-900 px-2 py-0.5 rounded">Meta Data Deletion Request</code></li>
            <li><strong>Required Information:</strong> Full Name, Phone Number, or Email submitted in the Facebook Lead Form.</li>
          </ul>
        </div>

        {/* Method 2 */}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/60 space-y-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
            Method 2: Via Facebook Settings & Privacy
          </h3>
          <ol className="list-decimal pl-6 text-xs sm:text-sm text-slate-300 space-y-2">
            <li>Log into your Facebook account and go to <strong>Settings & Privacy</strong> → <strong>Settings</strong>.</li>
            <li>In the left sidebar, navigate to <strong>Apps and Websites</strong>.</li>
            <li>Search for <strong>GOC Studio</strong> or <strong>God of Ceramic</strong>.</li>
            <li>Click <strong>Remove</strong> next to the app name.</li>
            <li>Optionally click <strong>View Removed Apps</strong> and select <strong>Send Request</strong> to notify GOC Studio to purge your historic lead records.</li>
          </ol>
        </div>
      </section>

      {/* 3. Processing Timeline */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <CheckCircle2 className="w-6 h-6 text-indigo-400" />
          3. Processing Timeline & Confirmation
        </h2>
        <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-800/50 space-y-2">
          <p className="text-sm text-indigo-200">
            Upon receiving your deletion request, GOC Studio will:
          </p>
          <ul className="list-disc pl-6 text-xs sm:text-sm text-indigo-300 space-y-1">
            <li>Permanently purge your lead record, contact details, and activity logs from our active MySQL production database.</li>
            <li>Complete the deletion within <strong>48 hours</strong> (and no later than 30 business days).</li>
            <li>Send a formal confirmation email containing your unique <strong>Deletion Confirmation Code</strong> once complete.</li>
          </ul>
        </div>
      </section>

      {/* 4. Support Contact */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Mail className="w-6 h-6 text-indigo-400" />
          4. Contact Support
        </h2>
        <p className="text-sm">
          If you experience any issues or have questions regarding data privacy, reach out directly:
        </p>
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 text-sm">
          <p className="text-white font-semibold">GOC Studio Data Privacy Team</p>
          <p className="text-slate-400">Email: <a href="mailto:support@godofceramic.cloud" className="text-indigo-400">support@godofceramic.cloud</a></p>
          <p className="text-slate-400">URL: <a href="https://godofceramic.cloud/data-deletion" className="text-indigo-400">https://godofceramic.cloud/data-deletion</a></p>
        </div>
      </section>
    </PublicLegalLayout>
  );
}
