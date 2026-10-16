import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useScopedPage from './useScopedPage.js';

test('filter changes reset the page immediately, including returning to an earlier filter', () => {
  const expected = [['all', 1], ['all', 4], ['antibiotic', 1], ['antibiotic', 2], ['all', 1]];
  function PaginationProbe() {
    const [step, setStep] = useState(0);
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useScopedPage(filter);
    assert.deepEqual([filter, page], expected[step]);
    if (step === 0) setPage(4);
    if (step === 1) setFilter('antibiotic');
    if (step === 2) setPage(current => current + 1);
    if (step === 3) setFilter('all');
    if (step < 4) setStep(step + 1);
    return createElement('output', null, page);
  }
  assert.equal(renderToStaticMarkup(createElement(PaginationProbe)), '<output>1</output>');
});

test('unchanged filters keep the selected page across unrelated renders', () => {
  function PaginationProbe() {
    const [step, setStep] = useState(0);
    const [page, setPage] = useScopedPage('stable-filter');
    if (step === 0) setPage(7);
    if (step < 3) setStep(step + 1);
    return createElement('output', null, page);
  }
  assert.equal(renderToStaticMarkup(createElement(PaginationProbe)), '<output>7</output>');
});
