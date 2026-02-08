import { Component, computed, input } from "@angular/core";
import { Database, Globe, LucideAngularModule, Mail, Server, Split, Zap } from "lucide-angular";
import { PlacedService } from "../../core/game/game-state.service";
import { getServiceConfig } from "../../core/game/service-types.config";

@Component({
    selector: "app-service",
    standalone: true,
    imports: [LucideAngularModule],
    template: `
    <div
      class="service absolute rounded-lg flex flex-col items-center justify-center cursor-pointer
             transition-all duration-150 hover:scale-[1.02] hover:shadow-lg"
      [class.ring-2]="isSelected()"
      [class.ring-blue-500]="isSelected()"
      [class.ring-offset-2]="isSelected()"
      [style.left.px]="positionX()"
      [style.top.px]="positionY()"
      [style.width.px]="width()"
      [style.height.px]="height()"
      [style.background-color]="config().color"
    >
      <!-- Icon -->
      <lucide-icon
        [img]="iconComponent()"
        [size]="iconSize()"
        class="text-white/90 drop-shadow-sm"
      />

      <!-- Service name -->
      <span
        class="text-[10px] font-medium text-white/80 mt-1 text-center leading-tight px-1"
        [class.hidden]="height() < 60"
      >
        {{ config().name }}
      </span>

      <!-- Ports indicator dots -->
      @for (port of config().ports; track $index) {
        <div
          class="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm"
          [style.background-color]="portColor(port.direction)"
          [style.left.px]="portX(port)"
          [style.top.px]="portY(port)"
        ></div>
      }
    </div>
  `,
    styles: [
        `
    .service {
      box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.1),
        0 2px 4px -2px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
  `,
    ],
})
export class ServiceComponent {
    readonly service = input.required<PlacedService>();
    readonly cellSize = input.required<number>();
    readonly isSelected = input<boolean>(false);

    // Icon mapping
    private readonly icons = {
        globe: Globe,
        server: Server,
        database: Database,
        zap: Zap,
        mail: Mail,
        split: Split,
    };

    protected readonly config = computed(() => getServiceConfig(this.service().type));

    protected readonly positionX = computed(() => this.service().gridX * this.cellSize());
    protected readonly positionY = computed(() => this.service().gridY * this.cellSize());

    protected readonly width = computed(() => this.config().gridWidth * this.cellSize());
    protected readonly height = computed(() => this.config().gridHeight * this.cellSize());

    protected readonly iconSize = computed(() => Math.min(this.width(), this.height()) * 0.4);

    protected readonly iconComponent = computed(() => {
        const iconName = this.config().icon as keyof typeof this.icons;
        return this.icons[iconName] || Globe;
    });

    protected portColor(direction: string): string {
        switch (direction) {
            case "input":
                return "#22c55e"; // green-500
            case "output":
                return "#3b82f6"; // blue-500
            case "bidirectional":
                return "#f97316"; // orange-500
            default:
                return "#9ca3af"; // gray-400
        }
    }

    protected portX(port: { cellOffsetX: number; edge: string }): number {
        const cellSize = this.cellSize();
        const baseX = port.cellOffsetX * cellSize;

        switch (port.edge) {
            case "west":
                return -6; // Half of port width, positioned at left edge
            case "east":
                return this.width() - 6;
            default:
                return baseX + cellSize / 2 - 6;
        }
    }

    protected portY(port: { cellOffsetY: number; edge: string }): number {
        const cellSize = this.cellSize();
        const baseY = port.cellOffsetY * cellSize;

        switch (port.edge) {
            case "north":
                return -6;
            case "south":
                return this.height() - 6;
            default:
                return baseY + cellSize / 2 - 6;
        }
    }
}
