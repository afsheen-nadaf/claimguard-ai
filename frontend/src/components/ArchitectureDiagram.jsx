export default function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 950 550" className="architecture-diagram" style={{ width: '100%', height: 'auto', maxWidth: '900px' }}>
      {/* Frontend - Teal */}
      <g>
        <rect x="40" y="40" width="150" height="70" rx="10" fill="rgba(20, 184, 166, 0.15)" stroke="#14b8a6" strokeWidth="2.5" />
        <text x="115" y="70" textAnchor="middle" fill="#f5f0e8" fontSize="13" fontWeight="600">React Frontend</text>
        <text x="115" y="90" textAnchor="middle" fill="#5eead4" fontSize="10">Wizard Interface</text>
      </g>

      {/* API Gateway - Gold */}
      <g>
        <rect x="270" y="40" width="150" height="70" rx="10" fill="rgba(251, 191, 36, 0.15)" stroke="#fbbf24" strokeWidth="2.5" />
        <text x="345" y="70" textAnchor="middle" fill="#f5f0e8" fontSize="13" fontWeight="600">API Gateway</text>
        <text x="345" y="90" textAnchor="middle" fill="#fde68a" fontSize="10">REST Endpoints</text>
      </g>

      {/* S3 - Amber */}
      <g>
        <rect x="510" y="25" width="130" height="60" rx="8" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" strokeWidth="2.5" />
        <text x="575" y="52" textAnchor="middle" fill="#f5f0e8" fontSize="12" fontWeight="600">S3 Bucket</text>
        <text x="575" y="68" textAnchor="middle" fill="#fcd34d" fontSize="9">Document Storage</text>
      </g>

      {/* Lambda Functions - Left Column (Emerald/Green) */}
      <g>
        <rect x="50" y="180" width="170" height="65" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" />
        <text x="135" y="206" textAnchor="middle" fill="#f5f0e8" fontSize="11" fontWeight="600">Policy Validation</text>
        <text x="135" y="222" textAnchor="middle" fill="#6ee7b7" fontSize="9">Lambda + DynamoDB</text>
      </g>

      <g>
        <rect x="50" y="265" width="170" height="65" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" />
        <text x="135" y="291" textAnchor="middle" fill="#f5f0e8" fontSize="11" fontWeight="600">Duplicate Detection</text>
        <text x="135" y="307" textAnchor="middle" fill="#6ee7b7" fontSize="9">Lambda + Hashing</text>
      </g>

      <g>
        <rect x="50" y="350" width="170" height="65" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" />
        <text x="135" y="376" textAnchor="middle" fill="#f5f0e8" fontSize="11" fontWeight="600">Outlier Detection</text>
        <text x="135" y="392" textAnchor="middle" fill="#6ee7b7" fontSize="9">Lambda + Statistics</text>
      </g>

      {/* Lambda Functions - Right Column (Purple/Violet) */}
      <g>
        <rect x="490" y="180" width="170" height="65" rx="8" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
        <text x="575" y="206" textAnchor="middle" fill="#f5f0e8" fontSize="11" fontWeight="600">Image Forensics</text>
        <text x="575" y="222" textAnchor="middle" fill="#c4b5fd" fontSize="9">Lambda + ML</text>
      </g>

      <g>
        <rect x="490" y="265" width="170" height="65" rx="8" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
        <text x="575" y="291" textAnchor="middle" fill="#f5f0e8" fontSize="11" fontWeight="600">Evidence Relevance</text>
        <text x="575" y="307" textAnchor="middle" fill="#c4b5fd" fontSize="9">Lambda + Bedrock</text>
      </g>

      <g>
        <rect x="490" y="350" width="170" height="65" rx="8" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
        <text x="575" y="376" textAnchor="middle" fill="#f5f0e8" fontSize="11" fontWeight="600">Document Extraction</text>
        <text x="575" y="392" textAnchor="middle" fill="#c4b5fd" fontSize="9">Lambda + Bedrock</text>
      </g>

      {/* DynamoDB - Amber */}
      <g>
        <rect x="740" y="215" width="150" height="75" rx="10" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" strokeWidth="2.5" />
        <text x="815" y="244" textAnchor="middle" fill="#f5f0e8" fontSize="12" fontWeight="600">DynamoDB</text>
        <text x="815" y="260" textAnchor="middle" fill="#fcd34d" fontSize="9">Reference Data</text>
        <text x="815" y="275" textAnchor="middle" fill="#fcd34d" fontSize="9">Claim Records</text>
      </g>

      {/* Amazon Bedrock - Pink */}
      <g>
        <rect x="740" y="325" width="150" height="65" rx="10" fill="rgba(236, 72, 153, 0.15)" stroke="#ec4899" strokeWidth="2.5" />
        <text x="815" y="354" textAnchor="middle" fill="#f5f0e8" fontSize="12" fontWeight="600">Amazon Bedrock</text>
        <text x="815" y="370" textAnchor="middle" fill="#fbcfe8" fontSize="9">Nova Lite Model</text>
      </g>

      {/* Arrow Markers */}
      <defs>
        <marker id="arrow-teal" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#14b8a6" />
        </marker>
        <marker id="arrow-gold" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
        </marker>
      </defs>

      {/* Frontend to API - Teal */}
      <line x1="190" y1="75" x2="270" y2="75" stroke="#14b8a6" strokeWidth="2" markerEnd="url(#arrow-teal)" />

      {/* API to Lambdas - Gold - spread out more */}
      <path d="M 345 110 Q 345 140, 135 180" stroke="#fbbf24" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-gold)" />
      <path d="M 345 110 Q 345 160, 135 265" stroke="#fbbf24" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-gold)" />
      <path d="M 345 110 Q 345 180, 135 350" stroke="#fbbf24" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-gold)" />
      <path d="M 345 110 Q 345 140, 575 180" stroke="#fbbf24" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-gold)" />
      <path d="M 345 110 Q 345 160, 575 265" stroke="#fbbf24" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-gold)" />
      <path d="M 345 110 Q 345 180, 575 350" stroke="#fbbf24" strokeWidth="1.5" fill="none" markerEnd="url(#arrow-gold)" />

      {/* S3 connection - dashed amber */}
      <line x1="420" y1="65" x2="510" y2="55" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" />

      {/* Lambda to DynamoDB - dashed */}
      <line x1="220" y1="212" x2="740" y2="245" stroke="#6ee7b7" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />
      <line x1="220" y1="297" x2="740" y2="260" stroke="#6ee7b7" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />

      {/* Lambda to Bedrock - dashed */}
      <line x1="660" y1="297" x2="740" y2="345" stroke="#c4b5fd" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />
      <line x1="660" y1="382" x2="740" y2="365" stroke="#c4b5fd" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />

      {/* Legend */}
      <g transform="translate(40, 470)">
        <text x="0" y="0" fill="#c4b5fd" fontSize="10" fontWeight="600">LEGEND:</text>
        <line x1="0" y1="12" x2="25" y2="12" stroke="#14b8a6" strokeWidth="2" markerEnd="url(#arrow-teal)" />
        <text x="32" y="16" fill="#f5f0e8" fontSize="9">API Flow</text>
        <line x1="100" y1="12" x2="125" y2="12" stroke="#6ee7b7" strokeWidth="1.2" strokeDasharray="4 3" />
        <text x="132" y="16" fill="#f5f0e8" fontSize="9">Data Access</text>
      </g>
    </svg>
  );
}
