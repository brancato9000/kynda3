import LegalPage, { H2, P, UL, A, Caps, COMPANY_ADDRESS } from "../legal-page.jsx";

export const metadata = {
  title: "Terms of Use — Kynda",
  description: "The terms for using Kynda, including how reader contributions are licensed (CC BY-SA 4.0, as on Wikipedia).",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalPage title="Terms of Use" other={{ href: "/privacy", label: "Privacy Policy" }}>
      <H2>1. Agreement</H2>
      <P>By using kynda.ai (the “Service”), you agree to these Terms. If you don’t agree, please don’t use the Service. The Service is operated by The O&amp;O LLC.</P>

      <H2>2. What Kynda is, and how it can be wrong</H2>
      <P>Kynda maps influences between creators and works, with the sources behind each connection. Its content combines quoted public sources (always credited), structured databases such as Wikidata and MusicBrainz, and text written with the help of AI. We check connections against their sources and label how well each is documented, but Kynda can still contain mistakes. Every connection links to its sources so you can judge for yourself, and you can flag anything that looks wrong. Kynda is for information and discovery, not professional advice.</P>

      <H2>3. No account needed</H2>
      <P>You can use Kynda without signing up. Some areas are private and password-protected; please don’t try to get into them.</P>

      <H2>4. Fair use of the Service</H2>
      <P>You agree not to:</P>
      <UL>
        <li>use bots, scripts or bulk requests to copy the site, run up requests, or get around rate or daily limits;</li>
        <li>interfere with or disrupt the Service, or try to reach private areas or other people’s information;</li>
        <li>submit contributions that are unlawful, defamatory, harassing, deceptive, or that infringe someone else’s rights;</li>
        <li>misrepresent a source, or present a fabricated quote as real.</li>
      </UL>
      <P>We may limit or block access that breaks these Terms.</P>

      <H2>5. Your contributions</H2>
      <P><b>You license what you write, openly.</b> When you submit a contribution (a correction, a comment, a new connection and how you describe it), you agree to license your own text under the <A href="https://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0 International license</A> (CC BY-SA 4.0), the same license Wikipedia uses. Anyone, including Kynda, may share and adapt it, provided they credit the contributors and release adaptations under the same license. You keep your copyright.</P>
      <P><b>Credit.</b> You agree to be credited by the name you give, or as an anonymous contributor if you give none. A link to the Kynda page where your contribution appears, which lists its contributors, is sufficient credit.</P>
      <P><b>Facts and quotes.</b> Facts, such as one artist having influenced another, belong to no one. Quotes from published sources aren’t yours to license: quote briefly and accurately, name the source, and they’ll appear as quotations of their authors, not under your license.</P>
      <P><b>Your promises.</b> You confirm your contribution is accurate to the best of your knowledge and that you have the right to submit it. We may verify, edit, decline or remove any contribution. A license already granted on published text can’t be withdrawn, but you can ask us to remove your name.</P>

      <H2>6. Other people’s content</H2>
      <UL>
        <li><b>Wikipedia</b> excerpts are quoted word for word under CC BY-SA 4.0, with a link to the article and the license; those excerpts stay available under the same license.</li>
        <li><b>Pictures</b> from Wikimedia Commons and similar sources appear under their own licenses, with credits.</li>
        <li><b>Cover art, audio and video previews</b> belong to their rights holders. They’re shown to identify the works under discussion and play from their original providers.</li>
        <li><b>Names and trademarks</b> belong to their owners. Appearing on Kynda doesn’t mean a person or company endorses or is affiliated with Kynda.</li>
      </UL>
      <P><b>Copyright concerns.</b> If you believe material on Kynda infringes your copyright, send a notice to our designated copyright agent: The O&amp;O LLC, Attn: Copyright Agent, {COMPANY_ADDRESS}; <a href="mailto:copyright@kynda.ai" style={{ color: "inherit" }}>copyright@kynda.ai</a>. Include the address of the material on our site, the work you own, your contact details, a statement that you believe in good faith the use isn’t authorized, a statement that your notice is accurate and, under penalty of perjury, that you’re authorized to act for the owner, and your physical or electronic signature. We’ll respond promptly, remove material where appropriate, and may end access for repeat infringers.</P>

      <H2>7. Kynda’s own content</H2>
      <P>Apart from third-party material and reader contributions, the Service’s original writing, design, software and the compiled map of connections belong to The O&amp;O LLC. You’re welcome to link to Kynda pages and to quote briefly with credit.</P>

      <H2>8. Other sites and services</H2>
      <P>Kynda links to and loads content from other services (streaming platforms, libraries, publishers, archives). We aren’t responsible for their availability, content or practices.</P>

      <H2>9. Disclaimer</H2>
      <Caps>THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY AND NON-INFRINGEMENT, TO THE FULLEST EXTENT THE LAW ALLOWS.</Caps>

      <H2>10. Limitation of liability</H2>
      <Caps>TO THE FULLEST EXTENT THE LAW ALLOWS, THE O&amp;O LLC WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, ANY CONTENT ON IT, OR ANY THIRD PARTY’S CONDUCT OR CONTENT.</Caps>

      <H2>11. Changes</H2>
      <P>We may update these Terms. We’ll post the new version here with a new date; continuing to use Kynda after a change means you accept it. We may change or discontinue any part of the Service.</P>

      <H2>12. Governing law</H2>
      <P>These Terms are governed by the laws of the State of California, without regard to its conflict-of-law rules.</P>

      <H2>13. Contact</H2>
      <P><a href="mailto:support@kynda.ai" style={{ color: "inherit" }}>support@kynda.ai</a> · The O&amp;O LLC, {COMPANY_ADDRESS}</P>
    </LegalPage>
  );
}
