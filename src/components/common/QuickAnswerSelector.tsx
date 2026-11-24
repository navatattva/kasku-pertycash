interface QuickAnswerSelectorProps {
  idPrefix: string;
  label: string;
  helperText?: string;
  options: readonly string[];
  selectedOptions: string[];
  onToggleOption: (option: string) => void;
  includeOther: boolean;
  onToggleOther: (next: boolean) => void;
  otherText: string;
  onOtherTextChange: (value: string) => void;
  otherLabel?: string;
  otherPlaceholder?: string;
  variant?: 'approve' | 'reject';
}

export function QuickAnswerSelector({
  idPrefix,
  label,
  helperText,
  options,
  selectedOptions,
  onToggleOption,
  includeOther,
  onToggleOther,
  otherText,
  onOtherTextChange,
  otherLabel = 'Lainnya (Tulis alasan/catatan manual)',
  otherPlaceholder = 'Tulis catatan atau alasan tambahan...',
  variant = 'reject',
}: QuickAnswerSelectorProps) {
  const activeBorderClass =
    variant === 'reject'
      ? 'border-rose-300 bg-rose-50/70 text-rose-900'
      : 'border-emerald-300 bg-emerald-50/70 text-emerald-900';

  const checkboxAccentClass =
    variant === 'reject'
      ? 'text-rose-700 focus:ring-rose-600'
      : 'text-emerald-700 focus:ring-emerald-700';

  return (
    <fieldset className="space-y-2.5">
      <legend className="block text-xs font-semibold text-slate-700">
        {label}
      </legend>
      {helperText && <p className="text-[11px] text-slate-500">{helperText}</p>}

      <div className="space-y-1.5">
        {options.map((option, idx) => {
          const checked = selectedOptions.includes(option);
          const inputId = `${idPrefix}-opt-${idx}`;
          return (
            <label
              key={option}
              htmlFor={inputId}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                checked
                  ? activeBorderClass
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => onToggleOption(option)}
                className={`mt-0.5 h-3.5 w-3.5 rounded border-slate-300 shrink-0 ${checkboxAccentClass}`}
              />
              <span className="leading-snug font-medium">{option}</span>
            </label>
          );
        })}

        <label
          htmlFor={`${idPrefix}-other-toggle`}
          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
            includeOther
              ? activeBorderClass
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <input
            id={`${idPrefix}-other-toggle`}
            type="checkbox"
            checked={includeOther}
            onChange={(e) => onToggleOther(e.target.checked)}
            className={`mt-0.5 h-3.5 w-3.5 rounded border-slate-300 shrink-0 ${checkboxAccentClass}`}
          />
          <span className="leading-snug font-medium">{otherLabel}</span>
        </label>
      </div>

      {includeOther && (
        <div className="pt-1">
          <label
            htmlFor={`${idPrefix}-other-text`}
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Keterangan Lainnya
          </label>
          <textarea
            id={`${idPrefix}-other-text`}
            rows={2}
            value={otherText}
            onChange={(e) => onOtherTextChange(e.target.value)}
            placeholder={otherPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
          />
        </div>
      )}
    </fieldset>
  );
}
