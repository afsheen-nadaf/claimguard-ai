export default function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 900 600" className="architecture-diagram">
      {/* Frontend */}
      <g>
        <rect x="20" y="50" width="160" height="80" rx="8" fill="var(--surface)" stroke="var(--indigo-600)" strokeWidth="2" />
        <text x="100" y="85" textAnchor="middle" fill="var(--text)" fontSize="14" fontWeight="600">React Frontend</text>
        <text x="100" y="105" textAnchor="middle" fill="var(--muted)" fontSize="11">Wizard Interface</text>
      </g>

      {/* API Gateway */}
      <g>
        <rect x="260" y="50" width="160" height="80" rx="8" fill="var(--surface)" stroke="var(--indigo-600)" strokeWidth="2" />
        <text x="340" y="85" textAnchor="middle" fill="var(--text)" fontSize="14" fontWeight="600">API Gateway</text>
        <text x="340" y="105" textAnchor="middle" fill="var(--muted)" fontSize="11">REST Endpoints</text>
      </g>

      {/* S3 */}
      <g>
        <rect x="500" y="30" width="140" height="60" rx="8" fill="var(--surface)" stroke="var(--amber-600)" strokeWidth="2" />
        <text x="570" y="57" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="600">S3 Bucket</text>
        <text x="570" y="75" textAnchor="middle" fill="var(--muted)" fontSize="10">Document Storage</text>
      </g>

      {/* Lambda Functions */}
      <g>
        <rect x="240" y="200" width="180" height="70" rx="8" fill="var(--slate-100)" stroke="var(--green-600)" strokeWidth="2" />
        <text x="330" y="227" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="600">Policy Validation</text>
        <text x="330" y="245" textAnchor="middle" fill="var(--muted)" fontSize="10">Lambda + DynamoDB</text>
      </g>

      <g>
        <rect x="240" y="290" width="180" height="70" rx="8" fill="var(--slate-100)" stroke="var(--green-600)" strokeWidth="2" />
        <text x="330" y="317" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="600">Duplicate Detection</text>
        <text x="330" y="335" textAnchor="middle" fill="var(--muted)" fontSize="10">Lambda + Image Hashing</text>
      </g>

      <g>
        <rect x="240" y="380" width="180" height="70" rx="8" fill="var(--slate-100)" stroke="var(--green-600)" strokeWidth="2" />
        <text x="330" y="407" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="600">Outlier Detection</text>
        <text x="330" y="425" textAnchor="middle" fill="var(--muted)" fontSize="10">Lambda + Statistics</text>
      </g>

      <g>
        <rect x="480" y="200" width="180" height="70" rx="8" fill="var(--slate-100)" stroke="var(--violet-600)" strokeWidth="2" />
        <text x="570" y="227" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="600">Image Forensics</text>
        <text x="570" y="245" textAnchor="middle" fill="var(--muted)" fontSize="10">Container Lambda + ML</text>
      </g>

      <g>
        <rect x="480" y="290" width="180" height="70" rx="8" fill="var(--slate-100)" stroke="var(--violet-600)" strokeWidth="2" />
        <text x="570" y="317" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="600">Evidence Relevance</text>
        <text x="570" y="335" textAnchor="middle" fill="var(--muted)" fontSize="10">Lambda + Bedrock</text>
      </g>

      <g>
        <rect x="480" y="380" width="180" height="70" rx="8" fill="var(--slate-100)" stroke="var(--violet-600)" strokeWidth="2" />
        <text x="570" y="407" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="600">Document Extraction</text>
        <text x="570" y="425" textAnchor="middle" fill="var(--muted)" fontSize="10">Lambda + Bedrock</text>
      </g>

      {/* DynamoDB */}
      <g>
        <rect x="720" y="240" width="160" height="80" rx="8" fill="var(--surface)" stroke="var(--amber-600)" strokeWidth="2" />
        <text x="800" y="270" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="600">DynamoDB</text>
        <text x="800" y="288" textAnchor="middle" fill="var(--muted)" fontSize="10">Reference Data</text>
        <text x="800" y="303" textAnchor="middle" fill="var(--muted)" fontSize="10">Claim Records</text>
      </g>

      {/* Bedrock */}
      <g>
        <rect x="720" y="360" width="160" height="70" rx="8" fill="var(--surface)" stroke="var(--amber-600)" strokeWidth="2" />
        <text x="800" y="387" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="600">Amazon Bedrock</text>
        <text x="800" y="405" textAnchor="middle" fill="var(--muted)" fontSize="10">Nova Lite Model</text>
      </g>

      {/* Arrows */}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="var(--indigo-600)" />
        </marker>
      </defs>

      {/* Frontend to API */}
      <line x1="180" y1="90" x2="260" y2="90" stroke="var(--indigo-600)" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* API to Lambda functions */}
      <line x1="340" y1="130" x2="330" y2="200" stroke="var(--indigo-600)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
      <line x1="340" y1="130" x2="330" y2="290" stroke="var(--indigo-600)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
      <line x1="340" y1="130" x2="330" y2="380" stroke="var(--indigo-600)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
      <line x1="340" y1="130" x2="570" y2="200" stroke="var(--indigo-600)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
      <line x1="340" y1="130" x2="570" y2="290" stroke="var(--indigo-600)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
      <line x1="340" y1="130" x2="570" y2="380" stroke="var(--indigo-600)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />

      {/* S3 connections */}
      <line x1="420" y1="70" x2="500" y2="60" stroke="var(--amber-600)" strokeWidth="1.5" strokeDasharray="4" />

      {/* Lambda to DynamoDB */}
      <line x1="420" y1="235" x2="720" y2="270" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4" />
      <line x1="420" y1="325" x2="720" y2="285" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4" />

      {/* Lambda to Bedrock */}
      <line x1="660" y1="325" x2="720" y2="380" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4" />
      <line x1="660" y1="415" x2="720" y2="400" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4" />

      {/* Legend */}
      <g transform="translate(20, 520)">
        <text x="0" y="0" fill="var(--muted)" fontSize="11" fontWeight="600">LEGEND:</text>
        <line x1="0" y1="15" x2="30" y2="15" stroke="var(--indigo-600)" strokeWidth="2" markerEnd="url(#arrowhead)" />
        <text x="40" y="19" fill="var(--muted)" fontSize="10">API Call</text>
        <line x1="120" y1="15" x2="150" y2="15" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4" />
        <text x="160" y="19" fill="var(--muted)" fontSize="10">Data Access</text>
      </g>
    </svg>
  );
}
