export class WorkerPool {
  constructor(workerUrl, poolSize = navigator.hardwareConcurrency || 4) {
    this.workerUrl = workerUrl;
    this.poolSize = poolSize;
    this.queue = [];
    this.workers = [];
    this.idleWorkers = [];

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerUrl);
      worker.onmessage = e => this._handleResult(worker, e);
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }

  _handleResult(worker, e) {
    const { resolve } = worker._currentTask;
    resolve(e.data);
    worker._currentTask = null;
    this.idleWorkers.push(worker);
    this._dequeue();
  }

  _dequeue() {
    if (this.queue.length === 0 || this.idleWorkers.length === 0) return;
    const { input, resolve } = this.queue.shift();
    const worker = this.idleWorkers.pop();
    worker._currentTask = { resolve };
    worker.postMessage(input, [input.data]);
  }

  runTask(input) {
    return new Promise(resolve => {
      this.queue.push({ input, resolve });
      this._dequeue();
    });
  }

  terminate() {
    this.workers.forEach(w => w.terminate());
  }
}
