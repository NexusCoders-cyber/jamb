import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Use", description: "The rules for using Qubit Learn." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="6 October 2026">
      <section>
        <h2>Using Qubit Learn</h2>
        <p>
          Qubit Learn is a study tool for JAMB/UTME preparation. By creating an account you agree to use it honestly, keep your
          password private, and not misuse the service (for example by scraping questions in bulk, attacking the service, or
          harassing other students in chat or the community).
        </p>
      </section>
      <section>
        <h2>Not the real exam</h2>
        <p>
          Questions, scores and predictions are practice aids. They do not guarantee any result in the real JAMB exam, and
          Qubit Learn is not affiliated with or endorsed by JAMB.
        </p>
      </section>
      <section>
        <h2>Pro plans and payments</h2>
        <p>
          Pro plans are paid in advance through Paystack for the period you choose (weekly, monthly or six months) and unlock
          extra features for that period. Plans do not renew automatically. If a payment went through but Pro was not
          activated, contact us with your payment reference and we will fix it.
        </p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You are responsible for what you post. We may remove content or suspend accounts that are abusive, unlawful or
          harmful to other students.
        </p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>
          We work to keep Qubit Learn available and your offline data safe, but we cannot promise uninterrupted service. Back up
          important results from Settings before clearing your phone&apos;s data.
        </p>
      </section>
      <section>
        <h2>Ending your account</h2>
        <p>You can delete your account in Settings at any time. We may suspend accounts that break these terms.</p>
      </section>
    </LegalPage>
  );
}
