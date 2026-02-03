// src/interaction/telegram/MessageFormatter.ts
// Utility functions for formatting Telegram messages

import { GateStatus } from '../../types/gates.types';
import { PermissionState } from '../../types/permission.types';

export class MessageFormatter {
  /**
   * Format a key-value pair for display
   */
  static formatKeyValue(key: string, value: string | number): string {
    return `<b>${key}:</b> ${value}`;
  }

  /**
   * Format a list item with bullet
   */
  static formatListItem(item: string, indent: number = 0): string {
    const prefix = indent > 0 ? '  '.repeat(indent) + '└ ' : '• ';
    return `${prefix}${item}`;
  }

  /**
   * Format a tree structure
   */
  static formatTree(items: string[]): string {
    if (items.length === 0) return '';
    
    return items.map((item, i) => {
      const isLast = i === items.length - 1;
      return `${isLast ? '└' : '├'} ${item}`;
    }).join('\n');
  }

  /**
   * Wrap text in a code block
   */
  static codeBlock(text: string): string {
    return `<code>${text}</code>`;
  }

  /**
   * Create a horizontal divider
   */
  static divider(): string {
    return '━━━━━━━━━━━━━━━━━━━━━━━';
  }

  /**
   * Format a section header
   */
  static sectionHeader(title: string): string {
    return `\n<b>${title}</b>`;
  }

  /**
   * Escape HTML special characters
   */
  static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Truncate text with ellipsis
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
}
