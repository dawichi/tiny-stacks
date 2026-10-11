import type { RunSummary, SimMetrics } from './sim-types';

const LATENCY_SAMPLE_SIZE = 200;
const RATE_WINDOW_MS = 3000;

export function percentile(values: readonly number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index] ?? 0;
}

function mean(values: readonly number[]): number {
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

/**
 * Live metrics: cumulative counters plus rolling windows, all on simulated time.
 */
export class MetricsCollector {
    private completed = 0;
    private failed = 0;
    private latencies: number[] = [];
    private completionTimes: number[] = [];
    private failureTimes: number[] = [];
    private costSamples: { t: number; amount: number }[] = [];

    asyncRetries = 0;
    asyncDropped = 0;

    reset(): void {
        this.completed = 0;
        this.failed = 0;
        this.latencies = [];
        this.completionTimes = [];
        this.failureTimes = [];
        this.costSamples = [];
        this.asyncRetries = 0;
        this.asyncDropped = 0;
    }

    recordCompletion(now: number, latency: number): void {
        this.completed++;
        this.completionTimes.push(now);
        this.latencies.push(latency);
        if (this.latencies.length > LATENCY_SAMPLE_SIZE) this.latencies.shift();
    }

    recordFailure(now: number): void {
        this.failed++;
        this.failureTimes.push(now);
    }

    recordCost(now: number, amount: number): void {
        if (amount > 0) this.costSamples.push({ t: now, amount });
    }

    /** Drop samples that fell out of the rolling window */
    prune(now: number): void {
        const cutoff = now - RATE_WINDOW_MS;
        while (this.completionTimes[0] !== undefined && this.completionTimes[0] <= cutoff) this.completionTimes.shift();
        while (this.failureTimes[0] !== undefined && this.failureTimes[0] <= cutoff) this.failureTimes.shift();
        while (this.costSamples[0] !== undefined && this.costSamples[0].t <= cutoff) this.costSamples.shift();
    }

    snapshot(activeRequests: number, asyncPending: number): SimMetrics {
        const recentOk = this.completionTimes.length;
        const recentFailed = this.failureTimes.length;
        const recentTotal = recentOk + recentFailed;
        const windowSeconds = RATE_WINDOW_MS / 1000;
        return {
            totalCompleted: this.completed,
            totalFailed: this.failed,
            activeRequests,
            avgLatency: mean(this.latencies),
            p95Latency: percentile(this.latencies, 95),
            throughput: recentOk / windowSeconds,
            errorRate: recentTotal > 0 ? (recentFailed / recentTotal) * 100 : 0,
            costPerSecond: this.costSamples.reduce((sum, s) => sum + s.amount, 0) / windowSeconds,
            asyncPending,
            asyncRetries: this.asyncRetries,
            asyncDropped: this.asyncDropped,
        };
    }
}

/**
 * Metrics for a single deploy run (no windows: everything since the run started)
 */
export class RunCollector {
    completed = 0;
    failed = 0;
    cost = 0;
    dbOperations = 0;
    private latencies: number[] = [];

    recordCompletion(latency: number): void {
        this.completed++;
        this.latencies.push(latency);
    }

    recordFailure(): void {
        this.failed++;
    }

    summarize(durationMs: number): RunSummary {
        const total = this.completed + this.failed;
        return {
            durationMs,
            completed: this.completed,
            failed: this.failed,
            errorRate: total > 0 ? (this.failed / total) * 100 : 0,
            avgLatency: mean(this.latencies),
            p95Latency: percentile(this.latencies, 95),
            throughput: durationMs > 0 ? this.completed / (durationMs / 1000) : 0,
            cost: this.cost,
            dbOperations: this.dbOperations,
        };
    }
}
