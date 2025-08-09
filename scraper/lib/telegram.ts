import { logger } from "../trigger/lib/logger.js";

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface ScrapingResult {
  scraper: string;
  success: boolean;
  discountsFound?: number;
  executionTime?: number;
  error?: string;
  stackTrace?: string;
  commitUrl?: string;
  commitHash?: string;
}

interface DiscountDiff {
  scraper: string;
  added: string[];
  removed: string[];
  validityChanged: Array<{
    baseKey: string;
    oldPeriod: string;
    newPeriod: string;
    fullOldKey: string;
    fullNewKey: string;
  }>;
  totalNew: number;
  totalOld: number;
  commitUrl?: string;
  commitHash?: string;
}

export class TelegramNotifier {
  private config: TelegramConfig | null = null;

  constructor() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      this.config = { botToken, chatId };
    } else {
      logger.debug(
        "Telegram notifications disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID",
      );
    }
  }

  async sendScrapingComplete(result: ScrapingResult): Promise<void> {
    if (!this.config) {
      logger.debug("Skipping Telegram notification - not configured");
      return;
    }

    try {
      const message = this.formatScrapingMessage(result);
      await this.sendMessage(message);
      logger.info("Telegram notification sent successfully");
    } catch (error) {
      logger.error(`Failed to send Telegram notification: ${error}`);
    }
  }

  async sendBatchComplete(results: ScrapingResult[]): Promise<void> {
    if (!this.config) {
      logger.debug("Skipping Telegram notification - not configured");
      return;
    }

    try {
      const message = this.formatBatchMessage(results);
      await this.sendMessage(message);
      logger.info("Telegram batch notification sent successfully");
    } catch (error) {
      logger.error("Failed to send Telegram batch notification:", error);
    }
  }

  async sendDiscountDiff(diff: DiscountDiff): Promise<void> {
    if (!this.config) {
      logger.debug("Skipping Telegram notification - not configured");
      return;
    }

    try {
      const message = this.formatDiscountDiffMessage(diff);
      await this.sendMessage(message);
      logger.info("Telegram discount diff notification sent successfully");
    } catch (error) {
      logger.error(
        "Failed to send Telegram discount diff notification:",
        error,
      );
    }
  }

  private formatScrapingMessage(result: ScrapingResult): string {
    const emoji = result.success ? "✅" : "❌";
    const status = result.success ? "Completed" : "Failed";

    let message = `${emoji} *Scraping ${status}*\n\n`;
    message += `🏪 *Scraper:* ${this.escapeMarkdown(result.scraper)}\n`;

    if (result.success) {
      if (result.discountsFound !== undefined) {
        message += `🎯 *Discounts Found:* ${result.discountsFound}\n`;
      }
      if (result.executionTime !== undefined) {
        message += `⏱ *Execution Time:* ${Math.round(result.executionTime / 1000)}s\n`;
      }
      if (result.commitUrl) {
        message += `🔗 *Commit:* [View Changes](${result.commitUrl})\n`;
      }
      if (result.commitHash) {
        message += `📝 *Hash:* \`${result.commitHash.substring(0, 8)}\`\n`;
      }
    } else {
      if (result.error) {
        message += `💥 *Error:* ${this.escapeMarkdown(result.error)}\n`;
      }
      if (result.stackTrace) {
        // Truncate stack trace to avoid Telegram message limits (4096 chars)
        const maxStackLength = 2000 - message.length;
        let stackTrace = result.stackTrace;
        if (stackTrace.length > maxStackLength) {
          stackTrace =
            stackTrace.substring(0, maxStackLength) + "\n... (truncated)";
        }
        message += `\n📋 *Stack Trace:*\n\`\`\`\n${stackTrace}\n\`\`\`\n`;
      }
    }

    return message;
  }

  private formatBatchMessage(results: ScrapingResult[]): string {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const totalDiscounts = successful.reduce(
      (sum, r) => sum + (r.discountsFound || 0),
      0,
    );

    let message = `🔄 *Batch Scraping Complete*\n\n`;
    message += `✅ *Successful:* ${successful.length}\n`;
    message += `❌ *Failed:* ${failed.length}\n`;
    message += `🎯 *Total Discounts:* ${totalDiscounts}\n\n`;

    if (successful.length > 0) {
      message += `*Successful Scrapers:*\n`;
      for (const result of successful) {
        message += `• ${this.escapeMarkdown(result.scraper)}`;
        if (result.discountsFound !== undefined) {
          message += ` (${result.discountsFound} discounts)`;
        }
        if (result.commitUrl) {
          message += ` [🔗](${result.commitUrl})`;
        }
        message += `\n`;
      }
    }

    if (failed.length > 0) {
      message += `\n*Failed Scrapers:*\n`;
      for (const result of failed) {
        message += `• ${this.escapeMarkdown(result.scraper)}: ${this.escapeMarkdown(result.error || "Unknown error")}\n`;
        if (result.stackTrace) {
          // Add first few lines of stack trace for batch view
          const stackLines = result.stackTrace.split("\n").slice(0, 3);
          const escapedStackLines = stackLines.map((line) =>
            this.escapeMarkdown(line),
          );
          message += `  \`${escapedStackLines.join("\\n")}\`\n`;
        }
      }
    }

    return message;
  }

  private formatDiscountDiffMessage(diff: DiscountDiff): string {
    let message = `🔄 *Discount Changes for ${this.escapeMarkdown(diff.scraper)}*\n\n`;

    message += `📊 *Summary:*\n`;
    message += `• Previous discounts: ${diff.totalOld}\n`;
    message += `• Current discounts: ${diff.totalNew}\n`;
    message += `• Net change: ${diff.totalNew - diff.totalOld > 0 ? "+" : ""}${diff.totalNew - diff.totalOld}\n`;
    message += `• New: ${diff.added.length} | Removed: ${diff.removed.length} | Period changed: ${diff.validityChanged.length}\n\n`;

    if (diff.added.length > 0) {
      message += `🆕 *New Discounts (${diff.added.length}):*\n`;
      const addedToShow = Math.min(diff.added.length, 8);
      for (let i = 0; i < addedToShow; i++) {
        message += `• ${this.escapeMarkdown(diff.added[i])}\n`;
      }
      if (diff.added.length > 8) {
        message += `  ...and ${diff.added.length - 8} more\n`;
      }
      message += `\n`;
    }

    if (diff.removed.length > 0) {
      message += `❌ *Removed Discounts (${diff.removed.length}):*\n`;
      const removedToShow = Math.min(diff.removed.length, 8);
      for (let i = 0; i < removedToShow; i++) {
        message += `• ${this.escapeMarkdown(diff.removed[i])}\n`;
      }
      if (diff.removed.length > 8) {
        message += `  ...and ${diff.removed.length - 8} more\n`;
      }
      message += `\n`;
    }

    if (diff.validityChanged.length > 0) {
      message += `📅 *Validity Period Changes (${diff.validityChanged.length}):*\n`;
      const changedToShow = Math.min(diff.validityChanged.length, 8);
      for (let i = 0; i < changedToShow; i++) {
        const change = diff.validityChanged[i];
        const formattedBase = this.escapeMarkdown(
          change.baseKey.toUpperCase().replace(/-/g, " "),
        );
        message += `• ${formattedBase}\n  ${this.escapeMarkdown(change.oldPeriod)} → ${this.escapeMarkdown(change.newPeriod)}\n`;
      }
      if (diff.validityChanged.length > 8) {
        message += `  ...and ${diff.validityChanged.length - 8} more\n`;
      }
      message += `\n`;
    }

    if (
      diff.added.length === 0 &&
      diff.removed.length === 0 &&
      diff.validityChanged.length === 0
    ) {
      message += `⚪ *No changes detected*\n\n`;
    }

    if (diff.commitUrl) {
      message += `🔗 *View Changes:* [GitHub](${diff.commitUrl})\n`;
    }
    if (diff.commitHash) {
      message += `📝 *Commit:* \`${diff.commitHash.substring(0, 8)}\`\n`;
    }

    return message;
  }

  private escapeMarkdown(text: string): string {
    // Only escape characters that can break Telegram parsing in variable text
    return text.replace(/([_*[\]`~])/g, "\\$1");
  }

  private async sendMessage(text: string): Promise<void> {
    if (!this.config) return;

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: this.config.chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${errorText}`);
    }
  }
}

export const telegramNotifier = new TelegramNotifier();
