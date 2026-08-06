import React from 'react';
import PublicLegalLayout from '../components/layout/PublicLegalLayout';
import { Shield, Lock, Database, UserCheck, Mail, Server, Globe } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <PublicLegalLayout
      title="Privacy Policy"
      subtitle="How GOC Studio collects, uses, protects, and handles your information and Meta Lead Ads data."
    >
      {/* 1. Introduction */}
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Shield className="w-6 h-6 text-indigo-400" />
          1. Introduction
        </h2>
        <p>
          Welcome to <strong className="text-white">GOC Studio Management System</strong> ("we", "us", "our"), accessible at{' '}
          <a href="https://godofceramic.cloud" className="text-indigo-400 hover:underline">
            https://godofceramic.cloud
          </a>. We are committed to protecting the privacy and security of customer data, website visitors, and users of our CRM application.
        </p>
        <p>
          This Privacy Policy outlines how we handle personal data collected through our CRM software, customer job bookings, and Meta (Facebook and Instagram) Lead Ads integrations.
        </p>
      </section>

      {/* 2. Information We Collect */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Database className="w-6 h-6 text-indigo-400" />
          2. Information We Collect
        </h2>
        <p>We collect personal information necessary to deliver automotive ceramic coating and detailing services:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-300">
          <li>
            <strong className="text-slate-200">Personal Contact Information:</strong> Full name, phone number, email address, and billing/city address.
          </li>
          <li>
            <strong className="text-slate-200">Vehicle Details:</strong> Vehicle make, model, registration number, year, and service history.
          </li>
          <li>
            <strong className="text-slate-200">Meta (Facebook/Instagram) Lead Ads Data:</strong> When prospective customers submit lead forms on Facebook or Instagram, we collect user-submitted fields such as name, phone number, email, and preferred service inquiry via the Meta Graph API webhook.
          </li>
          <li>
            <strong className="text-slate-200">System Logs & Usage Data:</strong> IP addresses, browser types, timestamp logs, and authentication tokens for platform security and debugging.
          </li>
        </ul>
      </section>

      {/* 3. Facebook Lead Ads Data Usage */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Globe className="w-6 h-6 text-indigo-400" />
          3. How We Use Facebook Lead Ads Data
        </h2>
        <p>
          Data received via our Meta Lead Ads Integration (<code className="text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded">/api/v1/webhooks/meta</code>) is strictly used for legitimate business operations:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-semibold text-white mb-1">Lead Management</h4>
            <p className="text-xs text-slate-400">Automated ingestion into GOC Studio CRM to assign sales representatives and track customer inquiries.</p>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-semibold text-white mb-1">Customer Communication</h4>
            <p className="text-xs text-slate-400">Sending booking quotes, service schedules, and warranty confirmations via WhatsApp or phone call.</p>
          </div>
        </div>
        <p className="text-amber-300/90 text-sm bg-amber-950/30 p-3 rounded-lg border border-amber-800/40">
          <strong>Strict Policy:</strong> We do NOT sell, rent, trade, or share Meta Lead data with unauthorized third parties or advertising networks.
        </p>
      </section>

      {/* 4. Data Storage & Security */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Lock className="w-6 h-6 text-indigo-400" />
          4. Data Storage & Security Measures
        </h2>
        <p>
          We employ industry-standard security protocols to prevent unauthorized access, data loss, or disclosure:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-300">
          <li>
            <strong className="text-slate-200">Encryption in Transit:</strong> All data transmitted between browsers, Meta servers, and our API is encrypted using TLS 1.3 / HTTPS SSL.
          </li>
          <li>
            <strong className="text-slate-200">Encryption at Rest:</strong> Sensitive access tokens (e.g. Meta Page Access Tokens) are encrypted using AES-256 before storage in our MySQL database.
          </li>
          <li>
            <strong className="text-slate-200">Infrastructure Isolation:</strong> Hosted on secured Cloud VPS infrastructure with active firewall rules, fail2ban rate-limiting, and strict role-based access control (RBAC).
          </li>
        </ul>
      </section>

      {/* 5. Cookies & Local Storage */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Server className="w-6 h-6 text-indigo-400" />
          5. Cookies & Local Storage
        </h2>
        <p>
          GOC Studio CRM uses essential session tokens stored in your browser's local storage solely to maintain authenticated user sessions and security context. We do not use intrusive third-party tracking cookies.
        </p>
      </section>

      {/* 6. User Data Rights */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <UserCheck className="w-6 h-6 text-indigo-400" />
          6. Your Rights & Data Deletion
        </h2>
        <p>You have the right to inspect, update, or permanently remove your personal data stored within GOC Studio CRM:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-300">
          <li>Request a copy of your stored records.</li>
          <li>Request immediate correction of erroneous contact information.</li>
          <li>Request complete deletion of your lead or customer profile (Data Deletion).</li>
        </ul>
        <p className="mt-2">
          To request data removal, visit our dedicated{' '}
          <a href="/data-deletion" className="text-indigo-400 hover:underline font-semibold">
            Facebook Data Deletion Instructions
          </a>{' '}
          page or contact our privacy officer directly.
        </p>
      </section>

      {/* 7. Contact Us */}
      <section className="space-y-3 pt-4 border-t border-slate-800/60">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Mail className="w-6 h-6 text-indigo-400" />
          7. Contact Information
        </h2>
        <p>If you have any questions or concerns regarding this Privacy Policy, please reach out to us:</p>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 inline-block space-y-1 text-sm">
          <p><strong className="text-white">God of Ceramic (GOC Studio)</strong></p>
          <p className="text-slate-300">Website: <a href="https://godofceramic.cloud" className="text-indigo-400">godofceramic.cloud</a></p>
          <p className="text-slate-300">Privacy Support Email: <a href="mailto:support@godofceramic.cloud" className="text-indigo-400">support@godofceramic.cloud</a></p>
        </div>
      </section>
    </PublicLegalLayout>
  );
}
