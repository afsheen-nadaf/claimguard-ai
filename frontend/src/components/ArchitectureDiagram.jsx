export default function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 980 570" className="architecture-diagram" style={{ width: "100%", height: "auto", maxWidth: "940px" }}>
      <defs>
        <marker id="arrow-teal" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#14b8a6" />
        </marker>
        <marker id="arrow-gold" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
        </marker>
        <marker id="arrow-purple" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#a855f7" />
        </marker>
      </defs>

      {/* 1. React Frontend */}
      <g>
        <rect x="30" y="45" width="160" height="72" rx="10" fill="rgba(20, 184, 166, 0.15)" stroke="#14b8a6" strokeWidth="2.5" />
        <text x="110" y="75" textAnchor="middle" fill="#f5f0e8" fontSize="13" fontWeight="600">React + Vite UI</text>
        <text x="110" y="94" textAnchor="middle" fill="#5eead4" fontSize="10">Claimant &amp; Adjuster Portals</text>
      </g>

      {/* 2. Amazon Cognito */}
      <g>
        <rect x="30" y="155" width="160" height="64" rx="10" fill="rgba(236, 72, 153, 0.15)" stroke="#ec4899" strokeWidth="2" />
        <text x="110" y="183" textAnchor="middle" fill="#f5f0e8" fontSize="12" fontWeight="600">Amazon Cognito</text>
        <text x="110" y="200" textAnchor="middle" fill="#fbcfe8" fontSize="9.5">JWT Auth &amp; Role Groups</text>
      </g>

      {/* 3. API Gateway */}
      <g>
        <rect x="250" y="45" width="165" height="72" rx="10" fill="rgba(251, 191, 36, 0.15)" stroke="#fbbf24" strokeWidth="2.5" />
        <text x="332" y="75" textAnchor="middle" fill="#f5f0e8" fontSize="13" fontWeight="600">API Gateway</text>
        <text x="332" y="94" textAnchor="middle" fill="#fde68a" fontSize="10">REST API + Authorizer</text>
      </g>

      {/* 4. S3 Bucket */}
      <g>
        <rect x="480" y="30" width="175" height="64" rx="8" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" strokeWidth="2" />
        <text x="567" y="57" textAnchor="middle" fill="#f5f0e8" fontSize="12" fontWeight="600">S3 Claim Packets</text>
        <text x="567" y="74" textAnchor="middle" fill="#fcd34d" fontSize="9.5">Private Presigned Uploads</text>
      </g>

      {/* 5. Document Extraction Lambda */}
      <g>
        <rect x="720" y="30" width="215" height="64" rx="8" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
        <text x="827" y="57" textAnchor="middle" fill="#f5f0e8" fontSize="12" fontWeight="600">Document Extraction</text>
        <text x="827" y="74" textAnchor="middle" fill="#c4b5fd" fontSize="9.5">Bedrock Nova Lite Auto-Fill</text>
      </g>

      {/* 6. Step Functions Orchestrator */}
      <g>
        <rect x="250" y="160" width="215" height="72" rx="10" fill="rgba(168, 85, 247, 0.18)" stroke="#a855f7" strokeWidth="2.5" />
        <text x="357" y="190" textAnchor="middle" fill="#f5f0e8" fontSize="13" fontWeight="600">AWS Step Functions</text>
        <text x="357" y="209" textAnchor="middle" fill="#d8b4fe" fontSize="10">ClaimPipeline Orchestrator</text>
      </g>

      {/* 7. Parallel Screening Lambdas */}
      <g>
        <rect x="40" y="285" width="165" height="64" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" />
        <text x="122" y="312" textAnchor="middle" fill="#f5f0e8" fontSize="11.5" fontWeight="600">Duplicate Check</text>
        <text x="122" y="328" textAnchor="middle" fill="#6ee7b7" fontSize="9">pHash + Policy/Date/Amt</text>
      </g>

      <g>
        <rect x="225" y="285" width="165" height="64" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" />
        <text x="307" y="312" textAnchor="middle" fill="#f5f0e8" fontSize="11.5" fontWeight="600">Policy Validation</text>
        <text x="307" y="328" textAnchor="middle" fill="#6ee7b7" fontSize="9">Deterministic Rule Engine</text>
      </g>

      <g>
        <rect x="410" y="285" width="165" height="64" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" />
        <text x="492" y="312" textAnchor="middle" fill="#f5f0e8" fontSize="11.5" fontWeight="600">Outlier Detection</text>
        <text x="492" y="328" textAnchor="middle" fill="#6ee7b7" fontSize="9">Robust Median / MAD Z-Score</text>
      </g>

      <g>
        <rect x="595" y="285" width="175" height="64" rx="8" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
        <text x="682" y="312" textAnchor="middle" fill="#f5f0e8" fontSize="11.5" fontWeight="600">Image Forensics</text>
        <text x="682" y="328" textAnchor="middle" fill="#c4b5fd" fontSize="9">Smaug ML + EXIF + DCT</text>
      </g>

      <g>
        <rect x="790" y="285" width="165" height="64" rx="8" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
        <text x="872" y="312" textAnchor="middle" fill="#f5f0e8" fontSize="11.5" fontWeight="600">Evidence Relevance</text>
        <text x="872" y="328" textAnchor="middle" fill="#c4b5fd" fontSize="9">Bedrock Nova Lite Vision</text>
      </g>

      {/* 8. Aggregate Results Lambda */}
      <g>
        <rect x="330" y="405" width="230" height="64" rx="10" fill="rgba(251, 191, 36, 0.15)" stroke="#fbbf24" strokeWidth="2" />
        <text x="445" y="432" textAnchor="middle" fill="#f5f0e8" fontSize="12" fontWeight="600">Aggregate Results Lambda</text>
        <text x="445" y="449" textAnchor="middle" fill="#fde68a" fontSize="9.5">Consolidates &amp; Persists Findings</text>
      </g>

      {/* 9. DynamoDB */}
      <g>
        <rect x="650" y="405" width="240" height="64" rx="10" fill="rgba(245, 158, 11, 0.18)" stroke="#f59e0b" strokeWidth="2.5" />
        <text x="770" y="432" textAnchor="middle" fill="#f5f0e8" fontSize="12.5" fontWeight="600">Amazon DynamoDB</text>
        <text x="770" y="449" textAnchor="middle" fill="#fcd34d" fontSize="9.5">Operational Claims, Policies &amp; pHashes</text>
      </g>

      {/* Arrows */}
      <line x1="190" y1="81" x2="250" y2="81" stroke="#14b8a6" strokeWidth="2" markerEnd="url(#arrow-teal)" />
      <line x1="110" y1="155" x2="110" y2="117" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="415" y1="68" x2="480" y2="62" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" />
      <line x1="655" y1="62" x2="720" y2="62" stroke="#8b5cf6" strokeWidth="1.5" markerEnd="url(#arrow-purple)" />
      <line x1="332" y1="117" x2="332" y2="160" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrow-gold)" />

      {/* Step Functions fan-out to 5 Lambdas */}
      <path d="M 357 232 L 122 285" stroke="#a855f7" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-purple)" />
      <path d="M 357 232 L 307 285" stroke="#a855f7" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-purple)" />
      <path d="M 357 232 L 492 285" stroke="#a855f7" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-purple)" />
      <path d="M 357 232 L 682 285" stroke="#a855f7" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-purple)" />
      <path d="M 357 232 L 872 285" stroke="#a855f7" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-purple)" />

      {/* Fan-in to Aggregate */}
      <path d="M 122 349 L 410 405" stroke="#6ee7b7" strokeWidth="1.3" fill="none" />
      <path d="M 307 349 L 430 405" stroke="#6ee7b7" strokeWidth="1.3" fill="none" />
      <path d="M 492 349 L 455 405" stroke="#6ee7b7" strokeWidth="1.3" fill="none" />
      <path d="M 682 349 L 480 405" stroke="#c4b5fd" strokeWidth="1.3" fill="none" />
      <path d="M 872 349 L 510 405" stroke="#c4b5fd" strokeWidth="1.3" fill="none" />

      {/* Aggregate to DynamoDB */}
      <line x1="560" y1="437" x2="650" y2="437" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrow-gold)" />

      {/* Legend */}
      <g transform="translate(30, 520)">
        <text x="0" y="0" fill="#c4b5fd" fontSize="10" fontWeight="600">LEGEND:</text>
        <line x1="65" y1="-4" x2="95" y2="-4" stroke="#14b8a6" strokeWidth="2" markerEnd="url(#arrow-teal)" />
        <text x="102" y="0" fill="#f5f0e8" fontSize="9.5">Client / API Request</text>
        <line x1="225" y1="-4" x2="255" y2="-4" stroke="#a855f7" strokeWidth="2" markerEnd="url(#arrow-purple)" />
        <text x="262" y="0" fill="#f5f0e8" fontSize="9.5">Step Functions Orchestration</text>
        <line x1="425" y1="-4" x2="455" y2="-4" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrow-gold)" />
        <text x="462" y="0" fill="#f5f0e8" fontSize="9.5">Persistence &amp; Storage</text>
      </g>
    </svg>
  );
}