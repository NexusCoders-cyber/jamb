import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy", description: "What Qubit stores, why, and how to delete it." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="6 October 2026">
      <section>
        <h2>The short version</h2>
        <p>
          Qubit helps students prepare for JAMB/UTME. We keep only what the app needs to work, we never sell your data, and you
          can delete your account and everything linked to it from Settings at any time.
        </p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: your name, email address and password (stored hashed by our sign-in provider).</li>
          <li>Study data: your exam results, answers, bookmarks, streaks, achievements and chosen subjects.</li>
          <li>Community data you choose to post: messages, community posts and quiz-duel activity.</li>
          <li>Payment records if you buy Pro: plan, amount and reference. Card details go to Paystack and never touch our servers.</li>
        </ul>
      </section>
      <section>
        <h2>What stays on your phone</h2>
        <p>
          Practice and mock exams run from your device. Unfinished exams, results and bookmarks are saved locally and only sent
          to our servers when you back up (Settings → Cloud backup), finish an exam while signed in, or sign in. Clearing your
          browser or app data removes the local copy.
        </p>
      </section>
      <section>
        <h2>Who processes data for us</h2>
        <ul>
          <li>Supabase — sign-in and database hosting.</li>
          <li>Paystack — payments.</li>
          <li>ALOC — past-question content (we send the subject and year, not your identity).</li>
          <li>Resend — emails such as announcements or password resets.</li>
          <li>Our hosting provider — to serve the app.</li>
        </ul>
      </section>
      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Edit your name and goals in Settings.</li>
          <li>Back up or keep your data on-device only.</li>
          <li>Delete your account in Settings → Account &amp; privacy. This removes your profile and study data from our servers and clears this device.</li>
        </ul>
      </section>
      <section>
        <h2>Children</h2>
        <p>Qubit is meant for exam candidates. If you are under 13, use it with a parent or guardian.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If we change this policy in a way that matters, we will say so in the app. The date above shows the latest version.</p>
      </section>
    </LegalPage>
  );
}
