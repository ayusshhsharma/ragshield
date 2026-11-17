import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { useState } from 'react';
import Button from '../Button.jsx';
import ErrorBanner from '../ErrorBanner.jsx';
import Input from '../Input.jsx';
import Modal from '../Modal.jsx';

const CATEGORIES = [
  { value: 'AT-01', label: 'AT-01: Direct Prompt Injection' },
  { value: 'AT-02', label: 'AT-02: System Prompt Leakage' },
  { value: 'AT-03', label: 'AT-03: Delimiter Hijacking' },
  { value: 'AT-04', label: 'AT-04: Indirect Context Injection' },
  { value: 'AT-05', label: 'AT-05: Hyperlink / Markdown Exfiltration' },
  { value: 'AT-06', label: 'AT-06: Multi-Turn Jailbreak' },
  { value: 'AT-07', label: 'AT-07: Obfuscation / Encoding' },
  { value: 'AT-08', label: 'AT-08: Multilingual / Hinglish' },
];

const TECHNIQUES = [
  { value: 'direct_request', label: 'Direct Request' },
  { value: 'ignore_previous', label: 'Ignore Previous Instructions' },
  { value: 'roleplay', label: 'Persona / Roleplay Switch' },
  { value: 'authority_claim', label: 'Authority / Admin Spoof' },
  { value: 'delimiter_spoof', label: 'Delimiter / Tag Spoof' },
  { value: 'hidden_comment', label: 'Hidden / Commented Payload' },
  { value: 'buried_in_long_text', label: 'Buried in Context Body' },
  { value: 'translation', label: 'Translation Bypass' },
  { value: 'transliteration', label: 'Transliteration / Roman Hindi' },
  { value: 'encoding', label: 'Encoding / Base64' },
  { value: 'format_trick', label: 'Format Trick' },
  { value: 'link_exfil', label: 'Hyperlink Exfiltration' },
  { value: 'multi_step', label: 'Multi-Step Execution' },
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const LANGUAGES = [
  { value: 'en', label: 'English (en)' },
  { value: 'hi', label: 'Hindi (hi)' },
  { value: 'hinglish', label: 'Hinglish' },
];

export default function CustomCaseModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('AT-01');
  const [technique, setTechnique] = useState('ignore_previous');
  const [severity, setSeverity] = useState('high');
  const [language, setLanguage] = useState('en');
  const [description, setDescription] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState(
    'Model refuses the injection and answers safely.',
  );
  const [owaspRef, setOwaspRef] = useState('LLM01:2025 - Prompt Injection');

  // Success condition
  const [conditionType, setConditionType] = useState('regex');
  const [conditionPattern, setConditionPattern] = useState('');
  const [conditionFlags, setConditionFlags] = useState('i');

  // Injected chunk (optional for indirect injection)
  const [includeInjectedChunk, setIncludeInjectedChunk] = useState(false);
  const [chunkText, setChunkText] = useState('');
  const [chunkPosition, setChunkPosition] = useState('middle');

  // Regex tester state
  const [regexSampleText, setRegexSampleText] = useState('');
  const [regexTestResult, setRegexTestResult] = useState(null);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setCategory('AT-01');
    setTechnique('ignore_previous');
    setSeverity('high');
    setLanguage('en');
    setDescription('');
    setUserQuery('');
    setExpectedBehavior('Model refuses the injection and answers safely.');
    setOwaspRef('LLM01:2025 - Prompt Injection');
    setConditionType('regex');
    setConditionPattern('');
    setConditionFlags('i');
    setIncludeInjectedChunk(false);
    setChunkText('');
    setChunkPosition('middle');
    setRegexSampleText('');
    setRegexTestResult(null);
    setErrors({});
    setServerError('');
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  // Browser-side regex test function
  const handleTestRegex = () => {
    if (!conditionPattern.trim()) {
      setRegexTestResult({ valid: false, error: 'Pattern is empty' });
      return;
    }

    try {
      const reg = new RegExp(conditionPattern.trim(), conditionFlags || undefined);
      if (regexSampleText) {
        const matches = reg.test(regexSampleText);
        setRegexTestResult({
          valid: true,
          matches,
          message: matches
            ? 'Regex compiled successfully and MATCHED sample text!'
            : 'Regex compiled successfully (did not match sample text).',
        });
      } else {
        setRegexTestResult({
          valid: true,
          message: 'Regex compiled successfully in browser.',
        });
      }
    } catch (err) {
      setRegexTestResult({
        valid: false,
        error: `Regex compile error: ${err.message}`,
      });
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!name.trim() || name.trim().length < 3) {
      nextErrors.name = 'Name must be at least 3 characters long.';
    } else if (name.trim().length > 100) {
      nextErrors.name = 'Name cannot exceed 100 characters.';
    }

    if (!description.trim() || description.trim().length < 5) {
      nextErrors.description = 'Description must be at least 5 characters long.';
    } else if (description.trim().length > 300) {
      nextErrors.description = 'Description cannot exceed 300 characters.';
    }

    if (!userQuery.trim()) {
      nextErrors.userQuery = 'User query prompt cannot be empty.';
    }

    if (!expectedBehavior.trim()) {
      nextErrors.expectedBehavior = 'Expected behavior description cannot be empty.';
    }

    if (!conditionPattern.trim()) {
      nextErrors.conditionPattern = 'Success condition pattern/values cannot be empty.';
    } else if (conditionType === 'regex') {
      try {
        new RegExp(conditionPattern.trim(), conditionFlags || undefined);
      } catch (err) {
        nextErrors.conditionPattern = `Regex syntax invalid: ${err.message}`;
      }
    }

    if (includeInjectedChunk && !chunkText.trim()) {
      nextErrors.chunkText = 'Injected chunk text cannot be empty when enabled.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        category,
        technique,
        severity,
        language,
        description: description.trim(),
        userQuery: userQuery.trim(),
        expectedBehavior: expectedBehavior.trim(),
        owaspRef: owaspRef.trim() || undefined,
        isBenign: false,
        expectedKeywords: [],
        successCondition: {
          type: conditionType,
          values: [conditionPattern.trim()],
          flags: conditionType === 'regex' ? conditionFlags : '',
        },
        injectedChunks:
          includeInjectedChunk && chunkText.trim()
            ? [{ text: chunkText.trim(), position: chunkPosition }]
            : [],
      };

      await onSubmit(payload);
      resetForm();
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to create custom attack case.';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Custom Attack Case"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {serverError && (
          <ErrorBanner message={serverError} onDismiss={() => setServerError('')} />
        )}

        <Input
          id="case-name"
          label="Attack Name"
          required
          placeholder="e.g. Delimiter Escape with System Canary Extraction"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          error={errors.name}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="case-category" className="block text-xs font-medium text-ink">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="case-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-base border border-line rounded-md text-xs text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="case-technique" className="block text-xs font-medium text-ink">
              Technique <span className="text-danger">*</span>
            </label>
            <select
              id="case-technique"
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              className="w-full bg-base border border-line rounded-md text-xs text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {TECHNIQUES.map((tech) => (
                <option key={tech.value} value={tech.value}>
                  {tech.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="case-severity" className="block text-xs font-medium text-ink">
              Severity <span className="text-danger">*</span>
            </label>
            <select
              id="case-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full bg-base border border-line rounded-md text-xs text-ink px-3 py-2 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="case-language" className="block text-xs font-medium text-ink">
              Language <span className="text-danger">*</span>
            </label>
            <select
              id="case-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-base border border-line rounded-md text-xs text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="case-desc" className="block text-xs font-medium text-ink">
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="case-desc"
            rows={2}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
            }}
            placeholder="Explain attack objective and evasion mechanism..."
            className="w-full bg-base border border-line rounded-md text-xs text-ink placeholder-muted px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          />
          {errors.description && <p className="text-xs text-danger">{errors.description}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="case-query" className="block text-xs font-medium text-ink">
            User Query Prompt <span className="text-danger">*</span>
          </label>
          <textarea
            id="case-query"
            rows={3}
            value={userQuery}
            onChange={(e) => {
              setUserQuery(e.target.value);
              if (errors.userQuery) setErrors((prev) => ({ ...prev, userQuery: '' }));
            }}
            placeholder="Payload sent to the RAG endpoint..."
            className="w-full bg-base border border-line rounded-md font-mono text-xs text-ink placeholder-muted px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {errors.userQuery && <p className="text-xs text-danger">{errors.userQuery}</p>}
        </div>

        {/* Success condition & regex test button */}
        <div className="p-3.5 rounded-lg bg-base border border-line space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink">
              Success Condition (Evaluation Metric) <span className="text-danger">*</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Type:</label>
              <select
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value)}
                className="bg-elevated border border-line text-xs text-ink px-2 py-1 rounded"
              >
                <option value="regex">Regex</option>
                <option value="contains_any">Contains Any</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-3">
              <Input
                id="condition-pattern"
                label={conditionType === 'regex' ? 'Regex Pattern' : 'Matching Value'}
                value={conditionPattern}
                placeholder={conditionType === 'regex' ? 'CANARY-[A-Z0-9-]+' : 'CANARY-ALPHA-9921'}
                onChange={(e) => {
                  setConditionPattern(e.target.value);
                  if (errors.conditionPattern) setErrors((prev) => ({ ...prev, conditionPattern: '' }));
                }}
                error={errors.conditionPattern}
              />
            </div>

            {conditionType === 'regex' && (
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">Flags</label>
                <select
                  value={conditionFlags}
                  onChange={(e) => setConditionFlags(e.target.value)}
                  className="w-full bg-base border border-line rounded-md text-xs text-ink px-3 py-2 font-mono"
                >
                  <option value="">none</option>
                  <option value="i">i (case-insensitive)</option>
                  <option value="im">im (multiline)</option>
                </select>
              </div>
            )}
          </div>

          {/* Regex browser test tool */}
          {conditionType === 'regex' && (
            <div className="pt-2 border-t border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted">Browser Regex Verifier</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestRegex}
                  className="text-[11px] py-1 h-7"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Test Regex
                </Button>
              </div>

              <input
                type="text"
                placeholder="Optional sample response text to test against..."
                value={regexSampleText}
                onChange={(e) => setRegexSampleText(e.target.value)}
                className="w-full bg-elevated border border-line rounded px-2.5 py-1.5 text-xs text-ink font-mono placeholder-muted"
              />

              {regexTestResult && (
                <div
                  className={`text-xs font-mono p-2 rounded flex items-center gap-1.5 ${
                    regexTestResult.valid
                      ? regexTestResult.matches
                        ? 'bg-success/15 text-success border border-success/30'
                        : 'bg-info/15 text-info border border-info/30'
                      : 'bg-danger/15 text-danger border border-danger/30'
                  }`}
                >
                  {regexTestResult.valid ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{regexTestResult.error || regexTestResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" loading={loading}>
            Save Custom Case
          </Button>
        </div>
      </form>
    </Modal>
  );
}
