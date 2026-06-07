/**
 * Simple console-based logger with level support.
 */
export class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  info(message: string): void {
    console.log(`[${this.timestamp()}] [INFO] [${this.name}] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[${this.timestamp()}] [WARN] [${this.name}] ${message}`);
  }

  error(message: string): void {
    console.error(`[${this.timestamp()}] [ERROR] [${this.name}] ${message}`);
  }
}
