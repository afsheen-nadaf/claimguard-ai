import { useEffect, useRef, useState } from "react";
import { CLAIM_TYPES } from "../../api/config";
import { FIELD_ORDER, validateField } from "../../lib/validation";
import { formatINR, todayISO } from "../../lib/format";
import Icon from "../Icon";
import { Callout, Card } from "../ui";

const NAME_PATTERN = /^[\p{L}\s]+$/u;

function validateClaimantName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Enter the claimant's full name.";
  if (!NAME_PATTERN.test(trimmed)) {
    return "Name can only contain letters and spaces (no numbers or symbols).";
  }
  return null;
}

function Field({ id, label, required = true, error, hint, children, className = "" }) {
  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`}>
      <label htmlFor={id}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`}><Icon name="alert" size={14} />{error}</p>}
    </div>
  );
}

function ClaimTypeDropdown({ id, value, onChange, onBlur, ariaInvalid, ariaDescribedBy }) {
  const [isOpen, setIsOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(260);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
        onBlur?.();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    const activeItem =
      menuRef.current?.querySelector('[aria-checked="true"]') ||
      menuRef.current?.querySelector('[role="menuitemradio"]');
    activeItem?.focus();

    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen, onBlur]);

  function handleMenuKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll('[role="menuitemradio"]') || []
    );
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[nextIndex]?.focus();
  }

  function selectOption(optionValue) {
    onChange(optionValue);
    onBlur?.();
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function toggleMenu() {
    if (isOpen) {
      setIsOpen(false);
      onBlur?.();
      return;
    }

    const bounds = triggerRef.current?.getBoundingClientRect();
    if (bounds) {
      const spaceBelow = window.innerHeight - bounds.bottom;
      const spaceAbove = bounds.top;
      const desiredHeight = Math.min(CLAIM_TYPES.length * 42 + 12, 260);
      const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
      setOpensUp(openAbove);
      setMenuMaxHeight(
        Math.max(120, Math.min(desiredHeight, Math.max(spaceAbove, spaceBelow) - 16))
      );
    }
    setIsOpen(true);
  }

  return (
    <div ref={dropdownRef} className="history-dropdown w-full">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="history-filter-trigger w-full justify-between"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            toggleMenu();
          }
        }}
      >
        <span className={value ? "text-white" : "text-purple-400"}>
          {value || "Select claim type"}
        </span>
        <Icon
          name="chevron"
          size={16}
          className={`text-purple-300 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          className={`history-filter-menu w-full ${opensUp ? "opens-up" : ""}`}
          role="menu"
          aria-labelledby={id}
          style={{ maxHeight: `${menuMaxHeight}px` }}
          onKeyDown={handleMenuKeyDown}
        >
          {CLAIM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="history-filter-option"
              role="menuitemradio"
              aria-checked={type === value}
              onClick={() => selectOption(type)}
            >
              <span>{type}</span>
              {type === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClaimDetailsStep({ draft, onContinue, hideFooter = false, entryMode = "manual" }) {
  const { form, setField, touched, touch, attempted, setAttempted } = draft;
  const nameError =
    touched.claimantName || attempted
      ? validateClaimantName(form.claimantName)
      : null;
  const visibleError = (name) =>
    name === "claimantName"
      ? nameError
      : touched[name] || attempted
        ? validateField(name, form)
        : null;
  const describe = (name, hasHint) => (visibleError(name) ? `${name}-error` : hasHint ? `${name}-hint` : undefined);
  const common = (name, hasHint = false) => ({
    id: name,
    "aria-invalid": visibleError(name) ? "true" : undefined,
    "aria-describedby": describe(name, hasHint),
    onBlur: () => touch(name),
  });

  function handleNameChange(e) {
    const sanitized = e.target.value.replace(/[^\p{L}\s]/gu, "");
    setField("claimantName", sanitized);
  }

  function handleContinue() {
    setAttempted(true);
    if (validateClaimantName(form.claimantName)) {
      document.getElementById("claimantName")?.focus();
      return;
    }
    const firstInvalid = FIELD_ORDER.find((name) => validateField(name, form));
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    onContinue();
  }

  const amountPreview = !validateField("amount", form) ? formatINR(Number(form.amount)) : null;

  return (
    <Card
      title="Claim information"
      icon="file"
      description={entryMode === "upload"
        ? "Review the details extracted from your documents and fill any gaps."
        : "Enter the claim details manually. You can review and edit everything before submitting."}
    >
      <Callout tone="info">
        <p className="small">
          {entryMode === "upload"
            ? "Extracted values fill empty fields only. Check each detail; you can edit any value before submitting."
            : "Supporting documents are added after these details. If uploaded later, extraction fills empty fields only."}
        </p>
      </Callout>
      <form
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
      >
        <Field
          id="claimantName"
          label="Claimant full name"
          className="span-2"
          error={visibleError("claimantName")}
          hint="Full name of the policyholder or claimant (letters and spaces only)"
        >
          <input
            {...common("claimantName", true)}
            type="text"
            value={form.claimantName || ""}
            onChange={handleNameChange}
            placeholder="e.g. Aarav Sharma"
            maxLength={120}
            autoComplete="off"
          />
        </Field>

        <Field id="claimType" label="Claim type" error={visibleError("claimType")}>
          <ClaimTypeDropdown
            id="claimType"
            value={form.claimType}
            onChange={(val) => setField("claimType", val)}
            onBlur={() => touch("claimType")}
            ariaInvalid={visibleError("claimType") ? "true" : undefined}
            ariaDescribedBy={describe("claimType", false)}
          />
        </Field>

        <Field id="policyNumber" label="Policy number" error={visibleError("policyNumber")}>
          <input
            {...common("policyNumber")}
            type="text"
            value={form.policyNumber}
            onChange={(e) => setField("policyNumber", e.target.value)}
            placeholder="e.g. POL-2024-001234"
            maxLength={80}
            autoComplete="off"
          />
        </Field>

        <Field id="incidentDate" label="Incident date" error={visibleError("incidentDate")}>
          <input
            {...common("incidentDate")}
            type="date"
            max={todayISO()}
            value={form.incidentDate}
            onChange={(e) => setField("incidentDate", e.target.value)}
          />
        </Field>

        <Field
          id="amount"
          label="Claim amount (INR)"
          error={visibleError("amount")}
          hint={amountPreview ? `Reads as ${amountPreview}` : "Up to 2 decimal places"}
        >
          <div className="input-affix">
            <span aria-hidden="true">₹</span>
            <input
              {...common("amount", true)}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="e.g. 125000"
            />
          </div>
        </Field>

        <Field id="location" label="Incident location" className="span-2" error={visibleError("location")}>
          <input
            {...common("location")}
            type="text"
            value={form.location}
            onChange={(e) => setField("location", e.target.value)}
            placeholder="City, state or incident location"
            maxLength={200}
          />
        </Field>

        <Field id="description" label="Incident description" className="span-2" error={visibleError("description")}>
          <textarea
            {...common("description")}
            rows={5}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Describe what happened, including relevant dates and circumstances…"
            maxLength={1000}
          />
          <span className="char-count" aria-live="off">{form.description.length}/1000</span>
        </Field>

        {!hideFooter && (
          <div className="form-footer span-2">
            <span className="required-note"><span className="req">*</span> Required</span>
            <button type="submit" className="btn btn-primary">
              Continue to documents <Icon name="arrow" size={17} />
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}