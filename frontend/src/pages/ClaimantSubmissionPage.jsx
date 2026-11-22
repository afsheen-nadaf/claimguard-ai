import { useState } from "react";
import toast from "react-hot-toast";
import { fetchDocumentViewUrl } from "../api/claims";
import Icon from "../components/Icon";
import Breadcrumbs from "../components/Breadcrumbs";
import { Card, EmptyState, KeyValueList, PageHeader } from "../components/ui";
import { formatBytes, formatDate, formatDateTime, formatINR } from "../lib/format";

export default function ClaimantSubmissionPage({ record, navigate }) {
  const [copied, setCopied] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [loadingDocKey, setLoadingDocKey] = useState(null);

  if (!record) {
    return (
      <div className="min-h-screen bg-[#0f0b14] p-8">
        <PageHeader eyebrow="MY SUBMISSION" title="Submission not found" />
        <Card>
          <EmptyState
            icon="history"
            title="We couldn't find this claim submission"
            action={
              <button
                type="button"
                className="px-5 py-2.5 bg-[#251d33] text-purple-100 border border-purple-700/30 rounded-xl font-semibold hover:bg-[#2d2440] transition-all"
                onClick={() => navigate("/history")}
              >
                Back to my claims
              </button>
            }
          >
            This claim is not available in your account or may have been removed.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const { claim } = record;
  const documents = Array.isArray(record.documents) ? record.documents : [];
  const isProcessing = record.screeningStatus === "RUNNING";

  async function copyId() {
    try {
      await navigator.clipboard.writeText(record.id);
      setCopied(true);
      toast.success("Claim ID copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy Claim ID");
    }
  }

  async function handleViewDocument(doc) {
    const docKey = doc.s3Key || doc.key;
    if (!docKey) {
      toast.error("File preview is unavailable for this entry.");
      return;
    }
    setLoadingDocKey(docKey);
    try {
      const data = await fetchDocumentViewUrl(record.id, docKey);
      setPreviewDoc({
        url: data.url,
        name: doc.name || data.name,
        contentType: doc.type || doc.contentType || data.contentType || "",
      });
    } catch (error) {
      toast.error(error.message || "Could not load document preview.");
    } finally {
      setLoadingDocKey(null);
    }
  }

  const breadcrumbItems = [
    { label: "My Claims", icon: "history", href: "/history", onClick: () => navigate("/history") },
    { label: record.id, icon: "file" },
  ];

  return (
    <div className="min-h-screen bg-[#0f0b14]">
      <div className="bg-[#1a1425]/40 backdrop-blur-sm border-b border-purple-900/10">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-block text-[10px] font-bold tracking-[0.15em] text-purple-400 uppercase mb-2">
              Claim Submission Details
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Claim #{record.id}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  isProcessing
                    ? "bg-purple-500/10 text-purple-200 border-purple-500/30"
                    : "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isProcessing ? "bg-purple-400 animate-pulse" : "bg-emerald-400"
                  }`}
                />
                {isProcessing ? "Processing" : "Submitted"}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-sm text-purple-200 mt-2">
              <span>Submitted {formatDateTime(record.submittedAt)}</span>
              <span className="text-purple-700">•</span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                onClick={copyId}
              >
                <Icon name="copy" size={14} />
                {copied ? "Copied!" : "Copy ID"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-4 py-2.5 bg-[#251d33] text-purple-100 border border-purple-700/30 rounded-xl font-semibold hover:bg-[#2d2440] hover:border-purple-600/50 transition-all flex items-center gap-2"
              onClick={() => navigate("/history")}
            >
              <Icon name="arrowLeft" size={16} />
              <span>Back to My Claims</span>
            </button>
            <button
              type="button"
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-500 hover:to-purple-600 transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2"
              onClick={() => navigate("/new")}
            >
              <Icon name="filePlus" size={16} />
              <span>New Claim</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Submitted Details */}
          <div className="bg-gradient-to-br from-[#1a1425]/90 to-[#251d33]/70 backdrop-blur-md border border-purple-700/30 rounded-2xl p-7 shadow-xl">
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-white mb-5">
              <Icon name="info" size={20} className="text-purple-400" />
              <span>Submitted Information</span>
            </h2>
            <KeyValueList
              items={[
                { label: "Claimant Name", value: claim.claimantName || "—" },
                { label: "Policy Number", value: claim.policyNumber || "—" },
                { label: "Claim Type", value: claim.claimType || "—" },
                { label: "Incident Date", value: formatDate(claim.incidentDate) },
                { label: "Claim Amount", value: formatINR(claim.claimAmountINR) },
                { label: "Submitted On", value: formatDateTime(record.submittedAt) },
              ]}
            />
          </div>

          {/* Uploaded Documents & Photos */}
          <div className="bg-gradient-to-br from-[#1a1425]/90 to-[#251d33]/70 backdrop-blur-md border border-purple-700/30 rounded-2xl p-7 shadow-xl">
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-white mb-5">
              <Icon name="file" size={20} className="text-purple-400" />
              <span>
                Uploaded Evidence{" "}
                <span className="text-sm font-normal text-purple-300">
                  ({documents.length})
                </span>
              </span>
            </h2>

            {documents.length === 0 ? (
              <p className="text-sm text-purple-300">
                No documents or photos were attached to this submission.
              </p>
            ) : (
              <ul className="space-y-3">
                {documents.map((d, i) => {
                  const docKey = d.s3Key || d.key;
                  const docType = d.type || d.contentType || "";
                  const isPdf =
                    docType === "application/pdf" ||
                    d.name?.toLowerCase().endsWith(".pdf");
                  return (
                    <li
                      key={`${d.name}-${i}`}
                      className="flex items-center gap-3 p-4 bg-purple-950/60 border border-purple-800/50 rounded-xl hover:bg-purple-900/60 hover:border-purple-700/50 transition-all group"
                    >
                      <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-700 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Icon name={isPdf ? "file" : "image"} size={20} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-white truncate">
                          {d.name}
                        </div>
                        <div className="text-xs text-purple-400 flex items-center gap-2 mt-1">
                          <span className="truncate">{docType || "Document"}</span>
                          {typeof d.size === "number" && (
                            <>
                              <span>•</span>
                              <span>{formatBytes(d.size)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {docKey && (
                        <button
                          type="button"
                          disabled={loadingDocKey === docKey}
                          onClick={() => handleViewDocument(d)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-800/60 text-purple-100 border border-purple-600/40 hover:bg-purple-700/70 hover:text-white transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                        >
                          <Icon name="eye" size={14} />
                          <span>{loadingDocKey === docKey ? "Loading..." : "View"}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Inline Document / Photo Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-[#1a1425] border border-purple-700/40 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-purple-800/40">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{previewDoc.name}</h4>
                <p className="text-xs text-purple-400">{previewDoc.contentType}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-900/60 text-purple-200 border border-purple-700/40 hover:bg-purple-800 transition-colors"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#251d33] text-purple-100 border border-purple-700/40 hover:bg-[#2d2440] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#0f0b14]">
              {previewDoc.contentType === "application/pdf" ||
              previewDoc.name?.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-[72vh] rounded-xl border border-purple-800/40 bg-white"
                />
              ) : (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}