export interface TutorialStep {
    title: string;
    description: string;
    hint: string;
    realWorldNote?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: 'Remove the backdoor',
        description:
            'Someone wired Origin straight to the Database for debugging and never removed it. Click that cable and press Delete.',
        hint: 'Click the cable that goes from Origin directly to the Database, then press Delete (or use the trash button in the panel).',
        realWorldNote: 'Clients should never reach the database directly: every request goes through your services.',
    },
    {
        title: 'Place the Cache',
        description: 'Drag the Cache service from the palette (bottom-left) and drop it on the grid.',
        hint: 'Mint-green tile with a lightning bolt icon.',
        realWorldNote:
            'Redis and Memcached are common caches: in-memory stores that answer in well under a millisecond.',
    },
    {
        title: 'Connect REST to Cache',
        description: 'Drag from the blue output port on the REST service to the green input port on the Cache.',
        hint: 'Blue port = output (right side of REST). Green port = input (left side of Cache).',
    },
    {
        title: 'Connect Cache to Database',
        description:
            'Drag from the blue output port on the Cache to the orange port on the Database. On a miss, the Cache fetches from here.',
        hint: 'The Database has an orange bidirectional port that handles both requests and responses.',
        realWorldNote: 'This is the cache-aside pattern: check the cache first, fall back to the database on a miss.',
    },
    {
        title: 'Set a route rule',
        description:
            'Click the REST to Cache cable. In the panel that opens, keep only GET enabled. Writes then always take the direct path to the Database.',
        hint: 'Click the cable to select it, then toggle methods in the Route Rule panel on the right.',
        realWorldNote:
            'API gateways and service meshes (nginx, Envoy, Kong) route requests by HTTP method the same way.',
    },
];
