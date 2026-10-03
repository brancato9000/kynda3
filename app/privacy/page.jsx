import LegalPage, { H2, P, UL } from "../legal-page.jsx";

export const metadata = {
  title: "Privacy Policy — Kynda",
  description: "What Kynda collects, why, and who processes it. No accounts, no ads, no tracking cookies.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" other={{ href: "/terms", label: "Terms of Use" }}>
      <H2>1. Who we are</H2>
      <P>Kynda (kynda.ai) maps how culture connects: who and what influenced an artist or a work, who they influenced in turn, and the sources that document each connection. Kynda is operated by The O&amp;O LLC (“Kynda,” “we,” “us”). This policy explains what we collect when you use the site and what we do with it.</P>

      <H2>2. The short version</H2>
      <UL>
        <li>You don’t need an account, and we never ask for one.</li>
        <li>We don’t sell your information, show ads, or use tracking cookies.</li>
        <li>We keep what you type into Kynda (searches, questions, contributions) to run and improve the service, but we don’t store it alongside your connection address.</li>
        <li>Some features send what you type to service providers, listed in section 4.</li>
      </UL>

      <H2>3. What we collect</H2>
      <P><b>Searches.</b> The text you search for, the subject it matched, and when. We use this to decide which subjects to map next.</P>
      <P><b>Map requests.</b> When you press “Ask Kynda to map this,” we record the subject plus a one-way, salted fingerprint of your connection address, so each visitor counts once in our queue. We store the fingerprint, not the address, and we can’t turn it back into your address.</P>
      <P><b>Questions to “Ask Kynda.”</b> The subject you’re on, the possible influence you ask about, and when. We keep these to run a daily limit and to improve answers.</P>
      <P><b>Contributions.</b> If you suggest a source, a quote, a correction or a new connection, we keep what you submit: links, quoted text, your comment and, only if you give it, your name. Approved contributions are published on the site, credited to the name you gave or to an anonymous contributor.</P>
      <P><b>Visits to shared pages.</b> When someone opens one of our shared demo pages, we record the page, the browser type, the page that linked there, and a one-way fingerprint of the connection address, to count visits roughly.</P>
      <P><b>Site analytics.</b> We use Vercel Web Analytics, which counts page views in aggregate without cookies.</P>
      <P><b>Server logs and abuse protection.</b> Our hosting provider processes connection addresses to deliver pages and stop abuse. To enforce rate limits we briefly hold connection addresses in server memory; we don’t write them to our database.</P>
      <P><b>Stored on your device.</b> The site saves a few preferences in your browser’s local storage, such as the size of the map’s side panel and your preferred streaming service. They never leave your device.</P>

      <H2>4. Service providers and other sites</H2>
      <UL>
        <li><b>Anthropic</b> (Claude AI): processes search text to work out which subject you mean, and processes “Ask Kynda” questions.</li>
        <li><b>Wikipedia, Wikidata and MusicBrainz</b>: receive search text through their public search services.</li>
        <li><b>Vercel</b> (hosting and analytics) and <b>Supabase</b> (our database).</li>
        <li><b>Media and font providers</b>: pictures, audio previews and video come from their original hosts, including Wikimedia Commons, Apple, Deezer, YouTube (privacy-enhanced mode), Cover Art Archive and the Internet Archive; fonts come from Google Fonts. Your browser contacts these providers directly when it loads their content, so they receive your connection address under their own privacy policies.</li>
        <li><b>Links out</b> to streaming services, libraries and sources take you to sites with their own privacy practices.</li>
      </UL>
      <P>Kynda’s research tools use AI services to read public sources; they never receive visitor information. We may disclose information if the law requires it.</P>

      <H2>5. How long we keep it</H2>
      <P>We keep searches, requests, questions and contributions as long as they’re useful for running and improving Kynda. Because we don’t store them with your connection address, we usually can’t tell which entries are yours. Published contributions stay published under their license (<a href="/terms" style={{ color: "inherit" }}>Terms, section 5</a>); if you want your name removed from one, write to us and identify it.</P>

      <H2>6. Children</H2>
      <P>Kynda isn’t directed to children under 13, and we don’t knowingly collect personal information from them. If you believe a child has sent us personal information, contact us and we’ll delete it.</P>

      <H2>7. Security</H2>
      <P>We use reasonable measures to protect what we hold, but no method of transmission or storage is perfectly secure.</P>

      <H2>8. Changes</H2>
      <P>If we change this policy, we’ll post the new version here and update the date above.</P>

      <H2>9. Contact</H2>
      <P>Questions or requests: <a href="mailto:support@kynda.ai" style={{ color: "inherit" }}>support@kynda.ai</a>.</P>
    </LegalPage>
  );
}
