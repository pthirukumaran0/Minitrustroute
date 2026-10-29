'use client';

import React, { useState } from 'react';
import { ProviderNode, ProviderEdge } from '@/src/types/frontend';
import { ShieldCheck, ArrowRight, Zap, Info } from 'lucide-react';

interface RouteGraphVisualizerProps {
  nodes: ProviderNode[];
  edges: ProviderEdge[];
  selectedHops?: string[];
  highlightRouteName?: string;
  className?: string;
  onSelectNode?: (nodeId: string) => void;
}

export function RouteGraphVisualizer({
  nodes,
  edges,
  selectedHops = [],
  highlightRouteName,
  className = '',
  onSelectNode,
}: RouteGraphVisualizerProps) {
  const [hoveredNode, setHoveredNode] = useState<ProviderNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<ProviderEdge | null>(null);

  // Deterministic 2D coordinates for known nodes (with fallback layout for dynamic ones)
  const layoutCoordinates: Record<string, { x: number; y: number }> = {
    'Gateway-US': { x: 70, y: 160 },
    'Bank-JPMorgan': { x: 260, y: 90 },
    'Swift-Direct': { x: 260, y: 230 },
    'Corridor-MiddleEast': { x: 470, y: 130 },
    'Clearing-India-NEFT': { x: 470, y: 260 },
    'Bank-Dubai-Commercial': { x: 670, y: 90 },
    'Bank-SBI-Mumbai': { x: 670, y: 260 },
    'Bank-Barclays-London': { x: 670, y: 20 },
    'Bank-Isolated-Pacific': { x: 670, y: 340 },
  };

  const getNodePos = (node: ProviderNode, index: number) => {
    if (layoutCoordinates[node.id]) {
      return layoutCoordinates[node.id];
    }
    // Fallback circular layout for any extra nodes
    const col = node.type === 'GATEWAY' ? 80 : node.type === 'DESTINATION_BANK' ? 660 : 360;
    const row = 60 + (index % 6) * 55;
    return { x: col, y: row };
  };

  // Helper to check if an edge is in the selected route
  const isEdgeInRoute = (src: string, tgt: string) => {
    if (selectedHops.length < 2) return false;
    for (let i = 0; i < selectedHops.length - 1; i++) {
      if (selectedHops[i] === src && selectedHops[i + 1] === tgt) {
        return true;
      }
    }
    return false;
  };

  const isNodeInRoute = (id: string) => selectedHops.includes(id);

  return (
    <div className={`relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden ${className}`}>
      {/* Top Banner / Route Title */}
      <div className="absolute top-3 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-700/60 pointer-events-auto">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-200">
            {highlightRouteName || (selectedHops.length > 0 ? `Active Path: ${selectedHops.join(' ➔ ')}` : 'Live Neo4j Payment Topology')}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400 bg-slate-800/80 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-700/60 pointer-events-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Selected Path
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            Active Rail
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            Prohibited
          </span>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <svg viewBox="0 0 760 380" className="w-full h-auto select-none">
        <defs>
          {/* Arrow marker for standard rail */}
          <marker id="arrow-active" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3B82F6" />
          </marker>
          {/* Arrow marker for highlighted route */}
          <marker id="arrow-highlight" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#10B981" />
          </marker>
          {/* Arrow marker for prohibited rail */}
          <marker id="arrow-prohibited" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EF4444" />
          </marker>
          {/* Subtle node glow */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Render Connections (Edges) */}
        {edges.map((edge) => {
          const srcNode = nodes.find((n) => n.id === edge.source);
          const tgtNode = nodes.find((n) => n.id === edge.target);
          if (!srcNode || !tgtNode) return null;

          const srcPos = getNodePos(srcNode, 0);
          const tgtPos = getNodePos(tgtNode, 0);

          const inRoute = isEdgeInRoute(edge.source, edge.target);
          const isProhibited = edge.prohibited || !edge.isAvailable || edge.status !== 'ACTIVE';

          let strokeColor = '#334155'; // default slate-700
          let strokeWidth = 2;
          let markerEnd = 'url(#arrow-active)';
          let strokeDash = undefined;

          if (inRoute) {
            strokeColor = '#10B981'; // vibrant emerald
            strokeWidth = 3.5;
            markerEnd = 'url(#arrow-highlight)';
          } else if (isProhibited) {
            strokeColor = '#EF4444'; // rose
            strokeWidth = 1.5;
            strokeDash = '4,4';
            markerEnd = 'url(#arrow-prohibited)';
          } else {
            strokeColor = '#3B82F6';
            strokeWidth = 1.8;
          }

          // Compute midpoint for cost/latency badge
          const midX = (srcPos.x + tgtPos.x) / 2;
          const midY = (srcPos.y + tgtPos.y) / 2 - 6;

          return (
            <g
              key={`${edge.source}-${edge.target}`}
              className="cursor-pointer group"
              onMouseEnter={() => setHoveredEdge(edge)}
              onMouseLeave={() => setHoveredEdge(null)}
            >
              {/* Invisible thicker path for easier hovering */}
              <line
                x1={srcPos.x}
                y1={srcPos.y}
                x2={tgtPos.x}
                y2={tgtPos.y}
                stroke="transparent"
                strokeWidth={16}
              />
              {/* Visible edge line */}
              <line
                x1={srcPos.x}
                y1={srcPos.y}
                x2={tgtPos.x}
                y2={tgtPos.y}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDash}
                markerEnd={markerEnd}
                className="transition-all duration-200"
              />
              {/* Cost badge at midpoint */}
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x="-22"
                  y="-9"
                  width="44"
                  height="16"
                  rx="4"
                  fill="#0F172A"
                  stroke={inRoute ? '#10B981' : isProhibited ? '#EF4444' : '#334155'}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill={inRoute ? '#A7F3D0' : isProhibited ? '#FCA5A5' : '#94A3B8'}
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  ${edge.baseCost.toFixed(1)}
                </text>
              </g>
            </g>
          );
        })}

        {/* 2. Render Provider Nodes */}
        {nodes.map((node, i) => {
          const pos = getNodePos(node, i);
          const inRoute = isNodeInRoute(node.id);
          const isOrigin = selectedHops.length > 0 && selectedHops[0] === node.id;
          const isDestination = selectedHops.length > 0 && selectedHops[selectedHops.length - 1] === node.id;

          let circleFill = '#1E293B';
          let circleStroke = '#475569';
          let radius = 16;

          if (isOrigin) {
            circleFill = '#065F46';
            circleStroke = '#10B981';
            radius = 18;
          } else if (isDestination) {
            circleFill = '#047857';
            circleStroke = '#34D399';
            radius = 18;
          } else if (inRoute) {
            circleFill = '#064E3B';
            circleStroke = '#10B981';
            radius = 17;
          } else if (node.type === 'GATEWAY') {
            circleFill = '#1E3A8A';
            circleStroke = '#3B82F6';
          } else if (node.type === 'DESTINATION_BANK') {
            circleFill = '#312E81';
            circleStroke = '#818CF8';
          }

          return (
            <g
              key={node.id}
              className="cursor-pointer group"
              onClick={() => onSelectNode && onSelectNode(node.id)}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              transform={`translate(${pos.x}, ${pos.y})`}
            >
              {/* Outer halo if in route */}
              {inRoute && (
                <circle
                  r={radius + 6}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                  opacity="0.4"
                  className="animate-pulse"
                />
              )}
              {/* Main Node Circle */}
              <circle
                r={radius}
                fill={circleFill}
                stroke={circleStroke}
                strokeWidth={inRoute ? 2.5 : 1.5}
                filter={inRoute ? 'url(#glow)' : undefined}
                className="transition-all duration-200 group-hover:scale-110"
              />
              {/* Node Icon / Country Code */}
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="9"
                fontWeight="bold"
                fontFamily="sans-serif"
                pointerEvents="none"
              >
                {node.country || node.id.slice(0, 3)}
              </text>
              {/* Node Label Below */}
              <text
                x="0"
                y={radius + 13}
                textAnchor="middle"
                fill={inRoute ? '#A7F3D0' : '#E2E8F0'}
                fontSize="9.5"
                fontWeight={inRoute ? 'bold' : '500'}
                className="pointer-events-none drop-shadow-xs"
              >
                {node.name.length > 20 ? node.name.slice(0, 18) + '...' : node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Details Box */}
      {hoveredNode && (
        <div className="absolute bottom-3 left-3 bg-slate-800/95 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs text-slate-200 z-20 max-w-xs backdrop-blur-xs">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {hoveredNode.name}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-300">
            <span>ID: <strong className="font-mono text-slate-100">{hoveredNode.id}</strong></span>
            <span>Type: <strong>{hoveredNode.type}</strong></span>
            <span>Country: <strong>{hoveredNode.country}</strong></span>
            <span>Currency: <strong>{hoveredNode.currency}</strong></span>
            <span>Status: <strong className="text-emerald-400">{hoveredNode.status}</strong></span>
          </div>
        </div>
      )}

      {hoveredEdge && (
        <div className="absolute bottom-3 right-3 bg-slate-800/95 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs text-slate-200 z-20 max-w-xs backdrop-blur-xs">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hoveredEdge.prohibited ? 'bg-rose-400' : 'bg-blue-400'}`} />
            {hoveredEdge.source} ➔ {hoveredEdge.target}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-300">
            <span>Base Fee: <strong className="text-white">${hoveredEdge.baseCost.toFixed(2)}</strong></span>
            <span>Latency: <strong>{hoveredEdge.latencyMs} ms</strong></span>
            <span>Reliability: <strong>{(hoveredEdge.reliability * 100).toFixed(1)}%</strong></span>
            <span>State: <strong className={hoveredEdge.prohibited ? 'text-rose-400' : 'text-emerald-400'}>
              {hoveredEdge.prohibited ? 'PROHIBITED' : 'ACTIVE'}
            </strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

