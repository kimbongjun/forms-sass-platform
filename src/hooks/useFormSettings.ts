import { useState } from 'react'
import type { Project, LocaleSettings } from '@/types/database'

const DEFAULT_LOCALE_SETTINGS: LocaleSettings = {
  enabled: false,
  default_locale: 'ko',
  available_locales: ['ko'],
  overrides: {},
}

function isHtmlEmpty(html: string) {
  return !html || html.replace(/<[^>]*>/g, '').trim() === ''
}

type Initial = Partial<Project> & { initialDeadline?: string }

export function useFormSettings(initial: Initial = {}) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [customSlug, setCustomSlug] = useState('')
  const [isPublished, setIsPublished] = useState(initial.is_published ?? true)
  const [themeColor, setThemeColor] = useState(initial.theme_color ?? '#111827')
  const [notificationEmail, setNotificationEmail] = useState(initial.notification_email ?? '')
  const [deadline, setDeadline] = useState(initial.initialDeadline ?? '')
  const [maxSubmissions, setMaxSubmissions] = useState(
    initial.max_submissions != null ? String(initial.max_submissions) : ''
  )
  const [webhookUrl, setWebhookUrl] = useState(initial.webhook_url ?? '')
  const [submissionMessage, setSubmissionMessage] = useState(initial.submission_message ?? '')
  const [adminEmailTemplate, setAdminEmailTemplate] = useState(initial.admin_email_template ?? '')
  const [userEmailTemplate, setUserEmailTemplate] = useState(initial.user_email_template ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnail_url ?? '')
  const [localeSettings, setLocaleSettings] = useState<LocaleSettings>(
    initial.locale_settings ?? DEFAULT_LOCALE_SETTINGS
  )

  /** Payload for POST /api/projects (camelCase) */
  function toApiPayload() {
    return {
      notificationEmail: notificationEmail.trim() || null,
      themeColor: themeColor || '#111827',
      isPublished,
      deadline: deadline || null,
      maxSubmissions: maxSubmissions ? parseInt(maxSubmissions, 10) : null,
      webhookUrl: webhookUrl.trim() || null,
      submissionMessage: submissionMessage.trim() || null,
      adminEmailTemplate: isHtmlEmpty(adminEmailTemplate) ? null : adminEmailTemplate,
      userEmailTemplate: isHtmlEmpty(userEmailTemplate) ? null : userEmailTemplate,
      thumbnailUrl: thumbnailUrl || null,
      localeSettings,
    }
  }

  /** Payload for Supabase .update() (snake_case) */
  function toUpdatePayload() {
    return {
      notification_email: notificationEmail.trim() || null,
      theme_color: themeColor || '#111827',
      is_published: isPublished,
      deadline: deadline || null,
      max_submissions: maxSubmissions ? parseInt(maxSubmissions, 10) : null,
      webhook_url: webhookUrl.trim() || null,
      submission_message: submissionMessage.trim() || null,
      admin_email_template: isHtmlEmpty(adminEmailTemplate) ? null : adminEmailTemplate,
      user_email_template: isHtmlEmpty(userEmailTemplate) ? null : userEmailTemplate,
      thumbnail_url: thumbnailUrl || null,
      locale_settings: localeSettings,
    }
  }

  return {
    title, setTitle,
    customSlug, setCustomSlug,
    isPublished, setIsPublished,
    themeColor, setThemeColor,
    notificationEmail, setNotificationEmail,
    deadline, setDeadline,
    maxSubmissions, setMaxSubmissions,
    webhookUrl, setWebhookUrl,
    submissionMessage, setSubmissionMessage,
    adminEmailTemplate, setAdminEmailTemplate,
    userEmailTemplate, setUserEmailTemplate,
    thumbnailUrl, setThumbnailUrl,
    localeSettings, setLocaleSettings,
    toApiPayload,
    toUpdatePayload,
  }
}
