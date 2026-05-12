import type { EdgeType } from "@civic-intel/core";
import * as d3 from "d3";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultTheme } from "../theme/dark";

export interface RadialNode {
  id: string;
  label: string;
  type: "person" | "organization" | "contract" | "donation" | "lobbying_filing";
}

export interface RadialEdge {
  source: string;
  target: string;
  type: EdgeType;
  weight?: number;
}

export interface NetworkRadialProps {
  centerNode: RadialNode;
  connections: RadialEdge[];
  nodes: RadialNode[];
  width?: number;
  height?: number;
  /** Click a connected node to re-center on it */
  onNodeClick?: (nodeId: string) => void;
}

const EDGE_COLORS: Record<string, string> = {
  awarded_to: defaultTheme.colors.gold,
  lobbied_by: defaultTheme.colors.red,
  donated_by: defaultTheme.colors.purple,
  disclosed_by: defaultTheme.colors.blue,
  employed_at: defaultTheme.colors.cyan,
  related_to: defaultTheme.colors.amber,
  communicated_with: defaultTheme.colors.red,
  filed_by: defaultTheme.colors.green,
};

const NODE_COLORS: Record<string, string> = {
  person: defaultTheme.colors.cyan,
  organization: defaultTheme.colors.gold,
  contract: defaultTheme.colors.green,
  donation: defaultTheme.colors.purple,
  lobbying_filing: defaultTheme.colors.red,
};

export function NetworkRadial({
  centerNode,
  connections,
  nodes,
  width = 600,
  height = 600,
  onNodeClick,
}: NetworkRadialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const cx = width / 2;
  const cy = height / 2;

  // Group connections by type into rings
  const { ringData, simulationNodes, simulationLinks } = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    nodeMap.set(centerNode.id, centerNode);

    // Group connections by edge type
    const typeGroups = new Map<string, RadialEdge[]>();
    for (const edge of connections) {
      const group = typeGroups.get(edge.type) ?? [];
      group.push(edge);
      typeGroups.set(edge.type, group);
    }

    const types = Array.from(typeGroups.keys());
    const ringRadius = Math.min(width, height) * 0.35;

    // Place nodes on rings by type
    const simNodes: Array<{
      id: string;
      label: string;
      type: string;
      ring: number;
      x: number;
      y: number;
    }> = [];

    // Center node
    simNodes.push({
      id: centerNode.id,
      label: centerNode.label,
      type: centerNode.type,
      ring: 0,
      x: cx,
      y: cy,
    });

    // Connected nodes
    for (let t = 0; t < types.length; t++) {
      const edges = typeGroups.get(types[t]) ?? [];
      const angleStep = (2 * Math.PI) / edges.length;

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const connectedId =
          edge.source === centerNode.id ? edge.target : edge.source;
        if (simNodes.find((n) => n.id === connectedId)) continue;

        const angle = t * ((2 * Math.PI) / types.length) + i * angleStep;
        const radius = ringRadius * (0.5 + (t % 2) * 0.3);
        const node = nodeMap.get(connectedId);

        simNodes.push({
          id: connectedId,
          label: node?.label ?? connectedId,
          type: node?.type ?? "organization",
          ring: t + 1,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      }
    }

    // Links
    const simLinks = connections.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }));

    return {
      ringData: types.map((t, i) => ({
        type: t,
        radius: ringRadius * (0.5 + (i % 2) * 0.3),
        count: typeGroups.get(t)?.length ?? 0,
      })),
      simulationNodes: simNodes,
      simulationLinks: simLinks,
    };
  }, [centerNode, connections, nodes, width, height, cx, cy]);

  const nodeMap = useMemo(
    () => new Map(simulationNodes.map((n) => [n.id, n])),
    [simulationNodes],
  );

  // Run force simulation
  const [positions, setPositions] = useState(simulationNodes);

  useEffect(() => {
    const sim = d3
      .forceSimulation(simulationNodes as never)
      .force(
        "link",
        d3
          .forceLink(simulationLinks as never)
          .id((d: unknown) => (d as { id: string }).id)
          .distance(120)
          .strength(0.3),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(cx, cy))
      .force("collision", d3.forceCollide().radius(24))
      .alphaDecay(0.03)
      .on("tick", () => {
        setPositions([...simulationNodes]);
      });

    return () => {
      sim.stop();
    };
  }, [simulationNodes, simulationLinks, cx, cy]);

  return (
    <motion.svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ fontFamily: defaultTheme.fonts.sans }}
    >
      <defs>
        <filter id="radial-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ring indicators */}
      {ringData.map((ring, i) => (
        <circle
          key={`ring-${i}`}
          cx={cx}
          cy={cy}
          r={ring.radius}
          fill="none"
          stroke={EDGE_COLORS[ring.type] ?? defaultTheme.colors.border}
          strokeWidth={0.5}
          strokeDasharray="4,4"
          opacity={0.3}
        />
      ))}

      {/* Edges */}
      {simulationLinks.map((link, i) => {
        const src =
          typeof link.source === "object"
            ? (link.source as { id: string }).id
            : link.source;
        const tgt =
          typeof link.target === "object"
            ? (link.target as { id: string }).id
            : link.target;
        const srcNode = nodeMap.get(src);
        const tgtNode = nodeMap.get(tgt);
        if (!srcNode || !tgtNode) return null;

        const color = EDGE_COLORS[link.type] ?? defaultTheme.colors.cyan;
        const isHighlighted = hovered === src || hovered === tgt;

        return (
          <motion.line
            key={`edge-${i}`}
            x1={srcNode.x}
            y1={srcNode.y}
            x2={tgtNode.x}
            y2={tgtNode.y}
            stroke={color}
            strokeWidth={isHighlighted ? 2 : 1}
            strokeOpacity={isHighlighted ? 0.8 : 0.25}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: i * 0.02 }}
          />
        );
      })}

      {/* Nodes */}
      {positions.map((node) => {
        const isCenter = node.id === centerNode.id;
        const color = isCenter
          ? defaultTheme.colors.gold
          : (NODE_COLORS[node.type] ?? defaultTheme.colors.cyan);
        const radius = isCenter ? 16 : 8;

        return (
          <g
            key={node.id}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onNodeClick?.(node.id)}
            style={{ cursor: isCenter ? "default" : "pointer" }}
          >
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: node.ring * 0.1 }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              filter={
                isCenter || hovered === node.id
                  ? "url(#radial-glow)"
                  : undefined
              }
            />
            <text
              x={node.x}
              y={node.y + radius + 14}
              textAnchor="middle"
              fill={defaultTheme.colors.textSecondary}
              fontSize={9}
              fontWeight={isCenter ? 600 : 400}
            >
              {node.label.length > 18
                ? `${node.label.slice(0, 16)}…`
                : node.label}
            </text>
          </g>
        );
      })}
    </motion.svg>
  );
}
