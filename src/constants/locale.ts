export type Locale = 'ko' | 'en' | 'ja' | 'zh'

/**
 * Locale string keys — all values are plain strings.
 * required_error supports {{label}} template placeholder.
 */
export interface LocaleStrings {
  submit: string
  submitting: string
  submitted_title: string
  submitted_subtitle: string
  /** Template: use {{label}} as the field name placeholder */
  required_error: string
  preview_note: string
  select_placeholder: string
  agree_label: string
}

export const DEFAULT_LOCALE_STRINGS: Record<Locale, LocaleStrings> = {
  ko: {
    submit: '제출하기',
    submitting: '제출 중...',
    submitted_title: '제출이 완료되었습니다!',
    submitted_subtitle: '응답해주셔서 감사합니다.',
    required_error: "'{{label}}' 항목은 필수입니다.",
    preview_note: '미리보기 모드에서는 제출되지 않습니다.',
    select_placeholder: '선택하세요',
    agree_label: '동의합니다',
  },
  en: {
    submit: 'Submit',
    submitting: 'Submitting...',
    submitted_title: 'Submission Complete!',
    submitted_subtitle: 'Thank you for your response.',
    required_error: "'{{label}}' is required.",
    preview_note: 'Submission is disabled in preview mode.',
    select_placeholder: 'Select an option',
    agree_label: 'I agree',
  },
  ja: {
    submit: '送信する',
    submitting: '送信中...',
    submitted_title: '送信が完了しました！',
    submitted_subtitle: 'ご回答ありがとうございます。',
    required_error: "'{{label}}' は必須項目です。",
    preview_note: 'プレビューモードでは送信できません。',
    select_placeholder: '選択してください',
    agree_label: '同意します',
  },
  zh: {
    submit: '提交',
    submitting: '提交中...',
    submitted_title: '提交完成！',
    submitted_subtitle: '感谢您的填写。',
    required_error: "'{{label}}' 为必填项。",
    preview_note: '预览模式下无法提交。',
    select_placeholder: '请选择',
    agree_label: '我同意',
  },
}

export const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
}

export const ALL_LOCALES: Locale[] = ['ko', 'en', 'ja', 'zh']

/** Merges default strings with stored overrides for a given locale */
export function resolveLocaleStrings(
  locale: Locale,
  overrides?: Partial<Record<Locale, Partial<LocaleStrings>>>
): LocaleStrings {
  return { ...DEFAULT_LOCALE_STRINGS[locale], ...(overrides?.[locale] ?? {}) }
}
