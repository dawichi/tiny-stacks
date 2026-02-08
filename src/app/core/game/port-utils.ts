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
