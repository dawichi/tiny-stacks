export interface TutorialStep {
    title: string;
    description: string;
    hint: string;
    realWorldNote?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: 'Place the Cache',
        description: 'Drag the Cache service from the palette (bottom-left) and drop it on the grid.',
        hint: 'Mint-green tile with a lightning bolt icon.',
        realWorldNote:
            'Redis is the most widely used cache — GitHub and Stack Overflow serve billions of reads per day with it.',
    },
    {
        title: 'Connect REST → Cache',
        description: 'Drag from the blue output port on the REST service to the green input port on the Cache.',
        hint: 'Blue port = output (right side of REST). Green port = input (left side of Cache).',
        realWorldNote: 'This creates a read-through cache path. Reads check the cache before reaching the database.',
    },
    {
        title: 'Connect Cache → Database',
        description: 'Drag from the blue output port on the Cache to the orange port on the Database.',
        hint: 'The Database has an orange bidirectional port — it handles both requests and responses.',
    },
    {
        title: 'Remove the bypass',
        description:
            'Click the direct REST → Database cable, then press Delete (or use the trash button in the panel). All traffic must flow through the Cache.',
        hint: 'Click the cable between REST and Database to select it, then press the Delete key.',
        realWorldNote:
            'A direct bypass defeats the cache. Removing it forces all reads through the cache, cutting DB load by 80–90%.',
    },
    {
        title: 'Set a route rule',
        description:
            'Click the REST → Cache cable. In the panel that opens, disable POST, PUT, and DELETE — writes should not be cached.',
        hint: 'Click the cable to select it, then toggle methods in the Route Rule panel on the right.',
        realWorldNote:
            'Route rules are how API gateways work in production. Nginx, Kong, and Envoy all route by HTTP method.',
    },
];
