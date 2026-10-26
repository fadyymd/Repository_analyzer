import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App.jsx';

afterEach(cleanup);

describe('RepoInsight interface', () => {
  it('switches from account analysis to account comparison', () => {
    render(<App />);

    const comparisonTab = screen.getByRole('tab', { name: 'Compare accounts' });
    fireEvent.click(comparisonTab);

    expect(comparisonTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'First GitHub username' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Second GitHub username' })).toBeTruthy();
  });

  it('displays the English interface and developer copyright', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /See your GitHub projects/i })).toBeTruthy();
    expect(screen.getByText('Built by Fadi Medkour')).toBeTruthy();
    expect(screen.getByText('© 2026 Fadi Medkour. All rights reserved.')).toBeTruthy();
  });
});
