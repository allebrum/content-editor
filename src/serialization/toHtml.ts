import type { EditorJsonDocument, Block, TextNode, TextMark } from '../schema/types';
import { sectionBackgroundToCssValue } from '../utils/sectionBackground';

function marksToHtml(text: string, marks: TextMark[] = []): string {
  let result = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `<strong>${result}</strong>`;
        break;
      case 'italic':
        result = `<em>${result}</em>`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'strike':
        result = `<s>${result}</s>`;
        break;
      case 'code':
        result = `<code>${result}</code>`;
        break;
      case 'link': {
        const href = escapeAttr(String(mark.attrs?.href ?? '#'));
        const rel = 'noopener noreferrer';
        const target = mark.attrs?.target ? ` target="${escapeAttr(String(mark.attrs.target))}"` : '';
        result = `<a href="${href}"${target} rel="${rel}">${result}</a>`;
        break;
      }
      case 'highlight':
        result = `<mark>${result}</mark>`;
        break;
      case 'textStyle': {
        const color = mark.attrs?.color;
        if (color) result = `<span style="color:${escapeAttr(String(color))}">${result}</span>`;
        break;
      }
    }
  }
  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function blockToHtml(block: Block): string {
  const b = block as {
    type: string;
    text?: string;
    marks?: TextMark[];
    content?: Block[];
    attrs?: Record<string, unknown>;
  };

  if (b.type === 'text') {
    return marksToHtml((b as TextNode).text ?? '', b.marks ?? []);
  }
  if (b.type === 'hardBreak') return '<br>';
  if (b.type === 'horizontalRule') return '<hr class="ae-divider">';

  const inner = () => (b.content ?? []).map(blockToHtml).join('');

  switch (b.type) {
    case 'paragraph': {
      const align = b.attrs?.textAlign;
      const cls = align && align !== 'left' ? ` style="text-align:${align}"` : '';
      return `<p${cls}>${inner() || '<br>'}</p>`;
    }
    case 'heading': {
      const level = (b.attrs?.level ?? 2) as number;
      const align = b.attrs?.textAlign;
      const cls = align && align !== 'left' ? ` style="text-align:${align}"` : '';
      return `<h${level}${cls}>${inner()}</h${level}>`;
    }
    case 'blockquote':
      return `<blockquote class="ae-blockquote">${inner()}</blockquote>`;
    case 'bulletList':
      return `<ul class="ae-list ae-list--bullet">${inner()}</ul>`;
    case 'orderedList':
      return `<ol class="ae-list ae-list--ordered" start="${b.attrs?.start ?? 1}">${inner()}</ol>`;
    case 'listItem':
      return `<li>${inner()}</li>`;
    case 'taskList':
      return `<ul class="ae-list ae-list--task">${inner()}</ul>`;
    case 'taskItem': {
      const checked = b.attrs?.checked ? ' checked' : '';
      return `<li class="ae-task-item"><input type="checkbox" disabled${checked}> ${inner()}</li>`;
    }
    case 'codeBlock': {
      const lang = b.attrs?.language ? ` class="language-${escapeAttr(String(b.attrs.language))}"` : '';
      return `<pre class="ae-code-block"><code${lang}>${inner()}</code></pre>`;
    }
    case 'spacer': {
      const h = b.attrs?.height ?? 'md';
      return `<div class="ae-spacer ae-spacer--${h}" aria-hidden="true"></div>`;
    }
    case 'image':
    case 'imageBlock': {
      const { src, alt, caption, alignment, width, height } = b.attrs ?? {};
      const sizeAtts = [
        width ? ` width="${escapeAttr(String(width))}"` : '',
        height ? ` height="${escapeAttr(String(height))}"` : '',
      ].join('');
      const img = `<img src="${escapeAttr(String(src ?? ''))}" alt="${escapeAttr(String(alt ?? ''))}"${sizeAtts} class="ae-image" loading="lazy">`;
      const wrapper = `<figure class="ae-image-block ae-image-block--${alignment ?? 'center'}">${img}${caption ? `<figcaption class="ae-image-caption">${escapeHtml(String(caption))}</figcaption>` : ''}</figure>`;
      return wrapper;
    }
    case 'button': {
      const { label, href, target, variant, size } = b.attrs ?? {};
      const rel = target === '_blank' ? ' rel="noopener noreferrer"' : '';
      return `<div class="ae-button-wrap"><a href="${escapeAttr(String(href ?? '#'))}" target="${escapeAttr(String(target ?? '_self'))}"${rel} class="ae-button ae-button--${variant ?? 'primary'} ae-button--${size ?? 'md'}">${escapeHtml(String(label ?? 'Button'))}</a></div>`;
    }
    case 'callout': {
      const { icon, variant } = b.attrs ?? {};
      return `<div class="ae-callout ae-callout--${variant ?? 'info'}"><span class="ae-callout__icon" aria-hidden="true">${escapeHtml(String(icon ?? 'ℹ️'))}</span><div class="ae-callout__content">${inner()}</div></div>`;
    }
    case 'section': {
      const { variant, paddingY, background, backdrop, fullBleed, contentAlign, cardWidth } = b.attrs ?? {};
      const widthClass =
        cardWidth === 'sm' ? 'ae-section__card--narrow' : cardWidth === 'lg' ? 'ae-section__card--wide' : variant ? `ae-section--${variant}` : '';
      const innerCls = [
        'ae-section__card',
        widthClass,
        paddingY ? `ae-py-${paddingY}` : '',
        fullBleed === false ? 'ae-section__card--raised' : 'ae-section__card--fullBleed',
        contentAlign ? `ae-section--content-${contentAlign}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const cardBg = sectionBackgroundToCssValue(background as Record<string, unknown>);
      const backdropBg = sectionBackgroundToCssValue(backdrop as Record<string, unknown>);
      const outerStyle = backdropBg ? `--ae-section-backdrop-bg:${backdropBg};` : '';
      const innerStyle = cardBg ? `--ae-section-card-bg:${cardBg};` : '';
      return `<section class="ae-section" data-type="section" data-card-width="${escapeAttr(String(cardWidth ?? 'md'))}" data-content-align="${escapeAttr(String(contentAlign ?? 'top'))}" data-full-bleed="${fullBleed === false ? 'false' : 'true'}"${outerStyle ? ` style="${escapeAttr(outerStyle)}"` : ''}><div class="${escapeAttr(innerCls)}"${innerStyle ? ` style="${escapeAttr(innerStyle)}"` : ''}>${inner()}</div></section>`;
    }
    case 'flexRow': {
      const { gap, responsive, align, justify, columnBackground } = b.attrs ?? {};
      const cls = [
        'ae-row',
        gap ? `ae-row--gap-${gap}` : '',
        align ? `ae-row--align-${align}` : '',
        justify ? `ae-row--justify-${justify}` : '',
        responsive === 'stackOnMobile' ? 'ae-row--stack-mobile' : '',
      ].filter(Boolean).join(' ');
      const rowBgAttr = typeof columnBackground === 'string' && columnBackground
        ? ` data-row-col-bg="${escapeAttr(columnBackground)}" style="--ae-row-col-bg:${escapeAttr(columnBackground)}"`
        : '';
      return `<div class="${cls}"${rowBgAttr}>${inner()}</div>`;
    }
    case 'flexColumn': {
      const { width, textAlign, verticalAlign, background } = b.attrs ?? {};
      const cls = [
        'ae-col',
        width && width !== 'auto' ? `ae-col--${width}` : 'ae-col--auto',
        textAlign ? `ae-col--text-${textAlign}` : '',
        verticalAlign ? `ae-col--valign-${verticalAlign}` : '',
      ].filter(Boolean).join(' ');
      const colBgAttr = typeof background === 'string' && background
        ? ` data-col-bg="${escapeAttr(background)}" style="--ae-col-bg:${escapeAttr(background)}"`
        : '';
      return `<div class="${cls}"${colBgAttr}>${inner()}</div>`;
    }
    case 'hero': {
      const { variant } = b.attrs ?? {};
      return `<section class="ae-hero ae-hero--${variant ?? 'centered'}"><div class="ae-hero__inner">${inner()}</div></section>`;
    }
    case 'faq':
      return `<div class="ae-faq">${inner()}</div>`;
    case 'faqItem':
      return `<details class="ae-faq__item">${inner()}</details>`;
    case 'embed': {
      const { url, height } = b.attrs ?? {};
      return `<div class="ae-embed" data-url="${escapeAttr(String(url ?? ''))}"><div class="ae-embed__placeholder" style="height:${escapeAttr(String(height ?? 400))}px">Embedded content: ${escapeHtml(String(url ?? ''))}</div></div>`;
    }
    default:
      return inner() ? `<div>${inner()}</div>` : '';
  }
}

export function toHtml(doc: EditorJsonDocument): string {
  return (doc.content ?? []).map(blockToHtml).join('');
}

export { escapeHtml };
