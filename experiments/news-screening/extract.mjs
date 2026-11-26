export function clean(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/<(script|style|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => {
      const code = parseInt(hex || decimal, hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&(?:nbsp|apos);/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isRelatedLinkLine(value = '') {
  return /^(?:[A-Z][a-z]{2} \d{1,2}(?:st|nd|rd|th)?(?:,)? \d{4})\s+.{12,}/u.test(String(value).trim());
}

// Remove reader discussion before choosing an article container. Comment <p> tags
// are often nested inside <article> and otherwise look like genuine paragraphs.
function stripCommentSections(html) {
  const sections = [];
  const stack = [];
  const tags = /<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  for (const match of html.matchAll(tags)) {
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex(item => item.tag === tag);
      if (index < 0) continue;
      for (const item of stack.splice(index)) {
        if (item.comment && !item.parentComment) sections.push([item.start, match.index + match[0].length]);
      }
      continue;
    }
    if (/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) || /\/>$/.test(match[0])) continue;
    const attributes = [...match[0].matchAll(/\b(?:id|class)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
      .flatMap(attribute => (attribute[1] ?? attribute[2]).split(/\s+/));
    const parentComment = stack.some(item => item.comment);
    const comment = parentComment || attributes.some(value => /^(?:comments?|comment[-_](?:list|area|body|content|thread|section|wrapper|item)|top[-_]comment|reader[-_]comments?|discussion|disqus[-_]thread|coral[-_]comments?|wpd[-_]comments?)$/iu.test(value));
    stack.push({ tag, start: match.index, comment, parentComment });
  }
  return sections.sort((a, b) => b[0] - a[0]).reduce((text, [start, end]) =>
    `${text.slice(0, start)} ${text.slice(end)}`, html);
}

// Track matching container ends so nested divs do not truncate the article.
export function extractBody(html) {
  const sanitized = stripCommentSections(html.replace(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1>/gi, ''));
  const containers = [];
  const stack = [];
  const tags = /<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  for (const match of sanitized.matchAll(tags)) {
    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith('</');
    if (closing) {
      const index = stack.findLastIndex(item => item.tag === tag);
      if (index < 0) continue;
      for (const item of stack.splice(index)) {
        if (item.selector) containers.push({ ...item, html: sanitized.slice(item.start, match.index) });
      }
      continue;
    }
    if (/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) || /\/>$/.test(match[0])) continue;
    const attributes = Object.fromEntries([...match[0].matchAll(/\b(id|class)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
      .map(attribute => [attribute[1].toLowerCase(), attribute[2] ?? attribute[3]]));
    const classes = (attributes.class || '').split(/\s+/);
    const selector = attributes.id === 'paragraph' ? '#paragraph'
      : attributes.id === 'ArticleContent' ? '#ArticleContent'
        : classes.includes('news_body') ? '.news_body'
      : classes.includes('post-content') ? '.post-content'
      : classes.includes('elementor-widget-theme-post-content') ? '.elementor-widget-theme-post-content'
      : classes.includes('post_cnt') ? '.post_cnt'
        : classes.includes('entry-content') ? '.entry-content'
          : classes.includes('article-body') ? '.article-body'
          : ['article', 'main'].includes(tag) ? tag : '';
    stack.push({ tag, selector, start: match.index + match[0].length });
  }
  const candidates = containers.map(container => {
    const paragraphs = [...container.html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map(match => clean(match[2])).filter(text => text.length >= 20
        && !isRelatedLinkLine(text)
        && !/^(?:Previous post|Next post|Related articles?|You may also like|Continue reading)\s*[:：]?/iu.test(text));
    return { selector: container.selector, paragraphs, characters: paragraphs.join(' ').length };
  });
  const preferred = candidates.filter(candidate => ['#paragraph', '#ArticleContent', '.news_body', '.post-content', '.elementor-widget-theme-post-content', '.post_cnt', '.entry-content', '.article-body'].includes(candidate.selector));
  const selected = (preferred.length ? preferred : candidates).sort((a, b) => b.characters - a.characters)[0];
  const blocked = /<title[^>]*>[^<]*(?:just a moment|access denied|captcha)|cf-chl-|challenge-platform/iu.test(html);
  return {
    bodyEvidence: selected?.paragraphs || [],
    bodyStatus: selected?.characters >= 250 ? 'ok' : blocked ? 'blocked' : 'insufficient',
    bodySelector: selected?.selector || '',
    bodyCharacters: selected?.characters || 0
  };
}
