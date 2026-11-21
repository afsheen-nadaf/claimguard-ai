import Icon from "../components/Icon";
import { Card, PageHeader } from "../components/ui";

const CHECK_INFO = [
  {
    icon: "clipboard",
    title: "Policy validation",
    text: "Sends the policy number, claim type, incident date and amount to the validation API, which applies deterministic policy rules. Any flags it returns are listed with the result.",
  },
  {
    icon: "copy",
    title: "Duplicate-claim detection",
    text: "Compares the policy number, incident date and amount against seeded reference claims and earlier submissions. The same call registers the claim, so later claims can be compared against it.",
  },
  {
    icon: "sliders",
    title: "Claim-amount outlier detection",
    text: "Compares the amount against historical claims of the same type using a robust statistic built on the median and median absolute deviation. The API reports its sample size, method and bounds, and those are shown as returned.",
  },
  {
    icon: "image",
    title: "Image forensics",
    text: "Inspects uploaded photos for metadata, compression and AI-generation signals. Missing metadata is shown as missing and is never treated as proof of tampering.",
  },
  {
    icon: "search",
    title: "Evidence relevance",
    text: "Checks whether uploaded documents and photos match the reported claim type and incident, and explains each judgement.",
  },
  {
    icon: "layers",
    title: "Cross-document consistency",
    text: "Compares details extracted from each uploaded document and flags fields that disagree, such as names, dates or amounts.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="HOW IT WORKS"
        title="How screening works"
        description="What each check does, and what it cannot tell you."
      />

      <div className="three-col">
        {CHECK_INFO.map((c) => (
          <Card key={c.title} title={c.title} icon={c.icon}>
            <p>{c.text}</p>
          </Card>
        ))}
      </div>

      <div className="two-col mt">
        <Card title="From submission to summary" icon="layers">
          <ol className="numbered">
            <li><strong>Documents upload first.</strong> Each file is sent straight to private storage using a short-lived presigned link. If any upload fails, nothing is registered or screened.</li>
            <li><strong>The checks run independently.</strong> A failure in one is shown as a failure, never as a pass, and can be retried on its own.</li>
            <li><strong>The summary combines what actually ran.</strong> It reports counts of passed, review-required and incomplete checks, with the reason for each.</li>
            <li><strong>A person decides.</strong> The summary recommends a next step for a reviewer. It never concludes that a claim is fraudulent or genuine.</li>
          </ol>
        </Card>

        <Card title="What this does not do" icon="alert">
          <ul className="plain-list bullets">
            <li>It does not produce a fraud score or probability.</li>
            <li>An unusual amount or a duplicate match is a signal for investigation, not proof.</li>
            <li>Image forensics and AI-generation signals can be wrong, and missing metadata is not evidence of tampering.</li>
            <li>It never decides a claim. A person reviews every flagged result.</li>
          </ul>
          <div className="callout callout-info inline-callout">
            <Icon name="lock" size={18} />
            <div className="callout-body">Location and description are held for reviewer context only. They are not sent to any screening check.</div>
          </div>
        </Card>
      </div>
    </>
  );
}
