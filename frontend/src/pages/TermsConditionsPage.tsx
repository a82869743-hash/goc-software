import React from 'react';
import PublicLegalLayout from '../components/layout/PublicLegalLayout';
import { FileText, ShieldAlert, Key, Award, Scale, HelpCircle } from 'lucide-react';

export default function TermsConditionsPage() {
  return (
    <PublicLegalLayout
      title="Terms & Conditions"
      subtitle="Terms of service governing the use of GOC Studio CRM platform, software features, and service subscriptions."
    >
      {/* 1. Acceptance of Terms */}
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-indigo-400" />
          1. Acceptance of Terms
        </h2>
        <p>
          By accessing or using <strong className="text-white">GOC Studio Management System</strong> at{' '}
          <a href="https://godofceramic.cloud" className="text-indigo-400 hover:underline">
            https://godofceramic.cloud
          </a>, you agree to be bound by these Terms & Conditions. If you do not agree to all terms, you may not access or use the platform.
        </p>
      </section>

      {/* 2. Acceptable Use */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-indigo-400" />
          2. Acceptable Use Policy
        </h2>
        <p>You agree to use GOC Studio CRM solely for lawful automotive detailing business operations. You must not:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-300">
          <li>Attempt to gain unauthorized access to any part of the system or database.</li>
          <li>Engage in automated scraping, reverse engineering, or vulnerability testing.</li>
          <li>Use the platform to distribute unsolicited spam or deceptive marketing messages.</li>
          <li>Interfere with or disrupt system servers, networks, or API integrations (e.g. Meta Lead Ads).</li>
        </ul>
      </section>

      {/* 3. Account Responsibility */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Key className="w-6 h-6 text-indigo-400" />
          3. Account Security & Responsibilities
        </h2>
        <p>
          Authorized studio staff and administrators are responsible for maintaining the confidentiality of their login credentials (user ID and password). You agree to immediately notify GOC Studio administration of any unauthorized account activity.
        </p>
      </section>

      {/* 4. Intellectual Property */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Award className="w-6 h-6 text-indigo-400" />
          4. Intellectual Property Rights
        </h2>
        <p>
          All content, software code, UI designs, logos, and trademarks associated with GOC Studio CRM and "God of Ceramic" are the exclusive intellectual property of GOC Studio. You may not reproduce, duplicate, or redistribute any part of the platform without explicit written authorization.
        </p>
      </section>

      {/* 5. Limitation of Liability */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Scale className="w-6 h-6 text-indigo-400" />
          5. Disclaimer of Liability
        </h2>
        <p>
          GOC Studio CRM is provided on an "AS IS" and "AS AVAILABLE" basis. While we maintain 99.9% uptime and enterprise data backups, we shall not be held liable for indirect, incidental, or consequential damages resulting from third-party network outages or Meta Graph API service disruptions.
        </p>
      </section>

      {/* 6. Governing Law */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <HelpCircle className="w-6 h-6 text-indigo-400" />
          6. Governing Law & Contact
        </h2>
        <p>
          These Terms & Conditions are governed by and construed in accordance with applicable state and federal laws.
        </p>
        <p className="text-sm text-slate-400 mt-2">
          For inquiries regarding our terms, email us at{' '}
          <a href="mailto:support@godofceramic.cloud" className="text-indigo-400">
            support@godofceramic.cloud
          </a>.
        </p>
      </section>
    </PublicLegalLayout>
  );
}
