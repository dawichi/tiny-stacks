import type { PlacedService } from './game-state.service';
import { getServiceConfig } from './service-types.config';

/**
 * Absolute position of a port in board pixel coordinates
 */
export interface PortPosition {
    x: number;
    y: number;
    edge: 'north' | 'south' | 'east' | 'west';
}

/**
 * Compute the absolute board-pixel center of a port
 */
export function getPortAbsolutePosition(service: PlacedService, portIndex: number, cellSize: number): PortPosition {
    const config = getServiceConfig(service.type);
    const port = config.ports[portIndex];

    const servicePixelX = service.gridX * cellSize;
    const servicePixelY = service.gridY * cellSize;
    const baseX = servicePixelX + port.cellOffsetX * cellSize;
    const baseY = servicePixelY + port.cellOffsetY * cellSize;

    switch (port.edge) {
        case 'west':
            return { x: servicePixelX, y: baseY + cellSize / 2, edge: 'west' };
        case 'east':
            return { x: servicePixelX + config.gridWidth * cellSize, y: baseY + cellSize / 2, edge: 'east' };
        case 'north':
            return { x: baseX + cellSize / 2, y: servicePixelY, edge: 'north' };
        case 'south':
            return { x: baseX + cellSize / 2, y: servicePixelY + config.gridHeight * cellSize, edge: 'south' };
    }
}

/**
 * Offset a point outward from its edge direction
 */
function offsetFromEdge(pos: PortPosition, offset: number): { x: number; y: number } {
    switch (pos.edge) {
        case 'north':
            return { x: pos.x, y: pos.y - offset };
        case 'south':
            return { x: pos.x, y: pos.y + offset };
        case 'east':
            return { x: pos.x + offset, y: pos.y };
        case 'west':
            return { x: pos.x - offset, y: pos.y };
    }
}

/**
 * Compute a cubic Bezier SVG path between two port positions
 */
export function computeBezierPath(from: PortPosition, to: PortPosition): string {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const offset = Math.max(40, distance * 0.4);

    const cp1 = offsetFromEdge(from, offset);
    const cp2 = offsetFromEdge(to, offset);

    return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
}

/**
 * Cubic Bezier curve defined by four control points
 */
export interface BezierCurve {
    start: { x: number; y: number };
    cp1: { x: number; y: number };
    cp2: { x: number; y: number };
    end: { x: number; y: number };
}

/**
 * Get the Bezier curve control points for a connection between two ports
 */
export function getConnectionBezier(
    srcService: PlacedService,
    srcPortIndex: number,
    tgtService: PlacedService,
    tgtPortIndex: number,
    cellSize: number,
): BezierCurve {
    const from = getPortAbsolutePosition(srcService, srcPortIndex, cellSize);
    const to = getPortAbsolutePosition(tgtService, tgtPortIndex, cellSize);

    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const offset = Math.max(40, distance * 0.4);

    return {
        start: { x: from.x, y: from.y },
        cp1: offsetFromEdge(from, offset),
        cp2: offsetFromEdge(to, offset),
        end: { x: to.x, y: to.y },
    };
}

/**
 * Evaluate a cubic Bezier curve at parameter t (0→1), returning the {x, y} position
 */
export function evaluateBezier(t: number, curve: BezierCurve): { x: number; y: number } {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: mt3 * curve.start.x + 3 * mt2 * t * curve.cp1.x + 3 * mt * t2 * curve.cp2.x + t3 * curve.end.x,
        y: mt3 * curve.start.y + 3 * mt2 * t * curve.cp1.y + 3 * mt * t2 * curve.cp2.y + t3 * curve.end.y,
    };
}

/**
 * Compute a cubic Bezier SVG path from a port to an arbitrary cursor position (for drag preview)
 */
export function computePreviewPath(from: PortPosition, cursorX: number, cursorY: number): string {
    const distance = Math.hypot(cursorX - from.x, cursorY - from.y);
    const offset = Math.max(40, distance * 0.4);

    const cp1 = offsetFromEdge(from, offset);
    // For the cursor end, pull the control point back toward the source
    const cp2 = { x: cursorX - (cp1.x - from.x) * 0.3, y: cursorY - (cp1.y - from.y) * 0.3 };

    return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${cursorX} ${cursorY}`;
}
