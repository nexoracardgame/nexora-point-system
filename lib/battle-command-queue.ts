type Command = { run: () => unknown | Promise<unknown>; key?: string; resolve: (value: unknown) => void; reject: (error: unknown) => void };

// Serialize dependent room mutations without blocking independent UI controls.
export class BattleCommandQueue {
  private commands: Command[] = [];
  private running = false;

  enqueue(run: Command['run'], key?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (key) {
        const previous = this.commands.findIndex(command => command.key === key);
        if (previous >= 0) this.commands.splice(previous, 1)[0].resolve(false);
      }
      this.commands.push({ run, key, resolve, reject });
      void this.drain();
    });
  }

  cancelPending() {
    for (const command of this.commands.splice(0)) command.resolve(false);
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.commands.length) {
        const command = this.commands.shift()!;
        try { command.resolve(await command.run()); }
        catch (error) { command.reject(error); }
      }
    } finally { this.running = false; }
  }
}
