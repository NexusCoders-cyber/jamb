import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Delete your account", description: "How to delete your Qubit account and data." };

/** Public page (no login) — app stores ask for a web address that explains account and data deletion. */
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your account" updated="6 October 2026">
      <section>
        <h2>In the app</h2>
        <ul>
          <li>Sign in to Qubit.</li>
          <li>Open <strong>Settings</strong> (from your profile or the menu).</li>
          <li>Go to <strong>Account &amp; privacy → Delete my account</strong>.</li>
          <li>Type <strong>DELETE</strong> and confirm.</li>
        </ul>
        <p className="mt-2">
          <Link href="/settings" className="font-bold text-violet-700 underline">Open Settings</Link>
        </p>
      </section>
      <section>
        <h2>What is deleted</h2>
        <ul>
          <li>Your profile, name and email.</li>
          <li>Your exam results, answers, bookmarks, streaks, achievements and points.</li>
          <li>Your messages, community posts and quiz-duel history.</li>
          <li>The copy of your data stored on the device you delete from.</li>
        </ul>
      </section>
      <section>
        <h2>What we may keep</h2>
        <p>
          Payment records may be kept for accounting and legal reasons. Active Pro time is lost when the account is deleted.
        </p>
      </section>
      <section>
        <h2>Can&apos;t sign in?</h2>
        <p>Use “Forgot password” on the sign-in page first. If that doesn&apos;t work, contact us and we will delete the account after confirming it is yours.</p>
      </section>
    </LegalPage>
  );
}
