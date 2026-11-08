import { describe, expect, it } from 'vitest';
import { matchMarkdownShortcut, pastedLines, reducer, type Action } from '../blocks';
import {
  markdownPlan, mergeNextPlan, mergePrevPlan, pasteLinesPlan, slashPickPlan, splitBlockPlan,
} from '../editing';
import type { Block } from '../types';

const apply = (blocks: Block[], actions: Action[]) => actions.reduce(reducer, blocks);
const t = (id: string, content = '', type: Block['type'] = 'text'): Block => ({ id, type, content });

describe('split / merge / paste', () => {
  it('splits at the caret and continues list type', () => {
    const blocks = [t('a', 'hello world', 'bullet')];
    const plan = splitBlockPlan(blocks, 'a', 'hello ', 'world');
    const next = apply(blocks, plan.actions);
    expect(next[0]?.content).toBe('hello ');
    expect(next[1]?.type).toBe('bullet');
    expect(next[1]?.content).toBe('world');
    expect(plan.focus?.pos).toBe(0);
  });

  it('merges with the previous editable block', () => {
    const blocks = [t('a', 'hello'), t('b', 'world')];
    const next = apply(blocks, mergePrevPlan(blocks, 'b', 'world').actions);
    expect(next).toHaveLength(1);
    expect(next[0]?.content).toBe('helloworld');
  });

  it('removes a previous divider on merge', () => {
    const blocks = [t('d', '', 'divider'), t('b', 'x')];
    const next = apply(blocks, mergePrevPlan(blocks, 'b', 'x').actions);
    expect(next.map((b) => b.id)).toEqual(['b']);
  });

  it('merges the next line on forward delete', () => {
    const blocks = [t('a', 'aa'), t('b', 'bb')];
    const next = apply(blocks, mergeNextPlan(blocks, 'a', 'aa').actions);
    expect(next).toEqual([{ id: 'a', type: 'text', content: 'aabb' }]);
  });

  it('pastes multiple lines as sibling blocks', () => {
    const blocks = [t('a', 'keep')];
    const lines = pastedLines('one\ntwo\nthree');
    const next = apply(blocks, pasteLinesPlan(blocks, 'a', '', lines, '').actions);
    expect(next.map((b) => b.content)).toEqual(['one', 'two', 'three']);
  });
});

describe('markdown and slash', () => {
  it('applies heading / list / checkbox / quote / divider shortcuts', () => {
    expect(matchMarkdownShortcut('# ', 2)).toEqual({ kind: 'type', type: 'h1', strip: 2 });
    const blocks = [t('a', '# Title')];
    const md = matchMarkdownShortcut('# Title', 2)!;
    const next = apply(blocks, markdownPlan('a', md, '# Title').actions);
    expect(next[0]?.type).toBe('h1');
    expect(next[0]?.content).toBe('Title');
  });

  it('turns a slash command into a heading and leaves host actions to adapters', () => {
    const blocks = [t('a', '/h1')];
    const heading = apply(blocks, slashPickPlan(blocks, 'a', 0, 'h1', 'h1').actions);
    expect(heading[0]?.type).toBe('h1');
    expect(heading[0]?.content).toBe('');

    const mention = slashPickPlan(blocks, 'a', 0, 'mention', 'mention');
    expect(mention.host).toEqual({ kind: 'mention', blockId: 'a', caret: 0 });
    expect(apply(blocks, mention.actions)[0]?.content).toBe('');
  });
});
