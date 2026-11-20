import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES, HELP_AUDIENCES, type HelpAudience } from './help.js';
import { LEGAL_DOCUMENTS, LEGAL_STATUS } from './legal.js';

describe('help centre and legal pages (WEB-02)', () => {
  it('gives every article a unique, URL-safe slug and an audience that has a section', () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const audience of Object.keys(HELP_AUDIENCES) as HelpAudience[]) {
      expect(HELP_ARTICLES.some((a) => a.audience === audience)).toBe(true);
    }
  });

  it('only links to pages of the site', () => {
    for (const a of HELP_ARTICLES) if (a.action) expect(a.action.href).toMatch(/^\/[a-z0-9/-]*$/);
  });

  it('cannot leave the draft status while something is still « à compléter »', () => {
    const text = JSON.stringify(LEGAL_DOCUMENTS);
    if (!LEGAL_STATUS.draft) expect(text).not.toContain('à compléter');
    else expect(LEGAL_STATUS.draftNotice).toContain('à compléter');
  });
});
