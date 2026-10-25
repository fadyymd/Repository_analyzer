import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App.jsx';

afterEach(cleanup);

describe('RepoInsight interface', () => {
  it('switches from account analysis to account comparison', () => {
    render(<App />);

    const comparisonTab = screen.getByRole('tab', { name: 'مقارنة حسابين' });
    fireEvent.click(comparisonTab);

    expect(comparisonTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'المستخدم الأول' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'المستخدم الثاني' })).toBeTruthy();
  });
});
