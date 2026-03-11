import type { NtfySettings } from './types';

function sanitizeHeaderValue(input: string): string {
  return input.replace(/[\r\n]+/g, ' ').trim();
}

function safeClickUrl(input: string): string {
  try {
    const parsed = new URL(input);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return 'https://ontario.hibid.com';
  }

  return 'https://ontario.hibid.com';
}

export async function sendNtfyNotification(input: {
  settings: NtfySettings;
  title: string;
  message: string;
  clickUrl: string;
  priority: '3' | '4';
}): Promise<void> {
  const url = `${input.settings.server.replace(/\/$/, '')}/${input.settings.topic}`;
  const headers: Record<string, string> = {
    Title: sanitizeHeaderValue(input.title),
    Priority: input.priority,
    Tags: 'auction,deal',
    Click: safeClickUrl(input.clickUrl),
  };

  if (input.settings.token) {
    headers.Authorization = `Bearer ${input.settings.token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: input.message,
  });

  if (!response.ok) {
    throw new Error(`ntfy rejected message (${response.status})`);
  }
}
