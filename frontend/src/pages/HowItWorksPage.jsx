import Icon from "../components/Icon";
import ArchitectureDiagram from "../components/ArchitectureDiagram";
import { Card, PageHeader } from "../components/ui";

const STEPS_INFO = [
  {
    icon: "upload",
    title: "1. Private Document Upload",
    text: "Supporting PDFs and incident photos are uploaded directly to encrypted private storage using short-lived, single-use links tied strictly to your account.",
  },
  {
    icon: "cpu",
    title: "2. Smart Form Auto-Fill",
    text: "When you start with a PDF document, Amazon Bedrock Nova Lite extracts key claim details—such as policy number, date, and amount—for you to review and edit.",
  },
  {
    icon: "shield",
    title: "3. Automated Verification",
    text: "Once submitted, AWS Step Functions coordinates independent checks for policy coverage, document completeness, and evidence consistency.",
  },
  {
    icon: "checkCircle",
    title: "4. Human Adjuster Review",
    text: "Every claim is reviewed by a qualified insurance adjuster. Automated checks assist with faster verification and never make an automated rejection.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="HOW IT WORKS"
        title="How claim submission works"
        description="A fast, transparent, and secure way to submit insurance claims and supporting evidence."
      />

      <div className="two-col">
        {STEPS_INFO.map((c) => (
          <Card key={c.title} title={c.title} icon={c.icon}>
            <p>{c.text}</p>
          </Card>
        ))}
      </div>

      <Card title="Platform Architecture" icon="layers" className="mt mb-12">
        <ArchitectureDiagram />
        <div className="tech-stack mt">
          <div className="tech-badge">
            <Icon name="shield" size={16} />
            <span>Amazon Cognito</span>
          </div>
          <div className="tech-badge">
            <Icon name="zap" size={16} />
            <span>API Gateway</span>
          </div>
          <div className="tech-badge">
            <Icon name="layers" size={16} />
            <span>AWS Step Functions</span>
          </div>
          <div className="tech-badge">
            <Icon name="upload" size={16} />
            <span>Encrypted S3</span>
          </div>
          <div className="tech-badge">
            <Icon name="cpu" size={16} />
            <span>Amazon Bedrock</span>
          </div>
          <div className="tech-badge">
            <Icon name="database" size={16} />
            <span>DynamoDB</span>
          </div>
        </div>
      </Card>

      <div className="two-col mt">
        <Card title="What happens after you submit" icon="layers">
          <ol className="numbered">
            <li><strong>Immediate confirmation.</strong> Your claim receives a unique Claim ID and appears immediately under <strong>My Claims</strong>.</li>
            <li><strong>Background processing.</strong> Your uploaded documents and photos are verified securely without keeping your browser open.</li>
            <li><strong>Adjuster assignment.</strong> An adjuster reviews your complete claim packet and follows up if additional information is needed.</li>
          </ol>
        </Card>

        <Card title="Your privacy & security" icon="lock">
          <ul className="plain-list bullets">
            <li>Uploaded documents are never publicly accessible and are isolated per claim.</li>
            <li>Role-based access ensures only you and authorized claims adjusters can view your submission.</li>
            <li>You can review and edit every extracted field before finalizing your submission.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}