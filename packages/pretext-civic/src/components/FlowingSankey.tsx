import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultTheme } from "../theme/dark";

export interface SankeyNode {
  id: string;
  label: string;
  color?: string;
  category?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface FlowingSankeyProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  width: number;
  height: number;
  onFlowClick?: (nodeId: string) => void;
  onFlowHover?: (nodeId: string | null) => void;
}

const DEPARTMENT_COLORS: Record<string, string> = {
  Treasury: defaultTheme.colors.gold,
  Defence: defaultTheme.colors.red,
  Health: defaultTheme.colors.green,
  Innovation: defaultTheme.colors.cyan,
  Infrastructure: defaultTheme.colors.blue,
  Foreign: defaultTheme.colors.purple,
};

interface ComputedNode {
  id: string;
  label: string;
  color: string;
  category?: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface ComputedLink {
  source: string;
  target: string;
  value: number;
  width: number;
  path: string | null;
}

export function FlowingSankey({
  nodes,
  links,
  width,
  height,
  onFlowClick,
  onFlowHover,
}: FlowingSankeyProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { computedNodes, computedLinks } = useMemo(() => {
    const graphNodes = nodes.map((n) => ({ ...n }));
    const graphLinks = links
      .filter(
        (l) =>
          nodes.some((n) => n.id === l.source) &&
          nodes.some((n) => n.id === l.target),
      )
      .map((l) => ({ ...l }));

    // Use d3-sankey with its internal types, extracting what we need
    interface SankeyInternalNode {
      id: string;
      label?: string;
      color?: string;
      category?: string;
      x0: number;
      x1: number;
      y0: number;
      y1: number;
    }
    interface SankeyInternalLink {
      source: SankeyInternalNode | string;
      target: SankeyInternalNode | string;
      value: number;
      width: number;
    }

    const sankeyGen = d3Sankey<SankeyInternalNode, SankeyInternalLink>()
      .nodeId((d) => d.id)
      .nodeWidth(18)
      .nodePadding(14)
      .extent([
        [24, 24],
        [width - 24, height - 24],
      ]);

    const graph = sankeyGen({
      nodes: graphNodes.map((d) => ({ ...d }) as unknown as SankeyInternalNode),
      links: graphLinks.map((d) => ({ ...d }) as unknown as SankeyInternalLink),
    });

    const cNodes: ComputedNode[] = graph.nodes.map((n) => ({
      id: n.id as string,
      label: (n as unknown as SankeyNode).label ?? n.id,
      color:
        (n as unknown as SankeyNode).color ??
        DEPARTMENT_COLORS[(n as unknown as SankeyNode).category ?? ""] ??
        defaultTheme.colors.cyan,
      category: (n as unknown as SankeyNode).category,
      x0: n.x0 ?? 0,
      x1: n.x1 ?? 0,
      y0: n.y0 ?? 0,
      y1: n.y1 ?? 0,
    }));

    const cLinks: ComputedLink[] = graph.links.map((l) => ({
      source:
        typeof l.source === "object"
          ? (l.source as { id: string }).id
          : String(l.source),
      target:
        typeof l.target === "object"
          ? (l.target as { id: string }).id
          : String(l.target),
      value: l.value,
      width: l.width ?? 1,
      path: sankeyLinkHorizontal()(l as never),
    }));

    return { computedNodes: cNodes, computedLinks: cLinks };
  }, [nodes, links, width, height]);

  const isHighlighted = useCallback(
    (link: ComputedLink) => {
      if (!hoveredNode) return true;
      return link.source === hoveredNode || link.target === hoveredNode;
    },
    [hoveredNode],
  );

  return (
    <motion.svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{ fontFamily: defaultTheme.fonts.sans }}
    >
      <defs>
        {computedLinks.map((link, i) => {
          const sourceNode = computedNodes.find((n) => n.id === link.source);
          const color = sourceNode?.color ?? defaultTheme.colors.cyan;
          const highlighted = isHighlighted(link);

          return (
            <linearGradient
              key={`grad-${i}`}
              id={`link-grad-${i}`}
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset="0%"
                stopColor={color}
                stopOpacity={highlighted ? 0.5 : 0.15}
              />
              <stop
                offset="100%"
                stopColor={color}
                stopOpacity={highlighted ? 0.3 : 0.08}
              />
            </linearGradient>
          );
        })}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Links */}
      {computedLinks.map((link, i) => {
        const highlighted = isHighlighted(link);

        return (
          <motion.path
            key={`link-${i}`}
            d={link.path ?? ""}
            fill="none"
            stroke={`url(#link-grad-${i})`}
            strokeWidth={Math.max(1, link.width)}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: highlighted ? 1 : 0.25 }}
            transition={{ duration: 0.8, delay: i * 0.02 }}
            onClick={() => onFlowClick?.(link.source)}
            style={{ cursor: "pointer" }}
          />
        );
      })}

      {/* Nodes */}
      {computedNodes.map((node, i) => {
        const nodeHeight = node.y1 - node.y0;
        const nodeWidth = node.x1 - node.x0;
        const isHovered = hoveredNode === node.id;

        return (
          <g
            key={`node-${i}`}
            onMouseEnter={() => {
              setHoveredNode(node.id);
              onFlowHover?.(node.id);
            }}
            onMouseLeave={() => {
              setHoveredNode(null);
              onFlowHover?.(null);
            }}
            onClick={() => onFlowClick?.(node.id)}
            style={{ cursor: "pointer" }}
          >
            <motion.rect
              x={node.x0}
              y={node.y0}
              width={nodeWidth}
              height={Math.max(nodeHeight, 2)}
              rx={3}
              fill={node.color}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
              style={{
                transformOrigin: `${node.x0 + nodeWidth / 2}px ${node.y0 + nodeHeight / 2}px`,
              }}
              filter={isHovered ? "url(#glow)" : undefined}
            />
            <text
              x={node.x0 < width / 2 ? node.x1 + 6 : node.x0 - 6}
              y={node.y0 + nodeHeight / 2}
              dy="0.35em"
              textAnchor={node.x0 < width / 2 ? "start" : "end"}
              fill={defaultTheme.colors.textSecondary}
              fontSize={11}
              fontWeight={500}
            >
              {node.label.length > 28
                ? `${node.label.slice(0, 26)}…`
                : node.label}
            </text>
          </g>
        );
      })}
    </motion.svg>
  );
}
