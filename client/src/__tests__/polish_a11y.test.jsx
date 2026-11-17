import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Drawer from '../components/Drawer.jsx';
import Modal from '../components/Modal.jsx';
import {
  formatLatency,
  formatPercentCard,
  formatPercentTable,
} from '../utils/format.js';

describe('Number formatting utilities (docs/design.md §6)', () => {
  it('formats card percentages to 1 decimal and table percentages to 2 decimals', () => {
    expect(formatPercentCard(16.666)).toBe('16.7%');
    expect(formatPercentCard(0)).toBe('0.0%');
    expect(formatPercentCard(null)).toBe('—');
    expect(formatPercentCard(undefined, 'N/A')).toBe('N/A');

    expect(formatPercentTable(16.666)).toBe('16.67%');
    expect(formatPercentTable(5)).toBe('5.00%');
    expect(formatPercentTable(null)).toBe('—');
  });

  it('formats latency in ms below 1000 ms and seconds at or above 1000 ms', () => {
    expect(formatLatency(0)).toBe('0 ms');
    expect(formatLatency(420.6)).toBe('421 ms');
    expect(formatLatency(999)).toBe('999 ms');
    expect(formatLatency(1000)).toBe('1.00 s');
    expect(formatLatency(1850)).toBe('1.85 s');

    expect(formatLatency(65.5, { signed: true })).toBe('+66 ms');
    expect(formatLatency(-120, { signed: true })).toBe('-120 ms');
    expect(formatLatency(1250, { signed: true })).toBe('+1.25 s');
    expect(formatLatency(null)).toBe('—');
  });
});

describe('Modal & Drawer keyboard focus trap and Escape handling', () => {
  function ModalHarness() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>
          Open Modal
        </button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Test Dialog">
          <input aria-label="First field" />
          <button type="button">Save Action</button>
        </Modal>
      </div>
    );
  }

  it('traps Tab and Shift+Tab inside Modal, closes on Escape, and restores trigger focus', () => {
    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: 'Open Modal' });
    trigger.focus();
    fireEvent.click(trigger);

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    const saveBtn = screen.getByRole('button', { name: 'Save Action' });

    // Initial focus moves inside modal (first focusable is close button)
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab on first focusable wraps to last focusable
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(saveBtn);

    // Tab on last focusable wraps to first focusable
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);

    // Escape closes modal and restores focus to trigger
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps focus inside Drawer and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Drawer isOpen onClose={onClose} title="Detail Drawer">
        <button type="button">Inner Button</button>
      </Drawer>,
    );

    const closeBtn = screen.getByRole('button', { name: 'Close drawer' });
    const innerBtn = screen.getByRole('button', { name: 'Inner Button' });

    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(innerBtn);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
